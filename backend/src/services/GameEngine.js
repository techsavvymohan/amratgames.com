import crypto from 'node:crypto'
import { db } from '../db/db.js'
import { CONFIG } from '../config.js'

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 👑 AmratGames.com — Server-Side Authoritative Provably Fair Game Engine
 * ═══════════════════════════════════════════════════════════════════════
 * Strictly enforces that all outcomes, multipliers, payouts, and card/tile
 * states are generated and validated on the SERVER.
 * Client-submitted 'won' and 'multiplier' values are NEVER trusted.
 */

// Official Plinko Payout Matrices (Rows 8 to 16, Risk: low, medium, high)
export const PLINKO_PAYOUTS = {
    8: {
        low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
        medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
        high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    },
    9: {
        low: [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6],
        medium: [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18],
        high: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43],
    },
    10: {
        low: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9],
        medium: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
        high: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
    },
    11: {
        low: [8.4, 3, 1.9, 1.3, 1, 0.7, 0.7, 1, 1.3, 1.9, 3, 8.4],
        medium: [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24],
        high: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
    },
    12: {
        low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
        medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
        high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    },
    13: {
        low: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3, 4, 8.1],
        medium: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43],
        high: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260],
    },
    14: {
        low: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
        medium: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58],
        high: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
    },
    15: {
        low: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 2, 3, 8, 15],
        medium: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88],
        high: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
    },
    16: {
        low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
        medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
        high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
    },
}

class GameEngineService {
    constructor() {
        // Active server-managed game sessions (Mines, Crash rounds)
        this.activeMinesRounds = new Map() // roundId -> { userId, betAmount, currency, minesCount, mineIndices, revealedIndices, currentMultiplier, active }
        this.userNonces = new Map() // userId -> nonce counter
    }

    // ── 1. Cryptographic Entropy & Nonce Helpers ───────────────
    getServerSeed() {
        return db.data.settings?.currentServerSeed || crypto.randomBytes(32).toString('hex')
    }

    getNextNonce(userId = 'guest') {
        const current = this.userNonces.get(userId) || 1
        this.userNonces.set(userId, current + 1)
        return current
    }

    /**
     * Compute HMAC-SHA256 outcome hash and uniform float in [0, 1)
     */
    generateHmacFloat(clientSeed = 'amrat-player', nonce = 1, serverSeedOverride = null) {
        const serverSeed = serverSeedOverride || this.getServerSeed()
        const message = `${String(clientSeed).trim()}:${nonce}`
        const hmac = crypto.createHmac('sha256', serverSeed)
        hmac.update(message)
        const hash = hmac.digest('hex')

        // First 8 hex characters (32 bits) divided by 2^32 gives uniform float [0, 1)
        const intVal = parseInt(hash.slice(0, 8), 16)
        const floatVal = intVal / 0x100000000

        return { hash, floatVal, serverSeed }
    }

    // ── 2. Limbo Evaluator (Server-Authoritative) ───────────────
    evaluateLimbo({ betAmount, targetMultiplier, clientSeed, nonce }) {
        const target = Math.max(1.01, Math.min(parseFloat(targetMultiplier) || 2.0, 1000000.0))
        const { hash, floatVal } = this.generateHmacFloat(clientSeed, nonce)

        // 1% instant bust house edge (RTP = 99%)
        let roll = 1.00
        if (floatVal >= 0.01) {
            roll = Math.floor((99 / (1 - floatVal))) / 100
        }
        roll = Math.max(1.00, Math.min(roll, 1000000.0))

        const won = roll >= target
        const payout = won ? parseFloat((betAmount * target).toFixed(2)) : 0

        return {
            game: 'limbo',
            won,
            roll,
            targetMultiplier: target,
            multiplier: won ? target : 0,
            payout,
            hash
        }
    }

