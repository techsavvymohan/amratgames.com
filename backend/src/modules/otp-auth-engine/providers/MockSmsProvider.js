import { BaseSmsProvider } from './BaseSmsProvider.js'

/**
 * Mock SMS Provider for Local Development, Testing, and Staging
 * Prints the OTP to the console and always succeeds immediately.
 */
export class MockSmsProvider extends BaseSmsProvider {
    constructor(options = {}) {
        super('mock')
        this.silent = options.silent || false
        this.history = [] // In-memory history for unit testing
    }

    async send({ phone, rawPhone, otp }) {
        const record = {
            phone,
            rawPhone,
            otp,
            timestamp: new Date().toISOString(),
            messageId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        }

        this.history.push(record)

        if (!this.silent) {
            console.log('\n======================================================')
            console.log('📲 [OTP-AUTH-ENGINE MOCK SMS DISPATCH]')
            console.log(`🎯 Recipient Phone: ${phone || rawPhone}`)
            console.log(`🔑 Verification Code: ${otp} (Valid for 5 mins)`)
            console.log('💡 Simulated SMS (Zero Telecom Cost)')
            console.log('======================================================\n')
        }

        return {
            success: true,
            messageId: record.messageId,
            provider: this.name
        }
    }

    async checkHealth() {
        return { ok: true, provider: this.name, status: 'mock_active' }
    }

    getLastOtp(rawPhone) {
        const entry = this.history.filter(h => !rawPhone || h.rawPhone === rawPhone).pop()
        return entry ? entry.otp : null
    }

    clearHistory() {
        this.history = []
    }
}
