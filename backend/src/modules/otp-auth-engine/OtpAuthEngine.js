import { normalizeIndianPhone } from './utils/phoneValidator.js'
import { generateSecureOtp } from './utils/cryptoOtp.js'
import { MemoryOtpStore } from './storage/MemoryOtpStore.js'
import { createSmsProvider } from './providers/index.js'

/**
 * OtpAuthEngine
 * High-performance, modular OTP authentication engine designed for SaaS and gaming platforms.
 */
export class OtpAuthEngine {
    /**
     * @param {object} options
     * @param {string|object} [options.provider] '2factor' | 'fast2sms' | 'mock' or custom BaseSmsProvider instance
     * @param {string} [options.apiKey] API key for the SMS gateway
     * @param {object} [options.store] Custom storage instance (defaults to MemoryOtpStore)
     * @param {number} [options.otpLength=6] OTP length (default 6)
     * @param {number} [options.otpExpiryMs=300000] TTL in ms (default 5 minutes)
     * @param {number} [options.resendCooldownSec=60] Minimum wait between OTP resends (default 60s)
     * @param {number} [options.maxAttempts=5] Max wrong guesses before OTP is invalidated
     * @param {string} [options.masterBypassCode] Demo/QA bypass code (e.g. '777777')
     * @param {boolean} [options.enableBypass=false] Enable master QA code (disabled by default in production)
     */
    constructor(options = {}) {
        this.options = options
        this.otpLength = options.otpLength || 6
        this.otpExpiryMs = options.otpExpiryMs || 5 * 60 * 1000 // 5 minutes
        this.resendCooldownSec = options.resendCooldownSec || 60
        this.maxAttempts = options.maxAttempts || 5
        this.masterBypassCode = options.masterBypassCode || null
        this.enableBypass = typeof options.enableBypass === 'boolean'
            ? options.enableBypass
            : (process.env.NODE_ENV !== 'production')

        // Initialize Store
        this.store = options.store || new MemoryOtpStore()

        // Initialize SMS Provider
        if (options.provider && typeof options.provider === 'object' && options.provider.send) {
            this.provider = options.provider
        } else {
            const providerName = typeof options.provider === 'string'
                ? options.provider
                : (process.env.SMS_GATEWAY_PROVIDER || 'mock')

            this.provider = createSmsProvider(providerName, {
                apiKey: options.apiKey || process.env.TWOFACTOR_API_KEY || process.env.SMS_GATEWAY_API_KEY,
                ...options
            })
        }
    }

    /**
     * Send an OTP to the given phone number
     * @param {string} phoneInput Raw or formatted phone number
     * @param {object} [sendOptions]
     * @returns {Promise<{ success: boolean, phone?: string, formattedPhone?: string, error?: string, resendIn?: number, expiresAt?: number }>}
     */
    async sendOtp(phoneInput, sendOptions = {}) {
        const check = normalizeIndianPhone(phoneInput)
        if (!check.isValid) {
            return { success: false, error: check.error }
        }

        const phoneKey = check.raw

        // 1. Check existing record for Resend Cooldown
        const existing = await this.store.get(phoneKey)
        if (existing && existing.lastSentAt) {
            const timeSinceLastSend = Date.now() - existing.lastSentAt
            const cooldownMs = this.resendCooldownSec * 1000
            if (timeSinceLastSend < cooldownMs) {
                const waitSec = Math.ceil((cooldownMs - timeSinceLastSend) / 1000)
                return {
                    success: false,
                    error: `Please wait ${waitSec}s before requesting a new OTP`,
                    resendIn: waitSec
                }
            }
        }

        // 2. Generate secure OTP
        const otp = generateSecureOtp(this.otpLength)
        const now = Date.now()
        const expiresAt = now + this.otpExpiryMs

        // 3. Save to storage
        await this.store.set(phoneKey, {
            otp,
            attempts: 0,
            lastSentAt: now,
            expiresAt
        }, this.otpExpiryMs)

        // 4. Dispatch via SMS provider
        const dispatchResult = await this.provider.send({
            phone: check.formatted,
            rawPhone: check.raw,
            otp,
            template: sendOptions.template
        })

        if (!dispatchResult.success) {
            // Note: If SMS provider failed, don't crash, report gracefully
            return {
                success: false,
                error: dispatchResult.error || 'Failed to dispatch SMS through telecom gateway',
                provider: this.provider.name
            }
        }

        return {
            success: true,
            phone: check.raw,
            formattedPhone: check.formatted,
            resendCooldown: this.resendCooldownSec,
            expiresAt,
            provider: this.provider.name,
            messageId: dispatchResult.messageId
        }
    }

    /**
     * Verify an OTP entered by the user
     * @param {string} phoneInput
     * @param {string} otpInput
     * @returns {Promise<{ valid: boolean, phone?: string, formattedPhone?: string, error?: string }>}
     */
    async verifyOtp(phoneInput, otpInput) {
        if (!phoneInput || !otpInput) {
            return { valid: false, error: 'Phone number and OTP code are required' }
        }

        const check = normalizeIndianPhone(phoneInput)
        if (!check.isValid) {
            return { valid: false, error: check.error }
        }

        const phoneKey = check.raw
        const inputCode = String(otpInput).trim()

        // 1. Check QA / Demo Bypass (if enabled)
        if (this.enableBypass && this.masterBypassCode && inputCode === String(this.masterBypassCode)) {
            await this.store.delete(phoneKey)
            return {
                valid: true,
                phone: check.raw,
                formattedPhone: check.formatted,
                bypassed: true
            }
        }

        // 2. Retrieve record from storage
        const record = await this.store.get(phoneKey)
        if (!record) {
            return { valid: false, error: 'OTP has expired or was not requested. Please request a new OTP.' }
        }

        // 3. Check expiration
        if (Date.now() > record.expiresAt) {
            await this.store.delete(phoneKey)
            return { valid: false, error: 'OTP has expired. Please request a new OTP.' }
        }

        // 4. Rate-limit failed attempts (Brute Force Protection)
        record.attempts = (record.attempts || 0) + 1
        if (record.attempts > this.maxAttempts) {
            await this.store.delete(phoneKey)
            return { valid: false, error: 'Too many incorrect attempts. This OTP has been invalidated for security.' }
        }

        // Save updated attempt count
        await this.store.update(phoneKey, { attempts: record.attempts })

        // 5. Compare OTP
        if (record.otp !== inputCode) {
            const remaining = this.maxAttempts - record.attempts
            return {
                valid: false,
                error: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
            }
        }

        // 6. Success: Burn the OTP immediately to prevent replay attacks
        await this.store.delete(phoneKey)

        return {
            valid: true,
            phone: check.raw,
            formattedPhone: check.formatted
        }
    }

    /**
     * Provider & Storage health check
     */
    async checkHealth() {
        const providerHealth = await this.provider.checkHealth().catch(err => ({ ok: false, error: err.message }))
        return {
            status: 'online',
            engine: 'AmratGames OtpAuthEngine v1.0.0',
            provider: this.provider.name,
            providerHealth,
            bypassEnabled: this.enableBypass
        }
    }
}
