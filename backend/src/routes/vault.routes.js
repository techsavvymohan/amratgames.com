// =============================================================================
// 👑 AmratGames.com — "Be the House" Liquidity Vault Staking Router
// Pillar 5: Staking, Dividends Yield, and Dynamic APY Engine
// =============================================================================

import express from 'express'
import { houseVaultService } from '../services/HouseVaultService.js'
import { requireAuth } from '../middleware/auth.js'
import { redisCache, CACHE_TTL } from '../services/RedisCacheService.js'
import { cashierLimiter } from '../middleware/rateLimiter.js'

const router = express.Router()

// GET /api/vault/overview - Public / Authenticated Vault Overview
router.get('/overview', async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null
        if (!userId) {
            const overview = await redisCache.getOrSet('vault:overview:public', CACHE_TTL.VAULT_STATS, async () => {
                return houseVaultService.getOverview(null)
            })
            return res.json({ success: true, vault: overview })
        }

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
router.post('/stake', cashierLimiter, requireAuth, async (req, res) => {
    try {
        const { amount } = req.body
        const result = await houseVaultService.stake({
            userId: req.user.id,
            amount
        })
        redisCache.del('vault:overview:public').catch(() => {})
        res.json(result)
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

// POST /api/vault/unstake - Unstake Capital back to Wallet
router.post('/unstake', cashierLimiter, requireAuth, async (req, res) => {
    try {
        const { amount } = req.body
        const result = await houseVaultService.unstake({
            userId: req.user.id,
            amount
        })
        redisCache.del('vault:overview:public').catch(() => {})
        res.json(result)
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

// POST /api/vault/claim - Claim Accrued House Dividends
router.post('/claim', cashierLimiter, requireAuth, async (req, res) => {
    try {
        const result = await houseVaultService.claimDividends({
            userId: req.user.id
        })
        redisCache.del('vault:overview:public').catch(() => {})
        res.json(result)
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

export default router
