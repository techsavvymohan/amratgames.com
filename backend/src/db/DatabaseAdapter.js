/**
 * 🏛️ DatabaseAdapter
 * Abstract Base Storage Driver / DAO Contract for AmratGames.
 * Defines the unified persistence, lifecycle, and query primitives
 * across both local file drivers (JsonFileDriver) and distributed SQL engines (PostgresDriver).
 */
export class DatabaseAdapter {
    constructor(config = {}) {
        if (new.target === DatabaseAdapter) {
            throw new TypeError('Cannot construct DatabaseAdapter instances directly. Subclass must implement abstract methods.')
        }
        this.config = config
        this.connected = false
    }

    /**
     * Establish connection or prepare file handle
     * @returns {Promise<void>}
     */
    async connect() {
        throw new Error('Method "connect()" must be implemented by database driver.')
    }

    /**
     * Gracefully close connection or release file locks
     * @returns {Promise<void>}
     */
    async disconnect() {
        throw new Error('Method "disconnect()" must be implemented by database driver.')
    }

    /**
     * Driver health check / connectivity verification
     * @returns {Promise<{ healthy: boolean, latencyMs?: number, details?: string }>}
     */
    async isHealthy() {
        return { healthy: this.connected, driver: this.getDriverName() }
    }

    /**
     * Unique driver identifier ('json' | 'postgres' | 'supabase')
     * @returns {string}
     */
    getDriverName() {
        return 'abstract'
    }

    /**
     * Load state snapshot into runtime memory
     * @returns {Promise<object>|object}
     */
    loadState() {
        throw new Error('Method "loadState()" must be implemented by database driver.')
    }

    /**
     * Asynchronously persist state to underlying storage engine
     * @param {object} state
     * @returns {Promise<void>}
     */
    async flushState(state) {
        throw new Error('Method "flushState(state)" must be implemented by database driver.')
    }

    /**
     * Synchronously persist state (called during process termination)
     * @param {object} state
     */
    flushStateSync(state) {
        throw new Error('Method "flushStateSync(state)" must be implemented by database driver.')
    }

    /**
     * Execute atomic transactional operation
     * @template T
     * @param {(client: any) => Promise<T>} task
     * @returns {Promise<T>}
     */
    async withTransaction(task) {
        return task(this)
    }
}

export default DatabaseAdapter
