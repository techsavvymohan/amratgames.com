import http from 'node:http'
import https from 'node:https'
import { IPaymentGateway } from '../contracts/IPaymentGateway.js'
import { webhookSignatureVerifier } from '../security/WebhookSignatureVerifier.js'

/**
 * YouPiGatewayAdapter
 * 
 * Concrete OOP Adapter for the self-hosted YouPI-PG UPI microservice.
 * Includes resilience features: request timeout, circuit breaker, and constant-time HMAC verification.
 */
export class YouPiGatewayAdapter extends IPaymentGateway {
    /**
     * @param {Object} [config]
     * @param {string} [config.baseUrl] - Base API URL of YouPI (e.g. http://localhost:6100)
     * @param {string} [config.checkoutUrl] - Base Checkout URL (e.g. http://localhost:7000)
     * @param {string} [config.merchantId] - Public merchant identifier
     * @param {string} [config.webhookSecret] - Shared HMAC secret for verifying webhooks
     * @param {number} [config.timeoutMs=3000] - HTTP request timeout
     */
    constructor(config = {}) {
        super()
        this.baseUrl = config.baseUrl || process.env.YOUPI_PG_BASE_URL || 'http://localhost:6100'
        this.checkoutUrl = config.checkoutUrl || process.env.YOUPI_PG_CHECKOUT_URL || 'http://localhost:7000'
        this.merchantId = config.merchantId || process.env.YOUPI_PG_MERCHANT_ID || '00000000-0000-0000-0000-000000000001'
        this.webhookSecret = config.webhookSecret || process.env.YOUPI_PG_WEBHOOK_SECRET || 'amrat_youpi_webhook_sec_489201948201'
        this.timeoutMs = config.timeoutMs || 3000

        // Circuit Breaker State
        this.failureCount = 0
        this.failureThreshold = 3
        this.circuitOpenUntil = 0
        this.cooldownDurationMs = 30000 // 30s before attempting half-open probe
    }

    /**
     * Unique identifier
     */
    get name() {
        return 'youpi'
    }

    /**
     * Checks if the circuit is currently tripped open.
     * @private
     */
    _isCircuitTripped() {
        if (this.circuitOpenUntil > 0) {
            if (Date.now() < this.circuitOpenUntil) {
                return true
            }
            // Cooldown passed; move to half-open state
            this.circuitOpenUntil = 0
        }
        return false
    }

    /**
     * Records a failure and trips the circuit if threshold exceeded.
     * @private
     */
    _recordFailure() {
        this.failureCount++
        if (this.failureCount >= this.failureThreshold) {
            this.circuitOpenUntil = Date.now() + this.cooldownDurationMs
            console.warn(`[YouPiGatewayAdapter] Circuit breaker tripped open for ${this.cooldownDurationMs / 1000}s due to consecutive failures.`)
        }
    }

    /**
     * Resets failure counters upon successful request.
     * @private
     */
    _recordSuccess() {
        this.failureCount = 0
        this.circuitOpenUntil = 0
    }

