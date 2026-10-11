/**
 * Abstract Base SMS Provider
 */
export class BaseSmsProvider {
    constructor(name = 'base') {
        this.name = name
    }

    /**
     * Send an OTP via SMS
     * @param {object} params
     * @param {string} params.phone Formatted phone (+91...)
     * @param {string} params.rawPhone 10-digit raw phone (9876543210)
     * @param {string} params.otp 6-digit OTP
     * @param {string} [params.template] Optional template name
     * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
     */
    async send(params) {
        throw new Error(`send() not implemented in provider ${this.name}`)
    }

    /**
     * Check provider health/balance
     */
    async checkHealth() {
        return { ok: true, provider: this.name }
    }
}
