/**
 * IPaymentGateway
 * 
 * Abstract base contract for all payment gateway adapters in AmratGames.
 * Guarantees a decoupled, interchangeable interface conforming to the OOP Adapter Pattern.
 */
export class IPaymentGateway {
    /**
     * Unique identifier for this gateway adapter (e.g. 'youpi', 'manual', 'crypto')
     * @returns {string}
     */
    get name() {
        throw new Error('Getter "name" must be implemented by concrete subclass.');
    }

    /**
     * Creates or initializes a payment deposit session / order.
     * 
     * @param {Object} params
     * @param {string} params.orderId - Unique merchant order identifier
     * @param {number} params.amount - Amount in standard currency units (e.g. INR)
     * @param {string} [params.currency='INR'] - Currency code
     * @param {string} params.userId - Player user ID
     * @param {string} [params.username] - Player username
     * @param {Object} [params.customer] - Customer details { name, email, phoneNumber }
     * @param {Object} [params.metadata] - Arbitrary metadata preserved through lifecycle
     * @returns {Promise<{
     *   success: boolean,
     *   orderId: string,
     *   paymentId: string,
     *   amount: number,
     *   currency: string,
     *   checkoutUrl?: string,
     *   qrPayload?: string,
     *   upiIntent?: string,
     *   gateway: string,
     *   raw?: any
     * }>}
     */
    async createOrder(params) {
        throw new Error('Method "createOrder" must be implemented by concrete subclass.');
    }

    /**
     * Cryptographically verifies the inbound webhook signature and returns verified payload.
     * 
     * @param {Object} headers - Request headers
     * @param {Buffer|string} rawBody - Raw unparsed request body
     * @returns {Promise<{
     *   valid: boolean,
     *   payload?: any,
     *   error?: string
     * }>}
     */
    async verifyWebhookSignature(headers, rawBody) {
        throw new Error('Method "verifyWebhookSignature" must be implemented by concrete subclass.');
    }

    /**
     * Checks authoritative payment status with the gateway upstream.
     * 
     * @param {string} paymentIdOrOrderId
     * @returns {Promise<{
     *   status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'EXPIRED' | 'CANCELLED',
     *   paymentId?: string,
     *   orderId?: string,
     *   amount?: number,
     *   utr?: string,
     *   completedAt?: string,
     *   raw?: any
     * }>}
     */
    async checkOrderStatus(paymentIdOrOrderId) {
        throw new Error('Method "checkOrderStatus" must be implemented by concrete subclass.');
    }

    /**
     * Rapid health check probing if the gateway daemon is reachable.
     * Used by circuit breakers to route to fallback if gateway service is offline.
     * 
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        throw new Error('Method "isAvailable" must be implemented by concrete subclass.');
    }
}
