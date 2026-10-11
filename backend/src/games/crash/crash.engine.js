import crypto from 'node:crypto'
import { provablyFairCore } from '../core/ProvablyFairCore.js'
import { bankrollRisk } from '../../services/BankrollRiskService.js'

/**
 * Crash / Rocket Flight Engine (Server-Authoritative)
 * 99% Player Return (1% instant bust house edge)
 */
export class CrashEngine {
    constructor() {
        this.activeCrashRounds = new Map() // roundId -> session
    }

    evaluate({ claimedMultiplier, clientSeed, nonce, autoCashout = null }) {
        const { hash, floatVal } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        // 1% instant bust (RTP = 99%)
        let crashPoint = 1.00
        if (floatVal >= 0.01) {
            crashPoint = Math.floor((99 / (1 - floatVal))) / 100
        }
        crashPoint = Math.max(1.00, Math.min(crashPoint, 1000.0))

        const requestedMultiplier = parseFloat(autoCashout || claimedMultiplier || 0)
        const won = requestedMultiplier > 1.0 && requestedMultiplier <= crashPoint
        const actualMultiplier = won ? parseFloat(requestedMultiplier.toFixed(2)) : 0

        return {
            crashPoint,
            won,
            multiplier: actualMultiplier,
            hash
        }
    }

    startRound({ userId, currency = 'INR', betAmount, autoCashout = null, clientSeed }) {
        const riskCheck = bankrollRisk.validateBetRisk({
            betAmount,
            targetMultiplier: autoCashout || 1.0,
            currency,
            game: 'crash'
        })
        if (!riskCheck.valid) {
            throw new Error(riskCheck.error)
        }
        const nonce = provablyFairCore.getNextNonce(userId)
        const { hash, floatVal } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        let crashPoint = 1.00
        if (floatVal >= 0.01) {
            crashPoint = Math.floor((99 / (1 - floatVal))) / 100
        }
        crashPoint = Math.max(1.00, Math.min(crashPoint, 1000.0))

        const roundId = 'crash_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex')
        const session = {
            roundId,
            userId,
            currency,
            betAmount: parseFloat(betAmount),
            crashPoint,
            autoCashout: autoCashout ? parseFloat(autoCashout) : null,
            hash,
            startedAt: Date.now(),
            active: true
        }

        this.activeCrashRounds.set(roundId, session)

        return {
            roundId,
            crashPoint,
            hash,
            autoCashout: session.autoCashout,
            active: true
        }
    }

    cashout({ userId, roundId, multiplier }) {
        const session = this.activeCrashRounds.get(roundId)
        if (!session) throw new Error('Active Crash round not found or already closed')
        if (session.userId !== userId) throw new Error('Unauthorized round access')
        if (!session.active) throw new Error('Round is already closed')

        const requestedMultiplier = Math.max(1.01, parseFloat(multiplier) || 1.01)
        session.active = false
        this.activeCrashRounds.delete(roundId)

        const won = requestedMultiplier <= session.crashPoint
        const actualMultiplier = won ? parseFloat(requestedMultiplier.toFixed(2)) : 0
        const rawPayout = won ? parseFloat((session.betAmount * actualMultiplier).toFixed(2)) : 0

        const capped = won ? bankrollRisk.enforceWinCap({
            betAmount: session.betAmount,
            multiplier: actualMultiplier,
            rawPayout,
            currency: session.currency
        }) : { payout: 0, multiplier: 0, wasCapped: false }

        return {
            roundId,
            won,
            currency: session.currency,
            betAmount: session.betAmount,
            multiplier: capped.multiplier,
            payout: capped.payout,
            wasCapped: capped.wasCapped,
            crashPoint: session.crashPoint,
            hash: session.hash
        }
    }

    bust({ userId, roundId }) {
        const session = this.activeCrashRounds.get(roundId)
        if (!session) return { alreadyClosed: true }
        if (session.userId !== userId) throw new Error('Unauthorized round access')

        session.active = false
        this.activeCrashRounds.delete(roundId)

        return {
            roundId,
            won: false,
            currency: session.currency,
            betAmount: session.betAmount,
            multiplier: 0,
            payout: 0,
            crashPoint: session.crashPoint,
            hash: session.hash
        }
    }

    getActiveRound(userId) {
        if (!userId) return null
        for (const session of this.activeCrashRounds.values()) {
            if (session.userId === userId && session.active) {
                return {
                    roundId: session.roundId,
                    betAmount: session.betAmount,
                    currency: session.currency,
                    crashPoint: session.crashPoint,
                    autoCashout: session.autoCashout,
                    startedAt: session.startedAt,
                    active: true
                }
            }
        }
        return null
    }
}

export const crashEngine = new CrashEngine()
export default crashEngine
