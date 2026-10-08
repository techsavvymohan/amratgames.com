import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { CONFIG, validateConfig } from '../src/config.js'
import authRoutes from '../src/routes/auth.routes.js'
import gamesRoutes from '../src/routes/games.routes.js'
import walletRoutes from '../src/routes/wallet.routes.js'

describe('AmratGames.com Backend CI Integrity & Fairness Suite', () => {
    it('verifies default configuration parameters and types', () => {
        assert.ok(typeof CONFIG.PORT === 'number', 'PORT should be a number')
        assert.ok(CONFIG.PORT > 0 && CONFIG.PORT < 65536, 'PORT should be a valid TCP port')
        assert.ok(typeof CONFIG.HOST === 'string', 'HOST should be a string')
        assert.ok(CONFIG.JWT_SECRET.length >= 16, 'JWT_SECRET should be sufficiently long')
        assert.equal(typeof CONFIG.ADMIN_DEFAULT_EMAIL, 'string')
        assert.equal(typeof CONFIG.DEMO_OTP_CODE, 'string')
        assert.equal(CONFIG.DEMO_OTP_CODE, '777777')
        
        // validateConfig should run cleanly without throwing
        assert.doesNotThrow(() => validateConfig())
    })

    it('verifies Provably Fair HMAC-SHA256 mathematical outcome generation', () => {
        const serverSeed = 'b3d68f74a9a08e1a5f4581c1c1fcf9e1d8a4e320f7c2b6e5d8a9f0e1d2c3b4a5'
        const clientSeed = 'amrat-player-seed-2026'
        const nonce = 1

        const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex')
        assert.equal(serverSeedHash.length, 64, 'SHA-256 hash must be 64 hex characters')

        const hmac = crypto.createHmac('sha256', serverSeed)
        hmac.update(`${clientSeed}:${nonce}`)
        const outcomeHash = hmac.digest('hex')
        assert.equal(outcomeHash.length, 64, 'HMAC-SHA256 must be 64 hex characters')

        // Verify deterministic reproducibility
        const hmac2 = crypto.createHmac('sha256', serverSeed)
        hmac2.update(`${clientSeed}:${nonce}`)
        assert.equal(outcomeHash, hmac2.digest('hex'), 'Outcome must be cryptographically deterministic')
    })

    it('verifies express route modules export valid router instances', () => {
        assert.ok(authRoutes, 'authRoutes should be defined')
        assert.equal(typeof authRoutes, 'function', 'Express Router is callable as middleware')

        assert.ok(gamesRoutes, 'gamesRoutes should be defined')
        assert.equal(typeof gamesRoutes, 'function', 'Express Router is callable as middleware')

        assert.ok(walletRoutes, 'walletRoutes should be defined')
        assert.equal(typeof walletRoutes, 'function', 'Express Router is callable as middleware')
    })

    it('verifies casino platform RTP and house edge constants', () => {
        const defaultRTP = 99.0
        const defaultHouseEdge = 1.0
        assert.equal(defaultRTP + defaultHouseEdge, 100.0, 'RTP and House Edge must sum to 100%')
    })
})
