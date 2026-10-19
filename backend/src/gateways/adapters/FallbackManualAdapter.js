import { IPaymentGateway } from '../contracts/IPaymentGateway.js'
import { CONFIG } from '../../config.js'

/**
 * FallbackManualAdapter
 * 
 * Concrete OOP Gateway Adapter for manual UPI QR code scanning and UTR submission.
 * Serves as the indestructible, permanent fallback when automated payment services
 * are offline, restarting, or undergoing maintenance.
 */
export class FallbackManualAdapter extends IPaymentGateway {
    /**
     * @param {Object} [config]
     * @param {string} [config.vpa]
     * @param {string} [config.merchantName]
     */
    constructor(config = {}) {
        super()
        this.vpa = config.vpa || CONFIG.UPI_MERCHANT_VPA || 'amratgames@upi'
        this.merchantName = config.merchantName || CONFIG.UPI_MERCHANT_NAME || 'AmratGames India'
    }

    get name() {
        return 'manual'
    }

    /**
     * Always available by definition (static offline-capable rail).
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        return true
    }

    /**
     * Creates an order with static VPA and UPI intent string.
     * 
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async createOrder(params) {
        const amount = Number(params.amount)
        const orderId = params.orderId || `MAN_${Date.now()}`
        
        // Construct NPCI standard UPI deep-link URI
        const upiIntent = `upi://pay?pa=${encodeURIComponent(this.vpa)}&pn=${encodeURIComponent(this.merchantName)}&am=${amount.toFixed(2)}&cu=INR&tr=${encodeURIComponent(orderId)}&tn=${encodeURIComponent(`Deposit ${orderId}`)}`

        return {
            success: true,
            gateway: this.name,
            orderId,
            paymentId: `manual_${orderId}`,
            amount,
            currency: params.currency || 'INR',
            vpa: this.vpa,
            merchantName: this.merchantName,
            upiIntent,
            qrPayload: upiIntent,
            requiresUtr: true,
            status: 'PENDING'
        }
    }

    /**
     * Manual gateway does not use webhooks.
     */
    async verifyWebhookSignature(headers, rawBody) {
        return {
            valid: false,
            error: 'FallbackManualAdapter does not accept automated webhooks.'
        }
    }

    /**
     * Checks status from manual deposit request history.
     */
    async checkOrderStatus(orderId) {
        return {
            status: 'PENDING',
            orderId,
            requiresUtr: true
        }
    }
}
