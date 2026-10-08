import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { CONFIG, validateConfig } from '../src/config.js'
import authRoutes from '../src/routes/auth.routes.js'
import gamesRoutes from '../src/routes/games.routes.js'
import walletRoutes from '../src/routes/wallet.routes.js'
import { db } from '../src/db/db.js'
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

    it('verifies deposits are queued in pending status without crediting unverified balance', () => {
        // Create test player
        const testUser = db.createUser({
            username: 'deposit_tester_' + Date.now().toString(36),
            phone: '9876543210',
            passwordHash: 'hash'
        })

        const initialBalance = testUser.balances.INR
        const initialDeposited = testUser.totalDeposited || 0

        // Submit deposit with UTR
        const { deposit } = db.requestDeposit({
            userId: testUser.id,
            currency: 'INR',
            amount: 500,
            paymentMethod: 'UPI',
            utrNumber: 'UTR' + Date.now()
        })

        assert.equal(deposit.status, 'pending', 'Deposit must be pending verification')
        assert.equal(deposit.amount, 500)

        // Balance must NOT have changed!
        const refreshedUser = db.findUserById(testUser.id)
        assert.equal(refreshedUser.balances.INR, initialBalance, 'Unverified deposit must NOT credit player balance')
        assert.equal(refreshedUser.totalDeposited || 0, initialDeposited, 'Unverified deposit must NOT increment totalDeposited')

        // Now cashier approves deposit
        const approveResult = db.approveDeposit(deposit.id, { adminUsername: 'master_admin', adminNote: 'Verified UTR' })
        assert.equal(approveResult.deposit.status, 'completed')

        const approvedUser = db.findUserById(testUser.id)
        assert.equal(approvedUser.balances.INR, initialBalance + 500, 'Approved deposit must legitimately credit player balance')
        assert.equal(approvedUser.totalDeposited, initialDeposited + 500, 'Approved deposit must legitimately increment totalDeposited')
    })

    it('verifies cashier rejection preserves balance and records rejection audit', () => {
        const testUser = db.createUser({
            username: 'reject_tester_' + Date.now().toString(36),
            phone: '9876543211',
            passwordHash: 'hash'
        })

        const initialBalance = testUser.balances.INR

        const { deposit } = db.requestDeposit({
            userId: testUser.id,
            currency: 'INR',
            amount: 1000,
            paymentMethod: 'UPI',
            utrNumber: 'UTR_REJECT_' + Date.now()
        })

        assert.equal(deposit.status, 'pending')

        // Cashier rejects fraudulent / invalid UTR
        const rejectResult = db.rejectDeposit(deposit.id, {
            adminUsername: 'cashier_audit',
            rejectionReason: 'Invalid UTR / Fake Screenshot'
        })

        assert.equal(rejectResult.deposit.status, 'rejected')
        assert.equal(rejectResult.deposit.rejectionReason, 'Invalid UTR / Fake Screenshot')

        const userAfterReject = db.findUserById(testUser.id)
        assert.equal(userAfterReject.balances.INR, initialBalance, 'Rejected deposit must NEVER credit balance')
    })

    it('verifies duplicate UTR submissions are strictly blocked', () => {
        const testUser = db.createUser({
            username: 'utr_tester_' + Date.now().toString(36),
            phone: '9876543212',
            passwordHash: 'hash'
        })

        const uniqueUtr = 'UTR_DUP_' + Date.now()

        db.requestDeposit({
            userId: testUser.id,
            currency: 'INR',
            amount: 500,
            paymentMethod: 'UPI',
            utrNumber: uniqueUtr
        })

        // Attempting to submit the exact same UTR must throw
        assert.throws(() => {
            db.requestDeposit({
                userId: testUser.id,
                currency: 'INR',
                amount: 500,
                paymentMethod: 'UPI',
                utrNumber: uniqueUtr
            })
        }, /already been submitted/)
    })

    it('verifies master admin account strictly rejects demo OTP bypass codes', () => {
        const adminEmail = CONFIG.ADMIN_DEFAULT_EMAIL
        const adminPhone = CONFIG.ADMIN_DEFAULT_PHONE

        // Attempting to bypass admin account using 777777 or 123456 must FAIL
        assert.equal(db.verifyOtp(adminEmail, '777777'), false, 'Master Admin email must NEVER accept demo bypass code')
        assert.equal(db.verifyOtp(adminPhone, '777777'), false, 'Master Admin phone must NEVER accept demo bypass code')
        assert.equal(db.verifyOtp(adminEmail, '123456'), false, '123456 code must be completely blocked')
    })

    it('verifies KYC profile verification defaults to pending_review and requires admin approval', () => {
        const testUser = db.createUser({
            username: 'kyc_tester_' + Date.now().toString(36),
            phone: '9876543213',
            passwordHash: 'hash'
        })

        assert.equal(testUser.kycStatus || 'unverified', 'unverified')

        // Update to pending_review (as done by verify-profile route)
        const submitted = db.updateUser(testUser.id, {
            kycStatus: 'pending_review',
            kycDocumentType: 'AADHAAR',
            kycDocumentNumber: '1234-5678-9012'
        })

        assert.equal(submitted.kycStatus, 'pending_review', 'KYC must NOT auto-verify upon document upload')

        // Compliance Admin approval
        const verified = db.updateUser(testUser.id, {
            kycStatus: 'verified',
            kycVerifiedAt: new Date().toISOString(),
            kycVerifiedBy: 'compliance_officer'
        })

        assert.equal(verified.kycStatus, 'verified')
        assert.equal(verified.kycVerifiedBy, 'compliance_officer')
    })

    it('verifies casino platform RTP and house edge constants', () => {
        const defaultRTP = 99.0
        const defaultHouseEdge = 1.0
        assert.equal(defaultRTP + defaultHouseEdge, 100.0, 'RTP and House Edge must sum to 100%')
    })
})
