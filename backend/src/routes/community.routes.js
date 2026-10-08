// =============================================================================
// 👑 AmratGames.com — Community, Social & Daily Wager Race Routes
// Real-time chat HTTP fallback, bet slip sharing, Chat Rain & ₹50K Race Leaderboard
// =============================================================================

import express from 'express'
import { authenticate } from '../middleware/auth.js'
import { chatService } from '../services/ChatService.js'
import { antiFraudService } from '../services/AntiFraudService.js'
import { db } from '../db/db.js'

const router = express.Router()

// ── 1. Community Chat Endpoints ─────────────────────────────
// GET /api/community/chat/messages
router.get('/chat/messages', (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 50
        res.json({
            success: true,
            messages: chatService.getRecentMessages(limit)
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/community/chat/send
router.post('/chat/send', authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required to post chat messages' })
        }
        const { text } = req.body
        const message = await chatService.postMessage({ user: req.user, text })
        res.json({ success: true, message })
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

// POST /api/community/chat/share-bet
router.post('/chat/share-bet', authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required to share bet' })
        }
        const { betId } = req.body
        const message = await chatService.shareBet({ user: req.user, betId })
        res.json({ success: true, message })
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

// POST /api/community/chat/rain
router.post('/chat/rain', authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required to sponsor chat rain' })
        }
        const { amount, numWinners, currency = 'INR' } = req.body
        const rainMessage = await chatService.triggerRain({
            user: req.user,
            amount,
            numWinners,
            currency
        })
        res.json({ success: true, rainMessage })
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

// ── 2. Daily ₹50,000 Wager Race Leaderboard ─────────────────
// GET /api/community/leaderboard/daily-race
router.get('/leaderboard/daily-race', (req, res) => {
    try {
        const now = Date.now()
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()

        // 1. Filter bets from the last 24 hours
        const recentBets = (db.data.bets || []).filter(b => b.timestamp >= oneDayAgo)

        // 2. Aggregate turnover by user
        const turnoverMap = new Map() // userId -> { username, totalWagered }
        for (const b of recentBets) {
            const uid = b.userId
            if (!uid) continue

            const prev = turnoverMap.get(uid) || {
                userId: uid,
                username: b.username || 'Anonymous',
                wagered: 0
            }

            // Normalize currency to INR
            let inrAmount = parseFloat(b.betAmount || 0)
            if (b.currency === 'USDT') inrAmount *= 86
            else if (b.currency === 'BTC') inrAmount *= 8500000
            else if (b.currency === 'AMRAT') inrAmount *= 10

            prev.wagered += inrAmount
            turnoverMap.set(uid, prev)
        }

        // 3. Include demo seeds if fresh instance to populate leaderboard realistically
        if (turnoverMap.size < 5) {
            const seedRacers = [
                { userId: 'usr_racer_1', username: 'KaranSharma_77', wagered: 84500 },
                { userId: 'usr_racer_2', username: 'Deepak_Trader', wagered: 62100 },
                { userId: 'usr_racer_3', username: 'RoyalSpinner', wagered: 41800 },
                { userId: 'usr_racer_4', username: 'Ananya_Gamer', wagered: 29500 },
                { userId: 'usr_racer_5', username: 'Vicky_LimboKing', wagered: 18200 },
                { userId: 'usr_racer_6', username: 'Pooja_99', wagered: 12400 },
                { userId: 'usr_racer_7', username: 'CryptoGuruIN', wagered: 9800 }
            ]
            for (const s of seedRacers) {
                if (!turnoverMap.has(s.userId)) {
                    turnoverMap.set(s.userId, s)
                }
            }
        }

        // 4. Sort and assign prize distribution
        const sorted = Array.from(turnoverMap.values())
            .sort((a, b) => b.wagered - a.wagered)

        const TOTAL_PRIZE_POOL = 50000
        const prizeSchedule = [15000, 10000, 7500, 4000, 4000, 1900, 1900, 1900, 1900, 1900]

        const leaderboard = sorted.slice(0, 10).map((player, idx) => {
            const userRecord = db.findUserById(player.userId)
            const vip = db.getVipTier(userRecord?.totalWagered || player.wagered)

            return {
                rank: idx + 1,
                userId: player.userId,
                username: player.username,
                vipTier: vip.tier.charAt(0).toUpperCase() + vip.tier.slice(1),
                wagered: parseFloat(player.wagered.toFixed(2)),
                prizeAmount: prizeSchedule[idx] || 0
            }
        })

        // 5. Countdown to UTC midnight
        const midnight = new Date()
        midnight.setUTCHours(24, 0, 0, 0)
        const secondsRemaining = Math.max(0, Math.floor((midnight.getTime() - now) / 1000))

        res.json({
            success: true,
            raceName: 'Daily ₹50,000 Turnover Sprint',
            totalPrizePool: TOTAL_PRIZE_POOL,
            currency: 'INR',
            secondsRemaining,
            leaderboard,
            totalParticipants: turnoverMap.size
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// ── 3. Risk Score Query ─────────────────────────────────────
// GET /api/community/risk/my-score
router.get('/risk/my-score', authenticate, (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' })
        }
        const profile = antiFraudService.calculateRiskScore(req.user.id)
        res.json({ success: true, profile })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

export default router
