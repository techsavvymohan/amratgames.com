import crypto from 'node:crypto'
import { provablyFairCore } from '../core/ProvablyFairCore.js'
import { bankrollRisk } from '../../services/BankrollRiskService.js'

/**
 * Mines Game Engine (Server-Side Session State)
 */
export class MinesEngine {
    constructor() {
        this.activeMinesRounds = new Map() // roundId -> session
        // Periodic cleanup of abandoned rounds (older than 24 hours) to prevent memory leaks
        this.cleanupTimer = setInterval(() => this.cleanupExpiredRounds(), 60000)
        if (this.cleanupTimer.unref) this.cleanupTimer.unref()
    }

    cleanupExpiredRounds() {
        const now = Date.now()
        const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
        for (const [roundId, session] of this.activeMinesRounds.entries()) {
            if (now - (session.createdAt || 0) > TTL_MS) {
                session.active = false
                this.activeMinesRounds.delete(roundId)
            }
        }
    }

    calculateMultiplier(minesCount, gemsRevealed) {
        if (gemsRevealed <= 0) return 1.00
        const houseEdge = 0.96 // 4% edge (96% RTP)
        let mult = 1.0
        for (let i = 0; i < gemsRevealed; i++) {
            mult *= (25 - i) / (25 - minesCount - i)
        }
        return parseFloat((mult * houseEdge).toFixed(2))
    }

    startRound({ userId, currency = 'INR', betAmount, minesCount = 3, clientSeed = 'amrat-player' }) {
        const riskCheck = bankrollRisk.validateBetRisk({ betAmount, currency, game: 'mines' })
        if (!riskCheck.valid) {
            throw new Error(riskCheck.error)
        }

        // Prevent multiple concurrent active rounds per user
        const existing = this.getActiveRound(userId)
        if (existing) {
            const err = new Error('You already have an active Mines round. Please complete or cash out your current round.')
            err.status = 400
            err.code = 'ACTIVE_ROUND_EXISTS'
            err.roundId = existing.roundId
            throw err
        }

        const count = Math.max(1, Math.min(parseInt(minesCount, 10) || 3, 24))
        const cleanClientSeed = String(clientSeed || 'amrat-player').trim()
        const nonce = provablyFairCore.getNextNonce(userId)
        const { hash, serverSeed, roundEntropy } = provablyFairCore.generateHmacFloat(cleanClientSeed, nonce)
        const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex')

        // Generate 25 tiles shuffled with unbiased cryptographic SHA-512 Fisher-Yates expansion
        const entropyHash = crypto.createHmac('sha512', serverSeed)
            .update(`${cleanClientSeed}:${nonce}:${roundEntropy || ''}`)
            .digest('hex')

        const tiles = Array.from({ length: 25 }, (_, i) => i)
        for (let i = 24; i > 0; i--) {
            const offset = (24 - i) * 4 // 24 steps * 4 chars = 96 chars (fits easily in 128-char sha512)
            const intVal = parseInt(entropyHash.slice(offset, offset + 4), 16)
            const j = Math.floor((intVal / 0x10000) * (i + 1))
            const swapIdx = Math.min(j, i)
            ;[tiles[i], tiles[swapIdx]] = [tiles[swapIdx], tiles[i]]
        }

        const mineIndices = tiles.slice(0, count).sort((a, b) => a - b)
        const roundId = 'mines_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex')

        const session = {
            roundId,
            userId,
            currency,
            betAmount,
            minesCount: count,
            mineIndices,
            revealedIndices: [],
            currentMultiplier: 1.00,
            active: true,
            createdAt: Date.now(),
            serverSeed,
            serverSeedHash,
            roundEntropy,
            clientSeed: cleanClientSeed,
            nonce,
            hash
        }

        this.activeMinesRounds.set(roundId, session)

