// =============================================================================
// 👑 AmratGames.com — High-Resilience Redis TTL Caching Service
// Features: Atomic TTLs, 1.2s circuit-breaker timeout, LRU memory fallback,
// wildcard cache invalidation, and zero-downtime offline recovery.
// =============================================================================

import { redisPubSub } from './RedisPubSubService.js'

export const CACHE_TTL = {
    HEALTH: 3,
    RECENT_BETS: 5,
    VAULT_STATS: 5,
    LEADERBOARD: 15,
    VIP_STATUS: 10,
    SEED_INFO: 30,
    USER_PROFILE: 10
}

/**
 * Race a promise against a timeout to protect request threads from Redis hangs.
 */
function withTimeout(promise, ms = 1200) {
    let timer
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const err = new Error(`Redis cache operation timed out after ${ms}ms`)
            err.code = 'REDIS_TIMEOUT'
            reject(err)
        }, ms)
        if (timer.unref) timer.unref()
    })

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timer)
    })
}

export class RedisCacheService {
    constructor({ maxLocalItems = 1000, defaultTtlSeconds = 60 } = {}) {
        this.localFallbackCache = new Map() // key -> { value, expiresAt, accessedAt }
        this.maxLocalItems = maxLocalItems
        this.defaultTtlSeconds = defaultTtlSeconds
        this.stats = {
            hits: 0,
            misses: 0,
            redisHits: 0,
            localHits: 0
        }

        // Automatic periodic cleanup of expired local items every 60s
        this.cleanupTimer = setInterval(() => this.cleanupExpired(), 60000)
        if (this.cleanupTimer.unref) this.cleanupTimer.unref()
    }

    cleanupExpired() {
        const now = Date.now()
        for (const [key, item] of this.localFallbackCache.entries()) {
            if (now >= item.expiresAt) {
                this.localFallbackCache.delete(key)
            }
        }
    }

    _evictLruIfNeeded() {
        if (this.localFallbackCache.size <= this.maxLocalItems) return
        this.cleanupExpired()
        if (this.localFallbackCache.size <= this.maxLocalItems) return

        // Evict oldest accessed items
        const entries = Array.from(this.localFallbackCache.entries())
        entries.sort((a, b) => a[1].accessedAt - b[1].accessedAt)
        const toDelete = entries.slice(0, Math.floor(this.maxLocalItems * 0.2))
        for (const [k] of toDelete) {
            this.localFallbackCache.delete(k)
        }
    }

    async get(key) {
        if (!key) return null
        const redisKey = `cache:${key}`

        // 1. Try Redis first (with strict 1.2s timeout)
        try {
            if (redisPubSub.isAvailable && redisPubSub.publisher) {
                const val = await withTimeout(redisPubSub.publisher.get(redisKey), 1200)
                if (val !== null && val !== undefined) {
                    this.stats.hits++
                    this.stats.redisHits++
                    try {
                        return JSON.parse(val)
                    } catch {
                        return val
                    }
                }
            }
        } catch (err) {
            // Silently fall back to local cache on timeout or network error
        }

        // 2. Fallback to Local Memory Cache
        const local = this.localFallbackCache.get(key)
        if (local) {
            if (Date.now() < local.expiresAt) {
                local.accessedAt = Date.now()
                this.stats.hits++
                this.stats.localHits++
                return local.value
            }
            this.localFallbackCache.delete(key)
        }

        this.stats.misses++
        return null
    }

    async set(key, value, ttlSeconds = this.defaultTtlSeconds) {
        if (!key) return false
        const ttl = Math.max(1, parseInt(ttlSeconds, 10) || this.defaultTtlSeconds)
        const now = Date.now()
        const redisKey = `cache:${key}`
        const serialized = typeof value === 'string' ? value : JSON.stringify(value)

        // Store in local memory cache
        this._evictLruIfNeeded()
        this.localFallbackCache.set(key, {
            value,
            expiresAt: now + (ttl * 1000),
            accessedAt: now
        })

        // Store in Redis with TTL (fire-and-forget or fast wait)
        try {
            if (redisPubSub.isAvailable && redisPubSub.publisher) {
                await withTimeout(redisPubSub.publisher.set(redisKey, serialized, 'EX', ttl), 1200)
                return true
            }
        } catch (err) {
            // Redis error or timeout; local cache is already set
        }

        return true
    }

    async del(key) {
        if (!key) return
        this.localFallbackCache.delete(key)

        try {
            if (redisPubSub.isAvailable && redisPubSub.publisher) {
                await withTimeout(redisPubSub.publisher.del(`cache:${key}`), 1200)
            }
        } catch {
            // Silent error suppression
        }
    }

    async delPattern(pattern) {
        if (!pattern) return

        // Delete from local cache
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
        for (const k of this.localFallbackCache.keys()) {
            if (regex.test(k)) {
                this.localFallbackCache.delete(k)
            }
        }

        // Delete from Redis if available
        try {
            if (redisPubSub.isAvailable && redisPubSub.publisher) {
                const keys = await withTimeout(redisPubSub.publisher.keys(`cache:${pattern}`), 1200)
                if (Array.isArray(keys) && keys.length > 0) {
                    await withTimeout(redisPubSub.publisher.del(...keys), 1200)
                }
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

    getStats() {
        return {
            ...this.stats,
            localSize: this.localFallbackCache.size,
            isRedisConnected: redisPubSub.isAvailable
        }
    }

    clearLocal() {
        this.localFallbackCache.clear()
    }
}

export const redisCache = new RedisCacheService()