    /**
     * Low-level resilient HTTP request helper.
     * @private
     */
    async _request(path, options = {}) {
        const url = new URL(path, this.baseUrl)
        const isHttps = url.protocol === 'https:'
        const client = isHttps ? https : http

        return new Promise((resolve, reject) => {
            const req = client.request(url, {
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Merchant-Id': this.merchantId,
                    ...(options.headers || {})
                },
                timeout: this.timeoutMs
            }, (res) => {
                let data = ''
                res.on('data', chunk => { data += chunk })
                res.on('end', () => {
                    let parsed
                    try {
                        parsed = data ? JSON.parse(data) : {}
                    } catch {
                        parsed = { raw: data }
                    }
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ statusCode: res.statusCode, body: parsed })
                    } else {
                        const err = new Error(parsed?.error || parsed?.message || `HTTP ${res.statusCode}`)
                        err.statusCode = res.statusCode
                        err.body = parsed
                        reject(err)
                    }
                })
            })

            req.on('timeout', () => {
                req.destroy()
                reject(new Error(`Request timed out after ${this.timeoutMs}ms`))
            })

            req.on('error', (err) => {
                reject(err)
            })

            if (options.body) {
                req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
            }
            req.end()
        })
    }

    /**
     * Checks if YouPI-PG microservice is healthy and responsive.
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        if (this._isCircuitTripped()) {
            return false
        }
        let timer = null
        try {
            // Rapid probe (1.5s max timeout)
            const timeoutPromise = new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('Probe timeout')), 1500)
                if (timer && timer.unref) timer.unref()
            })
            const probePromise = this._request('/api/v1/health')
            await Promise.race([probePromise, timeoutPromise])
            this._recordSuccess()
            return true
        } catch {
            this._recordFailure()
            return false
        } finally {
            if (timer) clearTimeout(timer)
        }
    }

    /**
     * Creates a payment session in YouPI-PG.
     * 
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async createOrder(params) {
        if (this._isCircuitTripped()) {
            throw new Error('YouPI Payment Gateway is temporarily unreachable (Circuit Breaker Open)')
        }

        const amountPaise = Math.round(Number(params.amount) * 100)
        const formattedAmount = (amountPaise / 100).toFixed(2)

        const payload = {
            orderId: params.orderId,
            amount: formattedAmount,
            currency: params.currency || 'INR',
            customer: {
                name: params.customer?.name || params.username || 'AmratGames Player',
                email: params.customer?.email || 'player@amratgames.com',
                phoneNumber: params.customer?.phoneNumber || ''
            },
            description: `AmratGames Instant Deposit #${params.orderId}`,
            returnUrl: params.returnUrl || `${this.checkoutUrl}/return?orderId=${params.orderId}`,
            metadata: {
                userId: params.userId,
                username: params.username,
                gateway: this.name,
                ...(params.metadata || {})
            }
        }

        try {
            const response = await this._request('/api/v1/payments', {
                method: 'POST',
                body: payload,
                headers: {
                    'Idempotency-Key': `idem_${params.orderId}`
                }
            })

            this._recordSuccess()
            const result = response.body

            return {
                success: true,
                gateway: this.name,
                orderId: result.orderId || params.orderId,
                paymentId: result.paymentId,
                amount: parseFloat(result.amount || formattedAmount),
                amountPaise: result.amountPaise || amountPaise,
                currency: result.currency || 'INR',
                status: result.status || 'INITIATED',
                checkoutUrl: result.checkoutUrl || `${this.checkoutUrl}/checkout/${result.paymentId}`,
                qrPayload: result.qrPayload || null,
                upiIntent: result.upiIntent || null,
                raw: result
            }
        } catch (err) {
            this._recordFailure()
            throw new Error(`Failed to create YouPI payment order: ${err.message}`)
        }
    }

    /**
     * Verifies inbound webhook request from YouPI-PG.
     * 
     * @param {Object} headers
     * @param {Buffer|string} rawBody
     * @returns {Promise<{ valid: boolean, payload?: any, error?: string }>}
     */
    async verifyWebhookSignature(headers, rawBody) {
        const signatureHeader = headers['x-gateway-signature'] 
            || headers['x-webhook-signature'] 
            || headers['x-signature']

        const verification = webhookSignatureVerifier.verifyHmacSha256(
            rawBody,
            signatureHeader,
            this.webhookSecret
        )

        if (!verification.valid) {
            return verification
        }

        try {
            const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody)
            const payload = JSON.parse(bodyStr)
            return {
                valid: true,
                payload
            }
        } catch (err) {
            return {
                valid: false,
                error: `Invalid JSON payload in webhook body: ${err.message}`
            }
        }
    }

    /**
     * Queries authoritative status of a payment.
     * 
     * @param {string} paymentId
     * @returns {Promise<Object>}
     */
    async checkOrderStatus(paymentId) {
        try {
            const res = await this._request(`/api/v1/payments/${encodeURIComponent(paymentId)}`)
            this._recordSuccess()
            const body = res.body
            return {
                status: body.status || 'PENDING',
                paymentId: body.paymentId,
                orderId: body.orderId,
                amount: parseFloat(body.amount || 0),
                utr: body.utr || null,
                completedAt: body.completedAt || null,
                raw: body
            }
        } catch (err) {
            this._recordFailure()
            throw new Error(`Failed to fetch payment status: ${err.message}`)
        }
    }
}
