// =============================================================================
// 👑 AmratGames.com — Bankroll Risk & Dynamic Liquidity Win Cap Service
// Pillar 2: Asymmetric Risk Engine & Gambler's Ruin Liquidity Protection
// =============================================================================

import { CONFIG } from '../config.js'

export class BankrollRiskService {
    constructor() {
        // Default profit caps per currency per round (can scale with bankroll)
        this.baseProfitCaps = {
            INR: 100000.00,  // ₹1 Lakh max win profit per single round
            USDT: 1200.00,   // $1,200 USDT max profit
            BTC: 0.0150,     // 0.015 BTC max profit
            AMRAT: 10000.00  // 10,000 AMRAT max profit
        }

        // Hard maximum allowable bet per single round
        this.maxBets = {
            INR: 50000.00,
            USDT: 600.00,
            BTC: 0.0080,
            AMRAT: 5000.00
        }

        // Minimum allowable bet per single round
        this.minBets = {
            INR: 10.00,
            USDT: 0.10,
            BTC: 0.00001,
            AMRAT: 1.00
        }

        // Maximum multiplier ceiling across all games
        this.absoluteMaxMultiplier = 1000.00
    }

    /**
     * Get the effective max win profit cap for a currency
     */
    getMaxProfitCap(currency = 'INR') {
        const curr = String(currency).toUpperCase()
        return this.baseProfitCaps[curr] || this.baseProfitCaps.INR
    }

    /**
     * Get maximum bet for a currency
     */
    getMaxBet(currency = 'INR') {
        const curr = String(currency).toUpperCase()
        return this.maxBets[curr] || this.maxBets.INR
    }

    /**
     * Get minimum bet for a currency
     */
    getMinBet(currency = 'INR') {
        const curr = String(currency).toUpperCase()
        return this.minBets[curr] || this.minBets.INR
    }

    /**
     * Validate bet amount and scale according to target multiplier
     * @returns {{ valid: boolean, error?: string, maxAllowedBet: number, maxProfitCap: number }}
     */
    validateBetRisk({ betAmount, targetMultiplier = 1.0, currency = 'INR', game = 'general' }) {
        const parsedBet = parseFloat(betAmount)
        const parsedTarget = Math.max(1.0, parseFloat(targetMultiplier) || 1.0)
        const curr = String(currency).toUpperCase()

        const minBet = this.getMinBet(curr)
        const maxBet = this.getMaxBet(curr)
        const maxProfitCap = this.getMaxProfitCap(curr)

        if (isNaN(parsedBet) || parsedBet < minBet) {
            return {
                valid: false,
                error: `Minimum bet for ${curr} is ${minBet}`,
                maxAllowedBet: maxBet,
                maxProfitCap
            }
        }

        if (parsedBet > maxBet) {
            return {
                valid: false,
                error: `Maximum bet limit is ${curr} ${maxBet.toLocaleString()} per round`,
                maxAllowedBet: maxBet,
                maxProfitCap
            }
        }

        // If player targets a specific multiplier (e.g. Limbo, auto-cashout):
        // Enforce: betAmount * (targetMultiplier - 1) <= maxProfitCap
        if (parsedTarget > 1.0) {
            const potentialProfit = parsedBet * (parsedTarget - 1)
            if (potentialProfit > maxProfitCap) {
                const maxAllowedForMult = Math.max(minBet, Math.floor(maxProfitCap / (parsedTarget - 1)))
                return {
                    valid: false,
                    error: `Maximum win profit is capped at ${curr} ${maxProfitCap.toLocaleString()}. For a ${parsedTarget}x multiplier, maximum allowable bet is ${curr} ${maxAllowedForMult.toLocaleString()}`,
                    maxAllowedBet: maxAllowedForMult,
                    maxProfitCap
                }
            }
        }

        return {
            valid: true,
            maxAllowedBet: maxBet,
            maxProfitCap
        }
    }

    /**
     * Enforce max win cap on game payouts
     * Guarantees platform can NEVER owe more than the bankroll ceiling on a single round
     */
    enforceWinCap({ betAmount, multiplier, rawPayout, currency = 'INR' }) {
        const curr = String(currency).toUpperCase()
        const maxProfitCap = this.getMaxProfitCap(curr)
        const stake = Math.max(0, parseFloat(betAmount) || 0)
        const payout = Math.max(0, parseFloat(rawPayout) || 0)

        const rawProfit = Math.max(0, payout - stake)

        if (rawProfit > maxProfitCap) {
            const cappedPayout = parseFloat((stake + maxProfitCap).toFixed(2))
            const effectiveMultiplier = parseFloat((cappedPayout / (stake || 1)).toFixed(2))

            return {
                payout: cappedPayout,
                profit: maxProfitCap,
                multiplier: effectiveMultiplier,
                wasCapped: true,
                maxProfitCap,
                rawPayout
            }
        }

        return {
            payout,
            profit: parseFloat(rawProfit.toFixed(2)),
            multiplier: parseFloat((parseFloat(multiplier) || (payout / (stake || 1))).toFixed(2)),
            wasCapped: false,
            maxProfitCap,
            rawPayout
        }
    }
}

export const bankrollRisk = new BankrollRiskService()
export default bankrollRisk
