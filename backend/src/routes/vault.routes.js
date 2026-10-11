// =============================================================================
// 👑 AmratGames.com — "Be the House" Liquidity Vault Staking Router
// Pillar 5: Staking, Dividends Yield, and Dynamic APY Engine
// =============================================================================

import express from 'express'
import { houseVaultService } from '../services/HouseVaultService.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// GET /api/vault/overview - Public / Authenticated Vault Overview
router.get('/overview', (req, res) => {
    try {
        const userId = req.user ? req.user.id : null
        const overview = houseVaultService.getOverview(userId)
        res.json({
            success: true,
            vault: overview
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/vault/stake - Deposit & Stake into House Vault
router.post('/stake', requireAuth, async (req, res) => {
    try {
        const { amount } = req.body
        const result = await houseVaultService.stake({
            userId: req.user.id,
            amount
        })
        res.json(result)
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

// POST /api/vault/unstake - Unstake Capital back to Wallet
router.post('/unstake', requireAuth, async (req, res) => {
    try {
        const { amount } = req.body
        const result = await houseVaultService.unstake({
            userId: req.user.id,
            amount
        })
        res.json(result)
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

// POST /api/vault/claim - Claim Accrued House Dividends
router.post('/claim', requireAuth, async (req, res) => {
    try {
        const result = await houseVaultService.claimDividends({
            userId: req.user.id
        })
        res.json(result)
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

export default router
