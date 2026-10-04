import express from 'express'
import crypto from 'node:crypto'
import { db } from '../db/db.js'
import { requireAuth } from '../middleware/auth.js'
import { broadcastEvent } from '../websocket.js'

const router = express.Router()

// GET /api/games/recent
router.get('/recent', (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 20
        const bets = db.getRecentBets(limit)
        res.json({ success: true, bets })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// GET /api/games/provably-fair/seed
router.get('/provably-fair/seed', (req, res) => {
    try {
        res.json({
            success: true,
            serverSeedHash: db.data.settings.serverSeedHash,
            rtp: db.data.settings.rtp,
            houseEdge: db.data.settings.houseEdge,
            announcement: db.data.settings.activeAnnouncements
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/games/bet
router.post('/bet', requireAuth, (req, res) => {
    try {
        const {
            game = 'crash',
            gameName = 'Crash 1000x',
            currency = 'INR',
            betAmount,
            multiplier = 0,
            won = false
        } = req.body

        const parsedAmount = parseFloat(betAmount)
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid bet amount is required' })
        }

        const user = db.findUserById(req.user.id)
        const currentBal = user.balances?.[currency] || 0

        if (parsedAmount > currentBal) {
            return res.status(400).json({ success: false, error: `Insufficient ${currency} balance to place bet` })
        }

        const payout = won ? parseFloat((parsedAmount * multiplier).toFixed(2)) : 0
        const profit = payout - parsedAmount

        // Deduct wager & add payout atomically
        const netChange = profit
        db.updateUserBalance(
            user.id,
            currency,
            netChange,
            `Bet on ${gameName} (${won ? `Won ${multiplier}x` : 'Bust'})`
        )

        const betRecord = db.recordBet({
            userId: user.id,
            username: user.username,
            game,
            gameName,
            currency,
            betAmount: parsedAmount,
            multiplier: parseFloat(multiplier.toFixed(2)),
            payout,
            profit,
            won: Boolean(won),
            hash: crypto.randomBytes(16).toString('hex')
        })

        // Broadcast live bet to all connected clients
        broadcastEvent('NEW_BET', betRecord)

        const updatedUser = db.findUserById(user.id)
        res.json({
            success: true,
            bet: betRecord,
            balances: updatedUser.balances
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

export default router
