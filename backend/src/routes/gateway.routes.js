import express from 'express'
import { paymentGatewayManager } from '../gateways/PaymentGatewayManager.js'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db/db.js'

const router = express.Router()

/**
 * POST /api/gateway/session
 * Creates an instant deposit checkout session for authenticated players.
 */
router.post('/session', requireAuth, async (req, res) => {
    try {
        const { amount, gateway = 'youpi' } = req.body
        const user = db.findUserById(req.user.id)
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' })
        }

        const session = await paymentGatewayManager.createDepositSession(user, amount, {
            preferredGateway: gateway
        })

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

export default router
