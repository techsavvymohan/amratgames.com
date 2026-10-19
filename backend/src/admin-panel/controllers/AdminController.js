import { AdminUserManager } from '../services/AdminUserManager.js'
import { AdminWithdrawalManager } from '../services/AdminWithdrawalManager.js'
import { TokenDistributionEngine } from '../services/TokenDistributionEngine.js'
import { PlatformAnalyticsService } from '../services/PlatformAnalyticsService.js'
import { GameEngineManager } from '../services/GameEngineManager.js'
import { db } from '../../db/db.js'
import { testSupabaseConnection } from '../../db/SupabaseClient.js'
import { broadcastEvent } from '../../websocket.js'
import { antiFraudService } from '../../services/AntiFraudService.js'
import { paymentGatewayManager } from '../../gateways/PaymentGatewayManager.js'

/**
 * AdminController — OOP Controller orchestrating admin API requests
 */
export class AdminController {
    constructor() {
        this.userManager = new AdminUserManager()
        this.withdrawalManager = new AdminWithdrawalManager()
        this.tokenEngine = new TokenDistributionEngine()
        this.analyticsService = new PlatformAnalyticsService()
        this.gameManager = new GameEngineManager()

        // Bind methods to preserve `this` context when invoked as route handlers
        this.getStats = this.getStats.bind(this)
        this.listUsers = this.listUsers.bind(this)
        this.getUserDetails = this.getUserDetails.bind(this)
        this.adjustBalance = this.adjustBalance.bind(this)
        this.updateUserStatus = this.updateUserStatus.bind(this)
        this.listWithdrawals = this.listWithdrawals.bind(this)
        this.getWithdrawalStats = this.getWithdrawalStats.bind(this)
        this.approveWithdrawal = this.approveWithdrawal.bind(this)
        this.rejectWithdrawal = this.rejectWithdrawal.bind(this)
        this.getTokenStats = this.getTokenStats.bind(this)
        this.distributeTokens = this.distributeTokens.bind(this)
        this.getTokenHistory = this.getTokenHistory.bind(this)
        this.getSettings = this.getSettings.bind(this)
        this.updateSettings = this.updateSettings.bind(this)
        this.rotateSeed = this.rotateSeed.bind(this)
        this.getSupabaseStatus = this.getSupabaseStatus.bind(this)
        this.migrateToSupabase = this.migrateToSupabase.bind(this)
        this.listDeposits = this.listDeposits.bind(this)
        this.approveDeposit = this.approveDeposit.bind(this)
        this.rejectDeposit = this.rejectDeposit.bind(this)
        this.approveKYC = this.approveKYC.bind(this)
        this.rejectKYC = this.rejectKYC.bind(this)
        this.toggleMaintenance = this.toggleMaintenance.bind(this)
        this.toggleGameKillSwitch = this.toggleGameKillSwitch.bind(this)
        this.getGatewayStatus = this.getGatewayStatus.bind(this)
        this.updateGatewayConfig = this.updateGatewayConfig.bind(this)
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
            const riskAnalysis = antiFraudService.calculateRiskScore(req.params.id)
            res.json({ success: true, ...details, riskAnalysis })
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

    async listWithdrawals(req, res) {
        try {
            const { status, search, userId } = req.query
            const rawWithdrawals = this.withdrawalManager.listWithdrawals({ status, search, userId })
            const withdrawals = rawWithdrawals.map(w => {
                const risk = antiFraudService.calculateRiskScore(w.userId)
                return {
                    ...w,
                    riskScore: risk.score,
                    riskLevel: risk.level,
                    riskFlags: risk.flags
                }
            })
            res.json({ success: true, total: withdrawals.length, withdrawals })
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    }

    async getWithdrawalStats(req, res) {
        try {
            const stats = this.withdrawalManager.getStats()
            res.json({ success: true, stats })
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    }

    async approveWithdrawal(req, res) {
        try {
            const { transactionRef, adminNote } = req.body
            const adminUsername = req.user?.username || 'admin'
            const withdrawal = this.withdrawalManager.approveWithdrawal(req.params.id, {
                adminUsername,
                transactionRef,
                adminNote
            })
            res.json({
                success: true,
                withdrawal,
                message: `Withdrawal #${req.params.id} approved successfully! Manual transfer confirmed.`
            })
        } catch (err) {
            res.status(400).json({ success: false, error: err.message })
        }
    }

    async rejectWithdrawal(req, res) {
        try {
            const { rejectionReason, adminNote } = req.body
            const adminUsername = req.user?.username || 'admin'
            const result = this.withdrawalManager.rejectWithdrawal(req.params.id, {
                adminUsername,
                rejectionReason,
                adminNote
            })
            res.json({
                success: true,
                withdrawal: result.withdrawal,
                message: `Withdrawal #${req.params.id} rejected. Balance refunded back to player wallet.`
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

    async toggleMaintenance(req, res) {
        try {
            const current = Boolean(db.data.settings?.maintenanceMode)
            const nextMode = req.body?.maintenanceMode !== undefined ? Boolean(req.body.maintenanceMode) : !current
            if (!db.data.settings) db.data.settings = {}
            db.data.settings.maintenanceMode = nextMode
            db.persist()

            broadcastEvent('MAINTENANCE_MODE_UPDATED', { maintenanceMode: nextMode })
            broadcastEvent('CIRCUIT_BREAKER_TRIGGERED', {
                type: 'PLATFORM_MAINTENANCE',
                active: nextMode,
                timestamp: new Date().toISOString()
            })

            res.json({
                success: true,
                maintenanceMode: nextMode,
                message: nextMode
                    ? 'Platform maintenance mode ACTIVATED. Non-admin wagering and cashier actions paused.'
                    : 'Platform maintenance mode DEACTIVATED. Full platform operational.'
            })
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    }

    async toggleGameKillSwitch(req, res) {
        try {
            const { game, disabled } = req.body
            if (!game) {
                return res.status(400).json({ success: false, error: 'Game identifier is required' })
            }
            if (!db.data.settings) db.data.settings = {}
            if (!Array.isArray(db.data.settings.disabledGames)) {
                db.data.settings.disabledGames = []
            }
            const list = new Set(db.data.settings.disabledGames)
            const targetState = disabled !== undefined ? Boolean(disabled) : !list.has(game)

            if (targetState) {
                list.add(game)
            } else {
                list.delete(game)
            }

            db.data.settings.disabledGames = Array.from(list)
            db.persist()

            broadcastEvent('GAME_KILL_SWITCH_UPDATED', {
                game,
                disabled: targetState,
                disabledGames: db.data.settings.disabledGames
            })

            res.json({
                success: true,
                game,
                disabled: targetState,
                disabledGames: db.data.settings.disabledGames,
                message: targetState
                    ? `Emergency kill switch ACTIVATED for ${game}. Game paused.`
                    : `Emergency kill switch DEACTIVATED for ${game}. Game online.`
            })
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

    async listDeposits(req, res) {
        try {
            const { userId, status, search } = req.query
            const deposits = db.getAllDeposits({ userId, status, search })
            res.json({ success: true, total: deposits.length, deposits })
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    }

    async approveDeposit(req, res) {
        try {
            const { id } = req.params
            const { adminNote } = req.body
            const adminUsername = req.user?.username || 'admin'
            const result = db.approveDeposit(id, { adminUsername, adminNote })
            res.json({ success: true, message: 'Deposit verified and player balance credited!', ...result })
        } catch (err) {
            res.status(400).json({ success: false, error: err.message })
        }
    }

    async rejectDeposit(req, res) {
        try {
            const { id } = req.params
            const { rejectionReason } = req.body
            const adminUsername = req.user?.username || 'admin'
            const result = db.rejectDeposit(id, { adminUsername, rejectionReason })
            res.json({ success: true, message: 'Deposit rejected.', ...result })
        } catch (err) {
            res.status(400).json({ success: false, error: err.message })
        }
    }

    async approveKYC(req, res) {
        try {
            const { id } = req.params
            const user = db.findUserById(id)
            if (!user) return res.status(404).json({ success: false, error: 'User not found' })

            const updated = db.updateUser(id, {
                kycStatus: 'verified',
                kycVerifiedAt: new Date().toISOString(),
                kycVerifiedBy: req.user?.username || 'admin'
            })
            res.json({ success: true, message: `KYC for ${user.username} approved!`, user: updated })
        } catch (err) {
            res.status(400).json({ success: false, error: err.message })
        }
    }

    async rejectKYC(req, res) {
        try {
            const { id } = req.params
            const { reason = 'Invalid document submitted' } = req.body
            const user = db.findUserById(id)
            if (!user) return res.status(404).json({ success: false, error: 'User not found' })

            const updated = db.updateUser(id, {
                kycStatus: 'rejected',
                kycRejectionReason: reason,
                kycRejectedAt: new Date().toISOString()
            })
            res.json({ success: true, message: `KYC for ${user.username} rejected.`, user: updated })
        } catch (err) {
            res.status(400).json({ success: false, error: err.message })
        }
    }

    async getGatewayStatus(req, res) {
        try {
            const youpiAdapter = paymentGatewayManager.getAdapter('youpi')
            const manualAdapter = paymentGatewayManager.getAdapter('manual')

            const youpiAvailable = youpiAdapter ? await youpiAdapter.isAvailable() : false
            const youpiCircuitTripped = youpiAdapter ? youpiAdapter._isCircuitTripped() : false
            const manualAvailable = manualAdapter ? await manualAdapter.isAvailable() : true

            const allDeposits = db.getAllDeposits() || []
            
            const automatedDeposits = allDeposits.filter(d => 
                (d.paymentMethod && d.paymentMethod.includes('YOUPI')) || 
                (d.approvedBy && d.approvedBy.includes('WEBHOOK'))
            )
            const manualDeposits = allDeposits.filter(d => 
                !(d.paymentMethod && d.paymentMethod.includes('YOUPI')) && 
                !(d.approvedBy && d.approvedBy.includes('WEBHOOK'))
            )

            const pendingManual = manualDeposits.filter(d => d.status === 'pending')

            const automatedAmount = automatedDeposits.reduce((sum, d) => sum + (d.amount || 0), 0)
            const manualCompletedAmount = manualDeposits.filter(d => d.status === 'completed').reduce((sum, d) => sum + (d.amount || 0), 0)
            const pendingManualAmount = pendingManual.reduce((sum, d) => sum + (d.amount || 0), 0)

            const activePrimary = db?.data?.settings?.primaryGateway || paymentGatewayManager.primaryGatewayName || 'youpi'

            res.json({
                success: true,
                gateway: {
                    activePrimary,
                    fallback: paymentGatewayManager.fallbackGatewayName,
                    corporateVpa: process.env.UPI_MERCHANT_VPA || 'shanviientrrprisee@ybl',
                    corporatePayeeName: 'Shanvii Enterprise',
                    youpi: {
                        name: 'YouPI-PG Sovereign UPI Gateway',
                        available: youpiAvailable,
                        circuitTripped: youpiCircuitTripped,
                        apiEndpoint: 'http://127.0.0.1:6100',
                        checkoutUrlTemplate: 'https://amratgames.com/checkout/:id',
                        adminPortalUrl: '/youpi-admin/'
                    },
                    manual: {
                        name: 'Manual UPI Fallback (Intent & QR)',
                        available: manualAvailable
                    },
                    stats: {
                        totalDepositsCount: allDeposits.length,
                        automatedDepositsCount: automatedDeposits.length,
                        automatedDepositsAmount: automatedAmount,
                        manualDepositsCount: manualDeposits.length,
                        manualDepositsAmount: manualCompletedAmount,
                        pendingManualCount: pendingManual.length,
                        pendingManualAmount: pendingManualAmount
                    }
                }
            })
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    }

    async updateGatewayConfig(req, res) {
        try {
            const { primaryGateway } = req.body
            if (!primaryGateway || !['youpi', 'manual'].includes(primaryGateway)) {
                return res.status(400).json({ success: false, error: 'Valid primaryGateway ("youpi" or "manual") required' })
            }

            paymentGatewayManager.setPrimaryGateway(primaryGateway)

            broadcastEvent('GATEWAY_CONFIG_UPDATED', {
                primaryGateway,
                updatedBy: req.user?.username || 'admin',
                timestamp: new Date().toISOString()
            })

            res.json({
                success: true,
                primaryGateway,
                message: `Active primary payment gateway switched to "${primaryGateway.toUpperCase()}".`
            })
        } catch (err) {
            res.status(400).json({ success: false, error: err.message })
        }
    }
}
