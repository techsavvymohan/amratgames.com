import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import { pvpService } from '../services/PvPService.js'

const router = express.Router()

// GET /api/pvp/duels — List active and historical PvP duels
router.get('/duels', (req, res) => {
    try {
        const { status = 'all', limit = 30 } = req.query
        const duels = pvpService.listDuels({
            status,
            limit: parseInt(limit, 10) || 30
        })
        res.json({ success: true, duels })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// GET /api/pvp/stats — Aggregate PvP statistics
router.get('/stats', (req, res) => {
    try {
        const stats = pvpService.getStats()
        res.json({ success: true, stats })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/pvp/create — Create a new PvP Coin Toss Duel
router.post('/create', requireAuth, async (req, res) => {
    try {
        const { stake, choice = 'heads', currency = 'INR', clientSeed = '' } = req.body
        const result = await pvpService.createDuel({
            userId: req.user.id,
            stake,
            choice,
            currency,
            clientSeed
        })
        res.json(result)
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

// POST /api/pvp/join — Accept an open PvP Duel
router.post('/join', requireAuth, async (req, res) => {
    try {
        const { duelId, clientSeed = '' } = req.body
        if (!duelId) {
            return res.status(400).json({ success: false, error: 'duelId is required' })
        }
        const result = await pvpService.joinDuel({
            duelId,
            userId: req.user.id,
            clientSeed
        })
        res.json(result)
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

// POST /api/pvp/cancel — Cancel an open PvP Duel and get refunded
router.post('/cancel', requireAuth, async (req, res) => {
    try {
        const { duelId } = req.body
        if (!duelId) {
            return res.status(400).json({ success: false, error: 'duelId is required' })
        }
        const result = await pvpService.cancelDuel({
            duelId,
            userId: req.user.id
        })
        res.json(result)
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

export default router
