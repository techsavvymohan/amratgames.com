// =============================================================================
// 👑 AmratGames.com — "Be the House" Liquidity Staking Vault Service
// Pillar 5: Community Bankroll Liquidity, Pro-Rata House Edge Yield & Staking
// =============================================================================

import crypto from 'node:crypto'
import { db } from '../db/db.js'

export class HouseVaultService {
    constructor() {
        this.minStakeINR = 100.00   // ₹100 minimum vault stake
        this.minClaimINR = 1.00     // ₹1 minimum dividend claim
        this.baseApy = 18.5         // 18.5% baseline annualized platform APY
    }

    ensureVaultStorage() {
        if (!db?.data) return null
        if (!db.data.vault) {
            db.data.vault = {
                totalStakedINR: 0.00,
                totalDividendsDistributedINR: 0.00,
                rollingVolume7d: 500000.00, // Seed volume for dynamic APY modeling
                stakers: {}, // userId -> { stakedINR: number, unclaimedDividendsINR: number, totalClaimedINR: number, stakedAt: string }
                history: []
            }
        }
        if (!db.data.vault.stakers) {
            db.data.vault.stakers = {}
        }
        if (!db.data.vault.history) {
            db.data.vault.history = []
        }
        return db.data.vault
    }

    /**
     * Get aggregate vault metrics and user-specific staking position
     */
    getOverview(userId = null) {
        this.ensureVaultStorage()
        const vault = db.data.vault || { totalStakedINR: 0, totalDividendsDistributedINR: 0, stakers: {} }
        const totalStaked = parseFloat((vault.totalStakedINR || 0).toFixed(2))
        const activeStakersCount = Object.keys(vault.stakers || {}).filter(
            (k) => (vault.stakers[k]?.stakedINR || 0) > 0
        ).length

        // Calculate dynamic APY: (Annualized house edge dividend / total staked)
        // Statistical 1% house edge * 15% revenue share to vault * 365 days
        let dynamicApy = this.baseApy
        if (totalStaked > 0) {
            const annualYieldEstimate = (vault.rollingVolume7d / 7) * 365 * 0.01 * 0.15
            const calculatedApy = parseFloat(((annualYieldEstimate / Math.max(totalStaked, 10000)) * 100).toFixed(1))
            dynamicApy = Math.max(14.5, Math.min(38.0, calculatedApy))
        }

        let userPosition = null
        if (userId) {
            const staker = vault.stakers[userId] || {
                stakedINR: 0,
                unclaimedDividendsINR: 0,
                totalClaimedINR: 0,
                stakedAt: null
            }
            const userStaked = parseFloat((staker.stakedINR || 0).toFixed(2))
            const poolSharePct = totalStaked > 0 ? parseFloat(((userStaked / totalStaked) * 100).toFixed(2)) : 0

            userPosition = {
                stakedINR: userStaked,
                poolSharePct,
                unclaimedDividendsINR: parseFloat((staker.unclaimedDividendsINR || 0).toFixed(4)),
                totalClaimedINR: parseFloat((staker.totalClaimedINR || 0).toFixed(2)),
                stakedAt: staker.stakedAt,
                canClaim: (staker.unclaimedDividendsINR || 0) >= this.minClaimINR
            }
        }

        return {
            totalStakedINR: totalStaked,
            totalDividendsDistributedINR: parseFloat((vault.totalDividendsDistributedINR || 0).toFixed(2)),
            activeStakersCount,
            dynamicApy,
            minStakeINR: this.minStakeINR,
            minClaimINR: this.minClaimINR,
            userPosition
        }
    }

    /**
     * Stake INR into the House Vault (Atomically backed by user lock)
     */
    async stake({ userId, amount }) {
        const parsedAmount = parseFloat(amount)
        if (isNaN(parsedAmount) || parsedAmount < this.minStakeINR) {
            const err = new Error(`Minimum vault deposit is ₹${this.minStakeINR.toLocaleString('en-IN')}`)
            err.status = 400
            throw err
        }

        return db.withUserLock(userId, async () => {
            const user = db.findUserById(userId)
            if (!user) {
                const err = new Error('User not found')
                err.status = 404
                throw err
            }

            const currentBal = user.balances?.INR || 0
            if (currentBal < parsedAmount) {
                const err = new Error(
                    `Insufficient INR balance to stake (Available: ₹${currentBal.toLocaleString('en-IN')})`
                )
                err.status = 400
                throw err
            }

            // Deduct from wallet balance
            db.updateUserBalance(userId, 'INR', -parsedAmount, `🏛️ Amrat House Vault Staking (₹${parsedAmount})`)

            this.ensureVaultStorage()
            const vault = db.data.vault
            if (!vault.stakers[userId]) {
                vault.stakers[userId] = {
                    stakedINR: 0,
                    unclaimedDividendsINR: 0,
                    totalClaimedINR: 0,
                    stakedAt: new Date().toISOString()
                }
            }

            const staker = vault.stakers[userId]
            staker.stakedINR = parseFloat(((staker.stakedINR || 0) + parsedAmount).toFixed(2))
            staker.stakedAt = staker.stakedAt || new Date().toISOString()
            vault.totalStakedINR = parseFloat(((vault.totalStakedINR || 0) + parsedAmount).toFixed(2))

            // Record vault history
            vault.history.unshift({
                id: 'vh_' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex'),
                userId,
                username: user.username,
                type: 'stake',
                amount: parsedAmount,
                timestamp: new Date().toISOString()
            })
            if (vault.history.length > 200) {
                vault.history = vault.history.slice(0, 200)
            }

            db.persist()

            return {
                success: true,
                message: `Successfully staked ₹${parsedAmount.toLocaleString('en-IN')} into the Amrat House Vault!`,
                stakedAmount: parsedAmount,
                totalUserStaked: staker.stakedINR,
                totalVaultStaked: vault.totalStakedINR,
                balances: user.balances
            }
        })
    }