    // ── 3. Crash / Dino Evaluator (Server-Authoritative) ────────
    evaluateCrash({ claimedMultiplier, clientSeed, nonce, autoCashout = null }) {
        const { hash, floatVal } = this.generateHmacFloat(clientSeed, nonce)

        // 1% instant bust (RTP = 99%)
        let crashPoint = 1.00
        if (floatVal >= 0.01) {
            crashPoint = Math.floor((99 / (1 - floatVal))) / 100
        }
        crashPoint = Math.max(1.00, Math.min(crashPoint, 1000.0))

        // Target multiplier requested by cashout or auto-cashout
        const requestedMultiplier = parseFloat(autoCashout || claimedMultiplier || 0)

        // If player cashed out at or before the crash point, they won!
        const won = requestedMultiplier > 1.0 && requestedMultiplier <= crashPoint
        const actualMultiplier = won ? parseFloat(requestedMultiplier.toFixed(2)) : 0

        return {
            crashPoint,
            won,
            multiplier: actualMultiplier,
            hash
        }
    }

    // ── 4. Plinko Evaluator (Server-Authoritative) ──────────────
    evaluatePlinko({ betAmount, rows = 16, risk = 'medium', clientSeed, nonce }) {
        const numRows = Math.max(8, Math.min(parseInt(rows, 10) || 16, 16))
        const riskLevel = ['low', 'medium', 'high'].includes(risk) ? risk : 'medium'
        const { hash, serverSeed } = this.generateHmacFloat(clientSeed, nonce)

        // Generate drop path using 4 hex chars (16 bits) per pin row
        const path = []
        let rightBounces = 0

        for (let i = 0; i < numRows; i++) {
            const chunk = hash.substr(i * 4, 4) || '7fff'
            const val = parseInt(chunk, 16)
            // 0 = bounce left, 1 = bounce right
            const direction = (val % 2 === 1) ? 1 : 0
            path.push(direction)
            if (direction === 1) rightBounces++
        }

        const binIndex = rightBounces
        const matrix = PLINKO_PAYOUTS[numRows]?.[riskLevel] || PLINKO_PAYOUTS[16].medium
        const multiplier = matrix[binIndex] || 0.5
        const payout = parseFloat((betAmount * multiplier).toFixed(2))
        const won = multiplier >= 1.0

        return {
            game: 'plinko',
            rows: numRows,
            risk: riskLevel,
            path,
            binIndex,
            multiplier,
            payout,
            won,
            hash
        }
    }

    // ── 5. Dragon Tiger Evaluator (Server-Authoritative) ────────
    evaluateDragonTiger({ betAmount, choice = 'dragon', clientSeed, nonce }) {
        const { hash } = this.generateHmacFloat(clientSeed, nonce)

        // Two cards drawn from 52 cards (1=Ace ... 13=King)
        const dVal = (parseInt(hash.slice(0, 4), 16) % 13) + 1
        const tVal = (parseInt(hash.slice(4, 8), 16) % 13) + 1
        const suits = ['♠', '♥', '♦', '♣']
        const dSuit = suits[parseInt(hash.slice(8, 9), 16) % 4]
        const tSuit = suits[parseInt(hash.slice(9, 10), 16) % 4]

        let winner = 'tie'
        if (dVal > tVal) winner = 'dragon'
        else if (tVal > dVal) winner = 'tiger'

        const selectedChoice = String(choice).toLowerCase()
        let won = false
        let multiplier = 0

        if (winner === 'tie') {
            if (selectedChoice === 'tie') {
                won = true
                multiplier = 9.0 // 8:1 profit + principal = 9x
            } else {
                won = false
                multiplier = 0.5 // Standard casino tie rule: 50% refund on dragon/tiger
            }
        } else if (winner === selectedChoice) {
            won = true
            multiplier = 2.0 // 1:1 payout
        } else {
            won = false
            multiplier = 0
        }

        const payout = parseFloat((betAmount * multiplier).toFixed(2))

        return {
            game: 'dragon-tiger',
            dragon: { value: dVal, suit: dSuit },
            tiger: { value: tVal, suit: tSuit },
            winner,
            choice: selectedChoice,
            won,
            multiplier,
            payout,
            hash
        }
    }

