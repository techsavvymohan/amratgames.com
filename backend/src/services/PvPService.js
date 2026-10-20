// =============================================================================
// 👑 AmratGames.com — Social Arcade PvP Arena Service
// Pillar 4: Player-vs-Player Duels & Zero-Risk House Rake Engine
// =============================================================================

import crypto from 'node:crypto'
import { db } from '../db/db.js'
import { CONFIG } from '../config.js'
import { broadcastEvent } from '../websocket.js'
import { chatService } from './ChatService.js'
import { houseVaultService } from './HouseVaultService.js'
import { bankrollRisk } from './BankrollRiskService.js'

export class PvPService {
    constructor() {
        this.activeDuels = new Map() // duelId -> duel object
        this.houseRakeRate = CONFIG.PVP_HOUSE_RAKE_RATE || 0.04    // 4.0% platform house rake (zero bankroll risk)
        this.minStake = 10.00        // ₹10 INR minimum duel stake
        this.maxStake = 50000.00     // ₹50,000 INR maximum duel stake
        this.duelExpiryMs = 15 * 60 * 1000 // 15 mins timeout before auto-refund

        // Background janitor to auto-refund stale open duels
        this.janitorTimer = setInterval(() => this.cleanupExpiredDuels(), 30000)
        if (this.janitorTimer.unref) this.janitorTimer.unref()

        this.initStorage()
    }

    initStorage() {
        if (!db.data.pvpDuels) {
            db.data.pvpDuels = []
        }
        // Load recent open/active duels into memory map
        db.data.pvpDuels.forEach(d => {
            if (d.status === 'open' || d.status === 'active') {
                this.activeDuels.set(d.id, d)
            }
        })
    }

    /**
     * Create a new PvP Coin Toss Duel challenge
     */
    async createDuel({ userId, stake, choice = 'heads', currency = 'INR', clientSeed = '' }) {
        const user = db.findUserById(userId)
        if (!user) {
            const err = new Error('Player account not found')
            err.status = 404
            throw err
        }

        const minStake = bankrollRisk.getMinBet(currency)
        const maxStake = bankrollRisk.getMaxBet(currency)
        const parsedStake = parseFloat(stake)
        if (isNaN(parsedStake) || parsedStake < minStake) {
            const err = new Error(`Minimum duel stake is ${minStake} ${currency}`)
            err.status = 400
            throw err
        }
        if (parsedStake > maxStake) {
            const err = new Error(`Maximum duel stake is ${maxStake} ${currency}`)
            err.status = 400
            throw err
        }

        const normalizedChoice = String(choice).toLowerCase().trim() === 'tails' ? 'tails' : 'heads'

        // Atomically lock and deduct stake from creator
        const balanceResult = await db.withUserLock(userId, async () => {
            const u = db.findUserById(userId)
            const currentBal = u?.balances?.[currency] || 0
            if (currentBal < parsedStake) {
                const err = new Error(`Insufficient ${currency} balance (Available: ${currentBal} ${currency})`)
                err.status = 400
                throw err
            }

            db.updateUserBalance(userId, currency, -parsedStake, `PvP Coin Toss Stake Lock (${parsedStake} ${currency})`)
            return u.balances
        })

        // Generate Provably Fair seed pair
        const serverSeed = crypto.randomBytes(32).toString('hex')
        const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex')
        const duelId = 'pvp_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex')

