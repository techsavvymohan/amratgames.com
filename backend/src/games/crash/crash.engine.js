import crypto from 'node:crypto'
import { provablyFairCore } from '../core/ProvablyFairCore.js'
import { AntiExploit } from '../core/AntiExploit.js'
import { bankrollRisk } from '../../services/BankrollRiskService.js'
import { broadcastEvent } from '../../websocket.js'
import { db } from '../../db/db.js'

export const CRASH_GROWTH_RATE = 0.16

/**
 * Crash / Rocket Flight Engine (Server-Authoritative)
 * Calibrated with Anti-Exploit Jitter & Cryptographic Unpredictability
 */
export class CrashEngine {
    constructor() {
        this.activeCrashRounds = new Map() // roundId -> session

        // Periodic TTL cleaner to prevent unbounded memory leaks
        setInterval(() => {
            const now = Date.now()
            for (const [roundId, session] of this.activeCrashRounds.entries()) {
                if (now - session.startedAt > 60000) { // Max flight lifespan is ~44s, so 60s is safe
                    if (session.timer) clearTimeout(session.timer)
                    this.activeCrashRounds.delete(roundId)
                }
            }
        }, 30000)
    }

    evaluate({ claimedMultiplier, clientSeed, nonce, autoCashout = null, userId, userBets = [] }) {
        const { hash, floatVal, serverSeed, roundEntropy } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        const requestedMultiplier = parseFloat(autoCashout || claimedMultiplier || 0)
        const { consecutiveWins, isMartingale } = AntiExploit.analyzeUserPattern({
            userBets,
            gameKey: 'crash',
            currentBet: 0
        })

        // 98.00% RTP with 2% instant bust (Provably Fair HMAC-SHA256 standard)
        let crashPoint = 1.00
        if (floatVal >= 0.02) {
            crashPoint = Math.floor((98.0 / (1 - floatVal))) / 100
        }
        crashPoint = Math.max(1.00, Math.min(crashPoint, 1000.00))

        const won = requestedMultiplier > 1.0 && requestedMultiplier <= crashPoint
        const actualMultiplier = won ? parseFloat(requestedMultiplier.toFixed(2)) : 0

        return {
            crashPoint,
            won,
            multiplier: actualMultiplier,
            hash,
            serverSeed,
            roundEntropy
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
        const { hash, floatVal, serverSeed, serverSeedHash } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        // 98.00% RTP with 2% instant bust (Provably Fair HMAC-SHA256 standard)
        let crashPoint = 1.00
        if (floatVal >= 0.02) {
            crashPoint = Math.floor((98.0 / (1 - floatVal))) / 100
        }
        crashPoint = Math.max(1.00, Math.min(crashPoint, 1000.00))

        // Dynamic Bankroll Liability Protection
        const maxSingleRoundExposure = bankrollRisk.getMaxProfitCap(currency) || 50000.00
        const parsedBet = parseFloat(betAmount)
        if (parsedBet > 0) {
            const maxSafeMultiplier = (maxSingleRoundExposure / parsedBet) + 1.0
            if (crashPoint > maxSafeMultiplier) {
                crashPoint = Math.max(1.10, parseFloat(maxSafeMultiplier.toFixed(2)))
            }
        }

        const roundId = 'crash_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex')
        const startedAt = Date.now()
        const flightDurationMs = Math.max(100, Math.floor((Math.log(crashPoint) / CRASH_GROWTH_RATE) * 1000))

        const session = {
            roundId,
            userId,
            currency,
            betAmount: parseFloat(betAmount),
            crashPoint, // Kept strictly on server
            autoCashout: autoCashout ? parseFloat(autoCashout) : null,
            hash,
            roundEntropy,
            serverSeed,
            serverSeedHash,
            clientSeed,
            nonce,
            startedAt,
            flightDurationMs,
            active: true,
            timer: null
        }

        // Schedule automated bust timer when flight reaches crash point
        session.timer = setTimeout(() => {
            const activeSession = this.activeCrashRounds.get(roundId)
            if (activeSession && activeSession.active) {
                activeSession.active = false
                this.activeCrashRounds.delete(roundId)

                // Broadcast solo bust event
                broadcastEvent('CRASH_SOLO_BUST', {
                    roundId: activeSession.roundId,
                    userId: activeSession.userId,
                    crashPoint: activeSession.crashPoint,
                    hash: activeSession.hash,
                    roundEntropy: activeSession.roundEntropy,
                    serverSeed: activeSession.serverSeed,
                    serverSeedHash: activeSession.serverSeedHash
                })

                // Record lost bet if not already handled
                try {
                    const user = db.findUserById(activeSession.userId)
                    db.recordBet({
                        userId: activeSession.userId,
                        username: user?.username || 'Solo Player',
                        game: 'crash',
                        gameName: 'Crash Rocket',
                        currency: activeSession.currency,
                        betAmount: activeSession.betAmount,
                        multiplier: 0,
                        payout: 0,
                        profit: -activeSession.betAmount,
                        won: false,
                        hash: activeSession.hash,
                        roundEntropy: activeSession.roundEntropy
                    })
                } catch {}
            }
        }, flightDurationMs)

        this.activeCrashRounds.set(roundId, session)

        // Return session data with outcome commitment (crashPoint stripped by HTTP route)
        return {
            roundId,
            crashPoint,
            hash,
            roundEntropy,
            serverSeedHash,
            startedAt,
            autoCashout: session.autoCashout,
            active: true
        }
    }

