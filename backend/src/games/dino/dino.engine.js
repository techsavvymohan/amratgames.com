import crypto from 'node:crypto'
import { provablyFairCore } from '../core/ProvablyFairCore.js'
import { bankrollRisk } from '../../services/BankrollRiskService.js'

export const DINO_DIFFICULTIES = {
    easy: { label: 'Easy', survivalChance: 0.85, color: '#35d06f' },
    medium: { label: 'Medium', survivalChance: 0.65, color: '#f7931a' },
    hard: { label: 'Hard', survivalChance: 0.45, color: '#ed4245' }
}

/**
 * Dino Runner Engine (Server-Authoritative)
 * Deterministic hurdle survival driven by HMAC-SHA256 Provably Fair seed
 */
export class DinoEngine {
    constructor() {
        this.activeDinoRounds = new Map() // roundId -> session

        // Periodic TTL cleaner for abandoned sessions (older than 30 minutes)
        this.cleanupTimer = setInterval(() => {
            const now = Date.now()
            const TTL_MS = 30 * 60 * 1000
            for (const [roundId, session] of this.activeDinoRounds.entries()) {
                if (now - (session.startedAt || 0) > TTL_MS) {
                    session.active = false
                    this.activeDinoRounds.delete(roundId)
                }
            }
        }, 60000)
        if (this.cleanupTimer.unref) this.cleanupTimer.unref()
    }

    calculateMultiplier(difficulty = 'medium', cleared = 0) {
        if (cleared <= 0) return 1.00
        const diff = DINO_DIFFICULTIES[difficulty] || DINO_DIFFICULTIES.medium
        const probability = Math.pow(diff.survivalChance, cleared)
        // 99% RTP (1% house edge)
        const pureMultiplier = 0.99 / probability
        return parseFloat((Math.floor(pureMultiplier * 100) / 100).toFixed(2))
    }

    startRound({ userId, currency = 'INR', betAmount, difficulty = 'medium', clientSeed = 'amrat-dino' }) {
        const riskCheck = bankrollRisk.validateBetRisk({ betAmount, currency, game: 'dino' })
        if (!riskCheck.valid) {
            throw new Error(riskCheck.error)
        }
        const diffKey = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium'
        const nonce = provablyFairCore.getNextNonce(userId)
        const { hash } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        const roundId = 'dino_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex')
        const session = {
            roundId,
            userId,
            currency,
            betAmount: parseFloat(betAmount),
            difficulty: diffKey,
            clientSeed,
            nonce,
            hash,
            obstaclesCleared: 0,
            stepNonce: 1,
            currentMultiplier: 1.00,
            active: true,
            startedAt: Date.now()
        }

        this.activeDinoRounds.set(roundId, session)

        return {
            roundId,
            difficulty: diffKey,
            currentMultiplier: 1.00,
            nextMultiplier: this.calculateMultiplier(diffKey, 1),
            hash,
            active: true
        }
    }

    jump({ userId, roundId }) {
        const session = this.activeDinoRounds.get(roundId)
        if (!session) throw new Error('Active Dino round not found or already finished')
        if (session.userId !== userId) throw new Error('Unauthorized round access')
        if (!session.active) throw new Error('Round is already closed')

        const diff = DINO_DIFFICULTIES[session.difficulty]
        const { floatVal } = provablyFairCore.generateHmacFloat(
            `${session.clientSeed}:dino_jump_${session.stepNonce}`,
            session.nonce
        )
        session.stepNonce++

        const survived = floatVal < diff.survivalChance

        if (survived) {
            session.obstaclesCleared++
            session.currentMultiplier = this.calculateMultiplier(session.difficulty, session.obstaclesCleared)
            const nextMultiplier = this.calculateMultiplier(session.difficulty, session.obstaclesCleared + 1)
            const potentialWin = parseFloat((session.betAmount * session.currentMultiplier).toFixed(2))

            return {
                survived: true,
                obstaclesCleared: session.obstaclesCleared,
                currentMultiplier: session.currentMultiplier,
                nextMultiplier,
                potentialWin,
                currency: session.currency,
                betAmount: session.betAmount
            }
        }

        // Crashed into obstacle
        session.active = false
        this.activeDinoRounds.delete(roundId)

        return {
            survived: false,
            obstaclesCleared: session.obstaclesCleared,
            currentMultiplier: 0,
            payout: 0,
            currency: session.currency,
            betAmount: session.betAmount,
            hash: session.hash
        }
    }

    cashout({ userId, roundId }) {
        const session = this.activeDinoRounds.get(roundId)
        if (!session) throw new Error('Active Dino round not found or already closed')
        if (session.userId !== userId) throw new Error('Unauthorized round access')
        if (!session.active) throw new Error('Round is already closed')
        if (session.obstaclesCleared <= 0) throw new Error('Must clear at least 1 obstacle to cash out')

        session.active = false
        this.activeDinoRounds.delete(roundId)

        const rawPayout = parseFloat((session.betAmount * session.currentMultiplier).toFixed(2))
        const capped = bankrollRisk.enforceWinCap({
            betAmount: session.betAmount,
            multiplier: session.currentMultiplier,
            rawPayout,
            currency: session.currency
        })

        return {
            roundId,
            won: true,
            currency: session.currency,
            betAmount: session.betAmount,
            multiplier: capped.multiplier,
            payout: capped.payout,
            wasCapped: capped.wasCapped,
            obstaclesCleared: session.obstaclesCleared,
            difficulty: session.difficulty,
            hash: session.hash
        }
    }

    bust({ userId, roundId }) {
        const session = this.activeDinoRounds.get(roundId)
        if (!session) return { alreadyClosed: true }
        if (session.userId !== userId) throw new Error('Unauthorized round access')

        session.active = false
        this.activeDinoRounds.delete(roundId)

        return {
            roundId,
            won: false,
            currency: session.currency,
            betAmount: session.betAmount,
            multiplier: 0,
            payout: 0,
            obstaclesCleared: session.obstaclesCleared,
            difficulty: session.difficulty,
            hash: session.hash
        }
    }

    getActiveRound(userId) {
        const now = Date.now()
        const TTL_MS = 30 * 60 * 1000
        for (const session of this.activeDinoRounds.values()) {
            if (session.userId === userId && session.active) {
                if (now - (session.startedAt || 0) > TTL_MS) {
                    session.active = false
                    this.activeDinoRounds.delete(session.roundId)
                    continue
                }
                return {
                    roundId: session.roundId,
                    difficulty: session.difficulty,
                    betAmount: session.betAmount,
                    currency: session.currency,
                    obstaclesCleared: session.obstaclesCleared,
                    currentMultiplier: session.currentMultiplier,
                    nextMultiplier: this.calculateMultiplier(session.difficulty, session.obstaclesCleared + 1),
                    potentialWin: parseFloat((session.betAmount * session.currentMultiplier).toFixed(2)),
                    active: true,
                    startedAt: session.startedAt
                }
            }
        }
        return null
    }

    static evaluate() {
        const err = new Error('Dino bets must be placed via the server-authoritative session routes at /api/games/dino/*')
        err.status = 400
        throw err
    }
}

export const dinoEngine = new DinoEngine()
export default DinoEngine
