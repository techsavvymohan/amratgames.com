// =============================================================================
// 👑 AmratGames.com — Synchronized Global Color Match / Win Go 30s Room Engine
// Centralized server-authoritative 24/7 background room ticker broadcasting
// Provably Fair 30-second draws & identical outcomes globally for ALL users.
// =============================================================================

import crypto from 'node:crypto'
import { db } from '../db/db.js'
import { CONFIG } from '../config.js'
import { broadcastEvent } from '../websocket.js'
import { ColorMatchEngine } from '../games/color-match/color-match.engine.js'
import { bankrollRisk } from './BankrollRiskService.js'

export class ColorMatchRoomService {
    constructor() {
        this.isRunning = false
        this.tickTimer = null
        this.periodId = this.calculateCurrentPeriod()
        this.timeLeft = this.calculateSecondsRemaining()
        this.isLocked = this.timeLeft <= 5
        this.isDrawing = false
        this.activeBets = new Map() // periodId -> Array of user bets
        this.history = [] // Last 50 completed rounds
        this.recentBalls = [] // Last 5 balls for billboard
        this.lastDrawnPeriod = 0

        // Seed initial history matching deterministic cryptographic rolls
        this.seedInitialHistory()
    }

    calculateSecondsRemaining() {
        const nowSec = Math.floor(Date.now() / 1000)
        const secInCycle = nowSec % 30
        return 30 - secInCycle // 1 to 30
    }

    calculatePeriodForTime(dateObj = new Date()) {
        const yyyy = dateObj.getFullYear()
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0')
        const dd = String(dateObj.getDate()).padStart(2, '0')
        const secToday = dateObj.getHours() * 3600 + dateObj.getMinutes() * 60 + dateObj.getSeconds()
        const roundNum = Math.floor(secToday / 30) + 1
        return parseInt(`${yyyy}${mm}${dd}30${String(roundNum).padStart(4, '0')}`, 10)
    }

    calculateCurrentPeriod() {
        return this.calculatePeriodForTime(new Date())
    }

    // Cryptographically derive outcome for any period (100% Provably Fair & Deterministic)
    generateOutcomeForPeriod(period) {
        let serverSeed = CONFIG?.PROVABLY_FAIR_DEFAULT_SERVER_SEED || 'amrat_fair_seed_default_2026'
        try {
            if (typeof db !== 'undefined' && db?.data?.settings?.currentServerSeed) {
                serverSeed = db.data.settings.currentServerSeed
            }
        } catch {}
        const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex')
        const clientSeed = 'amrat_wingo_public'
        const hmac = crypto.createHmac('sha256', serverSeed).update(`wingo_30s:${period}:${clientSeed}`).digest('hex')

        const luckyNumber = parseInt(hmac.slice(0, 4), 16) % 10

        const colors = []
        if (luckyNumber === 0) colors.push('red', 'violet')
        else if (luckyNumber === 5) colors.push('green', 'violet')
        else if ([1, 3, 7, 9].includes(luckyNumber)) colors.push('green')
        else colors.push('red')

        const bigSmall = luckyNumber >= 5 ? 'big' : 'small'

        return {
            period,
            luckyNumber,
            winningColors: colors,
            bigSmall,
            hash: hmac,
            serverSeedHash
        }
    }

    seedInitialHistory() {
        const now = Date.now()
        const rounds = []
        for (let i = 1; i <= 30; i++) {
            const pastTime = new Date(now - i * 30000)
            const pastPeriod = this.calculatePeriodForTime(pastTime)
            const outcome = this.generateOutcomeForPeriod(pastPeriod)
            rounds.push({
                period: outcome.period,
                num: outcome.luckyNumber,
                colors: outcome.winningColors,
                bigSmall: outcome.bigSmall,
                hash: outcome.hash,
                serverSeedHash: outcome.serverSeedHash,
                drawnAt: pastTime.toISOString()
            })
        }
        this.history = rounds
        this.recentBalls = rounds.slice(0, 5)
    }

    start() {
        if (this.isRunning) return
        this.isRunning = true

        // Re-align with current clock
        this.periodId = this.calculateCurrentPeriod()
        this.timeLeft = this.calculateSecondsRemaining()
        this.isLocked = this.timeLeft <= 5

        // Tick every 1000ms
        this.tickTimer = setInterval(() => this.tick(), 1000)
        if (this.tickTimer.unref) this.tickTimer.unref()

        console.log('[COLOR MATCH] Global 24/7 background room engine initialized and ticking')
    }

