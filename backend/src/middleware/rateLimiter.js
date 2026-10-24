// =============================================================================
// 👑 AmratGames.com — Enterprise Hybrid Sliding-Window Rate Limiter
// Backed by Redis with seamless in-memory fallback, sub-millisecond timeouts,
// and defense-in-depth against bot floods, brute force, and DDoS stress.
// =============================================================================

import crypto from 'node:crypto'
import { redisPubSub } from '../services/RedisPubSubService.js'

/**
 * Executes a promise with an automatic timeout to ensure rate limiting never
 * blocks or stalls client requests even under catastrophic Redis latency.
 */
function withTimeout(promise, ms = 500) {
    let timer
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const err = new Error(`Rate limit operation timed out after ${ms}ms`)
            err.code = 'RATE_LIMIT_TIMEOUT'
            reject(err)
        }, ms)
        if (timer.unref) timer.unref()
    })

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timer)
    })
}

export class MemorySlidingWindowLimiter {
    constructor({
        windowMs = 60000,
        max = 60,
        message = 'Too many requests. Please slow down.',
        keyPrefix = 'rl',
        skipSuccessfulRequests = false,
        maxTrackedKeys = 10000
    } = {}) {
        this.windowMs = windowMs
        this.max = max
        this.message = message
        this.keyPrefix = keyPrefix
        this.skipSuccessfulRequests = skipSuccessfulRequests
        this.maxTrackedKeys = maxTrackedKeys
        this.hits = new Map() // key -> [timestamps]

        // Periodic memory sweep every 60 seconds
        this.cleanupTimer = setInterval(() => this.cleanup(), 60000)
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

    _evictOldestIfNeeded() {
        if (this.hits.size <= this.maxTrackedKeys) return
        this.cleanup()
        if (this.hits.size <= this.maxTrackedKeys) return

        // Prune the oldest 20% of entries to keep memory bounded
        const keys = Array.from(this.hits.keys())
        for (let i = 0; i < Math.floor(keys.length * 0.2); i++) {
            this.hits.delete(keys[i])
        }
    }

    recordMemoryHit(key, timestamp = Date.now()) {
        const timestamps = (this.hits.get(key) || []).filter(t => timestamp - t < this.windowMs)
        timestamps.push(timestamp)
        this.hits.set(key, timestamps)
    }

    checkMemory(key, now = Date.now()) {
        this._evictOldestIfNeeded()
        const timestamps = (this.hits.get(key) || []).filter(t => now - t < this.windowMs)
        const count = timestamps.length

        if (count >= this.max) {
            const oldest = timestamps[0] || (now - this.windowMs)
            const retryAfterSec = Math.max(1, Math.ceil((this.windowMs - (now - oldest)) / 1000))
            return { allowed: false, remaining: 0, retryAfterSec, count }
        }

        return {
            allowed: true,
            remaining: Math.max(0, this.max - (count + 1)),
            retryAfterSec: 0,
            count
        }
    }

    middleware(keyGenerator = (req) => req.ip || req.connection?.remoteAddress || 'unknown') {
        return async (req, res, next) => {
            const now = Date.now()
            let rawKey
            try {
                rawKey = keyGenerator(req) || 'unknown'
            } catch {
                rawKey = 'unknown'
            }
            const key = `${this.keyPrefix}:${rawKey}`
            const redisKey = `rl:${key}`

            // ── 1. Try Redis Sliding-Window Rate Limiter ─────────────────────
            let redisChecked = false
            let allowed = true
            let remaining = this.max
            let retryAfterSec = 1

            if (redisPubSub.isAvailable && redisPubSub.publisher) {
                try {
                    const clearBefore = now - this.windowMs
                    const memberId = `${now}:${crypto.randomBytes(4).toString('hex')}`
                    const pipeline = redisPubSub.publisher.pipeline()

                    pipeline.zremrangebyscore(redisKey, 0, clearBefore)
                    pipeline.zcard(redisKey)

                    if (!this.skipSuccessfulRequests) {
                        pipeline.zadd(redisKey, now, memberId)
                        pipeline.pexpire(redisKey, this.windowMs + 5000)
                    }

                    const results = await withTimeout(pipeline.exec(), 500)
                    if (results && results[1]) {
                        const currentCount = results[1][1] || 0
                        if (currentCount >= this.max) {
                            allowed = false
                            remaining = 0
                            retryAfterSec = Math.max(1, Math.ceil(this.windowMs / 1000))
                        } else {
                            allowed = true
                            remaining = Math.max(0, this.max - currentCount - (this.skipSuccessfulRequests ? 0 : 1))
                        }
                        redisChecked = true

                        // If skipSuccessfulRequests is true, only record on failed response
                        if (this.skipSuccessfulRequests && allowed) {
                            res.on('finish', () => {
                                if (res.statusCode >= 400 && redisPubSub.isAvailable && redisPubSub.publisher) {
                                    const failPipe = redisPubSub.publisher.pipeline()
                                    failPipe.zadd(redisKey, Date.now(), `${Date.now()}:${crypto.randomBytes(4).toString('hex')}`)
                                    failPipe.pexpire(redisKey, this.windowMs + 5000)
                                    failPipe.exec().catch(() => {})
                                }
                            })
                        }
                    }
                } catch {
                    // Timeout or Redis connection blip: fallback directly to memory
                    redisChecked = false
                }
            }

            // ── 2. Fallback to High-Performance In-Memory Sliding Window ────
            if (!redisChecked) {
                const memCheck = this.checkMemory(key, now)
                allowed = memCheck.allowed
                remaining = memCheck.remaining
                retryAfterSec = memCheck.retryAfterSec

                if (allowed) {
                    if (this.skipSuccessfulRequests) {
                        res.on('finish', () => {
                            if (res.statusCode >= 400) {
                                this.recordMemoryHit(key, Date.now())
                            }
                        })
                    } else {
                        this.recordMemoryHit(key, now)
                    }
                }
            }

            // ── 3. Apply Standard Rate Limiting Headers ──────────────────────
            res.setHeader('X-RateLimit-Limit', this.max)
            res.setHeader('X-RateLimit-Remaining', remaining)

            if (!allowed) {
                res.setHeader('Retry-After', retryAfterSec)
                return res.status(429).json({
                    success: false,
                    error: this.message,
                    retryAfterSec,
                    code: 'RATE_LIMIT_EXCEEDED'
                })
            }

            next()
        }
    }
}

// ── Standard Key Extractor Helpers ──────────────────────────────────────────
export function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for']
    if (forwarded) {
        return forwarded.split(',')[0].trim()
    }
    return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1'
}

