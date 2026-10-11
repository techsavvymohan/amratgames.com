import { BaseSmsProvider } from './BaseSmsProvider.js'

/**
 * 2Factor.in SMS Provider (Fastest Indian OTP Gateway)
 * Delivers transactional OTP directly via priority SMPP routes in 2-4 seconds.
 */
export class TwoFactorSmsProvider extends BaseSmsProvider {
    /**
     * @param {object} options
     * @param {string} options.apiKey 2Factor.in API Key
     * @param {string} [options.template] Pre-approved template name (default: 'OTP1')
     * @param {number} [options.timeoutMs] Network timeout (default: 4500ms)
     */
    constructor(options = {}) {
        super('2factor')
        this.apiKey = options.apiKey || process.env.TWOFACTOR_API_KEY || ''
        this.template = options.template || process.env.TWOFACTOR_TEMPLATE || 'OTP1'
        this.timeoutMs = options.timeoutMs || 4500
    }

    isConfigured() {
        return Boolean(this.apiKey && this.apiKey.trim().length > 0)
    }

    async send({ rawPhone, otp, template }) {
        if (!this.isConfigured()) {
            return {
                success: false,
                error: '2Factor.in API Key is not configured (TWOFACTOR_API_KEY is missing)',
                provider: this.name
            }
        }

        const tpl = template || this.template || 'OTP1'
        const endpoint = `https://2factor.in/API/V1/${this.apiKey}/SMS/${rawPhone}/${otp}/${tpl}`

        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                signal: AbortSignal.timeout(this.timeoutMs)
            })

            if (!response.ok) {
                const text = await response.text().catch(() => '')
                return {
                    success: false,
                    error: `2Factor HTTP ${response.status}: ${text || response.statusText}`,
                    provider: this.name
                }
            }

            const data = await response.json()
            if (data.Status === 'Success') {
                return {
                    success: true,
                    messageId: data.Details,
                    provider: this.name
                }
            } else {
                return {
                    success: false,
                    error: data.Details || '2Factor dispatch failed',
                    provider: this.name
                }
            }
        } catch (err) {
            const isTimeout = err.name === 'TimeoutError' || err.code === 23
            return {
                success: false,
                error: isTimeout
                    ? `2Factor request timed out after ${this.timeoutMs}ms`
                    : `2Factor dispatch error: ${err.message}`,
                provider: this.name
            }
        }
    }

    async checkHealth() {
        if (!this.isConfigured()) {
            return { ok: false, provider: this.name, error: 'API key not configured' }
        }

        try {
            const endpoint = `https://2factor.in/API/V1/${this.apiKey}/BAL/SMS`
            const res = await fetch(endpoint, {
                signal: AbortSignal.timeout(3000)
            })
            const data = await res.json()
            return {
                ok: data.Status === 'Success',
                provider: this.name,
                balance: data.Details || 'Available'
            }
        } catch (err) {
            return { ok: false, provider: this.name, error: err.message }
        }
    }
}
