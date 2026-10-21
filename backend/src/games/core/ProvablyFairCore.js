import crypto from 'node:crypto'
import { db } from '../../db/db.js'

/**
 * Shared Cryptographic Provably Fair Core Entropy & Nonce Engine
 */
class ProvablyFairCore {
    constructor() {
        this.userNonces = new Map() // userId -> nonce counter
    }

    getServerSeed() {
        return db.data.settings?.currentServerSeed || crypto.randomBytes(32).toString('hex')
    }

    getNextNonce(userId = 'guest') {
        let current = this.userNonces.get(userId)
        if (!current && userId && userId !== 'guest' && db.data?.users) {
            const user = db.findUserById(userId)
            if (user && typeof user.nonce === 'number') {
                current = user.nonce
            }
        }
        if (!current || typeof current !== 'number') current = 1

        this.userNonces.set(userId, current + 1)

        // Persist to user record in DB if real player
        if (userId && userId !== 'guest' && db.data?.users) {
            try {
                const user = db.findUserById(userId)
                if (user) {
                    user.nonce = current + 1
                    if (typeof db.persistDebounced === 'function') {
                        db.persistDebounced()
                    }
                }
            } catch {}
        }

        return current
    }

    /**
     * Compute HMAC-SHA256 outcome hash and uniform float in [0, 1)
     * Follows canonical Provably Fair standard: HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}`)
     */
    generateHmacFloat(clientSeed = 'amrat-player', nonce = 1, serverSeedOverride = null) {
        const serverSeed = serverSeedOverride || this.getServerSeed()
        const cleanClientSeed = String(clientSeed || 'amrat-player').trim()
        const cleanNonce = parseInt(nonce, 10) || 1
        const message = `${cleanClientSeed}:${cleanNonce}`
        const hmac = crypto.createHmac('sha256', serverSeed)
        hmac.update(message)
        const hash = hmac.digest('hex')
        const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex')

        // First 8 hex characters (32 bits) divided by 2^32 gives uniform float [0, 1)
        const intVal = parseInt(hash.slice(0, 8), 16)
        const floatVal = intVal / 0x100000000

        return { hash, floatVal, serverSeed, serverSeedHash, clientSeed: cleanClientSeed, nonce: cleanNonce }
    }
}

export const provablyFairCore = new ProvablyFairCore()
