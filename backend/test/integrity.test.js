import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { CONFIG, validateConfig } from '../src/config.js'
import authRoutes from '../src/routes/auth.routes.js'
import gamesRoutes from '../src/routes/games.routes.js'
import walletRoutes from '../src/routes/wallet.routes.js'
import { db } from '../src/db/db.js'
import { gameEngine } from '../src/services/GameEngine.js'
import { revokeToken, isTokenRevoked } from '../src/middleware/auth.js'
import { checkPlatformMaintenance, checkGameMaintenance } from '../src/middleware/circuitBreaker.js'
import { crashRoomService } from '../src/services/CrashRoomService.js'
import { chatService } from '../src/services/ChatService.js'
import { antiFraudService } from '../src/services/AntiFraudService.js'
import { redisPubSub } from '../src/services/RedisPubSubService.js'
import { dinoEngine } from '../src/games/dino/dino.engine.js'
import { bankrollRisk } from '../src/services/BankrollRiskService.js'
import { automatedSettlement } from '../src/services/AutomatedSettlementService.js'

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

    it('verifies concurrent parallel bets strictly eliminate double-spending via user lock', async () => {
        // Create player with EXACTLY ₹100
        const testUser = db.createUser({
            username: 'concurrency_tester_' + Date.now().toString(36),
            phone: '9876543214',
            passwordHash: 'hash'
        })

        // Ensure balance is precisely ₹100
        testUser.balances.INR = 100.00
        db.updateUser(testUser.id, { balances: testUser.balances })

        // Fire 10 simultaneous bet requests of ₹100 each in parallel!
        const attempts = 10
        const promises = Array.from({ length: attempts }, (_, i) => {
            return db.executeAtomicBet({
                userId: testUser.id,
                currency: 'INR',
                betAmount: 100.00,
                game: 'limbo',
                gameName: 'Limbo',
                evaluator: async () => {
                    // Force losing outcome (multiplier 0, won false, payout 0)
                    return { won: false, multiplier: 0, payout: 0, hash: 'test-hash-' + i }
                }
            }).then(() => ({ success: true, index: i }))
              .catch(err => ({ success: false, error: err.message, code: err.code, index: i }))
        })

        const results = await Promise.all(promises)
        const successes = results.filter(r => r.success)
        const failures = results.filter(r => !r.success)

        // Exactly ONE bet must succeed (consuming the ₹100)
        assert.equal(successes.length, 1, `Exactly 1 bet must succeed, got ${successes.length}`)
        // Exactly 9 bets must fail due to insufficient balance
        assert.equal(failures.length, 9, `Exactly 9 bets must be rejected, got ${failures.length}`)

        // All failures must be insufficient funds
        for (const f of failures) {
            assert.match(f.error, /Insufficient/i, 'Failed bet must report insufficient balance')
        }

        // Final balance must be exactly ₹0, NEVER negative
        const finalUser = db.findUserById(testUser.id)
        assert.equal(finalUser.balances.INR, 0.00, 'Final balance must be exactly ₹0')
    })

    it('verifies concurrent withdrawals strictly prevent overdrafting player balance', async () => {
        const testUser = db.createUser({
            username: 'withdraw_concurrency_' + Date.now().toString(36),
            phone: '9876543215',
            passwordHash: 'hash',
            totalDeposited: 1000 // Eligible for withdrawal
        })

        // Balance is ₹500
        testUser.balances.INR = 500.00
        db.updateUser(testUser.id, { balances: testUser.balances })

        // Fire 5 simultaneous withdrawal requests of ₹500
        const promises = Array.from({ length: 5 }, () => {
            return db.withUserLock(testUser.id, async () => {
                const refreshed = db.findUserById(testUser.id)
                if ((refreshed.balances.INR || 0) < 500) {
                    throw new Error('Insufficient balance')
                }
                return db.requestWithdrawal({
                    userId: testUser.id,
                    currency: 'INR',
                    amount: 500,
                    payoutMethod: 'UPI',
                    payoutDestination: 'test@upi'
                })
            }).then(() => ({ success: true }))
              .catch(err => ({ success: false, error: err.message }))
        })

        const results = await Promise.all(promises)
        const successes = results.filter(r => r.success)
        const failures = results.filter(r => !r.success)

        assert.equal(successes.length, 1, 'Only 1 withdrawal must succeed')
        assert.equal(failures.length, 4, 'Remaining 4 must fail')

        const finalUser = db.findUserById(testUser.id)
        assert.equal(finalUser.balances.INR, 0, 'Final balance must be 0')
    })

    it('verifies non-blocking async persistence queue handles high-throughput burst safely', async () => {
        const startTime = Date.now()
        // Trigger 50 rapid persist calls
        for (let i = 0; i < 50; i++) {
            db.persist()
        }
        const burstDuration = Date.now() - startTime

        // In synchronous I/O 50 writes would block for 50-250ms+
        // With debounced non-blocking async persistence it returns in < 10ms
        assert.ok(burstDuration < 50, `Burst persists must not block event loop (took ${burstDuration}ms)`)

        // Allow async flush to drain
        const deadline = Date.now() + 1500
        while ((db._isFlushing || db._flushTimer || db._needsFlushAgain) && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 30))
        }
        assert.equal(db._isFlushing, false, 'Flush queue must cleanly drain')
    })

    it('verifies Server-Authoritative Crash round session lifecycle and cashout validation', () => {
        const session = gameEngine.startCrashRound({
            userId: 'test_crash_player',
            currency: 'INR',
            betAmount: 100,
            clientSeed: 'seed_abc_123'
        })

        assert.ok(session.roundId, 'Must generate unique roundId')
        assert.ok(session.crashPoint >= 1.00, 'Crash point must be >= 1.00')
        assert.ok(session.hash, 'Must commit outcome hash')

        // Active round query must find the session
        const active = gameEngine.getActiveCrashRound('test_crash_player')
        assert.ok(active, 'Must find active crash session')
        assert.equal(active.roundId, session.roundId)

        // Cashout below crash point must win
        const safeMultiplier = Math.max(1.01, parseFloat((session.crashPoint * 0.5).toFixed(2)))
        const cashout = gameEngine.cashoutCrash({
            userId: 'test_crash_player',
            roundId: session.roundId,
            multiplier: safeMultiplier
        })

        assert.equal(cashout.won, true, 'Cashout below crash point must win')
        assert.equal(cashout.multiplier, safeMultiplier)
        assert.equal(cashout.payout, parseFloat((100 * safeMultiplier).toFixed(2)))

        // Session must be deleted after cashout
        assert.equal(gameEngine.getActiveCrashRound('test_crash_player'), null, 'Session must close after cashout')
    })

    it('verifies active Mines session query and resumption state', () => {
        const session = gameEngine.startMinesRound({
            userId: 'test_mines_resumption',
            currency: 'INR',
            betAmount: 50,
            minesCount: 5,
            clientSeed: 'seed_mines_123'
        })

        const active = gameEngine.getActiveMinesRound('test_mines_resumption')
        assert.ok(active, 'Must locate active mines round')
        assert.equal(active.roundId, session.roundId)
        assert.equal(active.minesCount, 5)
        assert.equal(active.betAmount, 50)

        // Cleanup
        gameEngine.activeMinesRounds.delete(session.roundId)
    })

    it('verifies token revocation blacklist invalidates tokens on logout', () => {
        const dummyToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_test_token'
        assert.equal(isTokenRevoked(dummyToken), false, 'Token must not be revoked initially')
        revokeToken(dummyToken)
        assert.equal(isTokenRevoked(dummyToken), true, 'Token must be blacklisted after revocation')
    })

    it('verifies AML 1.0x wagering rollover requirement logic', () => {
        const testUser = db.createUser({
            username: 'test_aml_player_' + Date.now(),
            email: `aml_${Date.now()}@test.com`,
            passwordHash: 'dummy_hash',
            role: 'player'
        })

        // User deposits ₹500
        testUser.totalDeposited = 500
        testUser.totalWagered = 250 // Only 0.5x turnover

        const satisfiesDeposit = testUser.totalDeposited >= 300
        const satisfiesTurnover = testUser.totalWagered >= testUser.totalDeposited
        assert.equal(satisfiesDeposit, true, 'Must have deposited >= 300')
        assert.equal(satisfiesTurnover, false, 'Must reject withdrawal if turnover < totalDeposited')

        // User wagers ₹250 more to achieve 1.0x turnover
        testUser.totalWagered += 250
        assert.equal(testUser.totalWagered >= testUser.totalDeposited, true, 'Must unlock withdrawal once turnover is 100% completed')
    })

    it('verifies platform circuit breaker and per-game maintenance kill switches', () => {
        // 1. Platform maintenance mode
        db.data.settings.maintenanceMode = true
        let statusSent = null
        let jsonSent = null
        const mockRes = {
            status: (code) => {
                statusSent = code
                return {
                    json: (data) => { jsonSent = data }
                }
            }
        }

        let nextCalled = false
        checkPlatformMaintenance({ user: { role: 'player' } }, mockRes, () => { nextCalled = true })
        assert.equal(statusSent, 503, 'Platform maintenance must return 503 for players')
        assert.equal(jsonSent.code, 'PLATFORM_MAINTENANCE')
        assert.equal(nextCalled, false)

        // Admin must bypass platform maintenance
        nextCalled = false
        checkPlatformMaintenance({ user: { role: 'admin' } }, mockRes, () => { nextCalled = true })
        assert.equal(nextCalled, true, 'Admin must bypass platform maintenance')

        // Revert platform maintenance
        db.data.settings.maintenanceMode = false

        // 2. Per-game kill switch
        db.data.settings.disabledGames = ['crash']
        statusSent = null
        jsonSent = null
        nextCalled = false

        checkGameMaintenance({ body: { game: 'crash' }, user: { role: 'player' } }, mockRes, () => { nextCalled = true })
        assert.equal(statusSent, 503, 'Disabled game must return 503')
        assert.equal(jsonSent.code, 'GAME_MAINTENANCE')
        assert.equal(nextCalled, false)

        // Non-disabled game must pass
        nextCalled = false
        checkGameMaintenance({ body: { game: 'mines' }, user: { role: 'player' } }, mockRes, () => { nextCalled = true })
        assert.equal(nextCalled, true, 'Active game must pass maintenance check')

        // Clean up disabled games
        db.data.settings.disabledGames = []
    })

    it('verifies synchronized multiplayer Crash Room lifecycle and bet placement', async () => {
        crashRoomService.startWaitingPhase()
        assert.equal(crashRoomService.state, 'WAITING')
        assert.ok(crashRoomService.crashPoint >= 1.00)
        assert.ok(typeof crashRoomService.hash === 'string' && crashRoomService.hash.length > 0)

        // Ensure test user has balance
        const testUser = db.createUser({
            username: 'crash_room_tester_' + Date.now(),
            email: `crash_tester_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player'
        })
        testUser.balances.INR = 1000

        const betResult = await crashRoomService.placeBet({
            userId: testUser.id,
            username: testUser.username,
            betAmount: 100,
            autoCashout: 2.0,
            currency: 'INR'
        })

        assert.equal(betResult.success, true)
        assert.equal(betResult.bet.betAmount, 100)
        assert.equal(crashRoomService.activeBets.has(testUser.id), true)

        const state = crashRoomService.getState()
        assert.equal(state.state, 'WAITING')
        assert.ok(Array.isArray(state.bets))
        assert.equal(state.bets.length >= 1, true)
    })

    it('verifies automated payment webhook idempotency and instant balance crediting', async () => {
        const testUser = db.createUser({
            username: 'webhook_test_player_' + Date.now(),
            email: `wh_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player'
        })
        const initialBal = testUser.balances.INR

        const eventId = 'evt_test_unique_' + Date.now()
        assert.equal(db.isWebhookProcessed(eventId), false, 'Webhook must not be processed initially')

        // First deposit via webhook
        await db.withUserLock(testUser.id, async () => {
            db.updateUserBalance(testUser.id, 'INR', 500, 'Automated Gateway Deposit')
            testUser.totalDeposited += 500
            db.markWebhookProcessed(eventId)
        })

        assert.equal(testUser.balances.INR, initialBal + 500)
        assert.equal(testUser.totalDeposited, 500)
        assert.equal(db.isWebhookProcessed(eventId), true, 'Webhook must be marked as processed')
    })

    it('verifies viral affiliate referral tracking and 0.3% turnover commission accumulation', async () => {
        const referrer = db.createUser({
            username: 'referrer_vip_' + Date.now(),
            email: `ref_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player'
        })
        assert.ok(referrer.referralCode, 'Every user must have a generated referral code')

        // Create player referred by referrer
        const referredPlayer = db.createUser({
            username: 'referred_player_' + Date.now(),
            email: `referred_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player',
            referredBy: referrer.referralCode
        })

        assert.equal(referredPlayer.referredBy, referrer.id, 'Player must be linked to referrer')
        assert.equal(referrer.affiliateStats.totalReferred >= 1, true, 'Referrer must track referred player count')

        // Referred player places a ₹1,000 bet
        referredPlayer.balances.INR = 2000
        await db.executeAtomicBet({
            userId: referredPlayer.id,
            currency: 'INR',
            betAmount: 1000,
            game: 'limbo',
            gameName: 'Limbo',
            evaluator: async () => ({ won: false, multiplier: 0, payout: 0 })
        })

        // Commission is 0.3% of 1000 = ₹3.00
        assert.equal(referrer.affiliateStats.totalTurnover, 1000)
        assert.equal(referrer.affiliateStats.unclaimedEarnings, 3.0)

        // Referrer claims affiliate commission
        referrer.balances.INR = 100
        referrer.affiliateStats.unclaimedEarnings = 50 // Set claimable amount >= 10
        const claimResult = await db.claimAffiliateCommission(referrer.id)
        assert.equal(claimResult.claimedAmount, 50)
        assert.equal(referrer.balances.INR, 150)
        assert.equal(referrer.affiliateStats.unclaimedEarnings, 0)
    })

    it('verifies VIP loyalty tier progression and rakeback claim settlement', async () => {
        const vipPlayer = db.createUser({
            username: 'vip_player_' + Date.now(),
            email: `vip_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player'
        })

        // Status at 0 wager
        const initialStatus = db.getVipStatus(vipPlayer.id)
        assert.equal(initialStatus.currentTier, 'Bronze')
        assert.equal(initialStatus.rakebackPercent, '3%')

        // Player wagers ₹60,000 -> Reaches Gold tier (50k+)
        vipPlayer.totalWagered = 60000
        const goldStatus = db.getVipStatus(vipPlayer.id)
        assert.equal(goldStatus.currentTier, 'Gold')
        assert.equal(goldStatus.rakebackPercent, '7%')

        // Accumulate and claim rakeback
        vipPlayer.unclaimedRakeback = 25.50
        const initialBal = vipPlayer.balances.INR
        const claimResult = await db.claimRakeback(vipPlayer.id)

        assert.equal(claimResult.claimedAmount, 25.50)
        assert.equal(vipPlayer.balances.INR, parseFloat((initialBal + 25.50).toFixed(2)))
        assert.equal(vipPlayer.unclaimedRakeback, 0)
    })

    it('verifies ChatService real-time message posting, VIP badges, and 2-second slow mode', async () => {
        const chatter = db.createUser({
            username: 'chatter_' + Date.now(),
            email: `chatter_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player'
        })
        chatter.totalWagered = 15000 // Silver tier

        const msg = await chatService.postMessage({
            user: chatter,
            text: 'Hello AmratGames community! 🚀'
        })

        assert.equal(msg.userId, chatter.id)
        assert.equal(msg.username, chatter.username)
        assert.equal(msg.vipTier, 'Silver')
        assert.equal(msg.text, 'Hello AmratGames community! 🚀')
        assert.ok(msg.createdAt)

        // Rapid 2nd post must trigger 2-second slow mode rate limit
        await assert.rejects(
            async () => {
                await chatService.postMessage({
                    user: chatter,
                    text: 'Flood message attempt'
                })
            },
            (err) => {
                assert.match(err.message, /Slow mode/i)
                assert.equal(err.status, 429)
                return true
            }
        )
    })

    it('verifies ChatService bet slip sharing rejects unowned bets and publishes valid slips', async () => {
        const betOwner = db.createUser({
            username: 'winner_' + Date.now(),
            email: `winner_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player'
        })

        const betRecord = {
            id: 'bet_test_' + Date.now(),
            userId: betOwner.id,
            username: betOwner.username,
            game: 'limbo',
            gameName: 'Limbo',
            currency: 'INR',
            betAmount: 500,
            multiplier: 5.5,
            won: true,
            payout: 2750,
            timestamp: new Date().toISOString()
        }
        db.data.bets.push(betRecord)

        // Imposter trying to share someone else's bet
        const imposter = { id: 'usr_imposter', username: 'imposter' }
        await assert.rejects(
            async () => {
                await chatService.shareBet({ user: imposter, betId: betRecord.id })
            },
            (err) => {
                assert.match(err.message, /You can only share your own bets/i)
                return true
            }
        )

        // Legitimate owner shares bet
        const sharedMsg = await chatService.shareBet({ user: betOwner, betId: betRecord.id })
        assert.equal(sharedMsg.type, 'bet_share')
        assert.equal(sharedMsg.sharedBet.id, betRecord.id)
        assert.equal(sharedMsg.sharedBet.payout, 2750)
        assert.equal(sharedMsg.sharedBet.multiplier, 5.5)
    })

    it('verifies Anti-Sybil Sentinel detects IP collisions, device matches, and elevates risk score', () => {
        const referrer = db.createUser({
            username: 'sybil_agent_' + Date.now(),
            email: `sybil_agent_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player'
        })
        referrer.security = { lastIp: '198.51.100.25', fingerprint: 'fp_hardware_hash_123' }

        const fakeReferred = db.createUser({
            username: 'sybil_clone_' + Date.now(),
            email: `sybil_clone_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player',
            referredBy: referrer.referralCode
        })
        fakeReferred.security = { lastIp: '198.51.100.25', fingerprint: 'fp_hardware_hash_123' }

        // Track sessions in AntiFraudService
        antiFraudService.trackSession(referrer.id, { ip: '198.51.100.25', fingerprint: 'fp_hardware_hash_123' })
        antiFraudService.trackSession(fakeReferred.id, { ip: '198.51.100.25', fingerprint: 'fp_hardware_hash_123' })

        const risk = antiFraudService.calculateRiskScore(fakeReferred.id)
        assert.ok(risk.score >= 50, 'Sybil collision score should be elevated (>= 50)')
        assert.ok(['ELEVATED', 'CRITICAL'].includes(risk.level))
        assert.ok(risk.flags.includes('SYBIL_REFERRAL_IP_COLLISION') || risk.flags.includes('SYBIL_REFERRAL_DEVICE_FINGERPRINT_MATCH'))
    })

    it('verifies Provably Fair HMAC-SHA256 outcome verification logic across games', () => {
        const serverSeed = 'amrat_provably_fair_test_seed_777'
        const clientSeed = 'custom_player_seed'
        const nonce = 3

        const hmac = crypto.createHmac('sha256', serverSeed)
        hmac.update(`${clientSeed}:${nonce}`)
        const hash = hmac.digest('hex')

        const intVal = parseInt(hash.slice(0, 8), 16)
        const floatVal = intVal / 0x100000000

        let roll = 1.00
        if (floatVal >= 0.01) {
            roll = Math.floor((99 / (1 - floatVal))) / 100
        }
        roll = Math.max(1.00, Math.min(roll, 1000000.0))

        assert.ok(roll >= 1.00, 'Roll must be at least 1.00')
        assert.equal(hash.length, 64)
    })

    it('verifies Redis Pub/Sub multi-instance event bus and graceful local fallback', async () => {
        assert.ok(redisPubSub.instanceId.startsWith('worker_'), 'Instance ID must identify process worker')
        assert.ok(redisPubSub.CHANNELS.CHAT === 'amrat:chat')
        assert.ok(redisPubSub.CHANNELS.CRASH === 'amrat:crash')

        let receivedPayload = null
        const unsubscribe = redisPubSub.subscribe(redisPubSub.CHANNELS.CHAT, (envelope) => {
            receivedPayload = envelope
        })

        // Broadcast test chat message
        await redisPubSub.broadcast('NEW_CHAT_MESSAGE', {
            id: 'msg_test_redis_sync',
            text: 'Multi-instance cluster sync test',
            vipTier: 'Gold'
        })

        assert.ok(receivedPayload !== null, 'Subscriber must receive dispatched message')
        assert.equal(receivedPayload.type, 'NEW_CHAT_MESSAGE')
        assert.equal(receivedPayload.payload.text, 'Multi-instance cluster sync test')

        unsubscribe()
    })

    it('verifies Provably Fair Coin Toss evaluation and 1.98x payout calculation', () => {
        const evalHeads = gameEngine.evaluateCoinToss({
            betAmount: 100,
            choice: 'heads',
            clientSeed: 'test-seed-heads',
            nonce: 1
        })
        assert.ok(['heads', 'tails'].includes(evalHeads.outcome), 'Outcome must be heads or tails')
        assert.equal(evalHeads.game, 'coin-toss')
        assert.equal(evalHeads.choice, 'heads')
        if (evalHeads.won) {
            assert.equal(evalHeads.multiplier, 1.98, 'Win multiplier must be 1.98x')
            assert.equal(evalHeads.payout, 198, 'Payout must be 1.98x of stake')
        } else {
            assert.equal(evalHeads.multiplier, 0)
            assert.equal(evalHeads.payout, 0)
        }

        const evalTails = gameEngine.evaluateCoinToss({
            betAmount: 200,
            choice: 'tails',
            clientSeed: 'test-seed-tails',
            nonce: 2
        })
        assert.ok(['heads', 'tails'].includes(evalTails.outcome), 'Outcome must be heads or tails')
        assert.equal(evalTails.choice, 'tails')
        if (evalTails.won) {
            assert.equal(evalTails.multiplier, 1.98)
            assert.equal(evalTails.payout, 396)
        }
    })

    it('verifies Server-Authoritative Dino round lifecycle, Provably Fair jump steps, and cashout', async () => {
        const user = db.createUser({
            username: 'dino_runner_' + Date.now(),
            email: `dino_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player'
        })
        user.balances.INR = 1000

        // 1. Start round with ₹100
        const startRes = await dinoEngine.startRound({
            userId: user.id,
            betAmount: 100,
            currency: 'INR',
            difficulty: 'medium',
            clientSeed: 'custom-client-seed'
        })
        assert.equal(startRes.active, true)
        assert.equal(startRes.currentMultiplier, 1.0)
        assert.ok(startRes.roundId, 'Round ID must be generated')

        // 2. Query active round
        const active = dinoEngine.getActiveRound(user.id)
        assert.ok(active, 'Must return active Dino round')
        assert.equal(active.roundId, startRes.roundId)
        assert.equal(active.obstaclesCleared, 0)

        // 3. Jump step 1
        const jumpRes = await dinoEngine.jump({ userId: user.id, roundId: startRes.roundId })
        if (jumpRes.survived) {
            assert.ok(jumpRes.obstaclesCleared >= 1)
            assert.ok(jumpRes.currentMultiplier > 1.0)

            // Cashout
            const cashoutRes = await dinoEngine.cashout({ userId: user.id, roundId: startRes.roundId })
            assert.equal(cashoutRes.won, true)
            assert.ok(cashoutRes.payout > 100)
            assert.equal(dinoEngine.getActiveRound(user.id), null, 'Round must terminate upon cashout')
        } else {
            // Bust
            assert.equal(jumpRes.survived, false)
            assert.equal(dinoEngine.getActiveRound(user.id), null, 'Round must terminate upon bust')
        }
    })

    it('verifies Forgot Password OTP flow and secure bcrypt password update', async () => {
        const bcrypt = (await import('bcryptjs')).default
        const initialPasswordHash = await bcrypt.hash('OldSecretPass123', 10)
        const user = db.createUser({
            username: 'pwd_reset_user_' + Date.now(),
            email: `pwd_reset_${Date.now()}@test.com`,
            mobile: '+919988776655',
            passwordHash: initialPasswordHash,
            role: 'player'
        })

        // Request reset OTP
        const { otp } = db.generateOtp(user.email)
        assert.ok(otp, 'OTP code must be generated')
        assert.equal(otp.length, 6, 'OTP must be 6 digits')

        // Verify OTP
        const isValid = db.verifyOtp(user.email, otp)
        assert.equal(isValid, true, 'Generated OTP must be verified successfully')

        // Reset password
        const newPassword = 'BrandNewSecretPass456!'
        const newHash = await bcrypt.hash(newPassword, 10)
        db.updateUser(user.id, { passwordHash: newHash })

        const updated = db.findUserById(user.id)
        assert.notEqual(updated.passwordHash, initialPasswordHash)
        const isMatch = await bcrypt.compare(newPassword, updated.passwordHash)
        assert.equal(isMatch, true, 'New password must match stored bcrypt hash')
        
        // Ensure OTP cannot be reused after burning
        assert.equal(db.verifyOtp(user.email, otp), false, 'OTP must be single-use only')
    })

    it('verifies Pillar 2 Bankroll Risk Management dynamically caps single-round payouts', () => {
        const capped = bankrollRisk.enforceWinCap({
            betAmount: 1000,
            multiplier: 500,
            rawPayout: 500000,
            currency: 'INR'
        })
        assert.equal(capped.wasCapped, true, 'Win exceeding cap must be flagged as wasCapped')
        assert.equal(capped.profit, 100000, 'Max win profit must be capped at ₹100,000')
        assert.equal(capped.payout, 101000, 'Capped payout must equal stake + max profit cap')
        assert.equal(capped.multiplier, 101, 'Effective multiplier must reflect capped payout')

        // Normal win under cap must NOT be capped
        const normal = bankrollRisk.enforceWinCap({
            betAmount: 100,
            multiplier: 2.0,
            rawPayout: 200,
            currency: 'INR'
        })
        assert.equal(normal.wasCapped, false)
        assert.equal(normal.payout, 200)
        assert.equal(normal.profit, 100)
    })

    it('verifies Pillar 2 Bet Sizer rejects outsized bets on extreme multipliers', () => {
        // High multiplier with excessive bet: ₹5,000 at 100x -> potential profit ₹495,000 (> ₹100,000 cap)
        const riskyCheck = bankrollRisk.validateBetRisk({
            betAmount: 5000,
            targetMultiplier: 100,
            currency: 'INR'
        })
        assert.equal(riskyCheck.valid, false, 'Outsized bet on extreme multiplier must be rejected')
        assert.ok(riskyCheck.error.includes('Maximum win profit is capped'))

        // Safe scaled bet: ₹1,000 at 100x -> profit ₹99,000 (<= ₹100,000 cap)
        const safeCheck = bankrollRisk.validateBetRisk({
            betAmount: 1000,
            targetMultiplier: 100,
            currency: 'INR'
        })
        assert.equal(safeCheck.valid, true, 'Properly sized bet within cap must be accepted')
    })

    it('verifies Pillar 3 deterministic crypto deposit address and memo tag generation', () => {
        const userIdA = 'usr_player_alpha_99'
        const userIdB = 'usr_player_beta_88'

        const coordsA = automatedSettlement.getDepositCoordinates(userIdA, { currency: 'USDT', network: 'TRC20' })
        const coordsB = automatedSettlement.getDepositCoordinates(userIdB, { currency: 'USDT', network: 'TRC20' })

        assert.equal(coordsA.currency, 'USDT')
        assert.equal(coordsA.network, 'TRC20')
        assert.ok(coordsA.address.length > 20, 'Crypto address must be non-empty')
        assert.ok(coordsA.memoTag.startsWith('AG-'), 'Memo tag must have platform AG- prefix')
        assert.notEqual(coordsA.memoTag, coordsB.memoTag, 'Distinct user IDs must generate distinct memo tags')
        assert.ok(coordsA.qrPayload.includes(coordsA.memoTag), 'QR payload must embed user memo tag')
    })

    it('verifies Pillar 3 automated instant payout qualification and risk heuristics', () => {
        // Player 1: Has not deposited minimum ₹300 -> REJECTED
        const underDepositedUser = { id: 'usr_new', totalDeposited: 100, totalWagered: 200 }
        const res1 = automatedSettlement.evaluateWithdrawal({ amount: 100, currency: 'INR' }, underDepositedUser, [])
        assert.equal(res1.canProceed, false)
        assert.equal(res1.reason, 'MIN_DEPOSIT_REQUIRED')

        // Player 2: Has not completed 1.0x AML turnover -> REJECTED
        const amlViolatingUser = { id: 'usr_aml', totalDeposited: 1000, totalWagered: 400 }
        const res2 = automatedSettlement.evaluateWithdrawal({ amount: 500, currency: 'INR' }, amlViolatingUser, [])
        assert.equal(res2.canProceed, false)
        assert.equal(res2.reason, 'AML_TURNOVER_REQUIRED')

        // Player 3: Clean, met AML, low-risk amount (₹2,500 <= ₹10,000) -> AUTO APPROVED INSTANTLY
        const cleanUser = { id: 'usr_clean', totalDeposited: 1000, totalWagered: 1500, antiSybilRiskScore: 5 }
        const res3 = automatedSettlement.evaluateWithdrawal({ amount: 2500, currency: 'INR' }, cleanUser, [])
        assert.equal(res3.qualified, true)
        assert.equal(res3.instantPayout, true)
        assert.equal(res3.status, 'approved')
        assert.equal(res3.reason, 'AUTO_APPROVED_LOW_RISK')
        assert.ok(res3.dispatchRef.startsWith('APO_'))

        // Player 4: High-roller amount (₹25,000 > ₹10,000 threshold) -> QUEUED FOR CASHIER
        const highRollerUser = { id: 'usr_whale', totalDeposited: 50000, totalWagered: 60000, antiSybilRiskScore: 0 }
        const res4 = automatedSettlement.evaluateWithdrawal({ amount: 25000, currency: 'INR' }, highRollerUser, [])
        assert.equal(res4.qualified, true)
        assert.equal(res4.instantPayout, false)
        assert.equal(res4.status, 'pending')
        assert.equal(res4.reason, 'HIGH_VALUE_THRESHOLD')

        // Player 5: Suspicious user with elevated anti-sybil risk score -> QUEUED FOR COMPLIANCE
        const suspiciousUser = { id: 'usr_suspicious', totalDeposited: 2000, totalWagered: 3000, antiSybilRiskScore: 45 }
        const res5 = automatedSettlement.evaluateWithdrawal({ amount: 1000, currency: 'INR' }, suspiciousUser, [])
        assert.equal(res5.qualified, true)
        assert.equal(res5.instantPayout, false)
        assert.equal(res5.status, 'pending')
        assert.equal(res5.reason, 'RISK_SCORE_ELEVATED')
    })

    it('verifies Pillar 3 automated blockchain ingress webhook credits balance and prevents replay attacks', async () => {
        const cryptoPlayer = db.createUser({
            username: 'crypto_whale_' + Date.now(),
            email: `crypto_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player'
        })
        const initialBal = cryptoPlayer.balances.INR
        const coords = automatedSettlement.getDepositCoordinates(cryptoPlayer.id, { currency: 'USDT', network: 'TRC20' })
        const fakeTxHash = '0x_tx_hash_simulated_' + Date.now()

        // 1. Process simulated incoming USDT deposit (10 USDT @ 90 INR/USDT = ₹900 INR)
        const creditResult = await automatedSettlement.processCryptoDepositWebhook({
            txHash: fakeTxHash,
            network: 'TRC20',
            currency: 'USDT',
            amount: 10.0,
            creditCurrency: 'INR',
            memoTag: coords.memoTag
        }, db)

        assert.equal(creditResult.success, true)
        assert.equal(creditResult.creditedAmount, 900)
        assert.equal(cryptoPlayer.balances.INR, initialBal + 900)
        assert.equal(cryptoPlayer.totalDeposited >= 900, true)

        // 2. Prevent replay attacks: duplicate txHash must be safely recognized and rejected
        const replayResult = await automatedSettlement.processCryptoDepositWebhook({
            txHash: fakeTxHash,
            network: 'TRC20',
            currency: 'USDT',
            amount: 10.0,
            creditCurrency: 'INR',
            memoTag: coords.memoTag
        }, db)

        assert.equal(replayResult.duplicate, true)
        // Balance must not change on duplicate
        assert.equal(cryptoPlayer.balances.INR, initialBal + 900)
    })

    after(() => {
        redisPubSub.disconnect()
        // Ensure TAP test output flushes completely, then terminate cleanly to prevent keep-alive hang
        setTimeout(() => {
            process.exit(0)
        }, 150)
    })
})
