import express from 'express'
import crypto from 'node:crypto'
import { db } from '../../db/db.js'
import { authenticate } from '../../middleware/auth.js'
import { broadcastEvent } from '../../websocket.js'
import { dinoEngine } from './dino.engine.js'

const router = express.Router()

// GET /api/games/dino/active
router.get('/active', authenticate, (req, res) => {
    try {
        if (!req.user) {
            return res.json({ success: true, activeRound: null })
        }
        const activeRound = dinoEngine.getActiveRound(req.user.id)
        res.json({ success: true, activeRound })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/games/dino/start
router.post('/start', authenticate, async (req, res) => {
    try {
        const { betAmount, currency = 'INR', difficulty = 'medium', clientSeed } = req.body
        const parsedAmount = parseFloat(betAmount)

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid bet amount is required' })
        }
        if (parsedAmount > 50000) {
            return res.status(400).json({ success: false, error: 'Maximum bet limit is ₹50,000' })
        }

        if (!req.user) {
            return res.status(401).json({
                success: false,
                code: 'AUTH_REQUIRED',
                error: 'Please sign up or sign in to play Dino Run on AmratGames'
            })
        }

        const session = await db.withUserLock(req.user.id, async () => {
            const user = db.findUserById(req.user.id)
            const currentBal = user.balances?.[currency] || 0
            if (parsedAmount > currentBal + 0.0001) {
                const err = new Error(`Insufficient ${currency} balance`)
                err.status = 400
                throw err
            }

            // Deduct bet amount immediately upon round start under lock
            db.updateUserBalance(user.id, currency, -parsedAmount, `Dino Run Bet (${difficulty})`)

            return dinoEngine.startRound({
                userId: user.id,
                currency,
                betAmount: parsedAmount,
                difficulty,
                clientSeed: clientSeed || user.id
            })
        })

        const updatedUser = db.findUserById(req.user.id)
        return res.json({
            success: true,
            ...session,
            balances: updatedUser.balances
        })
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

// POST /api/games/dino/jump
router.post('/jump', authenticate, async (req, res) => {
    try {
        const { roundId } = req.body
        if (!roundId) {
            return res.status(400).json({ success: false, error: 'roundId is required' })
        }

        if (!req.user) {
            return res.status(401).json({
                success: false,
                code: 'AUTH_REQUIRED',
                error: 'Please sign up or sign in to play Dino Run'
            })
        }

        const result = await db.withUserLock(req.user.id, async () => {
            const jumpResult = dinoEngine.jump({
                userId: req.user.id,
                roundId
            })

            const currency = jumpResult.currency || 'INR'
            const betAmount = jumpResult.betAmount || 0

            if (!jumpResult.survived) {
                const betRecord = db.recordBet({
                    userId: req.user.id,
                    username: req.user.username,
                    game: 'dino',
                    gameName: 'Dino Run',
                    currency,
                    betAmount,
                    multiplier: 0,
                    payout: 0,
                    profit: -betAmount,
                    won: false,
                    hash: jumpResult.hash || crypto.randomBytes(16).toString('hex')
                })
                broadcastEvent('NEW_BET', betRecord)
            }

            return jumpResult
        })

        const user = db.findUserById(req.user.id)
        return res.json({
            success: true,
            ...result,
            balances: user.balances
        })
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

// POST /api/games/dino/cashout
router.post('/cashout', authenticate, async (req, res) => {
    try {
        const { roundId } = req.body
        if (!roundId) {
            return res.status(400).json({ success: false, error: 'roundId is required' })
        }

        if (!req.user) {
            return res.status(401).json({
                success: false,
                code: 'AUTH_REQUIRED',
                error: 'Please sign up or sign in to play Dino Run'
            })
        }

        const result = await db.withUserLock(req.user.id, async () => {
            const cashoutResult = dinoEngine.cashout({
                userId: req.user.id,
                roundId
            })

            const currency = cashoutResult.currency || 'INR'
            const payout = cashoutResult.payout || 0

            if (payout > 0) {
                db.updateUserBalance(req.user.id, currency, payout, `Dino Cashout (${cashoutResult.multiplier}x)`)
            }

            const betRecord = db.recordBet({
                userId: req.user.id,
                username: req.user.username,
                game: 'dino',
                gameName: 'Dino Run',
                currency,
                betAmount: cashoutResult.betAmount,
                multiplier: cashoutResult.multiplier,
                payout,
                profit: payout - cashoutResult.betAmount,
                won: true,
                hash: cashoutResult.hash || crypto.randomBytes(16).toString('hex')
            })

            broadcastEvent('NEW_BET', betRecord)
            return cashoutResult
        })

        const user = db.findUserById(req.user.id)
        return res.json({
            success: true,
            ...result,
            balances: user.balances
        })
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

// POST /api/games/dino/bust
router.post('/bust', authenticate, async (req, res) => {
    try {
        const { roundId } = req.body
        if (!roundId) {
            return res.status(400).json({ success: false, error: 'roundId is required' })
        }

        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' })
        }

        const result = await db.withUserLock(req.user.id, async () => {
            const bustResult = dinoEngine.bust({
                userId: req.user.id,
                roundId
            })

            if (!bustResult.alreadyClosed) {
                const currency = bustResult.currency || 'INR'
                const betAmount = bustResult.betAmount || 0
                const betRecord = db.recordBet({
                    userId: req.user.id,
                    username: req.user.username,
                    game: 'dino',
                    gameName: 'Dino Run',
                    currency,
                    betAmount,
                    multiplier: 0,
                    payout: 0,
                    profit: -betAmount,
                    won: false,
                    hash: bustResult.hash || crypto.randomBytes(16).toString('hex')
                })
                broadcastEvent('NEW_BET', betRecord)
            }

            return bustResult
        })

        const user = db.findUserById(req.user.id)
        return res.json({
            success: true,
            ...result,
            balances: user.balances
        })
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

export default router
