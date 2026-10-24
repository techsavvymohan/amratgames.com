// =============================================================================
// 👑 AmratGames.com — Stress, Rate Limit & Redis TTL Resilience Test Suite
// Verifies defense-in-depth under extreme concurrency, timeouts, and bot floods.
// =============================================================================

import test from 'node:test'
import assert from 'node:assert/strict'
import { RedisCacheService, CACHE_TTL } from '../src/services/RedisCacheService.js'
import { MemorySlidingWindowLimiter } from '../src/middleware/rateLimiter.js'
import { UserLockManager } from '../src/db/UserLockManager.js'

test('⚡ Stress & Resilience: Redis TTL Caching & Memory Fallback Suite', async (t) => {
    await t.test('verifies getOrSet caches value and invokes fetcher only on cache miss', async () => {
        const cache = new RedisCacheService({ defaultTtlSeconds: 10 })
        let fetchCount = 0

        const fetcher = async () => {
            fetchCount++
            return { rtp: 98.0, status: 'active' }
        }

        const res1 = await cache.getOrSet('test:seed:1', 10, fetcher)
        assert.equal(res1.rtp, 98.0)
        assert.equal(fetchCount, 1)

        // Second call should return cached value without calling fetcher
        const res2 = await cache.getOrSet('test:seed:1', 10, fetcher)
        assert.equal(res2.rtp, 98.0)
        assert.equal(fetchCount, 1, 'Fetcher must not be called again on cache hit')
    })

    await t.test('verifies cache item expires after TTL duration', async () => {
        const cache = new RedisCacheService()
        await cache.set('temp:key:1', { test: true }, 1) // 1 second TTL

        const immediate = await cache.get('temp:key:1')
        assert.ok(immediate)
        assert.equal(immediate.test, true)

        // Wait 1100ms for expiration
        await new Promise(r => setTimeout(r, 1100))

        const expired = await cache.get('temp:key:1')
        assert.equal(expired, null, 'Key must be expired and null after TTL')
    })

    await t.test('verifies del and delPattern wildcards clear cache keys correctly', async () => {
        const cache = new RedisCacheService()
        await cache.set('games:recent:limbo:20', [1, 2, 3], 60)
        await cache.set('games:recent:crash:10', [4, 5], 60)
        await cache.set('other:data', 'keep', 60)

        assert.ok(await cache.get('games:recent:limbo:20'))
        assert.ok(await cache.get('games:recent:crash:10'))

        await cache.delPattern('games:recent:*')

        assert.equal(await cache.get('games:recent:limbo:20'), null)
        assert.equal(await cache.get('games:recent:crash:10'), null)
        assert.equal(await cache.get('other:data'), 'keep', 'Unmatched keys must be preserved')
    })

    await t.test('verifies LRU bounding evicts oldest entries when capacity limit is reached', async () => {
        const cache = new RedisCacheService({ maxLocalItems: 10 })
        for (let i = 0; i < 15; i++) {
            await cache.set(`item:${i}`, { index: i }, 60)
        }

        const stats = cache.getStats()
        assert.ok(stats.localSize <= 12, `Cache size ${stats.localSize} should be bounded near maxLocalItems`)
    })
})

