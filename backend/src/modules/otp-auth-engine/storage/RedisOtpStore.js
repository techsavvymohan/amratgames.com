/**
 * Redis-backed Store for OTP records (for multi-instance clustering)
 */
export class RedisOtpStore {
    /**
     * @param {object} redisClient ioredis or redis client instance
     * @param {string} keyPrefix
     */
    constructor(redisClient, keyPrefix = 'otp:') {
        this.redis = redisClient
        this.prefix = keyPrefix
    }

    _key(phone) {
        return `${this.prefix}${phone}`
    }

    async set(phone, record, ttlMs = 300000) {
        const key = this._key(phone)
        const ttlSec = Math.ceil(ttlMs / 1000)
        const payload = JSON.stringify({
            ...record,
            expiresAt: Date.now() + ttlMs
        })
        await this.redis.set(key, payload, 'EX', ttlSec)
        return true
    }

    async get(phone) {
        const key = this._key(phone)
        const raw = await this.redis.get(key)
        if (!raw) return null
        try {
            return JSON.parse(raw)
        } catch {
            return null
        }
    }

    async update(phone, updates) {
        const current = await this.get(phone)
        if (!current) return null
        const merged = { ...current, ...updates }
        const remainingMs = Math.max(1000, merged.expiresAt - Date.now())
        await this.set(phone, merged, remainingMs)
        return merged
    }

    async delete(phone) {
        const key = this._key(phone)
        return await this.redis.del(key)
    }
}
