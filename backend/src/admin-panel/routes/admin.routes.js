import express from 'express'
import { AdminController } from '../controllers/AdminController.js'
import { requireAdmin } from '../../middleware/auth.js'

export function createAdminRouter() {
    const router = express.Router()
    const controller = new AdminController()

    // Enforce Admin Authentication
    router.use(requireAdmin)

    // Platform KPIs & Overview
    router.get('/stats', controller.getStats)

    // User Management
    router.get('/users', controller.listUsers)
    router.get('/users/:id', controller.getUserDetails)
    router.patch('/users/:id/balance', controller.adjustBalance)
    router.patch('/users/:id/status', controller.updateUserStatus)

    // Withdrawal Management & Manual Payout Controls
    router.get('/withdrawals', controller.listWithdrawals)
    router.get('/withdrawals/stats', controller.getWithdrawalStats)
    router.post('/withdrawals/:id/approve', controller.approveWithdrawal)
    router.post('/withdrawals/:id/reject', controller.rejectWithdrawal)

    // Deposit Verification & Cashier Approval Controls
    router.get('/deposits', controller.listDeposits)
    router.post('/deposits/:id/approve', controller.approveDeposit)
    router.post('/deposits/:id/reject', controller.rejectDeposit)

    // Sovereign Payment Gateway (YouPi-PG) Management & Telemetry
    router.get('/gateway/status', controller.getGatewayStatus)
    router.post('/gateway/config', controller.updateGatewayConfig)

    // Player KYC Compliance Review
    router.post('/users/:id/kyc/approve', controller.approveKYC)
    router.post('/users/:id/kyc/reject', controller.rejectKYC)

    // Token Distribution & Treasury
    router.get('/tokens/stats', controller.getTokenStats)
    router.post('/tokens/distribute', controller.distributeTokens)
    router.get('/tokens/history', controller.getTokenHistory)

    // Platform Settings & Odds
    router.get('/settings', controller.getSettings)
    router.patch('/settings', controller.updateSettings)
    router.post('/seed/rotate', controller.rotateSeed)

    // Emergency Platform Circuit Breaker & Kill Switches
    router.post('/circuit-breaker/maintenance', controller.toggleMaintenance)
    router.post('/circuit-breaker/toggle-game', controller.toggleGameKillSwitch)

    // Supabase Cloud Database Management
    router.get('/supabase/status', controller.getSupabaseStatus)
    router.post('/supabase/migrate', controller.migrateToSupabase)

    return router
}

export default createAdminRouter()