    // ── 6. Color Match Evaluator (Server-Authoritative) ─────────
    evaluateColorMatch({ betAmount, choice = 'green', clientSeed, nonce }) {
        const { hash } = this.generateHmacFloat(clientSeed, nonce)
        const luckyNumber = parseInt(hash.slice(0, 4), 16) % 10

        // Indian Color Match rules:
        // 0: Violet + Red
        // 5: Violet + Green
        // 1, 3, 7, 9: Green
        // 2, 4, 6, 8: Red
        const colors = []
        if (luckyNumber === 0) colors.push('red', 'violet')
        else if (luckyNumber === 5) colors.push('green', 'violet')
        else if ([1, 3, 7, 9].includes(luckyNumber)) colors.push('green')
        else colors.push('red')

        const selectedChoice = String(choice).toLowerCase()
        let won = false
        let multiplier = 0

        if (colors.includes(selectedChoice)) {
            won = true
            if (selectedChoice === 'violet') {
                multiplier = 4.5
            } else if (luckyNumber === 0 || luckyNumber === 5) {
                // Half win on split 0/5
                multiplier = 1.5
            } else {
                multiplier = 2.0
            }
        } else if (selectedChoice === String(luckyNumber)) {
            // Exact number prediction pays 9x
            won = true
            multiplier = 9.0
        }

        const payout = parseFloat((betAmount * multiplier).toFixed(2))

        return {
            game: 'color-match',
            luckyNumber,
            winningColors: colors,
            choice: selectedChoice,
            won,
            multiplier,
            payout,
            hash
        }
    }

    // ── 7. Mines Engine (Server-Side Session State) ────────────
    calculateMinesMultiplier(minesCount, gemsRevealed) {
        if (gemsRevealed <= 0) return 1.00
        const houseEdge = 0.99 // 1% edge
        let mult = 1.0
        for (let i = 0; i < gemsRevealed; i++) {
            mult *= (25 - i) / (25 - minesCount - i)
        }
        return parseFloat((mult * houseEdge).toFixed(2))
    }

    startMinesRound({ userId, currency = 'INR', betAmount, minesCount = 3, clientSeed }) {
        const count = Math.max(1, Math.min(parseInt(minesCount, 10) || 3, 24))
        const nonce = this.getNextNonce(userId)
        const { hash } = this.generateHmacFloat(clientSeed, nonce)

        // Generate 25 tiles shuffled with Fisher-Yates driven by HMAC hash
        const tiles = Array.from({ length: 25 }, (_, i) => i)
        // Fisher-Yates with hash bytes
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
            nextMultiplier: this.calculateMinesMultiplier(count, 1),
            active: true
        }
    }

    revealMinesTile({ userId, roundId, tileIndex }) {
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
                allMines: session.mineIndices,
                won: false,
                multiplier: 0,
                payout: 0
            }
        }

        // Player revealed a safe gem
        session.revealedIndices.push(idx)
        const gemsRevealed = session.revealedIndices.length
        session.currentMultiplier = this.calculateMinesMultiplier(session.minesCount, gemsRevealed)
        const nextMultiplier = this.calculateMinesMultiplier(session.minesCount, gemsRevealed + 1)
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
            gemsRevealed,
            currentMultiplier: session.currentMultiplier,
            nextMultiplier,
            autoWin,
            allMines: autoWin ? session.mineIndices : undefined,
            payout: autoWin ? parseFloat((session.betAmount * session.currentMultiplier).toFixed(2)) : 0
        }
    }

    cashoutMines({ userId, roundId }) {
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
            gemsRevealed: session.revealedIndices.length,
            multiplier: session.currentMultiplier,
            payout,
            allMines: session.mineIndices
        }
    }
}

export const gameEngine = new GameEngineService()
