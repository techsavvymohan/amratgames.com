import crypto from 'node:crypto'

/**
 * WebhookSignatureVerifier
 * 
 * High-security cryptographic utility for validating webhook delivery integrity
 * and eliminating replay attacks.
 */
export class WebhookSignatureVerifier {
    /**
     * @param {Object} [options]
     * @param {number} [options.maxTimestampSkewSeconds=300] - Allowed clock skew (5 min default)
     */
    constructor(options = {}) {
        this.maxTimestampSkewSeconds = options.maxTimestampSkewSeconds || 300
        // In-memory LRU idempotency cache (keyed by delivery ID / UTR)
        this.processedDeliveries = new Set()
        this.maxCacheSize = 10000
    }

    /**
     * Verifies constant-time HMAC-SHA256 signature against raw unparsed payload bytes.
     * 
     * @param {Buffer|string} rawBytes - Exact bytes received in HTTP body
     * @param {string} signatureHeader - Signature from header (e.g. "sha256=abcdef..." or "abcdef...")
     * @param {string} secret - Secret key configured for the gateway webhook
     * @returns {{ valid: boolean, error?: string }}
     */
    verifyHmacSha256(rawBytes, signatureHeader, secret) {
        if (!secret) {
            return { valid: false, error: 'Webhook secret is not configured' }
        }
        if (!signatureHeader || typeof signatureHeader !== 'string') {
            return { valid: false, error: 'Missing or malformed signature header' }
        }
        if (!rawBytes) {
            return { valid: false, error: 'Empty payload body cannot be verified' }
        }

        try {
            // Strip any "sha256=" or "sha256:" prefixes if present
            const cleanSignature = signatureHeader.replace(/^sha256[=:]/i, '').trim().toLowerCase()

            const bufferPayload = Buffer.isBuffer(rawBytes) 
                ? rawBytes 
                : Buffer.from(rawBytes, 'utf8')

            const expectedHex = crypto
                .createHmac('sha256', secret)
                .update(bufferPayload)
                .digest('hex')
                .toLowerCase()

            const actualBuf = Buffer.from(cleanSignature, 'hex')
            const expectedBuf = Buffer.from(expectedHex, 'hex')

            // timingSafeEqual requires buffers of identical length
            if (actualBuf.length !== expectedBuf.length) {
                return { valid: false, error: 'Signature length mismatch' }
            }

            const isValid = crypto.timingSafeEqual(actualBuf, expectedBuf)
            if (!isValid) {
                return { valid: false, error: 'Cryptographic signature mismatch' }
            }

            return { valid: true }
        } catch (err) {
            return { valid: false, error: `Verification exception: ${err.message}` }
        }
    }

    /**
     * Replay-attack defense: Verifies that the delivery/event ID has not been processed.
     * 
     * @param {string} deliveryId
     * @param {Function} [dbCheckFn] - Optional external database idempotency check
     * @returns {boolean} True if new (can process), false if duplicate replay
     */
    isIdempotent(deliveryId, dbCheckFn) {
        if (!deliveryId) return true

        // 1. Check in-memory fast cache
        if (this.processedDeliveries.has(deliveryId)) {
            return false
        }

        // 2. Check external DB if provided
        if (typeof dbCheckFn === 'function' && dbCheckFn(deliveryId)) {
            this.processedDeliveries.add(deliveryId)
            return false
        }

        return true
    }

    /**
     * Marks an event or delivery ID as processed.
     * 
     * @param {string} deliveryId
     * @param {Function} [dbMarkFn] - Optional external database mark function
     */
    markProcessed(deliveryId, dbMarkFn) {
        if (!deliveryId) return

        if (this.processedDeliveries.size >= this.maxCacheSize) {
            // Drop oldest items to prevent memory leak
            const iterator = this.processedDeliveries.values()
            for (let i = 0; i < 1000; i++) {
                const next = iterator.next()
                if (next.done) break
                this.processedDeliveries.delete(next.value)
            }
        }

        this.processedDeliveries.add(deliveryId)

        if (typeof dbMarkFn === 'function') {
            dbMarkFn(deliveryId)
        }
    }

    /**
     * Validates timestamp freshness to prevent delayed replay of intercepted webhooks.
     * 
     * @param {string|number} timestamp
     * @returns {boolean}
     */
    isTimestampFresh(timestamp) {
        if (!timestamp) return true // Skew check skipped if no timestamp sent
        let parsedTime = typeof timestamp === 'number' ? timestamp : Number(timestamp)
        if (isNaN(parsedTime)) {
            parsedTime = Date.parse(timestamp)
        }
        if (isNaN(parsedTime)) return true

        const now = Date.now()
        // If timestamp is in epoch seconds (e.g. 10 digits), convert to milliseconds
        if (parsedTime < 1e11) {
            parsedTime *= 1000
        }
        const diffSeconds = Math.abs(now - parsedTime) / 1000
        return diffSeconds <= this.maxTimestampSkewSeconds
    }
}

export const webhookSignatureVerifier = new WebhookSignatureVerifier()