    /**
     * Unstake capital from the House Vault and credit back to user wallet
     */
    async unstake({ userId, amount }) {
        const parsedAmount = parseFloat(amount)
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            const err = new Error('Invalid unstake amount')
            err.status = 400
            throw err
        }

        return db.withUserLock(userId, async () => {
            const user = db.findUserById(userId)
            if (!user) {
                const err = new Error('User not found')
                err.status = 404
                throw err
            }

            this.ensureVaultStorage()
            const vault = db.data.vault
            const staker = vault.stakers?.[userId]
            const currentStaked = staker?.stakedINR || 0

            if (parsedAmount > currentStaked) {
                const err = new Error(
                    `Cannot unstake more than your active deposit (Staked: ₹${currentStaked.toLocaleString('en-IN')})`
                )
                err.status = 400
                throw err
            }

            staker.stakedINR = parseFloat((currentStaked - parsedAmount).toFixed(2))
            vault.totalStakedINR = Math.max(0, parseFloat((vault.totalStakedINR - parsedAmount).toFixed(2)))

            // Credit principal back to user wallet
            db.updateUserBalance(userId, 'INR', parsedAmount, `🏛️ Amrat House Vault Principal Return (₹${parsedAmount})`)

            vault.history.unshift({
                id: 'vh_' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex'),
                userId,
                username: user.username,
                type: 'unstake',
                amount: parsedAmount,
                timestamp: new Date().toISOString()
            })
            if (vault.history.length > 200) {
                vault.history = vault.history.slice(0, 200)
            }

            db.persist()

            return {
                success: true,
                message: `Successfully unstaked ₹${parsedAmount.toLocaleString('en-IN')} to your wallet.`,
                unstakedAmount: parsedAmount,
                remainingStaked: staker.stakedINR,
                balances: user.balances
            }
        })
    }

    /**
     * Claim accrued dividend yield directly into user wallet
     */
    async claimDividends({ userId }) {
        return db.withUserLock(userId, async () => {
            const user = db.findUserById(userId)
            if (!user) {
                const err = new Error('User not found')
                err.status = 404
                throw err
            }

            this.ensureVaultStorage()
            const vault = db.data.vault
            const staker = vault.stakers?.[userId]
            const claimable = parseFloat((staker?.unclaimedDividendsINR || 0).toFixed(2))

            if (claimable < this.minClaimINR) {
                const err = new Error(`Minimum claimable dividend yield is ₹${this.minClaimINR.toFixed(2)}`)
                err.status = 400
                throw err
            }

            staker.unclaimedDividendsINR = 0.00
            staker.totalClaimedINR = parseFloat(((staker.totalClaimedINR || 0) + claimable).toFixed(2))

            // Credit yield into user's wallet balance
            db.updateUserBalance(userId, 'INR', claimable, `🏛️ House Vault Dividend Yield Claim (₹${claimable})`)

            db.persist()

            return {
                success: true,
                message: `🎉 Claimed ₹${claimable.toFixed(2)} in house edge dividends to your wallet!`,
                claimedAmount: claimable,
                balances: user.balances
            }
        })
    }

    /**
     * Distribute pro-rata house edge dividend yield from wager volume
     * Called automatically when platform bets are placed or PvP rakes collected
     */
    distributeGameYield(betAmount) {
        if (!betAmount || betAmount <= 0) return
        this.ensureVaultStorage()
        const vault = db.data?.vault
        if (!vault || !vault.totalStakedINR || vault.totalStakedINR <= 0) return

        // 15% of mathematical 1.0% house edge = 0.15% of turnover
        const dividendYield = parseFloat((betAmount * 0.01 * 0.15).toFixed(4))
        if (dividendYield <= 0) return

        vault.totalDividendsDistributedINR = parseFloat(
            ((vault.totalDividendsDistributedINR || 0) + dividendYield).toFixed(4)
        )
        vault.rollingVolume7d = parseFloat(((vault.rollingVolume7d || 500000) + betAmount).toFixed(2))

        // Distribute proportionally to each staker according to pool ownership share
        const totalPool = vault.totalStakedINR
        for (const [stakerId, staker] of Object.entries(vault.stakers || {})) {
            if (staker.stakedINR > 0) {
                const sharePct = staker.stakedINR / totalPool
                const stakerYield = parseFloat((dividendYield * sharePct).toFixed(5))
                staker.unclaimedDividendsINR = parseFloat(((staker.unclaimedDividendsINR || 0) + stakerYield).toFixed(5))
            }
        }
    }
}

export const houseVaultService = new HouseVaultService()