    stop() {
        if (this.tickTimer) {
            clearInterval(this.tickTimer)
            this.tickTimer = null
        }
        this.isRunning = false
    }

    tick() {
        if (!this.isRunning) return

        const secRem = this.calculateSecondsRemaining()
        const currentPeriod = this.calculateCurrentPeriod()

        this.timeLeft = secRem
        this.isLocked = secRem <= 5

        // If period has rotated or is at boundary, execute draw for the previous period
        if (secRem === 30 || (this.periodId !== currentPeriod && this.lastDrawnPeriod !== this.periodId)) {
            const finishedPeriod = this.periodId
            this.periodId = currentPeriod
            this.lastDrawnPeriod = finishedPeriod
            this.handleRoundDraw(finishedPeriod)
        } else {
            this.periodId = currentPeriod
        }

        // Broadcast clock sync tick every second to all connected clients
        broadcastEvent('COLOR_GAME_TICK', {
            periodId: this.periodId,
            timeLeft: this.timeLeft,
            isLocked: this.isLocked,
            isDrawing: this.isDrawing,
            serverTime: Date.now()
        })
    }

    async handleRoundDraw(periodToDraw) {
        this.isDrawing = true
        const outcome = this.generateOutcomeForPeriod(periodToDraw)

        const roundResult = {
            period: periodToDraw,
            num: outcome.luckyNumber,
            colors: outcome.winningColors,
            bigSmall: outcome.bigSmall,
            hash: outcome.hash,
            serverSeedHash: outcome.serverSeedHash,
            drawnAt: new Date().toISOString()
        }

        // Prepend to history & recent balls
        this.history.unshift(roundResult)
        if (this.history.length > 50) this.history = this.history.slice(0, 50)
        this.recentBalls = this.history.slice(0, 5)

        // Settle all active player bets placed for this period
        const periodBets = this.activeBets.get(periodToDraw) || []
        this.activeBets.delete(periodToDraw)

        // Clean up any stale bets older than 5 periods
        for (const [p] of this.activeBets.entries()) {
            if (p < periodToDraw - 3) {
                this.activeBets.delete(p)
            }
        }

        for (const playerBet of periodBets) {
            try {
                await this.settlePlayerBet(playerBet, outcome)
            } catch (err) {
                console.error(`[COLOR MATCH] Error settling bet for user ${playerBet.userId}:`, err.message)
            }
        }

        // Broadcast outcome to all live clients
        broadcastEvent('COLOR_GAME_DRAW', {
            ...roundResult,
            recentBalls: this.recentBalls,
            history: this.history.slice(0, 15)
        })

        // Conclude drawing visual phase after 2 seconds
        setTimeout(() => {
            this.isDrawing = false
        }, 2000)
    }

    async settlePlayerBet(playerBet, outcome) {
        const { userId, username, currency = 'INR', bets, totalAmount } = playerBet
        const { luckyNumber, winningColors, bigSmall } = outcome

        let payout = 0
        const calculatedTotal = Object.values(bets).reduce((a, b) => a + (parseFloat(b) || 0), 0) || totalAmount

        if (bets.green && winningColors.includes('green')) {
            const mult = winningColors.includes('violet') ? 1.45 : 1.95
            payout += (parseFloat(bets.green) || 0) * mult
        }
        if (bets.red && winningColors.includes('red')) {
            const mult = winningColors.includes('violet') ? 1.45 : 1.95
            payout += (parseFloat(bets.red) || 0) * mult
        }
        if (bets.violet && winningColors.includes('violet')) {
            payout += (parseFloat(bets.violet) || 0) * 4.5
        }
        const numKey = `num_${luckyNumber}`
        if (bets[numKey]) {
            payout += (parseFloat(bets[numKey]) || 0) * 9.0
        }
        if (bets[bigSmall]) {
            payout += (parseFloat(bets[bigSmall]) || 0) * 1.95
        }

        payout = parseFloat(payout.toFixed(2))
        const won = payout >= calculatedTotal

        await db.withUserLock(userId, async () => {
            if (won && payout > 0) {
                db.updateUserBalance(userId, currency, payout, `Win Go 30s Payout (Period ${playerBet.periodId})`)
            }

            const betRecord = db.recordBet({
                userId,
                username,
                game: 'color-match',
                gameName: 'Win Go 30s',
                currency,
                betAmount: calculatedTotal,
                multiplier: calculatedTotal > 0 ? parseFloat((payout / calculatedTotal).toFixed(2)) : 0,
                payout,
                profit: payout - calculatedTotal,
                won,
                hash: outcome.hash
            })

            if (won) {
                broadcastEvent('NEW_BET', betRecord)
            }
        })

        // Notify specific user of their individual settlement
        broadcastEvent('COLOR_GAME_PLAYER_SETTLEMENT', {
            userId,
            periodId: playerBet.periodId,
            won,
            payout,
            multiplier: calculatedTotal > 0 ? parseFloat((payout / calculatedTotal).toFixed(2)) : 0,
            outcome
        })
    }

