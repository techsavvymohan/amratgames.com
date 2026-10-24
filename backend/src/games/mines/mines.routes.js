import express from 'express'
import crypto from 'node:crypto'
import { db } from '../../db/db.js'
import { authenticate } from '../../middleware/auth.js'
import { broadcastEvent } from '../../websocket.js'
import { minesEngine } from './mines.engine.js'
import { gameActionLimiter } from '../../middleware/rateLimiter.js'

const router = express.Router()

// GET /api/games/mines/active
router.get('/active', authenticate, (req, res) => {
    try {
        const effectiveUserId = req.user ? req.user.id : (req.headers['x-guest-session'] || 'guest_demo')
        const activeRound = minesEngine.getActiveRound(effectiveUserId)
        res.json({ success: true, activeRound })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/games/mines/start
router.post('/start', gameActionLimiter, authenticate, async (req, res) => {
    try {
        const { betAmount, currency = 'INR', minesCount = 3, clientSeed } = req.body
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
                error: 'Please sign up or sign in to play Mines on AmratGames'
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
            db.updateUserBalance(user.id, currency, -parsedAmount, `Mines Bet (${minesCount} mines)`)

            return minesEngine.startRound({
                userId: user.id,
                currency,
                betAmount: parsedAmount,
                minesCount,
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

// POST /api/games/mines/reveal
router.post('/reveal', gameActionLimiter, authenticate, async (req, res) => {
    try {
        const { roundId, tileIndex } = req.body
        if (!roundId || tileIndex === undefined) {
            return res.status(400).json({ success: false, error: 'roundId and tileIndex are required' })
        }

        if (!req.user) {
            return res.status(401).json({
                success: false,
                code: 'AUTH_REQUIRED',
                error: 'Please sign up or sign in to play Mines on AmratGames'
            })
        }

        const result = await db.withUserLock(req.user.id, async () => {
            const revealResult = minesEngine.revealTile({
                userId: req.user.id,
                roundId,
                tileIndex
            })

            const currency = revealResult.currency || 'INR'
            const betAmount = revealResult.betAmount || 0

            if (revealResult.hitMine) {
                const betRecord = db.recordBet({
                    userId: req.user.id,
                    username: req.user.username,
                    game: 'mines',
                    gameName: 'Mines',
                    currency,
                    betAmount,
                    multiplier: 0,
                    payout: 0,
                    profit: -betAmount,
                    won: false,
                    hash: revealResult.hash || crypto.randomBytes(16).toString('hex')
                })
                broadcastEvent('NEW_BET', betRecord)
            } else if (revealResult.autoWin && revealResult.payout > 0) {
                db.updateUserBalance(req.user.id, currency, revealResult.payout, `Mines Auto Win (${revealResult.multiplier || revealResult.currentMultiplier}x)`)
                const betRecord = db.recordBet({
                    userId: req.user.id,
                    username: req.user.username,
                    game: 'mines',
                    gameName: 'Mines',
                    currency,
                    betAmount,
                    multiplier: revealResult.multiplier || revealResult.currentMultiplier,
                    payout: revealResult.payout,
                    profit: revealResult.payout - betAmount,
                    won: true,
                    hash: revealResult.hash || crypto.randomBytes(16).toString('hex')
                })
                broadcastEvent('NEW_BET', betRecord)
            }

            return revealResult
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

// POST /api/games/mines/cashout
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
                error: 'Please sign up or sign in to play Mines on AmratGames'
            })
        }

        const result = await db.withUserLock(req.user.id, async () => {
            const cashoutResult = minesEngine.cashout({
                userId: req.user.id,
                roundId
            })

            const currency = cashoutResult.currency || 'INR'
            const betAmount = cashoutResult.betAmount || 0

            if (cashoutResult.payout > 0) {
                db.updateUserBalance(req.user.id, currency, cashoutResult.payout, `Mines Cashout (${cashoutResult.multiplier}x)`)
            }

            const betRecord = db.recordBet({
                userId: req.user.id,
                username: req.user.username,
                game: 'mines',
                gameName: 'Mines',
                currency,
                betAmount,
                multiplier: cashoutResult.multiplier,
                payout: cashoutResult.payout,
                profit: cashoutResult.payout - betAmount,
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

export default router