        const decimals = bankrollRisk.getCurrencyDecimals(currency)
        const duel = {
            id: duelId,
            game: 'coin-toss',
            creatorId: user.id,
            creatorUsername: user.username,
            creatorChoice: normalizedChoice,
            stake: parsedStake,
            currency,
            status: 'open',
            opponentId: null,
            opponentUsername: null,
            opponentChoice: null,
            totalPot: parseFloat((parsedStake * 2).toFixed(decimals)),
            houseRakeRate: this.houseRakeRate,
            houseRakeAmount: parseFloat((parsedStake * 2 * this.houseRakeRate).toFixed(decimals)),
            winnerPayout: parseFloat(((parsedStake * 2) * (1 - this.houseRakeRate)).toFixed(decimals)),
            winnerId: null,
            winnerUsername: null,
            loserId: null,
            loserUsername: null,
            outcome: null,
            provablyFair: {
                serverSeed,
                serverSeedHash,
                clientSeed: clientSeed || 'amrat-pvp-seed',
                combinedHash: null,
                floatVal: null
            },
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + this.duelExpiryMs).toISOString(),
            resolvedAt: null
        }

        this.activeDuels.set(duelId, duel)
        if (!db.data.pvpDuels) db.data.pvpDuels = []
        db.data.pvpDuels.unshift(duel)
        if (db.data.pvpDuels.length > 500) {
            db.data.pvpDuels = db.data.pvpDuels.slice(0, 500)
        }
        db.persist()

        // Broadcast to all connected players
        const publicDuel = this.sanitizeDuel(duel)
        broadcastEvent('PVP_DUEL_CREATED', publicDuel)

        // Post challenge invitation in community live chat
        try {
            if (chatService && chatService.postSystemAnnouncement) {
                chatService.postSystemAnnouncement(
                    `⚔️ [PVP DUEL] ${user.username} created a ₹${parsedStake.toLocaleString('en-IN')} Coin Toss Duel (${normalizedChoice.toUpperCase()})! Who will step up?`,
                    { duelId, stake: parsedStake, game: 'coin-toss' }
                )
            }
        } catch {}

        return {
            success: true,
            duel: publicDuel,
            balances: balanceResult
        }
    }

    /**
     * Accept and resolve an open PvP Duel
     */
    async joinDuel({ duelId, userId, clientSeed = '' }) {
        const opponent = db.findUserById(userId)
        if (!opponent) {
            const err = new Error('Player account not found')
            err.status = 404
            throw err
        }

        const duel = this.activeDuels.get(duelId) || (db.data.pvpDuels || []).find(d => d.id === duelId)
        if (!duel) {
            const err = new Error('Duel challenge not found or has expired')
            err.status = 404
            throw err
        }

        if (duel.status !== 'open') {
            const err = new Error(`Duel is no longer open (Status: ${duel.status})`)
            err.status = 400
            throw err
        }

        if (duel.creatorId === userId) {
            const err = new Error('You cannot challenge your own duel')
            err.status = 400
            throw err
        }

        // Atomically lock opponent stake and transition duel to active
        await db.withUserLock(userId, async () => {
            const u = db.findUserById(userId)
            const currentBal = u?.balances?.[duel.currency] || 0
            if (currentBal < duel.stake) {
                const err = new Error(`Insufficient ${duel.currency} balance to join duel (Required: ${duel.stake} ${duel.currency})`)
                err.status = 400
                throw err
            }

            db.updateUserBalance(userId, duel.currency, -duel.stake, `PvP Coin Toss Stake Lock (${duel.stake} ${duel.currency})`)
        })

        // Opponent receives the opposite side
        const opponentChoice = duel.creatorChoice === 'heads' ? 'tails' : 'heads'
        duel.opponentId = opponent.id
        duel.opponentUsername = opponent.username
        duel.opponentChoice = opponentChoice
        duel.status = 'active'

        // Provably Fair mathematical outcome resolution
        const finalClientSeed = clientSeed || 'amrat-pvp-challenger-' + Date.now()
        const hmac = crypto.createHmac('sha256', duel.provablyFair.serverSeed)
        hmac.update(`${finalClientSeed}:${duel.id}`)
        const combinedHash = hmac.digest('hex')

        // First 8 hex characters -> integer -> floatVal in [0, 1)
        const subHash = combinedHash.slice(0, 8)
        const floatVal = parseInt(subHash, 16) / 0x100000000

        // floatVal < 0.50 -> heads, else tails
        const outcome = floatVal < 0.50 ? 'heads' : 'tails'
        const isCreatorWinner = (duel.creatorChoice === outcome)

        const winnerId = isCreatorWinner ? duel.creatorId : duel.opponentId
        const winnerUsername = isCreatorWinner ? duel.creatorUsername : duel.opponentUsername
        const loserId = isCreatorWinner ? duel.opponentId : duel.creatorId
        const loserUsername = isCreatorWinner ? duel.opponentUsername : duel.creatorUsername

        const decimals = bankrollRisk.getCurrencyDecimals(duel.currency)
        const totalPot = parseFloat((duel.stake * 2).toFixed(decimals))
        const houseRakeAmount = parseFloat((totalPot * this.houseRakeRate).toFixed(decimals))
        const winnerPayout = parseFloat((totalPot - houseRakeAmount).toFixed(decimals))

        // Credit winner atomically
        await db.withUserLock(winnerId, async () => {
            db.updateUserBalance(winnerId, duel.currency, winnerPayout, `PvP Coin Toss Duel Victory (Pot: ${totalPot} ${duel.currency}, Rake: ${houseRakeAmount} ${duel.currency})`)
        })

        // Accumulate turnover for both players (contributes to AML and VIP progression)
        const curr = String(duel.currency || 'INR').toUpperCase()
        let stakeInr = duel.stake
        if (curr === 'USDT') stakeInr = duel.stake * 90.0
        else if (curr === 'BTC') stakeInr = duel.stake * 8500000.0
        else if (curr === 'AMRAT') stakeInr = 0

        const creator = db.findUserById(duel.creatorId)
        if (creator && curr !== 'AMRAT') {
            creator.totalWagered = parseFloat(((creator.totalWagered || 0) + stakeInr).toFixed(2))
            if (db.accumulateWagerRewards) db.accumulateWagerRewards(creator, duel.stake, duel.currency)
        }
        const opponentRecord = db.findUserById(duel.opponentId)
        if (opponentRecord && curr !== 'AMRAT') {
            opponentRecord.totalWagered = parseFloat(((opponentRecord.totalWagered || 0) + stakeInr).toFixed(2))
            if (db.accumulateWagerRewards) db.accumulateWagerRewards(opponentRecord, duel.stake, duel.currency)
        }

        // Track platform revenue and statistics
        let potInr = totalPot
        let rakeInr = houseRakeAmount
        if (curr === 'USDT') {
            potInr = totalPot * 90.0
            rakeInr = houseRakeAmount * 90.0
        } else if (curr === 'BTC') {
            potInr = totalPot * 8500000.0
            rakeInr = houseRakeAmount * 8500000.0
        } else if (curr === 'AMRAT') {
            potInr = 0
            rakeInr = 0
        }

        if (!db.data.stats) db.data.stats = {}
        db.data.stats.totalPvpVolume = parseFloat(((db.data.stats.totalPvpVolume || 0) + potInr).toFixed(2))
        db.data.stats.totalRakeCollected = parseFloat(((db.data.stats.totalRakeCollected || 0) + rakeInr).toFixed(2))
        db.data.stats.totalDuelsResolved = (db.data.stats.totalDuelsResolved || 0) + 1

        // Route house edge yield to Community House Vault
        try {
            if (houseVaultService && houseVaultService.distributeGameYield && potInr > 0) {
                houseVaultService.distributeGameYield(potInr)
            }
        } catch {}

        // Finalize duel state
        duel.status = 'resolved'
        duel.outcome = outcome
        duel.winnerId = winnerId
        duel.winnerUsername = winnerUsername
        duel.winnerPayout = winnerPayout
        duel.loserId = loserId
        duel.loserUsername = loserUsername
        duel.totalPot = totalPot
        duel.houseRakeAmount = houseRakeAmount
        duel.resolvedAt = new Date().toISOString()
        duel.provablyFair.clientSeed = finalClientSeed
        duel.provablyFair.combinedHash = combinedHash
        duel.provablyFair.floatVal = floatVal

        // Remove from active memory map
        this.activeDuels.delete(duel.id)
        db.persist()

        // Broadcast resolution with revealed seeds
        const resolvedDuelPublic = this.sanitizeDuel(duel, true)
        broadcastEvent('PVP_DUEL_RESOLVED', resolvedDuelPublic)

        // Post chat victory announcement
        try {
            if (chatService && chatService.postSystemAnnouncement) {
                chatService.postSystemAnnouncement(
                    `👑 [PVP DUEL VICTORY] ${winnerUsername} won ₹${winnerPayout.toLocaleString('en-IN')} against ${loserUsername} in Coin Toss Duel! (${outcome.toUpperCase()})`,
                    { duelId: duel.id, winnerId, payout: winnerPayout }
                )
            }
        } catch {}

        return {
            success: true,
            duel: resolvedDuelPublic,
            outcome,
            winnerId,
            winnerUsername,
            winnerPayout,
            houseRakeAmount
        }
    }

    /**
     * Cancel an open duel and refund the creator's stake
     */
    async cancelDuel({ duelId, userId }) {
        const duel = this.activeDuels.get(duelId) || (db.data.pvpDuels || []).find(d => d.id === duelId)
        if (!duel) {
            const err = new Error('Duel not found')
            err.status = 404
            throw err
        }

        if (duel.status !== 'open') {
            const err = new Error(`Cannot cancel duel with status: ${duel.status}`)
            err.status = 400
            throw err
        }

        if (duel.creatorId !== userId) {
            const err = new Error('Only the duel creator can cancel this challenge')
            err.status = 403
            throw err
        }

        // Refund stake to creator
        const balanceResult = await db.withUserLock(userId, async () => {
            db.updateUserBalance(userId, duel.currency, duel.stake, `PvP Duel Cancelled (Stake Refund: ${duel.stake} ${duel.currency})`)
            const u = db.findUserById(userId)
            return u?.balances
        })

        duel.status = 'cancelled'
        this.activeDuels.delete(duel.id)
        db.persist()

        broadcastEvent('PVP_DUEL_CANCELLED', { duelId: duel.id })

        return {
            success: true,
            message: 'Duel successfully cancelled and stake refunded',
            balances: balanceResult
        }
    }

    /**
     * Auto-cancel and refund expired open duels
     */
    async cleanupExpiredDuels() {
        const now = new Date()
        for (const [id, duel] of this.activeDuels.entries()) {
            if (duel.status === 'open' && new Date(duel.expiresAt) < now) {
                try {
                    await db.withUserLock(duel.creatorId, async () => {
                        db.updateUserBalance(duel.creatorId, duel.currency, duel.stake, `PvP Duel Expired (Stake Refund: ${duel.stake} ${duel.currency})`)
                    })
                    duel.status = 'expired'
                    this.activeDuels.delete(id)
                    db.persist()
                    broadcastEvent('PVP_DUEL_CANCELLED', { duelId: duel.id, reason: 'expired' })
                } catch (e) {
                    console.error('[PVP JANITOR ERROR]', e)
                }
            }
        }
    }

    /**
     * List active and recent duels for the PvP lobby
     */
    listDuels({ status = 'all', limit = 30 } = {}) {
        let duels = db.data.pvpDuels || []
        if (status === 'open') {
            duels = duels.filter(d => d.status === 'open')
        } else if (status === 'resolved') {
            duels = duels.filter(d => d.status === 'resolved')
        }

        return duels
            .slice(0, limit)
            .map(d => this.sanitizeDuel(d, d.status === 'resolved'))
    }

    /**
     * Get aggregate PvP Arena stats
     */
    getStats() {
        const stats = db.data.stats || {}
        return {
            houseRakeRate: this.houseRakeRate,
            minStake: this.minStake,
            maxStake: this.maxStake,
            totalDuelsResolved: stats.totalDuelsResolved || 0,
            totalPvpVolume: stats.totalPvpVolume || 0,
            totalRakeCollected: stats.totalRakeCollected || 0,
            openDuelsCount: Array.from(this.activeDuels.values()).filter(d => d.status === 'open').length
        }
    }

    /**
     * Sanitize duel object for public client broadcast
     */
    sanitizeDuel(duel, revealSeed = false) {
        if (!duel) return null
        const clone = { ...duel }
        clone.provablyFair = {
            serverSeedHash: duel.provablyFair?.serverSeedHash,
            clientSeed: duel.provablyFair?.clientSeed,
            combinedHash: duel.provablyFair?.combinedHash,
            floatVal: duel.provablyFair?.floatVal
        }

        // Only reveal secret server seed once the duel has resolved
        if (revealSeed && duel.status === 'resolved') {
            clone.provablyFair.serverSeed = duel.provablyFair.serverSeed
        }

        return clone
    }
}

export const pvpService = new PvPService()