    async placeBet({ userId, username, periodId, bets, currency = 'INR' }) {
        const activePeriod = this.periodId
        const targetPeriod = parseInt(periodId, 10) || activePeriod

        // Validate that user is placing into active period or next period
        if (targetPeriod !== activePeriod) {
            const err = new Error(`Cannot place bet for period ${targetPeriod}. Active period is ${activePeriod}`)
            err.status = 400
            err.code = 'INVALID_PERIOD'
            throw err
        }

        // Validate 5-second countdown lock
        if (this.isLocked || this.timeLeft <= 5) {
            const err = new Error('Round is locked for drawing. Please wait for the next 30s period.')
            err.status = 400
            err.code = 'ROUND_LOCKED'
            throw err
        }

        if (!bets || typeof bets !== 'object' || Object.keys(bets).length === 0) {
            const err = new Error('At least one target bet is required')
            err.status = 400
            throw err
        }

        let totalAmount = 0
        for (const [k, v] of Object.entries(bets)) {
            const val = parseFloat(v)
            if (val > 0) totalAmount += val
        }

        if (totalAmount <= 0) {
            const err = new Error('Valid bet amount is required')
            err.status = 400
            throw err
        }

        const minBet = bankrollRisk.getMinBet(currency) || 1
        const maxBet = bankrollRisk.getMaxBet(currency) || 50000

        if (totalAmount < minBet) {
            const err = new Error(`Minimum total bet is ${minBet} ${currency}`)
            err.status = 400
            throw err
        }
        if (totalAmount > maxBet) {
            const err = new Error(`Maximum bet limit is ${maxBet} ${currency}`)
            err.status = 400
            throw err
        }

        // Deduct balance securely under exclusive lock
        const result = await db.withUserLock(userId, async () => {
            const user = db.findUserById(userId)
            if (!user) {
                const err = new Error('User not found')
                err.status = 404
                throw err
            }

            const bal = user.balances?.[currency] || 0
            if (totalAmount > bal + 0.0001) {
                const err = new Error(`Insufficient ${currency} balance`)
                err.status = 400
                throw err
            }

            db.updateUserBalance(userId, currency, -totalAmount, `Win Go 30s Stake (Period ${targetPeriod})`)

            const betId = 'cbet_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex')
            const betRecord = {
                id: betId,
                userId,
                username,
                currency,
                periodId: targetPeriod,
                bets: { ...bets },
                totalAmount,
                createdAt: new Date().toISOString()
            }

            if (!this.activeBets.has(targetPeriod)) {
                this.activeBets.set(targetPeriod, [])
            }
            this.activeBets.get(targetPeriod).push(betRecord)

            const updatedUser = db.findUserById(userId) || user
            return { user: updatedUser, bet: betRecord }
        })

        return {
            success: true,
            bet: result.bet,
            periodId: targetPeriod,
            totalAmount,
            balances: result.user?.balances || {}
        }
    }

    getState() {
        return {
            periodId: this.periodId,
            timeLeft: this.timeLeft,
            isLocked: this.isLocked,
            isDrawing: this.isDrawing,
            recentBalls: this.recentBalls,
            history: this.history.slice(0, 30),
            serverTime: Date.now()
        }
    }
}

export const colorMatchRoomService = new ColorMatchRoomService()
export default colorMatchRoomService
