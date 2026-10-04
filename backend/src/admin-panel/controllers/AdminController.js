import { AdminUserManager } from '../services/AdminUserManager.js'
import { TokenDistributionEngine } from '../services/TokenDistributionEngine.js'
import { PlatformAnalyticsService } from '../services/PlatformAnalyticsService.js'
import { GameEngineManager } from '../services/GameEngineManager.js'
import { db } from '../../db/db.js'
import { testSupabaseConnection } from '../../db/SupabaseClient.js'

/**
 * AdminController — OOP Controller orchestrating admin API requests
 */
export class AdminController {
    constructor() {
        this.userManager = new AdminUserManager()
        this.tokenEngine = new TokenDistributionEngine()
        this.analyticsService = new PlatformAnalyticsService()
        this.gameManager = new GameEngineManager()

        // Bind methods to preserve `this` context when invoked as route handlers
        this.getStats = this.getStats.bind(this)
        this.listUsers = this.listUsers.bind(this)
        this.getUserDetails = this.getUserDetails.bind(this)
        this.adjustBalance = this.adjustBalance.bind(this)
        this.updateUserStatus = this.updateUserStatus.bind(this)
        this.getTokenStats = this.getTokenStats.bind(this)
        this.distributeTokens = this.distributeTokens.bind(this)
        this.getTokenHistory = this.getTokenHistory.bind(this)
        this.getSettings = this.getSettings.bind(this)
        this.updateSettings = this.updateSettings.bind(this)
        this.rotateSeed = this.rotateSeed.bind(this)
        this.getSupabaseStatus = this.getSupabaseStatus.bind(this)
        this.migrateToSupabase = this.migrateToSupabase.bind(this)
    }

    async getStats(req, res) {
        try {
            const stats = this.analyticsService.getOverview()
            res.json({ success: true, stats })
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    }

    async listUsers(req, res) {
        try {
            const { search, status, role, isBanned } = req.query
            const filters = { search, status, role }
            if (isBanned !== undefined) filters.isBanned = isBanned === 'true'

            const users = this.userManager.listUsers(filters)
            res.json({ success: true, total: users.length, users })
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    }

    async getUserDetails(req, res) {
        try {
            const details = this.userManager.getUserDetails(req.params.id)
            if (!details) return res.status(404).json({ success: false, error: 'User not found' })
            res.json({ success: true, ...details })
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    }

    async adjustBalance(req, res) {
        try {
            const { currency, amount, note } = req.body
            const result = this.userManager.adjustBalance(
                req.params.id,
                currency,
                amount,
                req.user?.username || 'admin',
                note
            )
            res.json({
                success: true,
                user: result.user,
                transaction: result.transaction,
                message: `Successfully updated ${currency} balance for ${result.user.username}`
            })
        } catch (err) {
            res.status(400).json({ success: false, error: err.message })
        }
    }

    async updateUserStatus(req, res) {
        try {
            const { isBanned, status } = req.body
            const user = this.userManager.updateStatus(req.params.id, { isBanned, status })
            res.json({
                success: true,
                user,
                message: `Updated status for user ${user.username}`
            })
        } catch (err) {
            res.status(400).json({ success: false, error: err.message })
        }
    }

    async getTokenStats(req, res) {
        try {
            const data = this.tokenEngine.getTreasuryStats()
            res.json({ success: true, ...data })
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    }

    async distributeTokens(req, res) {
        try {
            const {
                token = 'AMRAT',
                amount,
                targetGroup = 'all_players',
                targetUserId = null,
                campaign,
                note
            } = req.body

            const result = this.tokenEngine.distribute({
                adminId: req.user?.id || 'admin',
                adminUsername: req.user?.username || 'admin',
                token,
                amount,
                targetGroup,
                targetUserId,
                campaign,
                note
            })

            res.json({
                success: true,
                data: result,
                message: `Successfully distributed ${result.totalDistributed.toLocaleString()} ${token} to ${result.recipientsCount} recipient(s)!`
            })
        } catch (err) {
            res.status(400).json({ success: false, error: err.message })
        }
    }

    async getTokenHistory(req, res) {
        try {
            const airdrops = this.tokenEngine.getHistory()
            res.json({ success: true, airdrops })
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    }

    async getSettings(req, res) {
        try {
            const settings = this.gameManager.getSettings()
            res.json({ success: true, settings })
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    }

    async updateSettings(req, res) {
        try {
            const { rtp, houseEdge, maintenanceMode, activeAnnouncements } = req.body
            const updates = {}
            if (rtp !== undefined) updates.rtp = parseFloat(rtp)
            if (houseEdge !== undefined) updates.houseEdge = parseFloat(houseEdge)
            if (maintenanceMode !== undefined) updates.maintenanceMode = Boolean(maintenanceMode)
            if (activeAnnouncements !== undefined) updates.activeAnnouncements = String(activeAnnouncements)

            const settings = this.gameManager.updateSettings(updates)
            res.json({ success: true, settings, message: 'Settings saved successfully' })
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    }

    async rotateSeed(req, res) {
        try {
            const result = this.gameManager.rotateSeed()
            res.json({ success: true, message: 'Server seed rotated successfully', ...result })
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    }

    async getSupabaseStatus(req, res) {
        try {
            const status = await testSupabaseConnection()
            res.json({ success: true, ...status })
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    }

    async migrateToSupabase(req, res) {
        try {
            const report = await db.migrateToSupabase()
            res.json({ success: true, message: 'Database migration to Supabase completed!', report })
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    }
}
