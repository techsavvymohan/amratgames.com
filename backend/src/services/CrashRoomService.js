// =============================================================================
// 👑 AmratGames.com — Synchronized Multiplayer Crash Room & Real-Time Engine
// Centralized server-authoritative room ticker broadcasting Provably Fair flights
// =============================================================================

import crypto from 'node:crypto'
import { db } from '../db/db.js'
import { CONFIG } from '../config.js'
import { broadcastEvent } from '../websocket.js'
import { gameEngine } from './GameEngine.js'

export class CrashRoomService {
    constructor() {
        this.state = 'WAITING' // 'WAITING' | 'FLYING' | 'CRASHED'
        this.roundId = this.generateRoundId()
        this.crashPoint = 1.00
        this.hash = ''
        this.currentMultiplier = 1.00
        this.countdown = 6 // 6 seconds betting window
        this.flightStartTime = null
        this.crashTime = null
        this.activeBets = new Map() // userId -> bet object
        this.history = [] // Last 30 crashed round results
        this.tickTimer = null
        this.isRunning = false

        // Seed 10 recent historical multipliers for immediate display
        this.seedInitialHistory()
    }

    seedInitialHistory() {
        const demoPoints = [1.45, 2.80, 1.15, 5.40, 1.88, 12.30, 1.02, 3.15, 1.95, 2.10]
        const now = Date.now()
        this.history = demoPoints.map((pt, i) => ({
            roundId: 'crash_hist_' + (now - (10 - i) * 15000).toString(36),
            crashPoint: pt,
            hash: crypto.randomBytes(16).toString('hex'),
            crashedAt: new Date(now - (10 - i) * 15000).toISOString()
        }))
    }

