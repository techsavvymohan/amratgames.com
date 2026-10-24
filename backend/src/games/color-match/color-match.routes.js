import express from 'express'
import { authenticate } from '../../middleware/auth.js'
import { gameActionLimiter } from '../../middleware/rateLimiter.js'
import { colorMatchRoomService } from '../../services/ColorMatchRoomService.js'
import { db } from '../../db/db.js'

const router = express.Router()

// GET /api/games/color-match/room/state and /api/games/color-match/state
const handleGetState = (req, res) => {
    try {
        res.json({
            success: true,
            room: colorMatchRoomService.getState(),
            state: colorMatchRoomService.getState()
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
}
router.get('/room/state', handleGetState)
router.get('/state', handleGetState)

// GET /api/games/color-match/room/history and /api/games/color-match/history
const handleGetHistory = (req, res) => {
    try {
        res.json({
            success: true,
            history: colorMatchRoomService.history,
            recentBalls: colorMatchRoomService.recentBalls
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
}
router.get('/room/history', handleGetHistory)
router.get('/history', handleGetHistory)

// POST /api/games/color-match/room/bet and /api/games/color-match/bet
const handlePlaceBet = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                code: 'AUTH_REQUIRED',
                error: 'Please sign up or sign in to play Win Go on AmratGames'
            })
        }

        const { periodId, bets, currency = 'INR' } = req.body || {}
        const result = await colorMatchRoomService.placeBet({
            userId: req.user.id,
            username: req.user.username,
            periodId,
            bets,
            currency
        })

        const user = db.findUserById(req.user.id)
        const balances = user?.balances || result.balances || req.user?.balances || {}

        res.json({
            success: true,
            ...result,
            balances
        })
    } catch (err) {
        console.error('[COLOR MATCH BET ERROR]', err.message)
        res.status(err.status || 400).json({
            success: false,
            error: err.message || 'Unable to place Win Go bet',
            code: err.code || 'BET_FAILED'
        })
    }
}
router.post('/room/bet', gameActionLimiter, authenticate, handlePlaceBet)
router.post('/bet', gameActionLimiter, authenticate, handlePlaceBet)

// GET /api/games/color-match/my-bets
router.get('/my-bets', authenticate, (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' })
        }
        const userBets = db.getUserBets ? db.getUserBets(req.user.id, 50) : []
        const colorBets = userBets.filter(b => b.game === 'color-match' || b.gameName === 'Win Go 30s')
        res.json({ success: true, bets: colorBets })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

export default router
