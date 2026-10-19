import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { IPaymentGateway } from '../src/gateways/contracts/IPaymentGateway.js'
import { WebhookSignatureVerifier, webhookSignatureVerifier } from '../src/gateways/security/WebhookSignatureVerifier.js'
import { FallbackManualAdapter } from '../src/gateways/adapters/FallbackManualAdapter.js'
import { YouPiGatewayAdapter } from '../src/gateways/adapters/YouPiGatewayAdapter.js'
import { PaymentGatewayManager } from '../src/gateways/PaymentGatewayManager.js'

describe('OOP Payment Gateway Bridge Suite', () => {

    describe('IPaymentGateway Interface Contract', () => {
        test('unimplemented subclass throws contract errors on all required methods', async () => {
            class IncompleteAdapter extends IPaymentGateway {}
            const instance = new IncompleteAdapter()

            assert.throws(() => instance.name, /Getter "name" must be implemented/)
            await assert.rejects(async () => await instance.createOrder({}), /Method "createOrder" must be implemented/)
            await assert.rejects(async () => await instance.verifyWebhookSignature({}, ''), /Method "verifyWebhookSignature" must be implemented/)
            await assert.rejects(async () => await instance.checkOrderStatus('123'), /Method "checkOrderStatus" must be implemented/)
            await assert.rejects(async () => await instance.isAvailable(), /Method "isAvailable" must be implemented/)
        })
    })

    describe('WebhookSignatureVerifier Security Engine', () => {
        const verifier = new WebhookSignatureVerifier({ maxTimestampSkewSeconds: 300 })
        const secret = 'test_webhook_secret_key_123456789'
        const payload = JSON.stringify({
            event: 'SUCCESS',
            paymentId: 'pay_test_001',
            orderId: 'DEP_1001',
            amount: '500.00',
            currency: 'INR'
        })
        const rawBytes = Buffer.from(payload, 'utf8')
        const validHex = crypto.createHmac('sha256', secret).update(rawBytes).digest('hex')

        test('verifies valid HMAC-SHA256 signature in raw hex format', () => {
            const res = verifier.verifyHmacSha256(rawBytes, validHex, secret)
            assert.equal(res.valid, true)
            assert.equal(res.error, undefined)
        })

        test('verifies valid signature with sha256= prefix', () => {
            const res = verifier.verifyHmacSha256(rawBytes, `sha256=${validHex}`, secret)
            assert.equal(res.valid, true)
        })

        test('rejects tampered payload content', () => {
            const tamperedBytes = Buffer.from(JSON.stringify({
                event: 'SUCCESS',
                paymentId: 'pay_test_001',
                orderId: 'DEP_1001',
                amount: '50000.00', // Tampered amount
                currency: 'INR'
            }), 'utf8')

            const res = verifier.verifyHmacSha256(tamperedBytes, validHex, secret)
            assert.equal(res.valid, false)
            assert.match(res.error, /Cryptographic signature mismatch/)
        })

        test('rejects wrong secret', () => {
            const res = verifier.verifyHmacSha256(rawBytes, validHex, 'wrong_secret_key')
            assert.equal(res.valid, false)
        })

        test('rejects missing or empty signature header', () => {
            const res = verifier.verifyHmacSha256(rawBytes, '', secret)
            assert.equal(res.valid, false)
            assert.match(res.error, /Missing or malformed signature header/)
        })

        test('prevents replay attacks via idempotency checks', () => {
            const deliveryId = 'deliv_test_replay_999'
            // First time: fresh and allowed
            assert.equal(verifier.isIdempotent(deliveryId), true)
            verifier.markProcessed(deliveryId)

            // Second time: replay detected and rejected
            assert.equal(verifier.isIdempotent(deliveryId), false)
        })
    })

    describe('FallbackManualAdapter', () => {
        const manual = new FallbackManualAdapter({
            vpa: 'test@upi',
            merchantName: 'Test Merchant'
        })

        test('always reports available = true', async () => {
            const available = await manual.isAvailable()
            assert.equal(available, true)
            assert.equal(manual.name, 'manual')
        })

        test('creates valid NPCI UPI intent uri and orders', async () => {
            const order = await manual.createOrder({
                orderId: 'DEP_TEST_MANUAL',
                amount: 750,
                currency: 'INR'
            })

            assert.equal(order.success, true)
            assert.equal(order.gateway, 'manual')
            assert.equal(order.amount, 750)
            assert.equal(order.requiresUtr, true)
            assert.match(order.upiIntent, /^upi:\/\/pay\?pa=test%40upi&pn=Test%20Merchant&am=750\.00/)
            assert.equal(order.qrPayload, order.upiIntent)
        })
    })

    describe('YouPiGatewayAdapter Resiliency & Circuit Breaker', () => {
        test('trips circuit breaker after consecutive probe failures and halts requests', async () => {
            const youpi = new YouPiGatewayAdapter({
                baseUrl: 'http://127.0.0.1:59999', // Non-existent offline port
                timeoutMs: 100
            })

            assert.equal(youpi.name, 'youpi')
            assert.equal(youpi._isCircuitTripped(), false)

            // Force 3 probe failures
            await youpi.isAvailable()
            await youpi.isAvailable()
            await youpi.isAvailable()

            assert.equal(youpi._isCircuitTripped(), true)

            // Attempting order creation when circuit is open throws immediately without hanging
            await assert.rejects(
                async () => await youpi.createOrder({ orderId: 'DEP_FAIL', amount: 100 }),
                /Circuit Breaker Open/
            )
        })
    })

    describe('PaymentGatewayManager Facade & Orchestration', () => {
        test('resolves active gateway and gracefully defaults to fallback when primary is offline', async () => {
            const manager = new PaymentGatewayManager()
            
            // Offline YouPI adapter on dummy port
            const offlineYoupi = new YouPiGatewayAdapter({
                baseUrl: 'http://127.0.0.1:59999',
                timeoutMs: 50
            })
            manager.registerAdapter(offlineYoupi)

            // Resolving should detect offline YouPI and serve manual fallback without errors
            const active = await manager.resolveActiveGateway('youpi')
            assert.equal(active.name, 'manual')
        })

        test('creates deposit session via fallback with 0 interruptions', async () => {
            const manager = new PaymentGatewayManager()
            const dummyUser = {
                id: 'usr_test_bridge_01',
                username: 'BridgeTester',
                name: 'Bridge Tester',
                phone: '9876543210'
            }

            const session = await manager.createDepositSession(dummyUser, 500, { preferredGateway: 'manual' })
            assert.equal(session.success, true)
            assert.equal(session.gateway, 'manual')
            assert.equal(session.amount, 500)
            assert.equal(session.requiresUtr, true)
            assert.ok(session.upiIntent)
        })
    })

    after(() => {
        setTimeout(() => {
            process.exit(0)
        }, 100)
    })
})