    generateRoundId() {
        return 'room_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex')
    }

    start() {
        if (this.isRunning) return
        this.isRunning = true
        this.startWaitingPhase()

        // Central room ticker (100ms interval / 10Hz)
        this.tickTimer = setInterval(() => this.tick(), 100)
        if (this.tickTimer.unref) this.tickTimer.unref()
        console.log('[CRASH ROOM] Multiplayer room engine initialized and ticking')
    }

    stop() {
        if (this.tickTimer) {
            clearInterval(this.tickTimer)
            this.tickTimer = null
        }
        this.isRunning = false
    }

    startWaitingPhase() {
        this.state = 'WAITING'
        this.roundId = this.generateRoundId()
        this.currentMultiplier = 1.00
        this.countdown = 6
        this.activeBets.clear()
        this.flightStartTime = null

        // Generate Provably Fair outcome upfront for this round
        const serverSeed = db.data.settings?.currentServerSeed || CONFIG.PROVABLY_FAIR_DEFAULT_SERVER_SEED
        const clientSeed = 'amrat_multiplayer_public'
        const hmac = crypto.createHmac('sha256', serverSeed).update(`${this.roundId}:${clientSeed}`).digest('hex')
        this.hash = hmac

        // 52-bit float generation matching Provably Fair standard
        const hexSub = hmac.slice(0, 13)
        const intVal = parseInt(hexSub, 16)
        const floatVal = intVal / Math.pow(2, 52)

        // 1% instant bust (RTP = 99%)
        let point = 1.00
        if (floatVal >= 0.01) {
            point = Math.floor((99 / (1 - floatVal))) / 100
        }
        this.crashPoint = Math.max(1.00, Math.min(point, 1000.0))

        broadcastEvent('CRASH_ROOM_STATE', this.getState())
    }

    startFlightPhase() {
        this.state = 'FLYING'
        this.flightStartTime = Date.now()
        this.currentMultiplier = 1.00

        broadcastEvent('CRASH_ROOM_STATE', this.getState())
    }

    handleCrashPhase() {
        this.state = 'CRASHED'
        this.crashTime = Date.now()
        this.currentMultiplier = this.crashPoint

        // Record losses for any players who did not cash out before the crash
        for (const [userId, bet] of this.activeBets.entries()) {
            if (!bet.cashedOut) {
                bet.cashedOut = true
                bet.multiplier = 0
                bet.payout = 0
                bet.won = false

                try {
                    db.recordBet({
                        userId,
                        username: bet.username,
                        game: 'crash',
                        gameName: 'Crash Multiplayer',
                        currency: bet.currency,
                        betAmount: bet.betAmount,
                        multiplier: 0,
                        payout: 0,
                        profit: -bet.betAmount,
                        won: false,
                        hash: this.hash
                    })
                } catch (e) {
                    console.error('[CRASH ROOM] Error recording loss bet:', e.message)
                }
            }
        }

        // Add to historical rolls
        this.history.unshift({
            roundId: this.roundId,
            crashPoint: this.crashPoint,
            hash: this.hash,
            crashedAt: new Date().toISOString()
        })
        if (this.history.length > 30) this.history = this.history.slice(0, 30)

        broadcastEvent('CRASH_ROOM_BUST', {
            roundId: this.roundId,
            crashPoint: this.crashPoint,
            hash: this.hash,
            history: this.history.slice(0, 10)
        })

        // Wait 3 seconds post-crash, then transition back to betting window
        setTimeout(() => {
            if (this.isRunning) {
                this.startWaitingPhase()
            }
        }, 3000)
    }

    tick() {
        if (!this.isRunning) return

        if (this.state === 'WAITING') {
            this.countdown -= 0.10
            if (this.countdown <= 0) {
                this.countdown = 0
                this.startFlightPhase()
            } else {
                // Broadcast tick every full second
                if (Math.round(this.countdown * 10) % 10 === 0) {
                    broadcastEvent('CRASH_ROOM_TICK', {
                        state: 'WAITING',
                        countdown: Math.max(0, Math.ceil(this.countdown)),
                        roundId: this.roundId
                    })
                }
            }
        } else if (this.state === 'FLYING') {
            const elapsed = (Date.now() - this.flightStartTime) / 1000
            // Exponential multiplier curve: e^(0.06 * elapsed)
            const raw = Math.pow(Math.E, 0.06 * elapsed)
            this.currentMultiplier = Math.max(1.00, parseFloat(raw.toFixed(2)))

            // Check auto-cashouts for active bets
            for (const [userId, bet] of this.activeBets.entries()) {
                if (!bet.cashedOut && bet.autoCashout && this.currentMultiplier >= bet.autoCashout) {
                    this.executeAutoCashout(userId, bet, bet.autoCashout)
                }
            }

            // Check if crashed
            if (this.currentMultiplier >= this.crashPoint) {
                this.handleCrashPhase()
            } else {
                // Broadcast flight tick
                broadcastEvent('CRASH_ROOM_TICK', {
                    state: 'FLYING',
                    roundId: this.roundId,
                    multiplier: this.currentMultiplier
                })
            }
        }
    }

    async executeAutoCashout(userId, bet, targetMultiplier) {
        if (bet.cashedOut) return
        bet.cashedOut = true
        bet.won = true
        bet.multiplier = targetMultiplier
        const payout = parseFloat((bet.betAmount * targetMultiplier).toFixed(2))
        bet.payout = payout

        try {
            await db.withUserLock(userId, async () => {
                db.updateUserBalance(userId, bet.currency, payout, `Crash Multiplayer Auto-Cashout (${targetMultiplier}x)`)
                const betRecord = db.recordBet({
                    userId,
                    username: bet.username,
                    game: 'crash',
                    gameName: 'Crash Multiplayer',
                    currency: bet.currency,
                    betAmount: bet.betAmount,
                    multiplier: targetMultiplier,
                    payout,
                    profit: payout - bet.betAmount,
                    won: true,
                    hash: this.hash
                })
                broadcastEvent('NEW_BET', betRecord)
            })

            broadcastEvent('CRASH_ROOM_CASHOUT', {
                userId,
                username: bet.username,
                roundId: this.roundId,
                multiplier: targetMultiplier,
                payout
            })
        } catch (e) {
            console.error('[CRASH ROOM] Error executing auto cashout:', e.message)
        }
    }

    async placeBet({ userId, username, betAmount, autoCashout = null, currency = 'INR' }) {
        if (this.state !== 'WAITING') {
            const err = new Error('Betting is closed for the active round. Please wait for the next flight.')
            err.status = 400
            err.code = 'ROUND_ALREADY_STARTED'
            throw err
        }

        if (this.activeBets.has(userId)) {
            const err = new Error('You have already placed a bet in this round.')
            err.status = 400
            err.code = 'ALREADY_BET'
            throw err
        }

        const parsedAmount = parseFloat(betAmount)
        if (isNaN(parsedAmount) || parsedAmount < 10) {
            const err = new Error('Minimum bet is ₹10')
            err.status = 400
            throw err
        }
        if (parsedAmount > 50000) {
            const err = new Error('Maximum bet limit is ₹50,000')
            err.status = 400
            throw err
        }

        const parsedAuto = autoCashout ? parseFloat(autoCashout) : null
        if (parsedAuto && parsedAuto < 1.01) {
            const err = new Error('Auto cashout must be at least 1.01x')
            err.status = 400
            throw err
        }

        // Deduct balance securely under exclusive lock
        const result = await db.withUserLock(userId, async () => {
            const user = db.findUserById(userId)
            if (!user) throw new Error('User not found')

            const bal = user.balances?.[currency] || 0
            if (parsedAmount > bal + 0.0001) {
                const err = new Error(`Insufficient ${currency} balance`)
                err.status = 400
                throw err
            }

            db.updateUserBalance(userId, currency, -parsedAmount, 'Crash Multiplayer Bet (Room)')

            const bet = {
                id: 'cbet_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
                userId,
                username,
                currency,
                betAmount: parsedAmount,
                autoCashout: parsedAuto,
                cashedOut: false,
                payout: 0,
                multiplier: 0,
                timestamp: new Date().toISOString()
            }

            this.activeBets.set(userId, bet)
            return { user: db.findUserById(userId), bet }
        })

        broadcastEvent('CRASH_ROOM_BET', {
            roundId: this.roundId,
            bet: {
                userId,
                username,
                betAmount: parsedAmount,
                autoCashout: parsedAuto,
                currency
            }
        })

        return {
            success: true,
            bet: result.bet,
            balances: result.user.balances
        }
    }

    async cashoutPlayer({ userId }) {
        if (this.state !== 'FLYING') {
            const err = new Error('Cannot cashout when flight is not in progress')
            err.status = 400
            err.code = 'NOT_FLYING'
            throw err
        }

        const bet = this.activeBets.get(userId)
        if (!bet) {
            const err = new Error('No active bet found for this round')
            err.status = 400
            err.code = 'NO_BET'
            throw err
        }

        if (bet.cashedOut) {
            const err = new Error('Bet has already been cashed out')
            err.status = 400
            err.code = 'ALREADY_CASHED_OUT'
            throw err
        }

        const multiplier = this.currentMultiplier
        if (multiplier >= this.crashPoint) {
            const err = new Error('Rocket crashed before cashout could be processed')
            err.status = 400
            err.code = 'CRASHED'
            throw err
        }

        bet.cashedOut = true
        bet.won = true
        bet.multiplier = multiplier
        const payout = parseFloat((bet.betAmount * multiplier).toFixed(2))
        bet.payout = payout

        const updatedUser = await db.withUserLock(userId, async () => {
            db.updateUserBalance(userId, bet.currency, payout, `Crash Multiplayer Cashout (${multiplier}x)`)
            const betRecord = db.recordBet({
                userId,
                username: bet.username,
                game: 'crash',
                gameName: 'Crash Multiplayer',
                currency: bet.currency,
                betAmount: bet.betAmount,
                multiplier,
                payout,
                profit: payout - bet.betAmount,
                won: true,
                hash: this.hash
            })
            broadcastEvent('NEW_BET', betRecord)
            return db.findUserById(userId)
        })

        broadcastEvent('CRASH_ROOM_CASHOUT', {
            userId,
            username: bet.username,
            roundId: this.roundId,
            multiplier,
            payout
        })

        return {
            success: true,
            roundId: this.roundId,
            multiplier,
            payout,
            balances: updatedUser.balances
        }
    }

    getPublicBets() {
        const list = []
        for (const b of this.activeBets.values()) {
            list.push({
                userId: b.userId,
                username: b.username,
                betAmount: b.betAmount,
                autoCashout: b.autoCashout,
                cashedOut: b.cashedOut,
                payout: b.payout,
                multiplier: b.multiplier
            })
        }
        return list
    }

    getState() {
        return {
            state: this.state,
            roundId: this.roundId,
            currentMultiplier: this.currentMultiplier,
            countdown: Math.max(0, Math.ceil(this.countdown)),
            hash: this.hash,
            bets: this.getPublicBets(),
            history: this.history.slice(0, 10),
            serverTime: Date.now()
        }
    }
}

export const crashRoomService = new CrashRoomService()
