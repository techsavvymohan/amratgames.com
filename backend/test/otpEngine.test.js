import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    createOtpAuthEngine,
    normalizeIndianPhone,
    MockSmsProvider,
    MemoryOtpStore
} from '../src/modules/otp-auth-engine/index.js'

describe('Modular OtpAuthEngine Test Suite', () => {
    it('normalizes various Indian phone formats correctly', () => {
        // Raw 10 digits
        const res1 = normalizeIndianPhone('9876543210')
        assert.equal(res1.isValid, true)
        assert.equal(res1.raw, '9876543210')
        assert.equal(res1.formatted, '+919876543210')

        // With +91
        const res2 = normalizeIndianPhone('+919876543210')
        assert.equal(res2.isValid, true)
        assert.equal(res2.raw, '9876543210')

        // With leading 0
        const res3 = normalizeIndianPhone('09876543210')
        assert.equal(res3.isValid, true)
        assert.equal(res3.raw, '9876543210')

        // Invalid: Starts with 1
        const res4 = normalizeIndianPhone('1876543210')
        assert.equal(res4.isValid, false)

        // Invalid: Short
        const res5 = normalizeIndianPhone('98765')
        assert.equal(res5.isValid, false)
    })

    it('successfully sends OTP and logs via MockSmsProvider', async () => {
        const mockProvider = new MockSmsProvider({ silent: true })
        const engine = createOtpAuthEngine({
            provider: mockProvider,
            resendCooldownSec: 2
        })

        const sendRes = await engine.sendOtp('9876543210')
        assert.equal(sendRes.success, true)
        assert.equal(sendRes.phone, '9876543210')
        assert.ok(sendRes.expiresAt > Date.now())

        // Verify provider captured the OTP
        const lastOtp = mockProvider.getLastOtp('9876543210')
        assert.ok(typeof lastOtp === 'string')
        assert.equal(lastOtp.length, 6)
    })

    it('enforces resend cooldown throttling', async () => {
        const mockProvider = new MockSmsProvider({ silent: true })
        const engine = createOtpAuthEngine({
            provider: mockProvider,
            resendCooldownSec: 10
        })

        // First send succeeds
        const first = await engine.sendOtp('9876543211')
        assert.equal(first.success, true)

        // Immediate second send fails with cooldown error
        const second = await engine.sendOtp('9876543211')
        assert.equal(second.success, false)
        assert.ok(second.error.includes('Please wait'))
        assert.ok(second.resendIn > 0)
    })

    it('rejects invalid OTP and enforces maximum attempt limits', async () => {
        const mockProvider = new MockSmsProvider({ silent: true })
        const engine = createOtpAuthEngine({
            provider: mockProvider,
            maxAttempts: 3
        })

        await engine.sendOtp('9876543212')

        // Attempt 1: wrong
        const check1 = await engine.verifyOtp('9876543212', '000000')
        assert.equal(check1.valid, false)
        assert.ok(check1.error.includes('Incorrect OTP'))

        // Attempt 2: wrong
        const check2 = await engine.verifyOtp('9876543212', '000000')
        assert.equal(check2.valid, false)

        // Attempt 3: wrong
        const check3 = await engine.verifyOtp('9876543212', '000000')
        assert.equal(check3.valid, false)

        // Attempt 4: should be invalidated due to max attempts exceeded
        const check4 = await engine.verifyOtp('9876543212', '000000')
        assert.equal(check4.valid, false)
        assert.ok(check4.error.includes('invalidated') || check4.error.includes('expired'))
    })

    it('successfully verifies correct OTP and burns it immediately', async () => {
        const mockProvider = new MockSmsProvider({ silent: true })
        const engine = createOtpAuthEngine({ provider: mockProvider })

        await engine.sendOtp('9876543213')
        const sentOtp = mockProvider.getLastOtp('9876543213')

        // Verify with matching code
        const verify = await engine.verifyOtp('9876543213', sentOtp)
        assert.equal(verify.valid, true)
        assert.equal(verify.phone, '9876543213')

        // Replay attempt fails because OTP is burned
        const replay = await engine.verifyOtp('9876543213', sentOtp)
        assert.equal(replay.valid, false)
    })

    it('supports master bypass code for testing', async () => {
        const engine = createOtpAuthEngine({
            provider: 'mock',
            masterBypassCode: '777777',
            enableBypass: true
        })

        // Bypass should succeed immediately without even calling sendOtp
        const verify = await engine.verifyOtp('9876543214', '777777')
        assert.equal(verify.valid, true)
        assert.equal(verify.bypassed, true)
    })
})
