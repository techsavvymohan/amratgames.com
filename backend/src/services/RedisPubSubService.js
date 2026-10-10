// =============================================================================
// 👑 AmratGames.com — Redis Pub/Sub Multi-Instance State Synchronization
// Horizontal scaling bus for Multiplayer Crash, Community Chat & Live Bets
// =============================================================================

import Redis from 'ioredis'
import crypto from 'node:crypto'
import { CONFIG } from '../config.js'

export class RedisPubSubService {
    constructor() {
        this.instanceId = 'worker_' + process.pid + '_' + crypto.randomBytes(3).toString('hex')
        this.pubClient = null
        this.subClient = null
        this.isConnected = false
        this.listeners = new Map() // channel -> Set(callbacks)

        this.CHANNELS = {
            EVENTS: 'amrat:events',
            CHAT: 'amrat:chat',
            CRASH: 'amrat:crash',
            BETS: 'amrat:bets'
        }

        this.init()
    }

    init() {
        const redisUrl = CONFIG.REDIS_URL || 'redis://127.0.0.1:6379'

        try {
            const redisOptions = {
                lazyConnect: true,
                maxRetriesPerRequest: 1,
                enableReadyCheck: true,
                connectTimeout: 2000,
                retryStrategy: (times) => {
                    // In test / CI mode or when retried more than 3 times, do not keep sockets open
                    if (process.env.NODE_ENV === 'test' || process.env.CI || times > 3) return null
                    return Math.min(times * 500, 3000)
                }
            }

            this.pubClient = new Redis(redisUrl, redisOptions)
            this.subClient = new Redis(redisUrl, redisOptions)

            this.pubClient.on('connect', () => {
                this.isConnected = true
                console.log(`[REDIS] Publisher connected successfully on ${this.instanceId}`)
            })

            this.pubClient.on('error', (err) => {
                this.isConnected = false
                // Suppress excessive error logs if Redis is offline during local test
                if (CONFIG.isDevelopment) {
                    // silent fallback
                } else {
                    console.warn(`[REDIS] Publisher notice:`, err.message)
                }
            })

            this.subClient.on('error', () => {
                this.isConnected = false
            })

            this.subClient.on('message', (channel, messageStr) => {
                try {
                    const data = JSON.parse(messageStr)
                    // Skip echoing back to the exact same process if marked
                    const cbs = this.listeners.get(channel)
                    if (cbs) {
                        for (const cb of cbs) {
                            try { cb(data) } catch (err) { console.error('[REDIS] Listener error:', err) }
                        }
                    }
                } catch {
                    // Ignore malformed payloads
                }
            })

            // Attempt connection in background
            Promise.all([
                this.pubClient.connect().catch(() => {}),
                this.subClient.connect().catch(() => {})
            ]).then(() => {
                if (this.subClient.status === 'ready') {
                    // Auto-subscribe to all platform channels
                    Object.values(this.CHANNELS).forEach((ch) => {
                        this.subClient.subscribe(ch).catch(() => {})
                    })
                }
            })
        } catch (err) {
            console.warn('[REDIS] Initialization fallback to local event bus:', err.message)
            this.isConnected = false
        }
    }

    subscribe(channel, callback) {
        if (!this.listeners.has(channel)) {
            this.listeners.set(channel, new Set())
        }
        this.listeners.get(channel).add(callback)

        if (this.subClient && this.subClient.status === 'ready') {
            this.subClient.subscribe(channel).catch(() => {})
        }

        return () => {
            const set = this.listeners.get(channel)
            if (set) set.delete(callback)
        }
    }

    async publish(channel, eventType, payload) {
        const envelope = {
            type: eventType,
            payload,
            senderInstance: this.instanceId,
            timestamp: new Date().toISOString()
        }

        // If Redis is connected, publish over Redis cluster bus
        if (this.pubClient && this.pubClient.status === 'ready') {
            try {
                await this.pubClient.publish(channel, JSON.stringify(envelope))
                return true
            } catch (err) {
                console.warn('[REDIS] Publish error:', err.message)
            }
        }

        // Fallback: Dispatch locally if Redis is not active
        const cbs = this.listeners.get(channel)
        if (cbs) {
            for (const cb of cbs) {
                try { cb(envelope) } catch {}
            }
        }
        return false
    }

    /**
     * Map platform event types to their dedicated Redis channels
     */
    async broadcast(eventType, payload) {
        let channel = this.CHANNELS.EVENTS
        if (/CHAT|RAIN/i.test(eventType)) {
            channel = this.CHANNELS.CHAT
        } else if (/CRASH/i.test(eventType)) {
            channel = this.CHANNELS.CRASH
        } else if (/BET/i.test(eventType)) {
            channel = this.CHANNELS.BETS
        }

        return this.publish(channel, eventType, payload)
    }

    disconnect() {
        if (this.pubClient) {
            try { this.pubClient.disconnect() } catch {}
            this.pubClient = null
        }
        if (this.subClient) {
            try { this.subClient.disconnect() } catch {}
            this.subClient = null
        }
        this.isConnected = false
    }
}

export const redisPubSub = new RedisPubSubService()
