/**
 * Zero-dependency In-Memory Store for OTP records
 * Includes automatic background expiration cleanup
 */
export class MemoryOtpStore {
    constructor() {
        this.store = new Map()
        // Sweep expired keys every 60 seconds
        this.cleanupInterval = setInterval(() => this.sweepExpired(), 60000)
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref() // Allow process to exit cleanly
        }
    }

    async set(phone, record, ttlMs = 300000) {
        const expiresAt = Date.now() + ttlMs
        this.store.set(phone, {
            ...record,
            expiresAt
        })
        return true
    }

    async get(phone) {
        const record = this.store.get(phone)
        if (!record) return null

        if (Date.now() > record.expiresAt) {
            this.store.delete(phone)
            return null
        }

        return record
    }

    async update(phone, updates) {
        const current = await this.get(phone)
        if (!current) return null
        const merged = { ...current, ...updates }
        this.store.set(phone, merged)
        return merged
    }

    async delete(phone) {
        return this.store.delete(phone)
    }

    sweepExpired() {
        const now = Date.now()
        for (const [phone, record] of this.store.entries()) {
            if (now > record.expiresAt) {
                this.store.delete(phone)
            }
        }
    }

    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
        }
        this.store.clear()
    }
}
