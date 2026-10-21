// =============================================================================
// 👑 AmratGames.com — High-Throughput Memory-Bounded Sliding Window Rate Limiter
// Prevents brute-force, credential stuffing, OTP flooding, and DDoS attacks
// =============================================================================

class MemorySlidingWindowLimiter {
    constructor({ windowMs = 60000, max = 60, message = 'Too many requests', keyPrefix = 'rl', skipSuccessfulRequests = false }) {
        this.windowMs = windowMs
        this.max = max
        this.message = message
        this.keyPrefix = keyPrefix
        this.skipSuccessfulRequests = skipSuccessfulRequests
        this.hits = new Map() // key -> [timestamps]

        // Sweep stale keys every 2 minutes
        this.cleanupTimer = setInterval(() => this.cleanup(), 120000)
        if (this.cleanupTimer.unref) this.cleanupTimer.unref()
    }

    cleanup() {
        const now = Date.now()
        for (const [key, timestamps] of this.hits.entries()) {
            const valid = timestamps.filter(t => now - t < this.windowMs)
            if (valid.length === 0) {
                this.hits.delete(key)
            } else {
                this.hits.set(key, valid)
            }
        }
    }

    middleware(keyGenerator = (req) => req.ip || req.connection.remoteAddress || 'unknown') {
        return (req, res, next) => {
            const now = Date.now()
            const rawKey = keyGenerator(req)
            const key = `${this.keyPrefix}:${rawKey}`

            const timestamps = (this.hits.get(key) || []).filter(t => now - t < this.windowMs)

            if (timestamps.length >= this.max) {
                const oldest = timestamps[0]
                const retryAfterSec = Math.ceil((this.windowMs - (now - oldest)) / 1000)

                res.setHeader('Retry-After', retryAfterSec)
                res.setHeader('X-RateLimit-Limit', this.max)
                res.setHeader('X-RateLimit-Remaining', 0)

                return res.status(429).json({
                    success: false,
                    error: this.message,
                    retryAfterSec
                })
            }

            if (this.skipSuccessfulRequests) {
                res.on('finish', () => {
                    if (res.statusCode >= 400) {
                        const current = (this.hits.get(key) || []).filter(t => Date.now() - t < this.windowMs)
                        current.push(Date.now())
                        this.hits.set(key, current)
                    }
                })
            } else {
                timestamps.push(now)
                this.hits.set(key, timestamps)
            }

            res.setHeader('X-RateLimit-Limit', this.max)
            res.setHeader('X-RateLimit-Remaining', Math.max(0, this.max - timestamps.length))

            next()
        }
    }
}

// ── Specific Rate Limiters ──────────────────────────────────────────────────

// 1. Login Limiter: Max 5 failed attempts per 15 minutes per IP & Login target
export const loginRateLimiter = new MemorySlidingWindowLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many failed login attempts. Account temporarily locked for 15 minutes.',
    keyPrefix: 'login',
    skipSuccessfulRequests: true
}).middleware((req) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'ip'
    const login = req.body?.login || req.body?.email || req.body?.phone || ''
    return `${ip}:${String(login).toLowerCase().trim()}`
})

// 2. OTP Request Cooldown: Max 1 OTP per 60 seconds per identifier, max 5 per hour
const otpShortLimiter = new MemorySlidingWindowLimiter({
    windowMs: 60 * 1000,
    max: 1,
    message: 'Please wait 60 seconds before requesting another verification code.',
    keyPrefix: 'otp_short'
})

const otpLongLimiter = new MemorySlidingWindowLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Maximum OTP verification requests reached for this hour. Please try again later.',
    keyPrefix: 'otp_hourly'
})

export function otpRateLimiter(req, res, next) {
    const identifier = String(req.body?.identifier || '').trim().toLowerCase()
    const keyGen = () => identifier || req.ip || 'global'

    otpShortLimiter.middleware(keyGen)(req, res, (err) => {
        if (err) return next(err)
        otpLongLimiter.middleware(keyGen)(req, res, next)
    })
}

// 3. Register Limiter: Max 10 registrations per hour per IP
export const registerRateLimiter = new MemorySlidingWindowLimiter({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many accounts registered from this network. Please contact support.',
    keyPrefix: 'reg'
}).middleware((req) => req.ip || req.headers['x-forwarded-for'] || 'ip')

// 4. General Sensitive API Limiter: Max 120 calls per minute
export const sensitiveApiLimiter = new MemorySlidingWindowLimiter({
    windowMs: 60 * 1000,
    max: 120,
    message: 'API rate limit exceeded. Please throttle requests.',
    keyPrefix: 'api'
}).middleware((req) => req.ip || req.headers['x-forwarded-for'] || 'ip')
