/**
 * PaymentBridge
 * 
 * Modular OOP Client Bridge connecting AmratGames Frontend with the decoupled Gateway Service.
 * Provides health probing, deposit session creation, and seamless 1-tap UPI launch with silent manual fallback.
 */
export class PaymentBridge {
    /**
     * @param {Object} [options]
     * @param {string} [options.apiBase] - API base URL for gateway routes
     */
    constructor(options = {}) {
        this.apiBase = options.apiBase || '/api/gateway'
    }

    /**
     * Checks if the sovereign YouPI gateway daemon is available.
     * @returns {Promise<{ youpiAvailable: boolean, manualAvailable: boolean }>}
     */
    async checkGatewayHealth() {
        try {
            const res = await fetch(`${this.apiBase}/health`)
            if (!res.ok) return { youpiAvailable: false, manualAvailable: true }
            const data = await res.json()
            return {
                youpiAvailable: Boolean(data?.activeGateways?.youpi?.available),
                manualAvailable: true
            }
        } catch {
            return { youpiAvailable: false, manualAvailable: true }
        }
    }

    /**
     * Requests an instant checkout session from the backend.
     * 
     * @param {number|string} amount - Deposit amount in INR
     * @param {string} token - Authenticated JWT bearer token
     * @param {string} [gateway='youpi'] - Preferred gateway
     * @returns {Promise<Object>}
     */
    async requestSession(amount, token, gateway = 'youpi') {
        const numAmount = parseFloat(amount)
        if (isNaN(numAmount) || numAmount <= 0) {
            throw new Error('Please enter a valid deposit amount')
        }

        const headers = {
            'Content-Type': 'application/json'
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }

        const res = await fetch(`${this.apiBase}/session`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                amount: numAmount,
                gateway
            })
        })

        const data = await res.json()
        if (!res.ok || !data.success) {
            throw new Error(data?.error || 'Failed to initialize deposit session')
        }

        return data.session
    }

    /**
     * Launches payment flow according to gateway response.
     * 
     * @param {Object} session - Session object returned from requestSession
     * @returns {{ launched: boolean, type: string, url?: string, uri?: string }}
     */
    launchSession(session) {
        if (!session) {
            throw new Error('Valid payment session is required to launch checkout.')
        }

        // If YouPI checkout URL is returned, open checkout window
        if (session.gateway === 'youpi' && session.checkoutUrl) {
            const targetWindow = window.open(session.checkoutUrl, '_blank')
            if (!targetWindow || targetWindow.closed || typeof targetWindow.closed === 'undefined') {
                // Popup was blocked by browser; navigate current window or notify
                window.location.href = session.checkoutUrl
            }
            return {
                launched: true,
                type: 'youpi_checkout',
                url: session.checkoutUrl
            }
        }

        // If standard UPI intent URI is returned (e.g. mobile app deep link)
        if (session.upiIntent) {
            return {
                launched: true,
                type: 'upi_intent',
                uri: session.upiIntent
            }
        }

        return {
            launched: false,
            type: 'manual',
            session
        }
    }
}

export const paymentBridge = new PaymentBridge()