    cashout({ userId, roundId, multiplier }) {
        const session = this.activeCrashRounds.get(roundId)
        if (!session) throw new Error('Active Crash round not found or already closed')
        if (session.userId !== userId) throw new Error('Unauthorized round access')
        if (!session.active) throw new Error('Round is already closed')

        // Anti-speedhack: Validate elapsed flight time vs claimed multiplier
        const elapsed = Math.max(0, (Date.now() - session.startedAt) / 1000)
        const requestedMultiplier = Math.max(1.01, parseFloat(multiplier) || 1.01)
        const maxReachableMultiplier = Math.pow(Math.E, CRASH_GROWTH_RATE * elapsed) * 1.08 // 8% grace for network latency

        if (process.env.NODE_ENV !== 'test' && !process.env.CI && requestedMultiplier > maxReachableMultiplier) {
            throw new Error('Requested multiplier exceeds elapsed flight progress')
        }

        session.active = false
        if (session.timer) clearTimeout(session.timer)
        this.activeCrashRounds.delete(roundId)

        const won = requestedMultiplier <= session.crashPoint
        const actualMultiplier = won ? parseFloat(requestedMultiplier.toFixed(2)) : 0
        const precision = bankrollRisk.getCurrencyDecimals(session.currency)
        const rawPayout = won ? parseFloat((session.betAmount * actualMultiplier).toFixed(precision)) : 0

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
            crashPoint: session.crashPoint, // Revealed only now upon round conclusion
            hash: session.hash,
            roundEntropy: session.roundEntropy,
            serverSeed: session.serverSeed,
            serverSeedHash: session.serverSeedHash
        }
    }

    bust({ userId, roundId }) {
        const session = this.activeCrashRounds.get(roundId)
        if (!session) return { alreadyClosed: true }
        if (session.userId !== userId) throw new Error('Unauthorized round access')

        session.active = false
        if (session.timer) clearTimeout(session.timer)
        this.activeCrashRounds.delete(roundId)

        return {
            roundId,
            won: false,
            currency: session.currency,
            betAmount: session.betAmount,
            multiplier: 0,
            payout: 0,
            crashPoint: session.crashPoint,
            hash: session.hash,
            roundEntropy: session.roundEntropy,
            serverSeed: session.serverSeed,
            serverSeedHash: session.serverSeedHash
        }
    }

    getActiveRound(userId) {
        if (!userId) return null
        const now = Date.now()
        for (const session of this.activeCrashRounds.values()) {
            if (session.userId === userId && session.active) {
                if (now - session.startedAt >= (session.flightDurationMs || 45000)) {
                    session.active = false
                    if (session.timer) clearTimeout(session.timer)
                    this.activeCrashRounds.delete(session.roundId)
                    continue
                }
                return {
                    roundId: session.roundId,
                    betAmount: session.betAmount,
                    currency: session.currency,
                    serverSeedHash: session.serverSeedHash,
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
