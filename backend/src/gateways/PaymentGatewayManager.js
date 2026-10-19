import { YouPiGatewayAdapter } from './adapters/YouPiGatewayAdapter.js'
import { FallbackManualAdapter } from './adapters/FallbackManualAdapter.js'
import { webhookSignatureVerifier } from './security/WebhookSignatureVerifier.js'
import { db } from '../db/db.js'
import { broadcastEvent } from '../websocket.js'

/**
 * PaymentGatewayManager
 * 
 * Central Facade & Strategy Manager orchestrating all payment gateways in AmratGames.
 * Dynamically routes deposit requests, manages automated failover / circuit breaking,
 * and processes incoming webhooks with idempotent ledger protection.
 */
export class PaymentGatewayManager {
    constructor() {
        this.adapters = new Map()
        this.primaryGatewayName = 'youpi'
        this.fallbackGatewayName = 'manual'

        // Register default adapters
        this.registerAdapter(new YouPiGatewayAdapter())
        this.registerAdapter(new FallbackManualAdapter())
    }

    /**
     * Registers a new gateway adapter.
     * @param {import('./contracts/IPaymentGateway.js').IPaymentGateway} adapter
     */
    registerAdapter(adapter) {
        if (!adapter || !adapter.name) {
            throw new Error('Cannot register gateway adapter without a valid "name".')
        }
        this.adapters.set(adapter.name, adapter)
    }

    /**
     * Gets a registered adapter by name.
     * @param {string} name
     * @returns {import('./contracts/IPaymentGateway.js').IPaymentGateway|null}
     */
    getAdapter(name) {
        return this.adapters.get(name) || null
    }

    /**
     * Resolves the healthiest active gateway adapter, falling back to manual if necessary.
     * 
     * @param {string} [preferredName]
     * @returns {Promise<import('./contracts/IPaymentGateway.js').IPaymentGateway>}
     */
    async resolveActiveGateway(preferredName) {
        const candidateName = preferredName || this.primaryGatewayName
        const candidate = this.getAdapter(candidateName)

        if (candidate) {
            try {
                const healthy = await candidate.isAvailable()
                if (healthy) {
                    return candidate
                }
                console.warn(`[PaymentGatewayManager] Preferred gateway "${candidateName}" reported unavailable. Routing to fallback "${this.fallbackGatewayName}".`)
            } catch (err) {
                console.warn(`[PaymentGatewayManager] Health probe failed for "${candidateName}": ${err.message}. Routing to fallback.`)
            }
        }

        const fallback = this.getAdapter(this.fallbackGatewayName)
        if (!fallback) {
            throw new Error(`Fallback gateway "${this.fallbackGatewayName}" is not registered.`)
        }
        return fallback
    }

    /**
     * Creates a deposit checkout session.
     * 
     * @param {Object} user - User record from db
     * @param {number} amount - Deposit amount in INR
     * @param {Object} [options]
     * @param {string} [options.preferredGateway]
     * @returns {Promise<Object>}
     */
    async createDepositSession(user, amount, options = {}) {
        if (!user || !user.id) {
            throw new Error('Valid player user is required to create deposit session.')
        }

        const parsedAmount = parseFloat(amount)
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            throw new Error('Valid positive deposit amount required.')
        }

        const orderId = `DEP_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`

        let adapter = await this.resolveActiveGateway(options.preferredGateway)

