import { BaseSmsProvider } from './BaseSmsProvider.js'

/**
 * InHouseOtpProvider
 * 100% In-House, Zero-Dependency, Zero-API-Key Provider.
 * Completely self-hosted: generates, logs, tracks, and manages OTP delivery internally.
 */
export class InHouseOtpProvider extends BaseSmsProvider {
    /**
     * @param {object} [options]
     * @param {boolean} [options.silent=false]
     * @param {Function} [options.onDispatch] Custom hook called on every OTP dispatch
     */
    constructor(options = {}) {
        super('in-house')
        this.silent = options.silent || false
        this.onDispatch = options.onDispatch || null
        this.recentDispatches = [] // In-memory ring buffer (last 50 dispatches)
    }

    /**
     * Internal OTP Dispatch
     */
    async send({ phone, rawPhone, otp, template }) {
        const messageId = `inhouse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const entry = {
            messageId,
            phone: phone || `+91${rawPhone}`,
            rawPhone,
            otp,
            template: template || 'DEFAULT_OTP',
            dispatchedAt: new Date().toISOString()
        }

        // Keep last 50 in ring buffer
        this.recentDispatches.push(entry)
        if (this.recentDispatches.length > 50) {
            this.recentDispatches.shift()
        }

        if (!this.silent) {
            console.log('\n======================================================')
            console.log('🛡️ [IN-HOUSE OTP AUTH ENGINE — ZERO API KEY]')
            console.log(`📱 Recipient Phone: ${entry.phone}`)
            console.log(`🔑 Verification OTP: ${otp} (Valid for 5 mins)`)
            console.log(`⚡ Dispatch ID:     ${messageId}`)
            console.log('🔒 100% In-House & Self-Hosted (Zero External Service)')
            console.log('======================================================\n')
        }

        // Trigger optional custom dispatch callback (e.g., email, websocket, or webhook)
        if (typeof this.onDispatch === 'function') {
            try {
                await this.onDispatch(entry)
            } catch (err) {
                console.warn('[IN-HOUSE OTP] Custom dispatch callback warning:', err.message)
            }
        }

        return {
            success: true,
            messageId,
            provider: this.name,
            inHouse: true
        }
    }

    async checkHealth() {
        return {
            ok: true,
            provider: this.name,
            status: 'active',
            dispatchesCount: this.recentDispatches.length,
            requiresApiKey: false
        }
    }

    getRecentDispatches() {
        return [...this.recentDispatches]
    }
}
