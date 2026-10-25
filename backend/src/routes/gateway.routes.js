import express from 'express'
import { paymentGatewayManager } from '../gateways/PaymentGatewayManager.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { db } from '../db/db.js'

const router = express.Router()

/**
 * POST /api/gateway/session
 * Creates an instant deposit checkout session for authenticated players.
 * Supports both HTTP microservice proxying and sovereign direct in-process SQLite allocation.
 */
router.post('/session', requireAuth, async (req, res) => {
    try {
        const { amount, gateway = 'youpi', mode = 'auto', returnUrl = null } = req.body
        const user = db.findUserById(req.user.id)
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' })
        }

        let session
        if (mode === 'direct' || gateway === 'youpi_direct') {
            session = await paymentGatewayManager.bridge.createDepositSession({
                userId: user.id,
                username: user.username,
                amount,
                returnUrl,
                customer: {
                    name: user.name || user.username,
                    phoneNumber: user.phone || ''
                }
            })
        } else {
            session = await paymentGatewayManager.createDepositSession(user, amount, {
                preferredGateway: gateway
            })
        }

        res.json({
            success: true,
            session
        })
    } catch (err) {
        console.error('[GATEWAY SESSION ERROR]', err)
        res.status(400).json({
            success: false,
            error: err.message
        })
    }
})

/**
 * POST /api/gateway/youpi/webhook
 * Ingress webhook receiver for YouPI-PG sovereign payment events.
 * Enforces HMAC-SHA256 verification and replay-attack rejection.
 */
router.post('/youpi/webhook', async (req, res) => {
    try {
        const rawPayload = req.rawBody || JSON.stringify(req.body)
        const result = await paymentGatewayManager.handleIncomingWebhook('youpi', req.headers, rawPayload)
        res.json(result)
    } catch (err) {
        const statusCode = err.statusCode || 400
        res.status(statusCode).json({
            success: false,
            error: err.message
        })
    }
})

/**
 * GET /api/gateway/health
 * Probes all registered gateway adapters and reports availability.
 */
