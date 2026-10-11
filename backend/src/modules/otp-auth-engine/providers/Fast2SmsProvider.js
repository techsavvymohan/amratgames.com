import { BaseSmsProvider } from './BaseSmsProvider.js'

/**
 * Fast2SMS Provider (Alternative Indian SMS Gateway)
 */
export class Fast2SmsProvider extends BaseSmsProvider {
    /**
     * @param {object} options
     * @param {string} options.apiKey Fast2SMS API Authorization Key
     * @param {number} [options.timeoutMs] Network timeout (default: 4500ms)
     */
    constructor(options = {}) {
        super('fast2sms')
        this.apiKey = options.apiKey || process.env.FAST2SMS_API_KEY || ''
        this.timeoutMs = options.timeoutMs || 4500
    }

    isConfigured() {
        return Boolean(this.apiKey && this.apiKey.trim().length > 0)
    }

    async send({ rawPhone, otp }) {
        if (!this.isConfigured()) {
            return {
                success: false,
                error: 'Fast2SMS API Key is not configured (FAST2SMS_API_KEY is missing)',
                provider: this.name
            }
        }

        const endpoint = 'https://www.fast2sms.com/dev/bulkV2'

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'authorization': this.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    variables_values: otp,
                    route: 'otp',
                    numbers: rawPhone
                }),
                signal: AbortSignal.timeout(this.timeoutMs)
            })

            const data = await response.json().catch(() => ({}))

            if (data.return === true) {
                return {
                    success: true,
                    messageId: data.request_id || 'fast2sms-sent',
                    provider: this.name
                }
            } else {
                return {
                    success: false,
                    error: (Array.isArray(data.message) ? data.message.join(', ') : data.message) || 'Fast2SMS dispatch failed',
                    provider: this.name
                }
            }
        } catch (err) {
            const isTimeout = err.name === 'TimeoutError' || err.code === 23
            return {
                success: false,
                error: isTimeout
                    ? `Fast2SMS request timed out after ${this.timeoutMs}ms`
                    : `Fast2SMS dispatch error: ${err.message}`,
                provider: this.name
            }
        }
    }
}