test('🛡️ Stress & Resilience: Sliding-Window Rate Limiting Suite', async (t) => {
    await t.test('verifies rate limiter permits requests up to max and rejects subsequent requests with HTTP 429', async () => {
        const limiter = new MemorySlidingWindowLimiter({
            windowMs: 5000,
            max: 3,
            message: 'Too many requests'
        })

        const middleware = limiter.middleware((req) => req.ip)

        const fakeReq = { ip: '192.168.1.100', headers: {} }
        const responses = []

        for (let i = 0; i < 5; i++) {
            let nextCalled = false
            let statusCode = 200
            let responseJson = null
            const headers = {}

            const res = {
                setHeader(k, v) { headers[k] = v },
                status(code) {
                    statusCode = code
                    return this
                },
                json(payload) {
                    responseJson = payload
                    return this
                },
                on() {}
            }

            await middleware(fakeReq, res, () => { nextCalled = true })
            responses.push({ nextCalled, statusCode, responseJson, headers })
        }

        // Requests 0, 1, 2 should succeed
        assert.equal(responses[0].nextCalled, true)
        assert.equal(responses[0].headers['X-RateLimit-Remaining'], 2)

        assert.equal(responses[1].nextCalled, true)
        assert.equal(responses[1].headers['X-RateLimit-Remaining'], 1)

        assert.equal(responses[2].nextCalled, true)
        assert.equal(responses[2].headers['X-RateLimit-Remaining'], 0)

        // Requests 3 and 4 must be rate-limited
        assert.equal(responses[3].nextCalled, false)
        assert.equal(responses[3].statusCode, 429)
        assert.equal(responses[3].responseJson.code, 'RATE_LIMIT_EXCEEDED')
        assert.ok(responses[3].headers['Retry-After'] >= 1)

        assert.equal(responses[4].nextCalled, false)
        assert.equal(responses[4].statusCode, 429)
    })

    await t.test('verifies rate limits track independent IP addresses separately', async () => {
        const limiter = new MemorySlidingWindowLimiter({
            windowMs: 5000,
            max: 1
        })
        const middleware = limiter.middleware((req) => req.ip)

        let ip1Accepted = false
        let ip2Accepted = false

        const makeRes = () => ({
            setHeader() {},
            status() { return this },
            json() { return this },
            on() {}
        })

        await middleware({ ip: '10.0.0.1', headers: {} }, makeRes(), () => { ip1Accepted = true })
        await middleware({ ip: '10.0.0.2', headers: {} }, makeRes(), () => { ip2Accepted = true })

        assert.equal(ip1Accepted, true)
        assert.equal(ip2Accepted, true, 'Different IPs must maintain separate quotas')
    })
})

test('🔒 Stress & Resilience: UserLockManager Concurrency & Deadlock Defense Suite', async (t) => {
    await t.test('serializes concurrent balance modifications strictly in FIFO order', async () => {
        const lockMgr = new UserLockManager()
        let balance = 100
        const order = []

        // Launch 5 concurrent mutations for the same user
        const promises = [1, 2, 3, 4, 5].map((step) => {
            return lockMgr.withLock('user_123', async () => {
                await new Promise(r => setTimeout(r, 10))
                balance += 10
                order.push(step)
                return balance
            })
        })

        const results = await Promise.all(promises)
        assert.equal(balance, 150)
        assert.deepEqual(order, [1, 2, 3, 4, 5], 'Operations must execute strictly in order')
        assert.equal(lockMgr.getActiveLockCount(), 0, 'Locks must drain to 0 with zero leaks')
    })

    await t.test('verifies queue depth saturation cap throws 429 when concurrency exceeds maximum', async () => {
        const smallLockMgr = new UserLockManager({ maxQueueDepth: 3 })
        let blockedCount = 0

        // Start 1 running slow task
        const first = smallLockMgr.withLock('user_flood', async () => {
            await new Promise(r => setTimeout(r, 100))
        })

        // Queue tasks up to depth 3
        const queued = []
        for (let i = 0; i < 5; i++) {
            queued.push(
                smallLockMgr.withLock('user_flood', async () => {})
                    .catch((err) => {
                        if (err.code === 'LOCK_QUEUE_SATURATED' && err.status === 429) {
                            blockedCount++
                        }
                    })
            )
        }

        await Promise.all([first, ...queued])
        assert.ok(blockedCount >= 2, `Expected at least 2 saturated rejections, got ${blockedCount}`)
        assert.equal(smallLockMgr.getActiveLockCount(), 0, 'Clean queue count after saturation drain')
    })

    await t.test('verifies task timeout releases mutex so next queued task is not starved', async () => {
        const fastTimeoutMgr = new UserLockManager({ taskTimeoutMs: 50, acquireTimeoutMs: 500 })

        // Task 1 will hang longer than 50ms
        const task1 = fastTimeoutMgr.withLock('user_hang', async () => {
            await new Promise(r => setTimeout(r, 200))
        }).catch(err => err)

        // Task 2 should execute after task 1 times out
        let task2Ran = false
        const task2 = fastTimeoutMgr.withLock('user_hang', async () => {
            task2Ran = true
            return 'success'
        })

        const [res1, res2] = await Promise.all([task1, task2])
        assert.equal(res1.code, 'LOCK_TASK_TIMEOUT')
        assert.equal(res1.status, 504)
        assert.equal(task2Ran, true, 'Task 2 must execute and not be starved by hanging Task 1')
        assert.equal(res2, 'success')
    })
})
