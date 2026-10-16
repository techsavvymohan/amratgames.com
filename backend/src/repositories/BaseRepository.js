import { durableOutbox } from '../db/DurableOutboxService.js'
import { CONFIG } from '../config.js'

/**
 * 🏛️ BaseRepository
 * Foundational repository providing shared state access, persistence, and transactional locking.
 */
export class BaseRepository {
    constructor(db) {
        this.db = db
    }

    get data() {
        return this.db.data
    }

    persist() {
        return this.db.persist()
    }

    persistDebounced() {
        if (typeof this.db.persistDebounced === 'function') {
            return this.db.persistDebounced()
        }
        return this.db.persist()
    }

    withLock(userId, task) {
        return this.db.withUserLock(userId, task)
    }

    enqueueOutbox(type, payload) {
        if (CONFIG.USE_SUPABASE && durableOutbox) {
            durableOutbox.enqueue(type, payload)
        }
    }
}

export default BaseRepository
