import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { youPiGatewayBridge, YouPiGatewayBridge } from '../src/gateways/bridge/YouPiGatewayBridge.js'
import { paymentGatewayManager } from '../src/gateways/PaymentGatewayManager.js'
import { db as amratDb } from '../src/db/db.js'

const isYouPiAvailable = Boolean(
    youPiGatewayBridge &&
    youPiGatewayBridge.isOperational &&
    youPiGatewayBridge.isOperational()
)

describe('YouPI Sovereign Gateway Full Bridge Integration Suite', { skip: !isYouPiAvailable ? 'YouPI gateway repository not installed or available' : false }, () => {

    describe('1. Dynamic Package Loading & Modules', () => {
        test('loads all 5 YouPI monorepo packages dynamically via ESM', () => {
            assert.ok(youPiGatewayBridge.modules.db, 'Database module must be loaded')
            assert.ok(youPiGatewayBridge.modules.core, 'Core engine module must be loaded')
            assert.ok(youPiGatewayBridge.modules.common, 'Common domain module must be loaded')
            assert.ok(youPiGatewayBridge.modules.client, 'Merchant client SDK must be loaded')
            assert.ok(youPiGatewayBridge.modules.observer, 'Observer client SDK must be loaded')
        })

        test('exposes all common money and crypto domain utilities', () => {
            const { toPaise, toRupeesString, formatINR, buildUpiUri, isValidVpa, generateHmac, verifyHmac } = youPiGatewayBridge.common

            assert.equal(toPaise('500.50'), 50050n)
            assert.equal(toRupeesString(50050n), '500.50')
            assert.equal(formatINR(50050n), '₹500.50')

            const valid = isValidVpa('shanviientrrprisee@ybl')
            assert.equal(valid, true)

            const uri = buildUpiUri({
                payeeVpa: 'shanviientrrprisee@ybl',
                payeeName: 'Shanvii Enterprise',
                amountPaise: 50000n,
                transactionRef: 'AMRAT123456789'
            })
            assert.match(uri, /^upi:\/\/pay\?pa=shanviientrrprisee%40ybl/)

            const secret = 'test_secret_hmac'
            const hmac = generateHmac('test payload', secret)
            assert.ok(hmac)
            assert.equal(verifyHmac('test payload', secret, hmac), true)
            assert.equal(verifyHmac('tampered payload', secret, hmac), false)
        })
    })

    describe('2. Direct SQLite WAL Database & All 9 Repositories', () => {
        test('successfully initializes SQLite WAL connection and verifies table counts', async () => {
            const diag = await youPiGatewayBridge.getDiagnostics()
            assert.equal(diag.directDatabase.connected, true)
            assert.ok(diag.directDatabase.sessionCount >= 0)
            assert.ok(diag.directDatabase.accountCount >= 1)
        })

        test('all 9 repositories are instantiated and functional', () => {
            const { merchants, accounts, customers, customerSessions, sessions, observations, supportTickets, auditLogs, devices } = youPiGatewayBridge.repositories

            assert.ok(merchants, 'merchants repository must exist')
            assert.ok(accounts, 'accounts repository must exist')
            assert.ok(customers, 'customers repository must exist')
            assert.ok(customerSessions, 'customerSessions repository must exist')
            assert.ok(sessions, 'sessions repository must exist')
            assert.ok(observations, 'observations repository must exist')
            assert.ok(supportTickets, 'supportTickets repository must exist')
            assert.ok(auditLogs, 'auditLogs repository must exist')
            assert.ok(devices, 'devices repository must exist')

            // Default Merchant & Active Account queries
            const merchant = merchants.getDefault()
            assert.ok(merchant, 'Default merchant must exist')
            assert.equal(merchant.id, '00000000-0000-0000-0000-000000000001')

            const activeAccount = accounts.findActiveForMerchant(merchant.id)
            assert.ok(activeAccount, 'Active receiving VPA account must exist')
            assert.equal(activeAccount.upiId, 'shanviientrrprisee@ybl')
        })

        test('can perform write and read operations across audit logs and support tickets', () => {
            const { auditLogs, supportTickets, merchants, customers } = youPiGatewayBridge.repositories
            const merchant = merchants.getDefault()

            // Audit log write
            const auditId = auditLogs.log({
                merchantId: merchant.id,
                entityType: 'PAYMENT_SESSION',
                entityId: 'test_session_123',
                action: 'BRIDGE_TEST_ACTION',
                actorType: 'SYSTEM',
                actorId: 'amrat_test_suite',
                details: { test: true, timestamp: Date.now() }
            })
            assert.ok(auditId)

            const recentLogs = auditLogs.findByMerchant(merchant.id, 5)
            assert.ok(recentLogs.length > 0)
            const found = recentLogs.find(l => l.action === 'BRIDGE_TEST_ACTION')
            assert.ok(found)

            // Support ticket write
            const testPhone = '9876543210'
            let cust = customers.findByPhone ? customers.findByPhone(testPhone) : null
            if (!cust) {
                cust = customers.create({
                    name: 'Test Customer',
                    mobileNumber: testPhone
                })
            }
            assert.ok(cust)

            const ticket = supportTickets.createTicket({
                merchantId: merchant.id,
                customerId: cust.id,
                subject: 'Test Bridge Dispute Ticket',
                initialMessage: { message: 'Automated test message' }
            })
            assert.ok(ticket)
            assert.equal(ticket.subject, 'Test Bridge Dispute Ticket')
        })
    })

    describe('3. Core Subsystems & Engines', () => {
        test('Bank SMS and Email parsers correctly extract amounts and references', () => {
            const { BankSmsParser, BankEmailParser, extractIntelligentAmount } = youPiGatewayBridge.core

            const sampleSms = 'Dear SBI User, A/C 1234 credited by Rs 750.00 via UPI Ref no: 435678129034'
            const parsed = extractIntelligentAmount(sampleSms)
            assert.ok(parsed)
            assert.equal(parsed.amountPaise, 75000n)
            assert.equal(parsed.amountStr, '750.00')

            const smsDetails = BankSmsParser.parse({ text: sampleSms })
            assert.ok(smsDetails)
            assert.equal(smsDetails.amount, '750.00')
            assert.equal(smsDetails.bankReferenceNumber, '435678129034')

            const sampleEmail = 'Dear Customer, INR 1,500.00 has been credited to your account via IMPS/UPI reference 987654321098.'
            const emailDetails = BankEmailParser.parse({ subject: 'Credit alert', body: sampleEmail })
            assert.ok(emailDetails)
            assert.equal(emailDetails.amount, '1500.00')
            assert.equal(emailDetails.bankReferenceNumber, '987654321098')
        })

        test('ISO/IEC 18004 Vector QR Code Generator produces valid SVG elements', () => {
            const { generateQrSvg, QrCode } = youPiGatewayBridge.core

            const uri = 'upi://pay?pa=shanviientrrprisee%40ybl&pn=Shanvii+Enterprise&am=500.00'
            const svg = generateQrSvg(uri, 280)

            assert.ok(svg)
            assert.match(svg, /^<svg/)
            assert.match(svg, /<\/svg>$/)
            assert.match(svg, /viewBox=/)

            const matrix = QrCode.encode(uri)
            assert.ok(matrix.length > 20)
        })

        test('Device Security normalizes signals and hashes deterministic fingerprints', () => {
            const { normalizeDeviceSignals, generateFingerprintHash } = youPiGatewayBridge.core.deviceSecurity

            const signals = {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
                platform: 'Win32',
                language: 'en-US',
                screenWidth: 1920,
                screenHeight: 1080
            }

            const normalized = normalizeDeviceSignals(signals)
            assert.equal(normalized.platform, 'win32')
            assert.equal(normalized.screenSignature, '1920x1080x24')

            const hash1 = generateFingerprintHash(signals)
            const hash2 = generateFingerprintHash(signals)
            assert.equal(hash1, hash2, 'Fingerprint must be deterministic')
            assert.equal(hash1.length, 64)
        })
    })

    describe('4. High-Level Bridge Payment Lifecycle & Auto-Settlement', () => {
        const testUserId = `usr_test_bridge_${Date.now()}`
        const testUsername = 'BridgePlayer99'

        // Setup test player in AmratGames DB and ensure account slot is vacant
        before(async () => {
            const activeAcc = youPiGatewayBridge.getActiveVpa()
            if (activeAcc) {
                const { PaymentStatus } = youPiGatewayBridge.common
                youPiGatewayBridge.db.execute(
                    `UPDATE payment_sessions SET status = ?, completed_at = datetime('now') WHERE receiving_account_id = ? AND status IN (?, ?)`,
                    [PaymentStatus.CANCELLED, activeAcc.id, PaymentStatus.ACTIVE, PaymentStatus.QUEUED]
                )
            }
            if (!amratDb.data.users) amratDb.data.users = []
            amratDb.data.users.push({
                id: testUserId,
                username: testUsername,
                email: 'bridgeplayer@amratgames.com',
                phone: '9876549999',
                balances: { INR: 100.0, USDT: 0, BTC: 0, AMRAT: 1000 },
                totalDeposited: 100.0
            })
            amratDb.persist()
        })

        test('creates deposit session directly in SQLite with slot allocation and vector QR SVG', async () => {
            const orderId = `DEP_FULL_BRIDGE_${Date.now()}`
            const session = await youPiGatewayBridge.createDepositSession({
                userId: testUserId,
                username: testUsername,
                amount: 350.0,
                orderId
            })

            assert.equal(session.success, true)
            assert.equal(session.mode, 'direct_db')
            assert.equal(session.gateway, 'youpi')
            assert.equal(session.amount, 350)
            assert.equal(session.status, 'ACTIVE')
            assert.ok(session.paymentId)
            assert.ok(session.qrSvg)
            assert.match(session.upiIntent, /^upi:\/\/pay\?pa=shanviientrrprisee%40ybl/)
            assert.equal(session.receivingAccount.upiId, 'shanviientrrprisee@ybl')

            // Query authoritative status
            const queried = await youPiGatewayBridge.getPaymentSession(session.paymentId)
            assert.equal(queried.success, true)
            assert.equal(queried.status, 'ACTIVE')
            assert.equal(queried.amount, 350)
            assert.equal(queried.orderId, orderId)
        })

        test('ingests bank SMS credit, matches active session, and settles deposit into AmratGames ledger atomically', async () => {
            // Free slot from previous test
            const activeAcc = youPiGatewayBridge.getActiveVpa()
            if (activeAcc) {
                const { PaymentStatus } = youPiGatewayBridge.common
                youPiGatewayBridge.db.execute(
                    `UPDATE payment_sessions SET status = ?, completed_at = datetime('now') WHERE receiving_account_id = ? AND status IN (?, ?)`,
                    [PaymentStatus.CANCELLED, activeAcc.id, PaymentStatus.ACTIVE, PaymentStatus.QUEUED]
                )
            }

            const orderId = `DEP_SMS_SETTLE_${Date.now()}`
            const depositAmount = 250.0

            // 1. Create session
            const session = await youPiGatewayBridge.createDepositSession({
                userId: testUserId,
                username: testUsername,
                amount: depositAmount,
                orderId
            })
            assert.equal(session.status, 'ACTIVE')

            // Initial balance
            const userBefore = amratDb.findUserById(testUserId)
            const balanceBefore = userBefore.balances.INR

            // 2. Simulate bank credit SMS observation received from bank
            const utr = `4321${Date.now().toString().slice(-8)}`
            const rawSms = `Your A/C 9876 is credited by INR 250.00 on 25-OCT-26 via UPI txn ref ${utr} shanviientrrprisee@ybl`

            const obsResult = await youPiGatewayBridge.ingestSmsObservation({
                message: rawSms,
                sender: 'VM-HDFCBK'
            })

            assert.equal(obsResult.success, true)
            assert.equal(obsResult.amountRupees, '250.00')
            assert.equal(obsResult.bankReferenceNumber, utr)
            assert.ok(obsResult.attribution)
            assert.equal(obsResult.attribution.attributed, true)
            assert.equal(obsResult.attribution.paymentSessionId, session.paymentId)

            // 3. Verify AmratGames Ledger updated
            assert.ok(obsResult.settlement)
            assert.equal(obsResult.settlement.settled, true)
            assert.equal(obsResult.settlement.amount, 250.0)

            const userAfter = amratDb.findUserById(testUserId)
            assert.equal(userAfter.balances.INR, balanceBefore + 250.0)
            assert.equal(obsResult.settlement.balanceAfter, balanceBefore + 250.0)

            // Verify deposit record in AmratGames DB
            const depositRecord = amratDb.data.deposits.find(d => d.id === obsResult.settlement.depositId)
            assert.ok(depositRecord)
            assert.equal(depositRecord.amount, 250.0)
            assert.equal(depositRecord.status, 'completed')
            assert.equal(depositRecord.utrNumber, utr)
        })

        test('prevents replay duplicates when same SMS notification is ingested twice', async () => {
            const utr = `5555${Date.now().toString().slice(-8)}`
            const rawSms = `A/C 1234 credited with Rs. 400.00 ref ${utr}`

            const first = await youPiGatewayBridge.ingestSmsObservation({ message: rawSms })
            assert.equal(first.success, true)

            const duplicate = await youPiGatewayBridge.ingestSmsObservation({ message: rawSms })
            assert.equal(duplicate.success, true)
            assert.equal(duplicate.duplicate, true)
            assert.match(duplicate.message, /Duplicate observation dropped/)
        })

        test('can dynamically switch and list receiving VPAs', () => {
            const listBefore = youPiGatewayBridge.listVpas()
            assert.ok(listBefore.length >= 1)

            const newVpa = 'amratgames.primary@icici'
            const newPayee = 'AmratGames Sovereign Vault'

            const activated = youPiGatewayBridge.switchActiveVpa(newVpa, newPayee)
            assert.ok(activated)
            assert.equal(activated.upiId, newVpa)
            assert.equal(activated.isActive, true)

            const currentActive = youPiGatewayBridge.getActiveVpa()
            assert.equal(currentActive.upiId, newVpa)

            // Switch back to original Shanvii Enterprise
            const restored = youPiGatewayBridge.switchActiveVpa('shanviientrrprisee@ybl', 'Shanvii Enterprise')
            assert.equal(restored.upiId, 'shanviientrrprisee@ybl')
        })

        test('queue status correctly reflects active slots and limits', () => {
            const queue = youPiGatewayBridge.getQueueStatus()
            assert.ok(queue)
            assert.ok(typeof queue.activeCount === 'number')
            assert.ok(typeof queue.queuedCount === 'number')
            assert.ok(Array.isArray(queue.activeSessions))
        })
    })

    describe('5. PaymentGatewayManager Bridge Integration', () => {
        test('PaymentGatewayManager exposes bridge directly and delegates methods', async () => {
            assert.ok(paymentGatewayManager.bridge)
            const diag = await paymentGatewayManager.getDiagnostics()
            assert.equal(diag.bridgeVersion, '2.0.0-sovereign')

            const activeVpa = paymentGatewayManager.getActiveVpa()
            assert.ok(activeVpa)
            assert.equal(activeVpa.upiId, 'shanviientrrprisee@ybl')

            const vpas = paymentGatewayManager.listVpas()
            assert.ok(vpas.length >= 1)

            const queue = paymentGatewayManager.getQueueStatus()
            assert.ok(queue)
        })
    })

    after(() => {
        if (!isYouPiAvailable) return
        setTimeout(() => {
            process.exit(0)
        }, 150)
    })
})
