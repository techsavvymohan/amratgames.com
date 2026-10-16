import crypto from 'node:crypto'
import { provablyFairCore } from '../core/ProvablyFairCore.js'
import { bankrollRisk } from '../../services/BankrollRiskService.js'
import { broadcastEvent } from '../../websocket.js'
import { db } from '../../db/db.js'

export const CRASH_GROWTH_RATE = 0.16

/**
 * Crash / Rocket Flight Engine (Server-Authoritative)
 * 99% Player Return (1% instant bust house edge)
 */
export class CrashEngine {
    constructor() {
        this.activeCrashRounds = new Map() // roundId -> session

        // Periodic TTL cleaner to prevent unbounded memory leaks
        setInterval(() => {
            const now = Date.now()
            for (const [roundId, session] of this.activeCrashRounds.entries()) {
                if (now - session.startedAt > 180000) { // 3 minutes max flight lifespan
                    if (session.timer) clearTimeout(session.timer)
                    this.activeCrashRounds.delete(roundId)
                }
            }
        }, 60000)
    }

    evaluate({ claimedMultiplier, clientSeed, nonce, autoCashout = null }) {
        const { hash, floatVal, serverSeed } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

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
            hash,
            serverSeed
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
        const { hash, floatVal, serverSeed } = provablyFairCore.generateHmacFloat(clientSeed, nonce)
        const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex')

        let crashPoint = 1.00
        if (floatVal >= 0.01) {
            crashPoint = Math.floor((99 / (1 - floatVal))) / 100
        }
        crashPoint = Math.max(1.00, Math.min(crashPoint, 1000.0))

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
                        hash: activeSession.hash
                    })
                } catch {}
            }
        }, flightDurationMs)

        this.activeCrashRounds.set(roundId, session)

        // Return commitment only - NEVER leak crashPoint or raw HMAC to client upfront
        return {
            roundId,
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

        if (requestedMultiplier > maxReachableMultiplier) {
            throw new Error('Requested multiplier exceeds elapsed flight progress')
        }

        session.active = false
        if (session.timer) clearTimeout(session.timer)
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
            crashPoint: session.crashPoint, // Revealed only now upon round conclusion
            hash: session.hash,
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
            serverSeed: session.serverSeed,
            serverSeedHash: session.serverSeedHash
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
