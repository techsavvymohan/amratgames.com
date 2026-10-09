import { redisPubSub } from './RedisPubSubService.js'

class RedisCacheService {
    constructor() {
        this.localFallbackCache = new Map() // key -> { value, expiresAt }
    }

    async get(key) {
        if (!key) return null
        try {
            if (redisPubSub.isAvailable && redisPubSub.publisher) {
                const val = await redisPubSub.publisher.get(`cache:${key}`)
                if (val !== null && val !== undefined) {
                    try {
                        return JSON.parse(val)
                    } catch {
                        return val
                    }
                }
            }
        } catch (err) {
            // Silently fall back to local
        }

        const local = this.localFallbackCache.get(key)
        if (local) {
            if (Date.now() < local.expiresAt) {
                return local.value
            }
            this.localFallbackCache.delete(key)
        }
        return null
    }

    async set(key, value, ttlSeconds = 60) {
        if (!key) return false
        const serialized = typeof value === 'string' ? value : JSON.stringify(value)

        // Set in local cache
        this.localFallbackCache.set(key, {
            value,
            expiresAt: Date.now() + (ttlSeconds * 1000)
        })

        // Evict expired entries if local cache exceeds 500 items
        if (this.localFallbackCache.size > 500) {
            const now = Date.now()
            for (const [k, v] of this.localFallbackCache.entries()) {
                if (now >= v.expiresAt) {
                    this.localFallbackCache.delete(k)
                }
            }
        }

        try {
            if (redisPubSub.isAvailable && redisPubSub.publisher) {
                await redisPubSub.publisher.set(`cache:${key}`, serialized, 'EX', ttlSeconds)
                return true
            }
        } catch (err) {
            // Redis error, fallback used
        }
        return true
    }

    async del(key) {
        if (!key) return
        this.localFallbackCache.delete(key)
        try {
            if (redisPubSub.isAvailable && redisPubSub.publisher) {
                await redisPubSub.publisher.del(`cache:${key}`)
            }
        } catch {}
    }

    async getOrSet(key, ttlSeconds, fetcherFn) {
        const cached = await this.get(key)
        if (cached !== null && cached !== undefined) {
            return cached
        }
        const fresh = await fetcherFn()
        if (fresh !== undefined && fresh !== null) {
            await this.set(key, fresh, ttlSeconds)
        }
        return fresh
    }
}

export const redisCache = new RedisCacheService()
