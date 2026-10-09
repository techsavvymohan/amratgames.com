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
        this.activeCrashRounds = new Map() // roundId -> { roundId, userId, currency, betAmount, crashPoint, autoCashout, startedAt, active }
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
    evaluateDragonTiger({ betAmount, choice = 'dragon', bets, clientSeed, nonce }) {
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

        let won = false
        let payout = 0
        let totalBet = parseFloat(betAmount) || 0

        if (bets && typeof bets === 'object' && Object.keys(bets).length > 0) {
            const bDragon = parseFloat(bets.dragon) || 0
            const bTiger = parseFloat(bets.tiger) || 0
            const bTie = parseFloat(bets.tie) || 0
            totalBet = bDragon + bTiger + bTie || totalBet

            if (winner === 'dragon') {
                payout = bDragon * 2.0
            } else if (winner === 'tiger') {
                payout = bTiger * 2.0
            } else if (winner === 'tie') {
                payout = (bTie * 9.0) + (bDragon * 0.5) + (bTiger * 0.5)
            }
            payout = parseFloat(payout.toFixed(2))
            won = payout > 0
        } else {
            const selectedChoice = String(choice).toLowerCase()
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
            payout = parseFloat((totalBet * multiplier).toFixed(2))
            won = payout > 0
        }

        const multiplier = totalBet > 0 ? parseFloat((payout / totalBet).toFixed(2)) : 0

        return {
            game: 'dragon-tiger',
            dragon: { value: dVal, suit: dSuit },
            tiger: { value: tVal, suit: tSuit },
            winner,
            choice: choice || 'dragon',
            won,
            multiplier,
            payout,
            hash
        }
    }

    // ── 6. Color Match Evaluator (Server-Authoritative) ─────────
    evaluateColorMatch({ betAmount, choice = 'green', bets, clientSeed, nonce }) {
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

        const bigSmall = luckyNumber >= 5 ? 'big' : 'small'

        let won = false
        let payout = 0
        let totalBet = parseFloat(betAmount) || 0

        if (bets && typeof bets === 'object' && Object.keys(bets).length > 0) {
            totalBet = Object.values(bets).reduce((a, b) => a + (parseFloat(b) || 0), 0) || totalBet

            if (bets.green && colors.includes('green')) {
                const mult = colors.includes('violet') ? 1.5 : 2.0
                payout += (parseFloat(bets.green) || 0) * mult
            }
            if (bets.red && colors.includes('red')) {
                const mult = colors.includes('violet') ? 1.5 : 2.0
                payout += (parseFloat(bets.red) || 0) * mult
            }
            if (bets.violet && colors.includes('violet')) {
                payout += (parseFloat(bets.violet) || 0) * 4.5
            }
            const numKey = `num_${luckyNumber}`
            if (bets[numKey]) {
                payout += (parseFloat(bets[numKey]) || 0) * 9.0
            }
            if (bets[bigSmall]) {
                payout += (parseFloat(bets[bigSmall]) || 0) * 2.0
            }
            payout = parseFloat(payout.toFixed(2))
            won = payout > 0
        } else {
            const selectedChoice = String(choice).toLowerCase()
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
            } else if (selectedChoice === bigSmall) {
                won = true
                multiplier = 2.0
            }
            payout = parseFloat((totalBet * multiplier).toFixed(2))
        }

        const multiplier = totalBet > 0 ? parseFloat((payout / totalBet).toFixed(2)) : 0

        return {
            game: 'color-match',
            luckyNumber,
            winningColors: colors,
            bigSmall,
            choice,
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
            currency: session.currency,
            betAmount: session.betAmount,
            gemsRevealed: session.revealedIndices.length,
            multiplier: session.currentMultiplier,
            payout,
            allMines: session.mineIndices
        }
    }

    getActiveMinesRound(userId) {
        if (!userId) return null
        for (const session of this.activeMinesRounds.values()) {
            if (session.userId === userId && session.active) {
                return {
                    roundId: session.roundId,
                    minesCount: session.minesCount,
                    revealedIndices: session.revealedIndices,
                    currentMultiplier: session.currentMultiplier,
                    nextMultiplier: this.calculateMinesMultiplier(session.minesCount, session.revealedIndices.length + 1),
                    betAmount: session.betAmount,
                    currency: session.currency,
                    active: true
                }
            }
        }
        return null
    }

    // ── 8. Crash Round Lifecycle (Server-Authoritative Sessions) ──
    startCrashRound({ userId, currency = 'INR', betAmount, autoCashout = null, clientSeed }) {
        const nonce = this.getNextNonce(userId)
        const { hash, floatVal } = this.generateHmacFloat(clientSeed, nonce)

        // 1% instant bust (RTP = 99%)
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

    cashoutCrash({ userId, roundId, multiplier }) {
        const session = this.activeCrashRounds.get(roundId)
        if (!session) throw new Error('Active Crash round not found or already closed')
        if (session.userId !== userId) throw new Error('Unauthorized round access')
        if (!session.active) throw new Error('Round is already closed')

        const requestedMultiplier = Math.max(1.01, parseFloat(multiplier) || 1.01)
        session.active = false
        this.activeCrashRounds.delete(roundId)

        // Validate that requested multiplier did not exceed crash point
        const won = requestedMultiplier <= session.crashPoint
        const actualMultiplier = won ? parseFloat(requestedMultiplier.toFixed(2)) : 0
        const payout = won ? parseFloat((session.betAmount * actualMultiplier).toFixed(2)) : 0

        return {
            roundId,
            won,
            currency: session.currency,
            betAmount: session.betAmount,
            multiplier: actualMultiplier,
            payout,
            crashPoint: session.crashPoint,
            hash: session.hash
        }
    }

    bustCrash({ userId, roundId }) {
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

    getActiveCrashRound(userId) {
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

    // ── 8. Coin Toss Evaluator (Server-Authoritative) ────────────
    evaluateCoinToss({ betAmount, choice = 'heads', clientSeed, nonce }) {
        const { hash, floatVal } = this.generateHmacFloat(clientSeed, nonce)

        // Provably Fair Coin Toss:
        // floatVal < 0.50 -> 'heads', else 'tails'
        // RTP = 99.00% (House Edge: 1.00%), Multiplier = 1.98x
        const outcome = floatVal < 0.50 ? 'heads' : 'tails'
        const selectedChoice = String(choice).toLowerCase().trim() === 'tails' ? 'tails' : 'heads'
        const won = (selectedChoice === outcome)
        const multiplier = won ? 1.98 : 0
        const totalBet = parseFloat(betAmount) || 0
        const payout = won ? parseFloat((totalBet * multiplier).toFixed(2)) : 0

        return {
            game: 'coin-toss',
            outcome, // 'heads' | 'tails'
            choice: selectedChoice,
            won,
            multiplier,
            payout,
            floatVal,
            hash
        }
    }
}

export const gameEngine = new GameEngineService()
