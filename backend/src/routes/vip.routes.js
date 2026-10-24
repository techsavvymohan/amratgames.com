// =============================================================================
// 👑 AmratGames.com — VIP Tier Loyalty Progression & Rakeback Engine
// Returns 3% to 15% of house edge back to active bettors on all wager turnover
// =============================================================================

import express from 'express'
import { db } from '../db/db.js'
import { requireAuth } from '../middleware/auth.js'
import { cashierLimiter } from '../middleware/rateLimiter.js'

const router = express.Router()

// GET /api/vip/status
router.get('/status', requireAuth, (req, res) => {
    try {
        const status = db.getVipStatus(req.user.id)
        if (!status) return res.status(404).json({ success: false, error: 'User not found' })

        res.json({
            success: true,
            ...status,
            allTiers: [
                { tier: 'Bronze', icon: '🥉', minWager: 0, rakebackRate: '3%' },
                { tier: 'Silver', icon: '🥈', minWager: 10000, rakebackRate: '5%' },
                { tier: 'Gold', icon: '🥇', minWager: 50000, rakebackRate: '7%' },
                { tier: 'Platinum', icon: '💎', minWager: 250000, rakebackRate: '10%' },
                { tier: 'Diamond', icon: '👑', minWager: 1000000, rakebackRate: '15%' }
            ]
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/vip/claim-rakeback
router.post('/claim-rakeback', cashierLimiter, requireAuth, async (req, res) => {
    try {
        const result = await db.claimRakeback(req.user.id)
        res.json({
            success: true,
            message: `🎉 Successfully claimed ₹${result.claimedAmount.toFixed(2)} in VIP Rakeback rewards to your wallet!`,
            claimedAmount: result.claimedAmount,
            newBalance: result.newBalance,
            balances: result.user.balances
        })
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

export default router
