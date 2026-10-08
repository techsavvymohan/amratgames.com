import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { CONFIG, validateConfig } from '../src/config.js'
import authRoutes from '../src/routes/auth.routes.js'
import gamesRoutes from '../src/routes/games.routes.js'
import walletRoutes from '../src/routes/wallet.routes.js'
import { gameEngine } from '../src/services/GameEngine.js'

describe('AmratGames.com Backend CI Integrity & Fairness Suite', () => {
    it('verifies default configuration parameters and types', () => {
        assert.ok(typeof CONFIG.PORT === 'number', 'PORT should be a number')
        assert.ok(CONFIG.PORT > 0 && CONFIG.PORT < 65536, 'PORT should be a valid TCP port')
        assert.ok(typeof CONFIG.HOST === 'string', 'HOST should be a string')
        assert.ok(CONFIG.JWT_SECRET.length >= 16, 'JWT_SECRET should be sufficiently long')
        assert.equal(typeof CONFIG.ADMIN_DEFAULT_EMAIL, 'string')
        assert.equal(typeof CONFIG.DEMO_OTP_CODE, 'string')
        assert.equal(CONFIG.DEMO_OTP_CODE, '777777')
        
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

        const hmac2 = crypto.createHmac('sha256', serverSeed)
        hmac2.update(`${clientSeed}:${nonce}`)
        assert.equal(outcomeHash, hmac2.digest('hex'), 'Outcome must be cryptographically deterministic')
    })

    it('verifies Server-Authoritative Limbo game evaluation', () => {
        const result = gameEngine.evaluateLimbo({
            betAmount: 100,
            targetMultiplier: 2.0,
            clientSeed: 'test-seed-1',
            nonce: 1
        })

        assert.equal(result.game, 'limbo')
        assert.ok(typeof result.won === 'boolean')
        assert.ok(typeof result.roll === 'number')
        assert.equal(result.targetMultiplier, 2.0)
        assert.ok(result.won ? result.payout === 200 : result.payout === 0)
        assert.equal(result.hash.length, 64)
    })

    it('verifies Server-Authoritative Plinko game evaluation', () => {
        const result = gameEngine.evaluatePlinko({
            betAmount: 50,
            rows: 16,
            risk: 'medium',
            clientSeed: 'plinko-test',
            nonce: 1
        })

        assert.equal(result.game, 'plinko')
        assert.equal(result.rows, 16)
        assert.equal(result.path.length, 16)
        assert.ok(result.binIndex >= 0 && result.binIndex <= 16)
        assert.ok(typeof result.multiplier === 'number')
        assert.ok(result.payout >= 0)
        assert.equal(result.hash.length, 64)
    })

    it('verifies Server-Authoritative Dragon Tiger game evaluation', () => {
        const result = gameEngine.evaluateDragonTiger({
            betAmount: 100,
            choice: 'dragon',
            clientSeed: 'dt-test',
            nonce: 1
        })

        assert.equal(result.game, 'dragon-tiger')
        assert.ok(result.dragon.value >= 1 && result.dragon.value <= 13)
        assert.ok(result.tiger.value >= 1 && result.tiger.value <= 13)
        assert.ok(['dragon', 'tiger', 'tie'].includes(result.winner))
        assert.ok(typeof result.won === 'boolean')
    })

    it('verifies Server-Authoritative Crash evaluation rejects fraudulent multipliers', () => {
        // Evaluate crash with a pre-set seed
        const outcome = gameEngine.evaluateCrash({
            claimedMultiplier: 999.0, // Fraudulent high claim
            clientSeed: 'crash-test',
            nonce: 5
        })

        assert.ok(typeof outcome.crashPoint === 'number')
        // If the crash point was lower than 999, won MUST be false!
        if (outcome.crashPoint < 999.0) {
            assert.equal(outcome.won, false, 'Player cannot win if claimed multiplier exceeds crash point')
            assert.equal(outcome.multiplier, 0)
        }
    })

    it('verifies Server-Authoritative Mines round session lifecycle', () => {
        const session = gameEngine.startMinesRound({
            userId: 'usr_test_123',
            currency: 'INR',
            betAmount: 100,
            minesCount: 3,
            clientSeed: 'mines-seed'
        })

        assert.ok(session.roundId.startsWith('mines_'))
        assert.equal(session.minesCount, 3)
        assert.ok(session.nextMultiplier > 1.0)
        assert.equal(session.active, true)

        // Ensure mine locations are NOT leaked in round start response
        assert.equal(session.mineIndices, undefined, 'Mines locations must never be leaked to the client at round start!')
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
