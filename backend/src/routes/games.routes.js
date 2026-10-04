import express from 'express'
import crypto from 'node:crypto'
import { db } from '../db/db.js'
import { authenticate } from '../middleware/auth.js'
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
router.post('/bet', authenticate, (req, res) => {
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
        if (parsedAmount > 50000) {
            return res.status(400).json({ success: false, error: 'Maximum bet limit is ₹50,000 per round' })
        }

        // Enforce game-specific max multiplier ceilings
        const GAME_MAX_MULTIPLIERS = {
            'limbo': 5000.00,
            'crash': 5000.00,
            'plinko': 5000.00,
            'dino': 5000.00,
            'mines': 50000.00,
            'dragon-tiger': 9.00,
            'color-match': 9.00
        }
        const maxMult = GAME_MAX_MULTIPLIERS[game] || 1000.00

        let numMultiplier = Math.max(0, parseFloat(multiplier) || 0)
        if (!won) {
            numMultiplier = 0
        } else if (numMultiplier > maxMult) {
            return res.status(400).json({
                success: false,
                error: `Multiplier ${numMultiplier}x exceeds ceiling (${maxMult}x) for ${game}`
            })
        }

        const payout = won ? parseFloat((parsedAmount * numMultiplier).toFixed(2)) : 0
        const profit = payout - parsedAmount

        let betRecord = null
        let updatedBalances = null

        if (req.user) {
            const user = db.findUserById(req.user.id)
            const currentBal = user.balances?.[currency] || 0

            // If user's balance is lower than wager, enforce check
            if (parsedAmount > currentBal + 0.01) {
                return res.status(400).json({ success: false, error: `Insufficient ${currency} balance to place bet` })
            }

            // Deduct wager & add payout atomically in DB
            const netChange = profit
            db.updateUserBalance(
                user.id,
                currency,
                netChange,
                `Bet on ${gameName} (${won ? `Won ${numMultiplier.toFixed(2)}x` : 'Bust'})`
            )

            betRecord = db.recordBet({
                userId: user.id,
                username: user.username,
                game,
                gameName,
                currency,
                betAmount: parsedAmount,
                multiplier: parseFloat(numMultiplier.toFixed(2)),
                payout,
                profit,
                won: Boolean(won),
                hash: crypto.randomBytes(16).toString('hex')
            })

            const updatedUser = db.findUserById(user.id)
            updatedBalances = updatedUser.balances
        } else {
            // Unauthenticated guest player
            betRecord = db.recordBet({
                userId: null,
                username: 'Player_' + crypto.randomBytes(2).toString('hex'),
                game,
                gameName,
                currency,
                betAmount: parsedAmount,
                multiplier: parseFloat(numMultiplier.toFixed(2)),
                payout,
                profit,
                won: Boolean(won),
                hash: crypto.randomBytes(16).toString('hex')
            })
        }

        // Broadcast live bet to all connected clients & admin panel
        broadcastEvent('NEW_BET', betRecord)

        res.json({
            success: true,
            bet: betRecord,
            balances: updatedBalances
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

export default router
