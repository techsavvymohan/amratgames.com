import crypto from 'node:crypto'
import { provablyFairCore } from '../core/ProvablyFairCore.js'

/**
 * Mines Game Engine (Server-Side Session State)
 */
export class MinesEngine {
    constructor() {
        this.activeMinesRounds = new Map() // roundId -> session
    }

    calculateMultiplier(minesCount, gemsRevealed) {
        if (gemsRevealed <= 0) return 1.00
        const houseEdge = 0.99 // 1% edge
        let mult = 1.0
        for (let i = 0; i < gemsRevealed; i++) {
            mult *= (25 - i) / (25 - minesCount - i)
        }
        return parseFloat((mult * houseEdge).toFixed(2))
    }

    startRound({ userId, currency = 'INR', betAmount, minesCount = 3, clientSeed }) {
        const count = Math.max(1, Math.min(parseInt(minesCount, 10) || 3, 24))
        const nonce = provablyFairCore.getNextNonce(userId)
        const { hash } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        // Generate 25 tiles shuffled with Fisher-Yates driven by HMAC hash
        const tiles = Array.from({ length: 25 }, (_, i) => i)
        for (let i = 24; i > 0; i--) {
            const byteOffset = (24 - i) % 32
            const randByte = parseInt(hash.slice(byteOffset * 2, byteOffset * 2 + 2), 16)
            const j = randByte % (i + 1);
            [tiles[i], tiles[j]] = [tiles[j], tiles[i]]
        }

        const mineIndices = new Set(tiles.slice(0, count))
        const roundId = 'mines_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex')

        const session = {
            roundId,
            userId,
            currency,
            betAmount,
            minesCount: count,
            mineIndices: Array.from(mineIndices),
            revealedIndices: [],
            currentMultiplier: 1.00,
            active: true,
            createdAt: Date.now()
        }

        this.activeMinesRounds.set(roundId, session)

        return {
            roundId,
            minesCount: count,
            nextMultiplier: this.calculateMultiplier(count, 1),
            active: true
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
                payout: 0
            }
        }

        // Player revealed a safe gem
        session.revealedIndices.push(idx)
        const gemsRevealed = session.revealedIndices.length
        session.currentMultiplier = this.calculateMultiplier(session.minesCount, gemsRevealed)
        const nextMultiplier = this.calculateMultiplier(session.minesCount, gemsRevealed + 1)
        const maxGems = 25 - session.minesCount

        // If player revealed all gems, auto cashout
        const autoWin = gemsRevealed >= maxGems
        if (autoWin) {
            session.active = false
            this.activeMinesRounds.delete(roundId)
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
            payout: autoWin ? parseFloat((session.betAmount * session.currentMultiplier).toFixed(2)) : 0
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

        const payout = parseFloat((session.betAmount * session.currentMultiplier).toFixed(2))

        return {
            won: true,
            currency: session.currency,
            betAmount: session.betAmount,
            gemsRevealed: session.revealedIndices.length,
            multiplier: session.currentMultiplier,
            payout,
            allMines: session.mineIndices
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
                    active: true
                }
            }
        }
        return null
    }
}

export const minesEngine = new MinesEngine()
export default minesEngine