        try {
            const session = await adapter.createOrder({
                orderId,
                amount: parsedAmount,
                currency: 'INR',
                userId: user.id,
                username: user.username,
                customer: {
                    name: user.name || user.username,
                    email: user.email || 'player@amratgames.com',
                    phoneNumber: user.phone || ''
                },
                metadata: {
                    platform: 'AmratGames.com',
                    userId: user.id,
                    username: user.username
                }
            })

            return session
        } catch (err) {
            console.error(`[PaymentGatewayManager] Failed to create order via ${adapter.name}: ${err.message}. Retrying with fallback.`)
            
            // If primary failed, retry with fallback adapter
            if (adapter.name !== this.fallbackGatewayName) {
                const fallback = this.getAdapter(this.fallbackGatewayName)
                if (fallback) {
                    return await fallback.createOrder({
                        orderId,
                        amount: parsedAmount,
                        currency: 'INR',
                        userId: user.id,
                        username: user.username
                    })
                }
            }
            throw err
        }
    }

    /**
     * Authoritatively processes incoming webhook from any registered gateway.
     * Validates HMAC, verifies idempotency, and securely credits user balance.
     * 
     * @param {string} gatewayName
     * @param {Object} headers
     * @param {Buffer|string} rawBody
     * @returns {Promise<{ success: boolean, message: string, credited?: boolean, duplicate?: boolean }>}
     */
    async handleIncomingWebhook(gatewayName, headers, rawBody) {
        const adapter = this.getAdapter(gatewayName)
        if (!adapter) {
            throw new Error(`Gateway adapter "${gatewayName}" not found.`)
        }

        // 1. Cryptographic HMAC verification
        const verification = await adapter.verifyWebhookSignature(headers, rawBody)
        if (!verification.valid) {
            const errorMsg = verification.error || 'Webhook cryptographic signature verification failed'
            console.warn(`[PaymentGatewayManager] ${gatewayName} Webhook Rejected: ${errorMsg}`)
            const err = new Error(errorMsg)
            err.statusCode = 401
            throw err
        }

        const payload = verification.payload || {}
        const eventId = payload.paymentId || payload.id || payload.orderId || `wh_${Date.now()}`

        // 2. Strict Idempotency Check (Defense against replay attacks)
        const isFresh = webhookSignatureVerifier.isIdempotent(eventId, id => db.isWebhookProcessed(id))
        if (!isFresh) {
            console.log(`[PaymentGatewayManager] Webhook ${eventId} already processed. Returning duplicate confirmation.`)
            return { success: true, duplicate: true, message: 'Webhook event already processed' }
        }

        // 3. Process payment event
        const isSuccess = payload.event === 'SUCCESS' 
            || payload.status === 'SUCCESS' 
            || payload.type === 'payment.succeeded' 
            || payload.event === 'payment_successful'

        if (isSuccess) {
            const userId = payload.metadata?.userId || payload.userId || payload.customer_id
            const amount = parseFloat(payload.amount || (payload.amountPaise ? payload.amountPaise / 100 : 0))
            const currency = payload.currency || 'INR'
            const utrNumber = payload.utr || payload.utrNumber || payload.paymentId || ''

            if (!userId || isNaN(amount) || amount <= 0) {
                throw new Error('Invalid webhook payload: userId and positive amount required')
            }

            // Ledger update inside mutex lock
            const result = await db.withUserLock(userId, async () => {
                const user = db.findUserById(userId)
                if (!user) throw new Error(`Target player account "${userId}" not found`)

                // Credit balance
                db.updateUserBalance(userId, currency, amount, `Instant Gateway Deposit [${adapter.name.toUpperCase()}] (Ref: ${utrNumber})`)

                // Accumulate turnover requirements
                user.totalDeposited = parseFloat(((user.totalDeposited || 0) + amount).toFixed(2))

                // Record completed deposit in database
                const depositRecord = {
                    id: 'dep_' + adapter.name + '_' + Date.now().toString(36),
                    userId,
                    username: user.username,
                    currency,
                    amount,
                    paymentMethod: `${adapter.name.toUpperCase()}_GATEWAY`,
                    utrNumber,
                    status: 'completed',
                    createdAt: new Date().toISOString(),
                    approvedAt: new Date().toISOString(),
                    approvedBy: `SYSTEM_${adapter.name.toUpperCase()}_WEBHOOK`
                }

                if (!db.data.deposits) db.data.deposits = []
                db.data.deposits.unshift(depositRecord)
                db.persist()

                // Real-time broadcast
                broadcastEvent('DEPOSIT_STATUS_UPDATED', depositRecord)

                return { user, deposit: depositRecord }
            })

            // Mark processed in idempotency ledger
            webhookSignatureVerifier.markProcessed(eventId, id => db.markWebhookProcessed(id))

            console.log(`[PaymentGatewayManager] Successfully credited ₹${amount} to user ${userId} via ${adapter.name}`)

            return {
                success: true,
                credited: true,
                message: `Successfully credited deposit for user ${userId}`,
                depositId: result.deposit.id,
                balances: result.user.balances
            }
        }

        // Other non-success events (EXPIRED, CANCELLED, FAILED)
        webhookSignatureVerifier.markProcessed(eventId, id => db.markWebhookProcessed(id))
        return {
            success: true,
            credited: false,
            message: `Recorded non-success event: ${payload.event || payload.status}`
        }
    }
}

export const paymentGatewayManager = new PaymentGatewayManager()
