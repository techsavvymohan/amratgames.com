import express from 'express'
import crypto from 'node:crypto'
import { db } from '../../db/db.js'
import { authenticate } from '../../middleware/auth.js'
import { broadcastEvent } from '../../websocket.js'
import { crashEngine } from './crash.engine.js'
import { crashRoomService } from '../../services/CrashRoomService.js'

const router = express.Router()

// GET /api/games/crash/active
router.get('/active', authenticate, (req, res) => {
    try {
        const effectiveUserId = req.user ? req.user.id : (req.headers['x-guest-session'] || 'guest_demo')
        const activeRound = crashEngine.getActiveRound(effectiveUserId)
        res.json({ success: true, activeRound })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/games/crash/start
router.post('/start', authenticate, async (req, res) => {
    try {
        const { betAmount, currency = 'INR', autoCashout, clientSeed } = req.body
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
                error: 'Please sign up or sign in to play Crash on AmratGames'
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

            // Deduct bet amount immediately upon flight launch under lock
            db.updateUserBalance(user.id, currency, -parsedAmount, 'Crash Bet (Launch)')

            return crashEngine.startRound({
                userId: user.id,
                currency,
                betAmount: parsedAmount,
                autoCashout,
                clientSeed: clientSeed || user.id
            })
        })

        const updatedUser = db.findUserById(req.user.id)
        const { crashPoint, hash, ...publicSession } = session
        const balances = updatedUser?.balances || req.user?.balances || {}
        return res.json({
            success: true,
            ...publicSession,
            balances
        })
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

// POST /api/games/crash/cashout
router.post('/cashout', authenticate, async (req, res) => {
    try {
        const { roundId, multiplier } = req.body
        if (!roundId) {
            return res.status(400).json({ success: false, error: 'roundId is required' })
        }

        if (!req.user) {
            return res.status(401).json({
                success: false,
                code: 'AUTH_REQUIRED',
                error: 'Please sign up or sign in to play Crash on AmratGames'
            })
        }

        const result = await db.withUserLock(req.user.id, async () => {
            const cashoutResult = crashEngine.cashout({
                userId: req.user.id,
                roundId,
                multiplier
            })

            const currency = cashoutResult.currency || 'INR'
            const betAmount = cashoutResult.betAmount || 0

            if (cashoutResult.won && cashoutResult.payout > 0) {
                db.updateUserBalance(req.user.id, currency, cashoutResult.payout, `Crash Cashout (${cashoutResult.multiplier}x)`)
            }

            const betRecord = db.recordBet({
                userId: req.user.id,
                username: req.user.username,
                game: 'crash',
                gameName: 'Crash Rocket',
                currency,
                betAmount,
                multiplier: cashoutResult.multiplier,
                payout: cashoutResult.payout,
                profit: cashoutResult.payout - betAmount,
                won: cashoutResult.won,
                hash: cashoutResult.hash
            })

            if (cashoutResult.won) {
                broadcastEvent('NEW_BET', betRecord)
            }

            return cashoutResult
        })

        const user = db.findUserById(req.user.id)
        const balances = user?.balances || req.user?.balances || {}
        return res.json({
            success: true,
            ...result,
            balances
        })
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

// POST /api/games/crash/bust
router.post('/bust', authenticate, async (req, res) => {
    try {
        const { roundId } = req.body
        if (!roundId) {
            return res.status(400).json({ success: false, error: 'roundId is required' })
        }

        if (!req.user) {
            return res.status(401).json({
                success: false,
                code: 'AUTH_REQUIRED',
                error: 'Please sign up or sign in to play Crash on AmratGames'
            })
        }

        const result = await db.withUserLock(req.user.id, async () => {
            const bustResult = crashEngine.bust({
                userId: req.user.id,
                roundId
            })

            if (!bustResult.alreadyClosed) {
                db.recordBet({
                    userId: req.user.id,
                    username: req.user.username,
                    game: 'crash',
                    gameName: 'Crash Rocket',
                    currency: bustResult.currency || 'INR',
                    betAmount: bustResult.betAmount || 0,
                    multiplier: 0,
                    payout: 0,
                    profit: -(bustResult.betAmount || 0),
                    won: false,
                    hash: bustResult.hash || crypto.randomBytes(16).toString('hex')
                })
            }

            return bustResult
        })

        const user = db.findUserById(req.user.id)
        const balances = user?.balances || req.user?.balances || {}
        return res.json({
            success: true,
            ...result,
            balances
        })
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

// GET /api/games/crash/room/state and /api/games/crash/room-info
router.get('/room/state', (req, res) => {
    try {
        res.json({
            success: true,
            room: crashRoomService.getState()
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

router.get('/room-info', (req, res) => {
    try {
        res.json({
            success: true,
            state: crashRoomService.getState(),
            activeBets: crashRoomService.getActiveBets(),
            recentHistory: crashRoomService.getRecentHistory()
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/games/crash/room/bet and /api/games/crash/room-bet
const handleRoomBet = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required to join multiplayer room bets' })
        }
        const { betAmount, currency = 'INR', autoCashout, panelId = 1 } = req.body || {}
        const result = await crashRoomService.placeBet({
            userId: req.user.id,
            username: req.user.username,
            betAmount,
            currency,
            autoCashout,
            panelId
        })
        const user = db.findUserById(req.user.id)
        const balances = user?.balances || result?.balances || req.user?.balances || {}
        res.json({
            success: true,
            ...result,
            bet: result?.bet || result,
            balances
        })
    } catch (err) {
        console.error('[CRASH ROOM BET ERROR]', err.message)
        res.status(err.status || 400).json({
            success: false,
            error: err.message || 'Unable to place room bet',
            code: err.code || 'BET_FAILED'
        })
    }
}
router.post('/room/bet', authenticate, handleRoomBet)
router.post('/room-bet', authenticate, handleRoomBet)

// POST /api/games/crash/room/cashout and /api/games/crash/room-cashout
const handleRoomCashout = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required to cashout' })
        }
        const { panelId = 1 } = req.body || {}
        const result = await crashRoomService.cashoutPlayer({ userId: req.user.id, panelId })
        const user = db.findUserById(req.user.id)
        const balances = user?.balances || result?.balances || req.user?.balances || {}
        res.json({
            success: true,
            ...result,
            cashout: result,
            balances
        })
    } catch (err) {
        console.error('[CRASH ROOM CASHOUT ERROR]', err.message)
        res.status(err.status || 400).json({
            success: false,
            error: err.message || 'Unable to cashout',
            code: err.code || 'CASHOUT_FAILED'
        })
    }
}
router.post('/room/cashout', authenticate, handleRoomCashout)
router.post('/room-cashout', authenticate, handleRoomCashout)

// POST /api/games/crash/room/cancel and /api/games/crash/room-cancel
const handleRoomCancel = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required to cancel bet' })
        }
        const { panelId = 1 } = req.body || {}
        const result = await crashRoomService.cancelBet({ userId: req.user.id, panelId })
        const user = db.findUserById(req.user.id)
        const balances = user?.balances || result?.balances || req.user?.balances || {}
        res.json({
            success: true,
            ...result,
            balances
        })
    } catch (err) {
        console.error('[CRASH ROOM CANCEL ERROR]', err.message)
        res.status(err.status || 400).json({
            success: false,
            error: err.message || 'Unable to cancel bet',
            code: err.code || 'CANCEL_FAILED'
        })
    }
}
router.post('/room/cancel', authenticate, handleRoomCancel)
router.post('/room-cancel', authenticate, handleRoomCancel)

export default router

