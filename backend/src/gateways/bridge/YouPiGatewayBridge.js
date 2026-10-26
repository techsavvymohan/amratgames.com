import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { EventEmitter } from 'node:events'
import { db as amratDb } from '../../db/db.js'
import { broadcastEvent } from '../../websocket.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Dynamically locate the youpi-pg repository root directory.
 */
function resolveYouPiRoot() {
    const candidates = [
        process.env.YOUPI_PG_ROOT,
        path.resolve(__dirname, '../../../../../gateway-service/youpi-pg'),
        path.resolve(__dirname, '../../../../gateway-service/youpi-pg'),
        path.resolve(process.cwd(), '../gateway-service/youpi-pg'),
        path.resolve(process.cwd(), '../../gateway-service/youpi-pg'),
        path.resolve(process.cwd(), 'gateway-service/youpi-pg')
    ].filter(Boolean)

    for (const candidate of candidates) {
        if (fs.existsSync(path.join(candidate, 'package.json')) && fs.existsSync(path.join(candidate, 'packages/db'))) {
            return candidate
        }
    }
    // Default fallback
    return process.env.YOUPI_PG_ROOT || path.resolve(__dirname, '../../../../../gateway-service/youpi-pg')
}

const YOUPI_ROOT = resolveYouPiRoot()
const DB_PACKAGE_INDEX = pathToFileURL(path.join(YOUPI_ROOT, 'packages/db/src/index.js')).href
const CORE_PACKAGE_INDEX = pathToFileURL(path.join(YOUPI_ROOT, 'packages/core/src/index.js')).href
const COMMON_PACKAGE_INDEX = pathToFileURL(path.join(YOUPI_ROOT, 'packages/common/src/index.js')).href
const CLIENT_SDK_INDEX = pathToFileURL(path.join(YOUPI_ROOT, 'packages/merchant-sdk/src/client.js')).href
const OBSERVER_SDK_INDEX = pathToFileURL(path.join(YOUPI_ROOT, 'packages/observer-sdk/src/index.js')).href

// Dynamically import all YouPI packages via ESM if repository exists
let youpiDbModule = null
let youpiCoreModule = null
let youpiCommonModule = null
let youpiClientModule = null
let youpiObserverModule = null