export function getUserOrIpKey(req) {
    if (req.user && req.user.id) {
        return `user:${req.user.id}`
    }
    return `ip:${getClientIp(req)}`
}

// ── Specific Exported Rate Limiters ─────────────────────────────────────────

// 1. Global API Protection: Max 300 requests per 60s per IP (DDoS & Web Scraping shield)
export const globalApiLimiter = new MemorySlidingWindowLimiter({
    windowMs: 60 * 1000,
    max: 300,
    message: 'Global API request rate exceeded. Please slow down your requests.',
    keyPrefix: 'global_api'
}).middleware(getClientIp)

// 2. High-Frequency Gaming Limiter: Max 30 actions / 10 seconds per user/IP (Auto-clicker & Bot spam defense)
export const gameActionLimiter = new MemorySlidingWindowLimiter({
    windowMs: 10 * 1000,
    max: 30,
    message: 'Game actions submitted too rapidly. Please throttle your gameplay pace.',
    keyPrefix: 'game_action'
}).middleware(getUserOrIpKey)

// 3. Cashier & Financial Limiter: Max 15 deposit/withdraw requests per 60s per user/IP
export const cashierLimiter = new MemorySlidingWindowLimiter({
    windowMs: 60 * 1000,
    max: 15,
    message: 'Financial transaction rate limit reached. Please wait a moment before trying again.',
    keyPrefix: 'cashier'
}).middleware(getUserOrIpKey)

// 4. Login Limiter: Max 5 failed attempts per 15 minutes per IP & Login target
export const loginRateLimiter = new MemorySlidingWindowLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many failed login attempts. Account temporarily locked for 15 minutes.',
    keyPrefix: 'login',
    skipSuccessfulRequests: true
}).middleware((req) => {
    const ip = getClientIp(req)
    const login = req.body?.login || req.body?.email || req.body?.phone || ''
    return `${ip}:${String(login).toLowerCase().trim()}`
})

// 5. OTP Request Cooldown: Max 1 OTP per 60 seconds per identifier, max 5 per hour
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
    const keyGen = () => identifier || getClientIp(req) || 'global'

    otpShortLimiter.middleware(keyGen)(req, res, (err) => {
        if (err) return next(err)
        otpLongLimiter.middleware(keyGen)(req, res, next)
    })
}

// 6. Registration Limiter: Max 10 accounts per hour per IP
export const registerRateLimiter = new MemorySlidingWindowLimiter({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many accounts registered from this network. Please contact support.',
    keyPrefix: 'reg'
}).middleware(getClientIp)

// 7. Sensitive Operations Limiter: Max 120 calls per minute
export const sensitiveApiLimiter = new MemorySlidingWindowLimiter({
    windowMs: 60 * 1000,
    max: 120,
    message: 'API rate limit exceeded. Please throttle requests.',
    keyPrefix: 'api'
}).middleware(getClientIp)
