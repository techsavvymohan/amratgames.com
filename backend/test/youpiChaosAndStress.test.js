import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { youPiGatewayBridge } from '../src/gateways/bridge/YouPiGatewayBridge.js'
import { paymentGatewayManager } from '../src/gateways/PaymentGatewayManager.js'
import { db as amratDb } from '../src/db/db.js'

const isYouPiAvailable = Boolean(
    youPiGatewayBridge &&
    youPiGatewayBridge.isOperational &&
    youPiGatewayBridge.isOperational() &&
    youPiGatewayBridge.getActiveVpa &&
    youPiGatewayBridge.getActiveVpa()
)

describe('🔥 YouPI Payment Gateway — Worst-Case Situations & Chaos Simulation Suite', { skip: !isYouPiAvailable ? 'YouPI gateway repository or active VPA not available' : false }, () => {
    const chaosUserId = `usr_chaos_${Date.now()}`
    const chaosUsername = 'ChaosTester'
    let activeAccount = null

    before(async () => {
        if (!isYouPiAvailable) return
        activeAccount = youPiGatewayBridge.getActiveVpa()
        assert.ok(activeAccount, 'Active receiving account must exist for chaos testing')

        // Clean any stale sessions on the receiving account
        const { PaymentStatus } = youPiGatewayBridge.common
        youPiGatewayBridge.db.execute(
            `UPDATE payment_sessions SET status = ?, completed_at = datetime('now') WHERE receiving_account_id = ? AND status IN (?, ?)`,
            [PaymentStatus.CANCELLED, activeAccount.id, PaymentStatus.ACTIVE, PaymentStatus.QUEUED]
        )

        // Seed chaos test user in AmratGames DB
        if (!amratDb.data.users) amratDb.data.users = []
        amratDb.data.users.push({
            id: chaosUserId,
            username: chaosUsername,
            email: 'chaos@amratgames.com',
            phone: '9876540000',
            balances: { INR: 1000.0, USDT: 0, BTC: 0, AMRAT: 5000 },
            totalDeposited: 1000.0
        })
        amratDb.persist()
    })

    // ─────────────────────────────────────────────────────────────────────────
    // 💥 1. High-Concurrency Slot Contention & FIFO Queue Race Condition
    // ─────────────────────────────────────────────────────────────────────────
    describe('1. Slot Contention & Concurrency Torture', () => {
        test('10 parallel players request deposit at the exact same millisecond: exactly 1 ACTIVE, 9 QUEUED in strict sequence', async () => {
            // Clean queue state
            const { PaymentStatus } = youPiGatewayBridge.common
            youPiGatewayBridge.db.execute(
                `UPDATE payment_sessions SET status = ?, completed_at = datetime('now') WHERE receiving_account_id = ? AND status IN (?, ?)`,
                [PaymentStatus.CANCELLED, activeAccount.id, PaymentStatus.ACTIVE, PaymentStatus.QUEUED]
            )

            const concurrencyCount = 10
            const promises = []

            for (let i = 0; i < concurrencyCount; i++) {
                promises.push(
                    youPiGatewayBridge.createDepositSession({
                        userId: chaosUserId,
                        username: `${chaosUsername}_${i}`,
                        amount: 150 + i * 10,
                        orderId: `CHAOS_CONCUR_${Date.now()}_${i}`
                    })
                )
            }

            const results = await Promise.all(promises)

            // Exactly 1 must be ACTIVE
            const activeResults = results.filter(r => r.status === PaymentStatus.ACTIVE)
            const queuedResults = results.filter(r => r.status === PaymentStatus.QUEUED)

            assert.equal(activeResults.length, 1, 'Strict Invariant: Exactly one active session allowed per receiving account')
            assert.equal(queuedResults.length, 9, 'All subsequent concurrent sessions must be placed in FIFO queue')

            // All must have generated unique payment IDs and vector QR codes
            const paymentIds = new Set(results.map(r => r.paymentId))
            assert.equal(paymentIds.size, concurrencyCount, 'All payment IDs must be globally unique')

            for (const res of results) {
                assert.ok(res.qrSvg, 'Every session (active or queued) must have genuine vector QR SVG')
                assert.match(res.upiIntent, /^upi:\/\/pay\?pa=shanviientrrprisee%40ybl/)
            }

            // Verify queue metrics
            const queueStatus = youPiGatewayBridge.getQueueStatus(activeAccount.id)
            assert.equal(queueStatus.activeCount, 1)
            assert.equal(queueStatus.queuedCount, 9)
        })

        test('atomic cascade: cancelling active session automatically promotes queue item #1 to ACTIVE', async () => {
            const queueBefore = youPiGatewayBridge.getQueueStatus(activeAccount.id)
            assert.equal(queueBefore.activeCount, 1)
            assert.ok(queueBefore.queuedCount > 0)

            const currentActiveId = queueBefore.activeSessions[0].id
            const expectedPromotedId = queueBefore.queuedSessions[0].id

            // Cancel the active session
            const cancelResult = await youPiGatewayBridge.cancelPaymentSession(currentActiveId)
            assert.equal(cancelResult.success, true)
            assert.equal(cancelResult.status, 'CANCELLED')

            // Check queue state after promotion
            const queueAfter = youPiGatewayBridge.getQueueStatus(activeAccount.id)
            assert.equal(queueAfter.activeCount, 1)
            assert.equal(queueAfter.activeSessions[0].id, expectedPromotedId, 'The next queued session must be promoted to ACTIVE')
            assert.equal(queueAfter.queuedCount, queueBefore.queuedCount - 1)
        })

        test('draining queue: cancelling all remaining sessions cleanly unoccupies slot without crash or leak', async () => {
            let queue = youPiGatewayBridge.getQueueStatus(activeAccount.id)

            while (queue.activeCount > 0 || queue.queuedCount > 0) {
                if (queue.activeSessions[0]) {
                    await youPiGatewayBridge.cancelPaymentSession(queue.activeSessions[0].id)
                }
                queue = youPiGatewayBridge.getQueueStatus(activeAccount.id)
            }

            assert.equal(queue.activeCount, 0)
            assert.equal(queue.queuedCount, 0)
        })
    })

    // ─────────────────────────────────────────────────────────────────────────
    // 💥 2. Adversarial Attacks & Fraud Pipeline Injections
    // ─────────────────────────────────────────────────────────────────────────
    describe('2. Adversarial Attacks & Anti-Fraud Security Pipeline', () => {
        test('malicious XSS script injection in SMS is detected and blocked by verification pipeline', async () => {
            const maliciousPayload = "<script>alert('XSS_ATTACK')</script> Dear SBI User, Rs 500.00 credited via UPI Ref 112233445566"
            const result = await youPiGatewayBridge.verifyPayment({
                source: 'SMS',
                rawText: maliciousPayload,
                sender: 'VM-HDFCBK',
                receivingAccountId: activeAccount.id
            })

            assert.equal(result.success, false, 'Malicious script injection must NOT verify')
            assert.ok(result.status === 'REJECTED' || result.status === 'UNRESOLVED')
        })

        test('SQL injection attempt in SMS payload is neutralized and rejected', async () => {
            const sqlInjectionPayload = "'; DROP TABLE payment_sessions; -- Dear Customer A/C credited by Rs 1000 ref 998877665544"
            const result = await youPiGatewayBridge.verifyPayment({
                source: 'SMS',
                rawText: sqlInjectionPayload,
                sender: 'VM-HDFCBK',
                receivingAccountId: activeAccount.id
            })

            assert.equal(result.success, false)
            assert.ok(result.status === 'REJECTED' || result.status === 'UNRESOLVED')

            // Verify table still exists and database was not dropped
            const count = youPiGatewayBridge.db.queryOne('SELECT count(*) as c FROM payment_sessions')
            assert.ok(count)
        })

        test('personal SMS spoofing (+919876543210) is rejected by verification pipeline', async () => {
            const personalSms = 'I sent you Rs 500 via Google Pay bro ref 123456789012'
            const result = await youPiGatewayBridge.verifyPayment({
                source: 'SMS',
                rawText: personalSms,
                sender: '+919876543210', // Personal 10-digit number, NOT a bank alpha-tag like VM-HDFCBK
                receivingAccountId: activeAccount.id
            })

            assert.equal(result.success, false)
            assert.ok(result.failingStage === 2 || result.failingStage === 3, 'Must fail early in stage 2 or 3')
        })

        test('pure debit notifications ("debited Rs 500") are rejected and never attributed', async () => {
            const debitSms = 'Dear Customer, Rs 500.00 debited from A/C 1234 on 25-Oct-26 for Amazon shopping Ref 876543219012'
            const parsed = youPiGatewayBridge.core.BankSmsParser.parse({ text: debitSms })
            assert.equal(parsed, null, 'BankSmsParser must return null for pure debit alerts')

            const obsResult = await youPiGatewayBridge.ingestSmsObservation({ message: debitSms })
            assert.equal(obsResult.success, false)
            assert.match(obsResult.error, /debit alert/i)
        })

        test('zero and negative credit amounts are completely rejected', async () => {
            const zeroSms = 'Rs 0.00 credited to account'
            const parsedZero = youPiGatewayBridge.core.extractIntelligentAmount(zeroSms)
            assert.equal(parsedZero, null, 'Zero amount must return null')

            const negativeSms = 'Rs -100.00 credited to account'
            const parsedNegative = youPiGatewayBridge.core.extractIntelligentAmount(negativeSms)
            assert.equal(parsedNegative, null, 'Negative amount must return null')
        })
    })

    // ─────────────────────────────────────────────────────────────────────────
    // 💥 3. High-Concurrency Replay Attack & Ledger Mutex Safety
    // ─────────────────────────────────────────────────────────────────────────
    describe('3. Replay Attacks & Distributed Duplicate Bursts', () => {
        test('rapid burst of 5 identical bank SMS alerts: exactly 1 settles, 4 dropped as duplicates', async () => {
            // Clean slot & create session for ₹450
            const { PaymentStatus } = youPiGatewayBridge.common
            youPiGatewayBridge.db.execute(
                `UPDATE payment_sessions SET status = ?, completed_at = datetime('now') WHERE receiving_account_id = ? AND status IN (?, ?)`,
                [PaymentStatus.CANCELLED, activeAccount.id, PaymentStatus.ACTIVE, PaymentStatus.QUEUED]
            )

            const session = await youPiGatewayBridge.createDepositSession({
                userId: chaosUserId,
                username: chaosUsername,
                amount: 450.0,
                orderId: `CHAOS_REPLAY_${Date.now()}`
            })
            assert.equal(session.status, 'ACTIVE')

            const userBefore = amratDb.findUserById(chaosUserId)
            const balanceBefore = userBefore.balances.INR

            const testUtr = `9988${Date.now().toString().slice(-8)}`
            const identicalSms = `Your A/C 9876 is credited by Rs 450.00 on 25-Oct-26 via UPI Ref no: ${testUtr} shanviientrrprisee@ybl`

            // Fire 5 identical observations in parallel (simulating packet replay / retry flood)
            const burstPromises = [
                youPiGatewayBridge.ingestSmsObservation({ message: identicalSms }),
                youPiGatewayBridge.ingestSmsObservation({ message: identicalSms }),
                youPiGatewayBridge.ingestSmsObservation({ message: identicalSms }),
                youPiGatewayBridge.ingestSmsObservation({ message: identicalSms }),
                youPiGatewayBridge.ingestSmsObservation({ message: identicalSms })
            ]

            const burstResults = await Promise.all(burstPromises)

            // Exactly 1 must have settled
            const settledResults = burstResults.filter(r => r.settlement?.settled === true)
            const duplicateResults = burstResults.filter(r => r.duplicate === true)

            assert.equal(settledResults.length, 1, 'Only the first observation must settle')
            assert.equal(duplicateResults.length, 4, 'All 4 replayed observations must be caught as duplicates')

            // Verify wallet ledger was credited EXACTLY ONCE (₹450, never ₹2,250)
            const userAfter = amratDb.findUserById(chaosUserId)
            assert.equal(userAfter.balances.INR, balanceBefore + 450.0, 'Balance must be credited exactly once without double-spending')
        })

        test('20 concurrent wallet balance updates on the same player account are serialized cleanly by withUserLock', async () => {
            const userBefore = amratDb.findUserById(chaosUserId)
            const initialBalance = userBefore.balances.INR
            const deltaAmount = 25.0
            const concurrentUpdates = 20

            const updatePromises = []
            for (let i = 0; i < concurrentUpdates; i++) {
                updatePromises.push(
                    amratDb.withUserLock(chaosUserId, async () => {
                        return amratDb.updateUserBalance(chaosUserId, 'INR', deltaAmount, `Stress Test Deposit #${i}`)
                    })
                )
            }

            await Promise.all(updatePromises)

            const userAfter = amratDb.findUserById(chaosUserId)
            const expectedBalance = initialBalance + (concurrentUpdates * deltaAmount)
            assert.equal(userAfter.balances.INR, expectedBalance, 'All 20 concurrent updates must be serialized with zero lost updates')
        })
    })

    // ─────────────────────────────────────────────────────────────────────────
    // 💥 4. Stale Session Recovery & Illegal State Transition Rejections
    // ─────────────────────────────────────────────────────────────────────────
    describe('4. Stale Session Recovery & State Transition Defenses', () => {
        test('RecoveryEngine automatically detects expired active sessions, terminates them, and promotes queue', async () => {
            const { PaymentStatus } = youPiGatewayBridge.common

            // 1. Clean slot
            youPiGatewayBridge.db.execute(
                `UPDATE payment_sessions SET status = ?, completed_at = datetime('now') WHERE receiving_account_id = ? AND status IN (?, ?)`,
                [PaymentStatus.CANCELLED, activeAccount.id, PaymentStatus.ACTIVE, PaymentStatus.QUEUED]
            )

            // 2. Create session #1 (which will be active)
            const session1 = await youPiGatewayBridge.createDepositSession({
                userId: chaosUserId,
                amount: 200,
                orderId: `CHAOS_STALE_1_${Date.now()}`
            })
            assert.equal(session1.status, 'ACTIVE')

            // 3. Create session #2 (which will be queued)
            const session2 = await youPiGatewayBridge.createDepositSession({
                userId: chaosUserId,
                amount: 300,
                orderId: `CHAOS_STALE_2_${Date.now()}`
            })
            assert.equal(session2.status, 'QUEUED')

            // 4. Artificially age session #1 into the past (10 minutes ago)
            const tenMinutesAgo = new Date(Date.now() - 600000).toISOString()
            youPiGatewayBridge.db.execute(
                `UPDATE payment_sessions SET expires_at = ? WHERE id = ?`,
                [tenMinutesAgo, session1.paymentId]
            )

            // 5. Run Recovery Engine!
            const recoveryStats = youPiGatewayBridge.recoverStaleSessions()
            assert.ok(recoveryStats.expiredCount >= 1, 'Stale session must be counted as expired')
            assert.ok(recoveryStats.promotedCount >= 1, 'Queued session must be promoted')

            // 6. Verify session states
            const s1Check = await youPiGatewayBridge.getPaymentSession(session1.paymentId)
            assert.equal(s1Check.status, 'EXPIRED', 'Aged session must transition to EXPIRED')

            const s2Check = await youPiGatewayBridge.getPaymentSession(session2.paymentId)
            assert.equal(s2Check.status, 'ACTIVE', 'Queued session must be promoted to ACTIVE')

            // Clean up
            await youPiGatewayBridge.cancelPaymentSession(session2.paymentId)
        })

        test('State Machine strictly prevents illegal state transitions (e.g. CANCELLED -> ACTIVE)', () => {
            const { assertValidTransition, isValidTransition } = youPiGatewayBridge.core.stateMachine

            // Valid transitions
            assert.equal(isValidTransition('INITIATED', 'ACTIVE'), true)
            assert.equal(isValidTransition('ACTIVE', 'SUCCESS'), true)
            assert.equal(isValidTransition('ACTIVE', 'CANCELLED'), true)
            assert.equal(isValidTransition('ACTIVE', 'EXPIRED'), true)

            // Illegal transitions
            assert.equal(isValidTransition('CANCELLED', 'ACTIVE'), false)
            assert.equal(isValidTransition('SUCCESS', 'PENDING'), false)
            assert.equal(isValidTransition('EXPIRED', 'ACTIVE'), false)

            assert.throws(
                () => assertValidTransition('CANCELLED', 'ACTIVE'),
                /Illegal payment state transition/
            )
        })

        test('gracefully handles missing player user in settlement without crashing server', async () => {
            const dummySession = {
                id: `pay_ghost_${Date.now()}`,
                amountPaise: 50000n,
                currency: 'INR',
                metadata: { userId: 'usr_ghost_player_that_does_not_exist' }
            }

            await assert.rejects(
                async () => await youPiGatewayBridge.settleDepositFromPaymentSession(dummySession, 'UTR_GHOST_123'),
                /Target player account "usr_ghost_player_that_does_not_exist" not found/
            )
        })
    })

    // ─────────────────────────────────────────────────────────────────────────
    // 💥 5. Circuit Breaker Half-Open & Failover Self-Healing
    // ─────────────────────────────────────────────────────────────────────────
    describe('5. Circuit Breaker Self-Healing & Fallback Recovery', () => {
        test('circuit breaker trips on consecutive errors, then resets and heals after cooldown', async () => {
            const adapter = paymentGatewayManager.getAdapter('youpi')
            assert.ok(adapter)

            // Force circuit trip
            const serverErr = new Error('500 Internal Server Error')
            serverErr.statusCode = 500
            adapter._recordFailure(serverErr)
            adapter._recordFailure(serverErr)
            adapter._recordFailure(serverErr)

            assert.equal(adapter._isCircuitTripped(), true)

            // While tripped, PaymentGatewayManager gracefully falls back to manual adapter
            const active = await paymentGatewayManager.resolveActiveGateway('youpi')
            assert.equal(active.name, 'manual', 'Must smoothly serve fallback while primary circuit is open')

            // Simulate cooldown passage
            adapter.circuitOpenUntil = Date.now() - 1000
            assert.equal(adapter._isCircuitTripped(), false, 'Must move to half-open state after cooldown')

            // Record success to heal
            adapter._recordSuccess()
            assert.equal(adapter.failureCount, 0)
        })
    })

    after(() => {
        if (!isYouPiAvailable) return
        // Clean up chaos sessions
        if (activeAccount) {
            const { PaymentStatus } = youPiGatewayBridge.common
            youPiGatewayBridge.db.execute(
                `UPDATE payment_sessions SET status = ?, completed_at = datetime('now') WHERE receiving_account_id = ? AND status IN (?, ?)`,
                [PaymentStatus.CANCELLED, activeAccount.id, PaymentStatus.ACTIVE, PaymentStatus.QUEUED]
            )
        }
        setTimeout(() => {
            process.exit(0)
        }, 150)
    })
})