if (fs.existsSync(path.join(YOUPI_ROOT, 'packages/db/src/index.js'))) {
    try {
        youpiDbModule = await import(DB_PACKAGE_INDEX)
        youpiCoreModule = await import(CORE_PACKAGE_INDEX)
        youpiCommonModule = await import(COMMON_PACKAGE_INDEX)
        youpiClientModule = await import(CLIENT_SDK_INDEX)
        try {
            youpiObserverModule = await import(OBSERVER_SDK_INDEX)
        } catch (e) {
            console.warn('[YouPiGatewayBridge] Observer SDK optional load note:', e.message)
        }
    } catch (loadErr) {
        console.warn('[YouPiGatewayBridge] Warning: Could not eagerly import YouPI packages:', loadErr.message)
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 👑 AmratGames.com — Sovereign YouPI-PG Gateway Bridge
 * ═══════════════════════════════════════════════════════════════════════════
 * Unified Full-Spectrum Bridge connecting AmratGames backend to the YouPI-PG
 * payment gateway repository. Exposes all database repositories, core queue/attribution
 * engines, bank SMS/email parsers, 6-stage anti-fraud verification pipeline,
 * vector QR generation, observer SDK, and merchant HTTP SDK.
 */
export class YouPiGatewayBridge {
    /**
     * @param {Object} [options]
     * @param {string} [options.dbPath] - Path to youpi_pg.sqlite
     * @param {string} [options.baseUrl] - Base URL of YouPI Payment API
     * @param {string} [options.checkoutUrl] - Base URL of YouPI Checkout Portal
     * @param {string} [options.merchantId] - Canonical merchant UUID
     * @param {string} [options.webhookSecret] - Shared HMAC secret
     * @param {boolean} [options.inMemory=false] - In-memory SQLite for testing
     */
    constructor(options = {}) {
        this.rootPath = YOUPI_ROOT
        this.dbPath = options.dbPath || process.env.YOUPI_SQLITE_PATH || path.resolve(YOUPI_ROOT, 'data/youpi_pg.sqlite')
        this.baseUrl = options.baseUrl || process.env.YOUPI_PG_BASE_URL || 'http://localhost:6100'
        this.checkoutUrl = options.checkoutUrl || process.env.YOUPI_PG_CHECKOUT_URL || 'http://localhost:7000'
        this.merchantId = options.merchantId || process.env.YOUPI_PG_MERCHANT_ID || '00000000-0000-0000-0000-000000000001'
        this.webhookSecret = options.webhookSecret || process.env.YOUPI_PG_WEBHOOK_SECRET || 'amrat_youpi_webhook_sec_489201948201'
        this.inMemory = Boolean(options.inMemory)

        // Event Emitter for Real-Time Payment Events
        this.eventEmitter = new EventEmitter()

        // Expose Raw Modules
        this.modules = {
            db: youpiDbModule,
            core: youpiCoreModule,
            common: youpiCommonModule,
            client: youpiClientModule,
            observer: youpiObserverModule
        }

        // Direct Database & Repositories
        this.db = null
        this.repositories = {}

        // Core Engines & Pipelines
        this.core = {}

        // Common Domain Utilities
        this.common = youpiCommonModule || {}

        // SDK Clients
        this.client = null
        this.observerClient = null

        this._initBridge()
    }

    _initBridge() {
        if (!youpiDbModule) return

        try {
            const {
                Database,
                ensureDatabaseInitialized,
                MerchantRepository,
                ReceivingAccountRepository,
                CustomerRepository,
                CustomerSessionRepository,
                PaymentSessionRepository,
                ObservationRepository,
                SupportTicketRepository,
                AuditLogRepository,
                DeviceRepository
            } = youpiDbModule

            // Connect to SQLite WAL DB
            this.db = new Database({
                dbPath: this.inMemory ? undefined : this.dbPath,
                inMemory: this.inMemory
            })
            ensureDatabaseInitialized(this.db)

            // Instantiating all 9 database repositories
            const customerRepo = new CustomerRepository(this.db)
            this.repositories = {
                merchants: new MerchantRepository(this.db),
                accounts: new ReceivingAccountRepository(this.db),
                customers: customerRepo,
                customerSessions: new CustomerSessionRepository(this.db, customerRepo),
                sessions: new PaymentSessionRepository(this.db),
                observations: new ObservationRepository(this.db),
                supportTickets: new SupportTicketRepository(this.db),
                auditLogs: new AuditLogRepository(this.db),
                devices: new DeviceRepository(this.db)
            }

            // Instantiating Core Engines & Pipelines
            if (youpiCoreModule) {
                const {
                    QueueEngine,
                    TimingEngine,
                    AttributionEngine,
                    RecoveryEngine,
                    WebhookEngine,
                    PaymentVerificationPipeline,
                    BankSmsParser,
                    BankEmailParser,
                    QrCode,
                    generateQrSvg,
                    generateQrMatrix,
                    extractIntelligentAmount,
                    extractIntelligentPaise,
                    ObservationNormalizer,
                    normalizeDeviceSignals,
                    generateFingerprintHash,
                    importDevicePublicKey,
                    verifyDeviceSignature,
                    isValidTransition,
                    canTransitionPaymentStatus,
                    assertValidTransition
                } = youpiCoreModule

                const queueEngine = new QueueEngine({
                    sessionRepo: this.repositories.sessions,
                    accountRepo: this.repositories.accounts,
                    eventEmitter: this.eventEmitter,
                    auditRepo: this.repositories.auditLogs
                })

                const timingEngine = new TimingEngine({
                    sessionRepo: this.repositories.sessions,
                    queueEngine,
                    eventEmitter: this.eventEmitter,
                    auditRepo: this.repositories.auditLogs,
                    activeDurationMs: 300000,
                    processingDurationMs: 30000
                })

                const attributionEngine = new AttributionEngine({
                    sessionRepo: this.repositories.sessions,
                    obsRepo: this.repositories.observations,
                    ticketRepo: this.repositories.supportTickets,
                    auditRepo: this.repositories.auditLogs,
                    eventEmitter: this.eventEmitter
                })

                const recoveryEngine = new RecoveryEngine({
                    db: this.db,
                    sessionRepo: this.repositories.sessions,
                    accountRepo: this.repositories.accounts,
                    queueEngine,
                    timingEngine,
                    auditRepo: this.repositories.auditLogs
                })

                const webhookEngine = new WebhookEngine({
                    db: this.db,
                    merchantRepo: this.repositories.merchants
                })

                const verificationPipeline = new PaymentVerificationPipeline({
                    db: this.db,
                    sessionRepo: this.repositories.sessions,
                    obsRepo: this.repositories.observations,
                    customerRepo: this.repositories.customers,
                    attributionEngine,
                    auditRepo: this.repositories.auditLogs,
                    merchantRepo: this.repositories.merchants,
                    eventEmitter: this.eventEmitter
                })

                const safeExtractIntelligentAmount = (text) => {
                    if (!text || typeof text !== 'string') return null
                    if (/(?:^|[^\w.])-\s*[\d,]+(?:\.\d+)?/.test(text)) return null
                    return extractIntelligentAmount(text)
                }

                this.core = {
                    queueEngine,
                    timingEngine,
                    attributionEngine,
                    recoveryEngine,
                    webhookEngine,
                    verificationPipeline,
                    BankSmsParser,
                    BankEmailParser,
                    QrCode,
                    generateQrSvg,
                    generateQrMatrix,
                    extractIntelligentAmount: safeExtractIntelligentAmount,
                    extractIntelligentPaise,
                    ObservationNormalizer,
                    deviceSecurity: {
                        normalizeDeviceSignals,
                        generateFingerprintHash,
                        importDevicePublicKey,
                        verifyDeviceSignature
                    },
                    stateMachine: {
                        isValidTransition,
                        canTransitionPaymentStatus,
                        assertValidTransition
                    }
                }
            }

            // Instantiating Merchant SDK Client
            if (youpiClientModule?.YoupiPaymentClient) {
                this.client = new youpiClientModule.YoupiPaymentClient({
                    apiUrl: this.baseUrl,
                    merchantId: this.merchantId,
                    webhookSecret: this.webhookSecret
                })
            }

            // Instantiating Observer SDK Client
            if (youpiObserverModule?.PaymentObserverClient) {
                this.observerClient = new youpiObserverModule.PaymentObserverClient({
                    apiBaseUrl: this.baseUrl,
                    sourceName: 'AMRAT_INTERNAL_OBSERVER'
                })
            }
        } catch (err) {
            console.error('[YouPiGatewayBridge] Bridge initialization failed:', err.message)
        }
    }

    /**
     * Checks if the YouPI sovereign gateway packages and direct database are loaded and operational.
     * @returns {boolean}
     */
    isOperational() {
        return Boolean(this.modules.db && this.modules.core && this.db)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 👑 1. Sovereign Payment Session Lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Creates a deposit checkout session.
     * Uses direct in-process database allocation with ISO/IEC 18004 Vector SVG QR generation
     * and automatic slot queuing, falling back to HTTP if preferred.
     */
    async createDepositSession(params) {
        const {
            userId,
            username = 'AmratGames Player',
            amount,
            currency = 'INR',
            orderId = `DEP_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            returnUrl,
            customer = {},
            metadata = {}
        } = params

        const parsedAmount = parseFloat(amount)
        if (isNaN(parsedAmount) || parsedAmount < 100) {
            throw new Error('Minimum deposit amount is ₹100')
        }
        if (parsedAmount > 500000) {
            throw new Error('Maximum deposit limit per transaction is ₹5,00,000')
        }

        // Try HTTP API if explicitly configured and reachable
        if (this.client && params.preferHttp) {
            try {
                const httpRes = await this.client.createPayment({
                    orderId,
                    amount: parsedAmount.toFixed(2),
                    currency,
                    returnUrl,
                    customer: {
                        phoneNumber: customer.phoneNumber || customer.phone || '9876543210',
                        fullName: customer.name || username
                    },
                    metadata: { userId, username, ...metadata }
                })
                return {
                    success: true,
                    mode: 'http',
                    gateway: 'youpi',
                    orderId: httpRes.orderId || orderId,
                    paymentId: httpRes.paymentId,
                    amount: parsedAmount,
                    amountPaise: httpRes.amountPaise || String(Math.round(parsedAmount * 100)),
                    currency,
                    status: httpRes.status || 'INITIATED',
                    checkoutUrl: httpRes.checkoutUrl || `${this.checkoutUrl}/checkout/${httpRes.paymentId}`,
                    raw: httpRes
                }
            } catch (err) {
                console.warn(`[YouPiGatewayBridge] HTTP createPayment failed: ${err.message}. Seamlessly falling back to direct in-process DB allocation.`)
            }
        }

        // Direct In-Process SQLite & Core Engine Allocation
        if (!this.repositories.sessions || !this.repositories.accounts) {
            throw new Error('YouPI database repositories are not initialized')
        }

        const { toPaise, buildUpiUri, PaymentStatus } = this.common
        const { generateQrSvg } = this.core

        const merchant = this.repositories.merchants.getDefault() || {
            id: this.merchantId,
            businessName: 'AmratGames India'
        }

        const activeAccount = this.repositories.accounts.findActiveForMerchant(merchant.id)
        if (!activeAccount) {
            throw new Error('No active merchant receiving VPA configured in YouPI PG')
        }

        const amountPaise = toPaise(parsedAmount.toFixed(2))
        const paymentId = 'pay_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
        const txnRef = `AMRAT${orderId.replace(/[^a-zA-Z0-9]/g, '').slice(-12)}`

        // Build authentic ISO/IEC 18004 Vector QR & UPI Intent URI
        const upiUri = buildUpiUri({
            payeeVpa: activeAccount.upiId,
            payeeName: activeAccount.payeeName,
            amountPaise,
            transactionRef: txnRef,
            transactionNote: `Deposit #${orderId} on AmratGames`
        })

        const qrSvg = generateQrSvg ? generateQrSvg(upiUri, 280) : null

        // Persist session to YouPI SQLite DB
        const now = new Date()
        const sessionRecord = this.repositories.sessions.create({
            id: paymentId,
            merchantId: merchant.id,
            receivingAccountId: activeAccount.id,
            orderId,
            amountPaise,
            currency,
            status: PaymentStatus.INITIATED,
            method: 'UPI',
            bankReferenceNumber: null,
            returnUrl: returnUrl || `${this.checkoutUrl}/return?orderId=${orderId}`,
            metadata: { userId, username, orderId, ...metadata },
            createdAt: now
        })

        // Slot Acquisition & FIFO Queue Assignment
        const slotResult = this.core.queueEngine.enqueueOrActivate(paymentId, activeAccount.id, 300000)
        if (slotResult.status === PaymentStatus.ACTIVE && this.core.timingEngine) {
            this.core.timingEngine.startActiveTimer(paymentId, slotResult.expiresAt)
        }

        const checkoutUrl = `${this.checkoutUrl}/checkout/${paymentId}`

        return {
            success: true,
            mode: 'direct_db',
            gateway: 'youpi',
            orderId,
            paymentId,
            amount: parsedAmount,
            amountPaise: String(amountPaise),
            currency,
            status: slotResult.status,
            queuePosition: slotResult.queuePosition || 0,
            receivingAccount: {
                upiId: activeAccount.upiId,
                payeeName: activeAccount.payeeName
            },
            upiIntent: upiUri,
            qrSvg,
            checkoutUrl,
            expiresAt: slotResult.expiresAt?.toISOString() || null
        }
    }

    /**
     * Queries payment status and full session details.
     */
    async getPaymentSession(paymentId) {
        if (!paymentId) throw new Error('paymentId is required')

        if (this.repositories.sessions) {
            const session = this.repositories.sessions.findById(paymentId)
            if (session) {
                return {
                    success: true,
                    session,
                    status: session.status,
                    amount: Number(session.amountPaise) / 100,
                    orderId: session.orderId,
                    utr: session.bankReferenceNumber
                }
            }
        }

        if (this.client) {
            try {
                const httpRes = await this.client.getPayment(paymentId)
                return { success: true, session: httpRes, status: httpRes.status }
            } catch (e) {
                // Ignore and fall through
            }
        }

        return { success: false, error: `Payment session "${paymentId}" not found` }
    }

    /**
     * Lists recent payment sessions matching optional filter criteria.
     */
    listSessions(options = {}) {
        if (!this.repositories.sessions) return []
        const { limit = 50, status = null } = options
        if (status === 'QUEUED') {
            return this.repositories.sessions.findQueuedSessions(this.getActiveVpa()?.id)
        }
        return this.repositories.sessions.findByMerchantId(this.merchantId, limit)
    }

    /**
     * Explicitly cancels an active or queued payment session, freeing the concurrency slot.
     */
    async cancelPaymentSession(paymentId) {
        if (!paymentId) throw new Error('paymentId is required')

        if (this.repositories.sessions) {
            const session = this.repositories.sessions.findById(paymentId)
            if (session) {
                const { PaymentStatus } = this.common
                this.repositories.sessions.transitionToTerminal(paymentId, PaymentStatus.CANCELLED)
                if (this.core.queueEngine) {
                    this.core.queueEngine.promoteNext(session.receivingAccountId)
                }
                return { success: true, status: PaymentStatus.CANCELLED }
            }
        }

        return { success: false, error: 'Payment session not found' }
    }

    /**
     * Explicitly expires an active session.
     */
    async expirePaymentSession(paymentId) {
        if (!paymentId) throw new Error('paymentId is required')

        if (this.repositories.sessions) {
            const session = this.repositories.sessions.findById(paymentId)
            if (session) {
                const { PaymentStatus } = this.common
                this.repositories.sessions.transitionToTerminal(paymentId, PaymentStatus.EXPIRED)
                if (this.core.queueEngine) {
                    this.core.queueEngine.promoteNext(session.receivingAccountId)
                }
                return { success: true, status: PaymentStatus.EXPIRED }
            }
        }

        return { success: false, error: 'Payment session not found' }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 👑 2. Bank Ingestion, Attribution & Automated Settlement
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Ingests a raw bank SMS credit notification, parses the amount and UTR,
     * matches it against active payment sessions, and triggers automated credit settlement!
     */
    async ingestSmsObservation({ message, sender = 'VM-HDFCBK', timestamp = new Date(), receivingAccountId = null, runFullPipeline = false }) {
        if (!message) throw new Error('SMS message text is required')
        if (!this.core.extractIntelligentAmount || !this.repositories.observations) {
            throw new Error('Core attribution engine is not initialized')
        }

        const account = receivingAccountId
            ? this.repositories.accounts.findById(receivingAccountId)
            : this.repositories.accounts.findActiveForMerchant(this.merchantId)

        if (!account) {
            throw new Error('No receiving account found for attribution')
        }

        // If runFullPipeline is requested, invoke the 6-stage VerificationPipeline
        if (runFullPipeline && this.core.verificationPipeline) {
            const pipelineResult = await this.core.verificationPipeline.process({
                source: 'SMS',
                rawText: message,
                sender,
                receivingAccountId: account.id,
                receivedAt: new Date(timestamp)
            })

            let settlement = null
            if (pipelineResult.finalStatus === 'VERIFIED' && pipelineResult.session) {
                settlement = await this.settleDepositFromPaymentSession(
                    pipelineResult.session,
                    pipelineResult.parsed?.bankReferenceNumber || pipelineResult.session.bankReferenceNumber
                )
            }

            return {
                success: true,
                mode: 'verification_pipeline',
                pipeline: pipelineResult,
                settlement
            }
        }

        // Ignore pure debits or non-credit notifications
        if (/(debited|withdrawn|sent rs|paid rs)/i.test(message) && !/(credited|received|deposit)/i.test(message)) {
            return { success: false, parsed: false, error: 'SMS message is a debit alert, not a credit alert' }
        }

        let parsedAmount = null
        let extractedUtr = null

        if (this.core.BankSmsParser?.parse) {
            const parsedSms = this.core.BankSmsParser.parse({ text: message, sender, timestamp })
            if (parsedSms) {
                parsedAmount = { amountStr: parsedSms.amount, amountPaise: parsedSms.amountPaise }
                extractedUtr = parsedSms.bankReferenceNumber
            }
        }

        if (!parsedAmount) {
            parsedAmount = this.core.extractIntelligentAmount(message)
        }

        if (!parsedAmount || parsedAmount.amountPaise <= 0n) {
            return { success: false, parsed: false, error: 'Could not extract valid credit amount from SMS text' }
        }

        // Derive deterministic fingerprint to prevent replay duplicates
        const cleanText = message.trim().toLowerCase()
        const crypto = await import('node:crypto')
        const fingerprint = crypto.createHash('sha256').update(`${account.id}:${cleanText}:${parsedAmount.amountPaise}`).digest('hex')

        const existing = this.repositories.observations.findByFingerprint(fingerprint)
        if (existing) {
            return { success: true, duplicate: true, observationId: existing.id, message: 'Duplicate observation dropped' }
        }

        // Extract UTR reference if present
        const utrMatch = message.match(/\b(\d{12})\b/) || message.match(/ref(?:erence)?(?:\s*no)?[:\s]+([a-zA-Z0-9]+)/i)
        const bankReferenceNumber = extractedUtr || (utrMatch ? (utrMatch[1] || utrMatch[2]) : null)

        const { ObserverSource, ObservationAttributionStatus } = this.common
        const observationSource = ObserverSource?.SMS_GATEWAY || 'SMS_GATEWAY'

        const observationData = {
            receivingAccountId: account.id,
            source: observationSource,
            amountPaise: parsedAmount.amountPaise,
            observedAt: new Date(timestamp),
            senderVpa: sender,
            bankReferenceNumber,
            fingerprintHash: fingerprint,
            rawPayload: { message, sender, timestamp },
            attributionStatus: ObservationAttributionStatus.UNATTRIBUTED
        }

        let attributionResult = null
        let observationId = null

        if (this.core.attributionEngine) {
            attributionResult = this.core.attributionEngine.processObservation(observationData)
            observationId = attributionResult.observationId
        } else {
            const obsRecord = this.repositories.observations.create(observationData)
            observationId = obsRecord.id
        }

        // If successfully attributed, settle the deposit on AmratGames!
        let settlementResult = null
        if (attributionResult && attributionResult.attributed && attributionResult.paymentSessionId) {
            const session = this.repositories.sessions.findById(attributionResult.paymentSessionId)
            if (session) {
                settlementResult = await this.settleDepositFromPaymentSession(session, bankReferenceNumber || observationId)
            }
        }

        return {
            success: true,
            observationId,
            amountRupees: (Number(parsedAmount.amountPaise) / 100).toFixed(2),
            bankReferenceNumber,
            attribution: attributionResult,
            settlement: settlementResult
        }
    }

    /**
     * Ingests a bank email notification (e.g. from HDFC/ICICI alert).
     */
    async ingestEmailObservation({ subject = '', body = '', sender = 'alerts@hdfcbank.net', timestamp = new Date(), receivingAccountId = null }) {
        if (!body && !subject) throw new Error('Email body or subject is required')

        const fullText = `${subject}\n${body}`
        return await this.ingestSmsObservation({
            message: fullText,
            sender,
            timestamp,
            receivingAccountId
        })
    }

    /**
     * Executes the comprehensive 6-stage anti-fraud verification pipeline.
     */
    async verifyPayment(observationPayload) {
        if (!this.core.verificationPipeline) {
            throw new Error('VerificationPipeline is not initialized')
        }
        return await this.core.verificationPipeline.process(observationPayload)
    }

    /**
     * Settles an attributed payment session into the AmratGames player ledger atomically.
     */
    async settleDepositFromPaymentSession(session, utrNumber = '') {
        const userId = session.metadata?.userId
        if (!userId) {
            console.warn(`[YouPiGatewayBridge] Payment session ${session.id} lacks metadata.userId; cannot auto-credit.`)
            return { settled: false, reason: 'NO_USER_ID' }
        }

        const amountRupees = Number(session.amountPaise) / 100
        const effectiveUtr = utrNumber || session.bankReferenceNumber || session.id

        return await amratDb.withUserLock(userId, async () => {
            const user = amratDb.findUserById(userId)
            if (!user) {
                throw new Error(`Target player account "${userId}" not found in AmratGames DB`)
            }

            const balResult = amratDb.updateUserBalance(
                userId,
                session.currency || 'INR',
                amountRupees,
                `Instant UPI Deposit [YOUPI-PG] (Ref: ${effectiveUtr})`
            )

            user.totalDeposited = parseFloat(((user.totalDeposited || 0) + amountRupees).toFixed(2))

            const depositRecord = {
                id: 'dep_youpi_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                transactionId: balResult?.transaction?.id || null,
                userId,
                username: user.username,
                currency: session.currency || 'INR',
                amount: amountRupees,
                paymentMethod: 'YOUPI_SOVEREIGN_UPI',
                utrNumber: effectiveUtr,
                status: 'completed',
                createdAt: new Date().toISOString(),
                approvedAt: new Date().toISOString(),
                approvedBy: 'SYSTEM_YOUPI_BRIDGE'
            }

            if (!amratDb.data.deposits) amratDb.data.deposits = []
            amratDb.data.deposits.unshift(depositRecord)
            amratDb.persist()

            // Real-time broadcast
            broadcastEvent('DEPOSIT_STATUS_UPDATED', depositRecord)

            return {
                settled: true,
                depositId: depositRecord.id,
                userId,
                amount: amountRupees,
                balanceAfter: balResult.user?.balances?.[session.currency || 'INR'] ?? balResult.transaction?.balanceAfter
            }
        })
    }

    /**
     * Runs queue reconciliation and stale session recovery.
     */
    recoverStaleSessions() {
        if (!this.core.recoveryEngine) return { recovered: 0 }
        return this.core.recoveryEngine.recover()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 👑 3. Receiving VPA & Merchant Account Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Retrieves the current active VPA for the default merchant.
     */
    getActiveVpa() {
        if (!this.repositories.accounts) return null
        return this.repositories.accounts.findActiveForMerchant(this.merchantId)
    }

    /**
     * Lists all receiving accounts / VPAs configured in YouPI PG.
     */
    listVpas() {
        if (!this.repositories.accounts) return []
        return this.repositories.accounts.findByMerchantId(this.merchantId)
    }

    /**
     * Dynamically switches the active receiving VPA in YouPI database.
     */
    switchActiveVpa(upiId, payeeName) {
        if (!this.repositories.accounts) throw new Error('Account repository unavailable')
        if (!upiId || !payeeName) throw new Error('upiId and payeeName are required')

        const existingAccounts = this.repositories.accounts.findByMerchantId(this.merchantId)
        let targetAccount = existingAccounts.find(a => a.upiId.toLowerCase() === upiId.toLowerCase().trim())

        if (targetAccount) {
            return this.repositories.accounts.activateAccount(this.merchantId, targetAccount.id)
        } else {
            return this.repositories.accounts.create({
                merchantId: this.merchantId,
                upiId: upiId.trim(),
                payeeName: payeeName.trim(),
                isActive: true,
                isMerchantEnabled: true
            })
        }
    }

    /**
     * Creates a new receiving account VPA.
     */
    createVpa(data) {
        if (!this.repositories.accounts) throw new Error('Account repository unavailable')
        return this.repositories.accounts.create({
            merchantId: this.merchantId,
            upiId: data.upiId.trim(),
            payeeName: data.payeeName.trim(),
            dailyLimitPaise: data.dailyLimitPaise || 50000000n,
            perTransactionLimitPaise: data.perTransactionLimitPaise || 20000000n,
            isActive: Boolean(data.isActive),
            isMerchantEnabled: true
        })
    }

    /**
     * Deactivates a receiving account.
     */
    deactivateVpa(accountId) {
        if (!this.repositories.accounts) throw new Error('Account repository unavailable')
        return this.repositories.accounts.update(accountId, { isActive: false })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 👑 4. Devices, Support & Queue Observability
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Lists registered observer devices.
     */
    listDevices() {
        if (!this.repositories.devices) return []
        return this.repositories.devices.findByMerchantId(this.merchantId)
    }

    /**
     * Registers an observer device in YouPI PG.
     */
    registerDevice(deviceData) {
        if (!this.repositories.devices) throw new Error('Device repository unavailable')
        return this.repositories.devices.create({
            merchantId: this.merchantId,
            ...deviceData
        })
    }

    /**
     * Lists pending support tickets.
     */
    listSupportTickets() {
        if (!this.repositories.supportTickets) return []
        return this.repositories.supportTickets.listPending()
    }

    /**
     * Retrieves queue concurrency metrics for the active account.
     */
    getQueueStatus(accountId) {
        const targetAccountId = accountId || this.getActiveVpa()?.id
        if (!targetAccountId || !this.repositories.sessions) {
            return { activeCount: 0, queuedCount: 0, activeSessions: [], queuedSessions: [] }
        }
        const active = this.repositories.sessions.findCurrentActiveOrProcessing(targetAccountId)
        const queued = this.repositories.sessions.findQueuedSessions(targetAccountId) || []
        const activeSessions = active ? [{ id: active.id, orderId: active.orderId, amount: Number(active.amountPaise) / 100 }] : []
        const queuedSessions = queued.map(s => ({ id: s.id, orderId: s.orderId, amount: Number(s.amountPaise) / 100 }))
        return {
            accountId: targetAccountId,
            activeCount: activeSessions.length,
            queuedCount: queuedSessions.length,
            activeSessions,
            queuedSessions
        }
    }

    /**
     * Retrieves recent audit logs.
     */
    getAuditLogs(limit = 20) {
        if (!this.repositories.auditLogs) return []
        return this.repositories.auditLogs.findByMerchant(this.merchantId, limit)
    }

    /**
     * Returns full diagnostic metrics of the payment gateway bridge.
     */
    async getDiagnostics() {
        let isHttpAvailable = false
        if (this.client) {
            try {
                const res = await fetch(`${this.baseUrl}/api/v1/health`, { signal: AbortSignal.timeout(1000) })
                isHttpAvailable = res.ok
            } catch {}
        }

        let dbStats = { connected: false }
        if (this.db) {
            try {
                const sessionCount = this.db.queryOne('SELECT count(*) as count FROM payment_sessions')?.count || 0
                const obsCount = this.db.queryOne('SELECT count(*) as count FROM payment_observations')?.count || 0
                const accountCount = this.db.queryOne('SELECT count(*) as count FROM payment_receiving_accounts')?.count || 0
                const deviceCount = this.db.queryOne('SELECT count(*) as count FROM devices')?.count || 0
                const ticketCount = this.db.queryOne('SELECT count(*) as count FROM support_tickets')?.count || 0

                dbStats = {
                    connected: true,
                    path: this.dbPath,
                    sessionCount: Number(sessionCount),
                    observationCount: Number(obsCount),
                    accountCount: Number(accountCount),
                    deviceCount: Number(deviceCount),
                    ticketCount: Number(ticketCount)
                }
            } catch (err) {
                dbStats = { connected: false, error: err.message }
            }
        }

        const activeAccount = this.getActiveVpa()

        return {
            bridgeVersion: '2.0.0-sovereign',
            youPiRoot: this.rootPath,
            directDatabase: dbStats,
            httpMicroservice: {
                configuredUrl: this.baseUrl,
                available: isHttpAvailable
            },
            activeVpa: activeAccount ? {
                id: activeAccount.id,
                upiId: activeAccount.upiId,
                payeeName: activeAccount.payeeName,
                isActive: Boolean(activeAccount.isActive)
            } : null,
            merchantId: this.merchantId,
            webhookSecretConfigured: Boolean(this.webhookSecret),
            engines: {
                queue: Boolean(this.core.queueEngine),
                timing: Boolean(this.core.timingEngine),
                attribution: Boolean(this.core.attributionEngine),
                recovery: Boolean(this.core.recoveryEngine),
                verificationPipeline: Boolean(this.core.verificationPipeline),
                parsers: {
                    sms: Boolean(this.core.BankSmsParser),
                    email: Boolean(this.core.BankEmailParser)
                },
                qr: Boolean(this.core.generateQrSvg)
            }
        }
    }
}

export const youPiGatewayBridge = new YouPiGatewayBridge()
export default youPiGatewayBridge
