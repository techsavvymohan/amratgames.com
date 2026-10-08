// =============================================================================
// 👑 AmratGames.com — Viral Affiliate & Referral Flywheel API
// Allows players to earn 0.3% turnover commission on all referred wagers
// =============================================================================

import express from 'express'
import { db } from '../db/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// GET /api/affiliate/stats
router.get('/stats', requireAuth, (req, res) => {
    try {
        const stats = db.getAffiliateStats(req.user.id)
        if (!stats) return res.status(404).json({ success: false, error: 'User not found' })

        res.json({
            success: true,
            ...stats
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/affiliate/claim
router.post('/claim', requireAuth, async (req, res) => {
    try {
        const result = await db.claimAffiliateCommission(req.user.id)
        res.json({
            success: true,
            message: `🎉 Successfully claimed ₹${result.claimedAmount.toFixed(2)} in referral commission to your wallet!`,
            claimedAmount: result.claimedAmount,
            newBalance: result.newBalance,
            balances: result.user.balances
        })
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

export default router
