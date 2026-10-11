import express from 'express'

/**
 * Creates a standalone Express router for OTP operations
 * @param {import('../OtpAuthEngine.js').OtpAuthEngine} engine
 * @param {object} [options]
 * @param {Function} [options.onUserVerified] Callback when OTP matches: async (phone, req) => ({ user, token })
 * @returns {express.Router}
 */
export function createOtpRouter(engine, options = {}) {
    const router = express.Router()

    // 1. Send OTP
    router.post('/send-otp', async (req, res) => {
        try {
            const { phone } = req.body
            if (!phone) {
                return res.status(400).json({ success: false, error: 'Phone number is required' })
            }

            const result = await engine.sendOtp(phone, req.body)
            if (!result.success) {
                return res.status(400).json(result)
            }

            res.json(result)
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    })

    // 2. Verify OTP
    router.post('/verify-otp', async (req, res) => {
        try {
            const { phone, otp } = req.body
            if (!phone || !otp) {
                return res.status(400).json({ success: false, error: 'Phone and OTP are required' })
            }

            const verifyResult = await engine.verifyOtp(phone, otp)
            if (!verifyResult.valid) {
                return res.status(400).json({ success: false, error: verifyResult.error })
            }

            // Hook for host SaaS to create/lookup user, issue JWT, etc.
            let extraData = {}
            if (typeof options.onUserVerified === 'function') {
                extraData = (await options.onUserVerified(verifyResult.phone, req)) || {}
            }

            res.json({
                success: true,
                phone: verifyResult.phone,
                formattedPhone: verifyResult.formattedPhone,
                ...extraData
            })
        } catch (err) {
            res.status(500).json({ success: false, error: err.message })
        }
    })

    // 3. Provider & Engine Health Check
    router.get('/health', async (req, res) => {
        try {
            const health = await engine.checkHealth()
            res.json(health)
        } catch (err) {
            res.status(500).json({ status: 'error', error: err.message })
        }
    })

    return router
}
