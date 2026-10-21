import { DatabaseAdapter } from '../DatabaseAdapter.js'
import { JsonFileDriver } from './JsonFileDriver.js'
import { CONFIG } from '../../config.js'

/**
 * 🐘 PostgresDriver
 * Enterprise Clustered PostgreSQL Driver with Connection Pooling.
 * Enables horizontal scaling across multi-container Kubernetes / Docker clusters.
 * Supports standard connection strings (AWS RDS, Supabase, DigitalOcean, Azure Database).
 */
export class PostgresDriver extends DatabaseAdapter {
    constructor(config = {}) {
        super(config)
        this.connectionString = config.connectionString || CONFIG.DATABASE_URL || ''
        this.poolConfig = {
            max: config.maxPoolSize || 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            ...config.pool
        }
        this.pool = null
        this.client = null
        this.driverMode = 'direct_sql'
        this.fileFallback = new JsonFileDriver(config)
    }

    getDriverName() {
        return 'postgres'
    }

    /**
     * Initialize connection pool with lazy dynamic driver import
     */
    async connect() {
        if (this.connected && this.pool) return

        try {
            // 1. Try native PostgreSQL driver (pg)
            let pgModule = null
            try {
                pgModule = await import('pg')
            } catch {}

            if (pgModule && (pgModule.Pool || pgModule.default?.Pool)) {
                const PoolClass = pgModule.Pool || pgModule.default.Pool
                this.pool = new PoolClass({
                    connectionString: this.connectionString,
                    ssl: this.connectionString.includes('sslmode=require') || CONFIG.isProduction
                        ? { rejectUnauthorized: false }
                        : false,
                    ...this.poolConfig
                })

                // Verify pool connection
                const testClient = await this.pool.connect()
                const res = await testClient.query('SELECT NOW() AS current_time, current_database() AS db_name')
                testClient.release()

                this.connected = true
                console.log(`[PostgresDriver] Connected to PostgreSQL cluster [db: ${res.rows[0]?.db_name}]`)
                return
            }

            // 2. Fallback to Supabase PostgreSQL Client if available
            if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_SERVICE_ROLE_KEY) {
                const { createClient } = await import('@supabase/supabase-js')
                this.client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY)
                this.connected = true
                this.driverMode = 'supabase_rest'
                console.log('[PostgresDriver] Connected via Supabase PostgreSQL REST Client')
                return
            }

            console.warn('[PostgresDriver] Notice: Native "pg" package not detected and no Supabase credentials provided.')
            this.connected = false
        } catch (err) {
            console.error('[PostgresDriver] Connection failed:', err.message)
            this.connected = false
            throw err
        }
    }

    async disconnect() {
        if (this.pool) {
            await this.pool.end()
            this.pool = null
        }
        this.connected = false
    }

    async isHealthy() {
        if (!this.connected) {
            return { healthy: false, driver: 'postgres', error: 'Not connected' }
        }

        const start = Date.now()
        try {
            if (this.pool) {
                const res = await this.pool.query('SELECT 1 AS alive')
                return {
                    healthy: res.rows?.[0]?.alive === 1,
                    driver: 'postgres',
                    mode: 'pg_pool',
                    latencyMs: Date.now() - start,
                    totalCount: this.pool.totalCount,
                    idleCount: this.pool.idleCount,
                    waitingCount: this.pool.waitingCount
                }
            }
            if (this.client) {
                const { error } = await this.client.from('platform_settings').select('id').limit(1)
                return {
                    healthy: !error,
                    driver: 'postgres',
                    mode: 'supabase_rest',
                    latencyMs: Date.now() - start
                }
            }
            return { healthy: false, driver: 'postgres', error: 'No active pool or client' }
        } catch (err) {
            return { healthy: false, driver: 'postgres', latencyMs: Date.now() - start, error: err.message }
        }
    }

    /**
     * Parameterized query execution with connection reuse
     */
    async query(sql, params = []) {
        if (!this.connected) {
            await this.connect()
        }
        if (this.pool) {
            return this.pool.query(sql, params)
        }
        throw new Error('[PostgresDriver] Direct SQL requires native "pg" connection pool.')
    }

    /**
     * ACID transaction wrapper with automatic commit and rollback
     */
    async withTransaction(task) {
        if (!this.pool) {
            throw new Error('[PostgresDriver] withTransaction requires native "pg" connection pool.')
        }

        const client = await this.pool.connect()
        try {
            await client.query('BEGIN')
            const result = await task(client)
            await client.query('COMMIT')
            return result
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {})
            throw err
        } finally {
            client.release()
        }
    }

    loadState() {
        return this.fileFallback.loadState()
    }

    async flushState(state) {
        return this.fileFallback.flushState(state)
    }

    flushStateSync(state) {
        return this.fileFallback.flushStateSync(state)
    }
}

export default PostgresDriver