router.get('/health', async (req, res) => {
    try {
        const youpiAdapter = paymentGatewayManager.getAdapter('youpi')
        const manualAdapter = paymentGatewayManager.getAdapter('manual')

        const youpiAvailable = youpiAdapter ? await youpiAdapter.isAvailable() : false
        const manualAvailable = manualAdapter ? await manualAdapter.isAvailable() : true

        res.json({
            success: true,
            activeGateways: {
                youpi: {
                    name: 'YouPI-PG Sovereign UPI',
                    available: youpiAvailable,
                    circuitTripped: youpiAdapter ? youpiAdapter._isCircuitTripped() : false
                },
                manual: {
                    name: 'Manual UPI QR & UTR',
                    available: manualAvailable
                }
            }
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

/**
 * GET /api/gateway/diagnostics
 * Full system diagnostic status covering SQLite WAL, table metrics, active VPA, and core engines.
 */
router.get('/diagnostics', async (req, res) => {
    try {
        const diagnostics = await paymentGatewayManager.getDiagnostics()
        res.json({
            success: true,
            diagnostics
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

/**
 * GET /api/gateway/vpa
 * Returns current active VPA and list of all configured receiving accounts.
 */
router.get('/vpa', (req, res) => {
    try {
        const active = paymentGatewayManager.getActiveVpa()
        const all = paymentGatewayManager.listVpas()
        res.json({
            success: true,
            activeVpa: active,
            configuredAccounts: all
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

/**
 * POST /api/gateway/vpa/switch
 * Dynamically switches or creates the active receiving VPA.
 */
router.post('/vpa/switch', requireAuth, requireAdmin, (req, res) => {
    try {
        const { upiId, payeeName } = req.body
        if (!upiId || !payeeName) {
            return res.status(400).json({ success: false, error: 'upiId and payeeName are required' })
        }

        const account = paymentGatewayManager.switchActiveVpa(upiId, payeeName)
        res.json({
            success: true,
            activeVpa: account
        })
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

/**
 * POST /api/gateway/vpa
 * Creates a new receiving VPA with custom limits.
 */
router.post('/vpa', requireAuth, requireAdmin, (req, res) => {
    try {
        const { upiId, payeeName, dailyLimitPaise, perTransactionLimitPaise, isActive } = req.body
        if (!upiId || !payeeName) {
            return res.status(400).json({ success: false, error: 'upiId and payeeName are required' })
        }

        const account = paymentGatewayManager.createVpa({
            upiId,
            payeeName,
            dailyLimitPaise: dailyLimitPaise ? BigInt(dailyLimitPaise) : undefined,
            perTransactionLimitPaise: perTransactionLimitPaise ? BigInt(perTransactionLimitPaise) : undefined,
            isActive: Boolean(isActive)
        })
        res.json({
            success: true,
            account
        })
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

/**
 * GET /api/gateway/sessions
 * Lists recent payment sessions from SQLite database.
 */
router.get('/sessions', requireAuth, requireAdmin, (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 50
        const status = req.query.status || null
        const sessions = paymentGatewayManager.listSessions({ limit, status })
        res.json({
            success: true,
            sessions
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

/**
 * GET /api/gateway/session/:paymentId
 * Inspects a payment session by ID.
 */
router.get('/session/:paymentId', requireAuth, async (req, res) => {
    try {
        const result = await paymentGatewayManager.getPaymentSession(req.params.paymentId)
        if (!result.success) {
            return res.status(404).json(result)
        }
        res.json(result)
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

/**
 * POST /api/gateway/session/:paymentId/cancel
 * Cancels a payment session and frees the queue slot.
 */
router.post('/session/:paymentId/cancel', requireAuth, async (req, res) => {
    try {
        const result = await paymentGatewayManager.cancelPaymentSession(req.params.paymentId)
        res.json(result)
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

/**
 * POST /api/gateway/observe/sms
 * Ingests a bank SMS notification, runs attribution, and automatically settles the deposit.
 */
router.post('/observe/sms', async (req, res) => {
    try {
        const { message, sender = 'VM-HDFCBK', timestamp = new Date(), receivingAccountId = null, runFullPipeline = false } = req.body
        if (!message) {
            return res.status(400).json({ success: false, error: 'SMS message text is required' })
        }

        const result = await paymentGatewayManager.ingestSmsObservation({
            message,
            sender,
            timestamp,
            receivingAccountId,
            runFullPipeline
        })

        res.json(result)
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

/**
 * POST /api/gateway/observe/email
 * Ingests a bank email notification, runs attribution, and automatically settles the deposit.
 */
router.post('/observe/email', async (req, res) => {
    try {
        const { subject, body, sender = 'alerts@hdfcbank.net', timestamp = new Date(), receivingAccountId = null } = req.body
        if (!body && !subject) {
            return res.status(400).json({ success: false, error: 'Email subject or body is required' })
        }

        const result = await paymentGatewayManager.ingestEmailObservation({
            subject,
            body,
            sender,
            timestamp,
            receivingAccountId
        })

        res.json(result)
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

/**
 * POST /api/gateway/verify
 * Runs observation through the 6-stage anti-fraud PaymentVerificationPipeline.
 */
router.post('/verify', async (req, res) => {
    try {
        const result = await paymentGatewayManager.verifyPayment(req.body)
        res.json({
            success: true,
            result
        })
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

/**
 * GET /api/gateway/queue
 * Returns slot concurrency and queue status for the active VPA.
 */
router.get('/queue', (req, res) => {
    try {
        const status = paymentGatewayManager.getQueueStatus(req.query.accountId)
        res.json({
            success: true,
            queue: status
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

/**
 * GET /api/gateway/devices
 * Lists all registered observer devices.
 */
router.get('/devices', requireAuth, requireAdmin, (req, res) => {
    try {
        const devices = paymentGatewayManager.listDevices()
        res.json({
            success: true,
            devices
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

/**
 * POST /api/gateway/devices/register
 * Registers an observer device in YouPI PG.
 */
router.post('/devices/register', requireAuth, requireAdmin, (req, res) => {
    try {
        const device = paymentGatewayManager.registerDevice(req.body)
        res.json({
            success: true,
            device
        })
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

/**
 * GET /api/gateway/tickets
 * Lists dispute and support tickets.
 */
router.get('/tickets', requireAuth, requireAdmin, (req, res) => {
    try {
        const tickets = paymentGatewayManager.listSupportTickets()
        res.json({
            success: true,
            tickets
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

/**
 * GET /api/gateway/audit-logs
 * Retrieves immutable audit logs from SQLite WAL.
 */
router.get('/audit-logs', requireAuth, requireAdmin, (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 50
        const logs = paymentGatewayManager.getAuditLogs(limit)
        res.json({
            success: true,
            logs
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

export default router
