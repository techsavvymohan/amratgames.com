import fs from 'node:fs'
import path from 'node:path'
import { DatabaseAdapter } from '../DatabaseAdapter.js'
import { CONFIG } from '../../config.js'

/**
 * 📁 JsonFileDriver
 * High-performance, atomic local file storage driver with NTFS lock resilience.
 * Default driver for single-node development, testing, and zero-config deployment.
 */
export class JsonFileDriver extends DatabaseAdapter {
    constructor(config = {}) {
        super(config)
        this.dir = config.dir || CONFIG.DATA_DIR
        this.fileName = config.fileName || CONFIG.DB_FILE || 'amratgames_db.json'
        this.filePath = path.join(this.dir, this.fileName)
        this._flushTimer = null
        this._isFlushing = false
        this._needsFlushAgain = false
        this.connected = true
    }

    getDriverName() {
        return 'json'
    }

    async connect() {
        if (!fs.existsSync(this.dir)) {
            fs.mkdirSync(this.dir, { recursive: true })
        }
        this._cleanupDanglingTempFiles()
        this.connected = true
    }

    async disconnect() {
        if (this._flushTimer) {
            clearTimeout(this._flushTimer)
            this._flushTimer = null
        }
        this.connected = false
    }

    async isHealthy() {
        try {
            const exists = fs.existsSync(this.filePath)
            return {
                healthy: true,
                driver: 'json',
                filePath: this.filePath,
                fileExists: exists,
                sizeBytes: exists ? fs.statSync(this.filePath).size : 0
            }
        } catch (err) {
            return { healthy: false, driver: 'json', error: err.message }
        }
    }

    loadState() {
        if (!fs.existsSync(this.dir)) {
            fs.mkdirSync(this.dir, { recursive: true })
        }
        this._cleanupDanglingTempFiles()

        if (fs.existsSync(this.filePath)) {
            try {
                const raw = fs.readFileSync(this.filePath, 'utf-8')
                return JSON.parse(raw)
            } catch (err) {
                console.error('[JsonFileDriver] Error parsing database file, initializing empty store:', err)
                return null
            }
        }
        return null
    }

    scheduleFlush(state, delayMs = 25) {
        if (this._flushTimer) return
        this._flushTimer = setTimeout(() => {
            this._flushTimer = null
            this.flushState(state).catch(err => {
                console.error('[JsonFileDriver] Async flush error:', err)
            })
        }, delayMs)
    }

    async flushState(state) {
        if (this._isFlushing) {
            this._needsFlushAgain = true
            return
        }
        this._isFlushing = true
        this._needsFlushAgain = false

        let tempFile = null
        try {
            tempFile = `${this.filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`
            const serialized = CONFIG.isProduction ? JSON.stringify(state) : JSON.stringify(state, null, 2)
            await fs.promises.writeFile(tempFile, serialized, 'utf-8')
            try {
                await fs.promises.rename(tempFile, this.filePath)
            } catch (renameErr) {
                // Windows NTFS file lock fallback
                await fs.promises.copyFile(tempFile, this.filePath)
                await fs.promises.unlink(tempFile).catch(() => {})
            }
        } catch (err) {
            console.error('[JsonFileDriver] Async persist error:', err)
            if (tempFile) {
                await fs.promises.unlink(tempFile).catch(() => {})
            }
        } finally {
            this._isFlushing = false
            if (this._needsFlushAgain) {
                this.scheduleFlush(state, 10)
            }
        }
    }

    flushStateSync(state) {
        let tempFile = null
        try {
            tempFile = `${this.filePath}.${Date.now()}.tmp`
            const serialized = CONFIG.isProduction ? JSON.stringify(state) : JSON.stringify(state, null, 2)
            fs.writeFileSync(tempFile, serialized, 'utf-8')
            try {
                fs.renameSync(tempFile, this.filePath)
            } catch (renameErr) {
                fs.copyFileSync(tempFile, this.filePath)
                try { fs.unlinkSync(tempFile) } catch {}
            }
        } catch (err) {
            console.error('[JsonFileDriver] Synchronous flush error:', err)
            if (tempFile) {
                try { fs.unlinkSync(tempFile) } catch {}
            }
        }
    }

    _cleanupDanglingTempFiles() {
        try {
            if (fs.existsSync(this.dir)) {
                const files = fs.readdirSync(this.dir)
                for (const f of files) {
                    if (f.endsWith('.tmp') && f.startsWith(this.fileName)) {
                        try { fs.unlinkSync(path.join(this.dir, f)) } catch {}
                    }
                }
            }
        } catch {}
    }
}

export default JsonFileDriver