        return {
            roundId,
            minesCount: count,
            nextMultiplier: this.calculateMultiplier(count, 1),
            active: true,
            serverSeedHash,
            roundEntropy,
            nonce
        }
    }

    revealTile({ userId, roundId, tileIndex }) {
        const session = this.activeMinesRounds.get(roundId)
        if (!session) throw new Error('Active Mines round not found or already finished')
        if (session.userId !== userId) throw new Error('Unauthorized round access')
        if (!session.active) throw new Error('Round is already closed')

        const idx = parseInt(tileIndex, 10)
        if (isNaN(idx) || idx < 0 || idx > 24) throw new Error('Invalid tile index (0-24)')
        if (session.revealedIndices.includes(idx)) throw new Error('Tile already revealed')

        // Check if player hit a mine!
        if (session.mineIndices.includes(idx)) {
            session.active = false
            this.activeMinesRounds.delete(roundId)

            return {
                hitMine: true,
                tileIndex: idx,
                currency: session.currency,
                betAmount: session.betAmount,
                allMines: session.mineIndices,
                won: false,
                multiplier: 0,
                payout: 0,
                hash: session.hash,
                roundEntropy: session.roundEntropy,
                serverSeed: session.serverSeed,
                serverSeedHash: session.serverSeedHash,
                clientSeed: session.clientSeed,
                nonce: session.nonce
            }
        }

        // Player revealed a safe gem
        session.revealedIndices.push(idx)
        const gemsRevealed = session.revealedIndices.length
        session.currentMultiplier = this.calculateMultiplier(session.minesCount, gemsRevealed)
        const nextMultiplier = this.calculateMultiplier(session.minesCount, gemsRevealed + 1)
        const maxGems = 25 - session.minesCount

        // If player revealed all gems, auto cashout with win cap enforcement
        const autoWin = gemsRevealed >= maxGems
        let capped = { payout: 0, multiplier: session.currentMultiplier, wasCapped: false }

        if (autoWin) {
            session.active = false
            this.activeMinesRounds.delete(roundId)

            const rawPayout = parseFloat((session.betAmount * session.currentMultiplier).toFixed(2))
            capped = bankrollRisk.enforceWinCap({
                betAmount: session.betAmount,
                multiplier: session.currentMultiplier,
                rawPayout,
                currency: session.currency
            })
        }

        return {
            hitMine: false,
            tileIndex: idx,
            currency: session.currency,
            betAmount: session.betAmount,
            gemsRevealed,
            currentMultiplier: session.currentMultiplier,
            nextMultiplier,
            autoWin,
            allMines: autoWin ? session.mineIndices : undefined,
            multiplier: autoWin ? capped.multiplier : session.currentMultiplier,
            payout: autoWin ? capped.payout : 0,
            wasCapped: autoWin ? capped.wasCapped : false,
            hash: session.hash,
            roundEntropy: session.roundEntropy,
            serverSeed: autoWin ? session.serverSeed : undefined,
            serverSeedHash: session.serverSeedHash,
            clientSeed: session.clientSeed,
            nonce: session.nonce
        }
    }

    cashout({ userId, roundId }) {
        const session = this.activeMinesRounds.get(roundId)
        if (!session) throw new Error('Active Mines round not found or already closed')
        if (session.userId !== userId) throw new Error('Unauthorized round access')
        if (!session.active) throw new Error('Round is not active')
        if (session.revealedIndices.length === 0) throw new Error('Reveal at least one gem before cashout')

        session.active = false
        this.activeMinesRounds.delete(roundId)

        const rawPayout = parseFloat((session.betAmount * session.currentMultiplier).toFixed(2))
        const capped = bankrollRisk.enforceWinCap({
            betAmount: session.betAmount,
            multiplier: session.currentMultiplier,
            rawPayout,
            currency: session.currency
        })

        return {
            won: true,
            currency: session.currency,
            betAmount: session.betAmount,
            gemsRevealed: session.revealedIndices.length,
            multiplier: capped.multiplier,
            payout: capped.payout,
            wasCapped: capped.wasCapped,
            allMines: session.mineIndices,
            hash: session.hash,
            roundEntropy: session.roundEntropy,
            serverSeed: session.serverSeed,
            serverSeedHash: session.serverSeedHash,
            clientSeed: session.clientSeed,
            nonce: session.nonce
        }
    }

    getActiveRound(userId) {
        if (!userId) return null
        for (const session of this.activeMinesRounds.values()) {
            if (session.userId === userId && session.active) {
                return {
                    roundId: session.roundId,
                    minesCount: session.minesCount,
                    revealedIndices: session.revealedIndices,
                    currentMultiplier: session.currentMultiplier,
                    nextMultiplier: this.calculateMultiplier(session.minesCount, session.revealedIndices.length + 1),
                    betAmount: session.betAmount,
                    currency: session.currency,
                    active: true,
                    serverSeedHash: session.serverSeedHash,
                    nonce: session.nonce
                }
            }
        }
        return null
    }
}

export const minesEngine = new MinesEngine()
export default minesEngine
