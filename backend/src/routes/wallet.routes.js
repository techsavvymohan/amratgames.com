import express from 'express'
import crypto from 'node:crypto'
import { db } from '../db/db.js'
import { CONFIG } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { broadcastEvent } from '../websocket.js'
import { automatedSettlement } from '../services/AutomatedSettlementService.js'
import { webhookSignatureVerifier } from '../gateways/security/WebhookSignatureVerifier.js'
import { cashierLimiter, sensitiveApiLimiter } from '../middleware/rateLimiter.js'

const router = express.Router()

// GET /api/wallet/balance
router.get('/balance', requireAuth, (req, res) => {
    try {
        const user = db.findUserById(req.user.id)
        const totalDeposited = user?.totalDeposited || 0
        const totalWagered = user?.totalWagered || 0
        const requiredTurnover = totalDeposited
        const remainingTurnover = Math.max(0, parseFloat((requiredTurnover - totalWagered).toFixed(2)))
        const canWithdraw = totalDeposited >= 300 && totalWagered >= requiredTurnover

        res.json({
            success: true,
            balances: user?.balances || { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 },
            totalDeposited,
            totalWagered,
            requiredTurnover,
            remainingTurnover,
            minDepositRequired: 300,
            canWithdraw
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// GET /api/wallet/crypto-deposit-info
router.get('/crypto-deposit-info', requireAuth, (req, res) => {
    try {
        const { currency = 'USDT', network = 'TRC20' } = req.query
        const info = automatedSettlement.getDepositCoordinates(req.user.id, { currency, network })
        res.json({
            success: true,
            ...info
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/wallet/deposit
router.post('/deposit', requireAuth, cashierLimiter, async (req, res) => {
    try {
        const { currency = 'INR', amount, paymentMethod = 'UPI', utrNumber = '' } = req.body
        const parsedAmount = parseFloat(amount)

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid deposit amount required' })
        }
        if (currency === 'INR' && parsedAmount < 100) {
            return res.status(400).json({ success: false, error: 'Minimum deposit amount is ₹100' })
        }

        const user = db.findUserById(req.user.id)
        if (!user) return res.status(404).json({ success: false, error: 'User not found' })

        // Create pending deposit verification request inside mutex lock to prevent concurrent UTR race
        const result = await db.withUserLock(req.user.id, async () => {
            return db.requestDeposit({
                userId: req.user.id,
                currency,
                amount: parsedAmount,
                paymentMethod,
                utrNumber
            })
        })

        res.json({
            success: true,
            status: 'pending',
            message: `Deposit request for ${currency} ${parsedAmount.toLocaleString('en-IN')} submitted! Funds will be credited once verified.`,
            depositId: result.deposit.id,
            deposit: result.deposit,
            transaction: result.transaction
        })
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

// POST /api/wallet/withdraw
router.post('/withdraw', requireAuth, cashierLimiter, async (req, res) => {
    try {
        const { currency = 'INR', amount, payoutDestination, payoutMethod = 'UPI', bankDetails = null } = req.body
        const parsedAmount = parseFloat(amount)

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid withdrawal amount required' })
        }
        if (currency === 'INR' && parsedAmount < 100) {
            return res.status(400).json({ success: false, error: 'Minimum withdrawal amount is ₹100' })
        }
        if (currency === 'INR' && parsedAmount > 200000) {
            return res.status(400).json({ success: false, error: 'Maximum withdrawal per request is ₹2,00,000' })
        }

        // Validate payout destination format
        if (payoutMethod === 'UPI') {
            const cleanDest = String(payoutDestination || '').trim()
            if (!cleanDest || cleanDest.length < 3 || !cleanDest.includes('@')) {
                return res.status(400).json({ success: false, error: 'Please enter a valid UPI ID (e.g. yourname@upi)' })
            }
        } else if (payoutMethod === 'BANK') {
            if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifsc || !bankDetails.holder) {
                return res.status(400).json({ success: false, error: 'Bank account number, IFSC code, and account holder name are required' })
            }
        }

        const result = await db.withUserLock(req.user.id, async () => {
            const user = db.findUserById(req.user.id)
            if (!user) {
                const err = new Error('User not found')
                err.status = 404
                throw err
            }

            // ── Rule 0: Prevent concurrent pending withdrawal spam ──
            const existingPending = (db.data.withdrawals || []).find(w => w.userId === req.user.id && w.status === 'pending')
            if (existingPending) {
                const err = new Error('You already have a withdrawal request under security verification. Please wait for it to be processed before submitting another.')
                err.code = 'CONCURRENT_WITHDRAWAL_BLOCKED'
                err.status = 400
                throw err
            }

            // ── Rule 1: User must deposit minimum ₹300 before requesting any withdrawal ──
            const totalDeposited = user.totalDeposited || 0
            if (totalDeposited < 300) {
                const needed = 300 - totalDeposited
                const err = new Error(`Minimum deposit of ₹300 is required before making a withdrawal. You have currently deposited ₹${totalDeposited}. Please deposit at least ₹${needed} more to activate withdrawals.`)
                err.code = 'MINIMUM_DEPOSIT_REQUIRED'
                err.status = 400
                err.requiredDeposit = 300
                err.currentDeposited = totalDeposited
                err.remainingNeeded = needed
                throw err
            }

            // ── Rule 2: AML 1.0x Wagering Turnover Requirement ──
            const totalWagered = user.totalWagered || 0
            if (totalWagered < totalDeposited) {
                const neededWager = parseFloat((totalDeposited - totalWagered).toFixed(2))
                const err = new Error(`Anti-Money Laundering (AML) Compliance: You must wager at least 1.0x of your total deposits before withdrawing. Wagered: ₹${totalWagered.toLocaleString('en-IN')}, Required: ₹${totalDeposited.toLocaleString('en-IN')}. Remaining turnover: ₹${neededWager.toLocaleString('en-IN')}.`)
                err.code = 'AML_TURNOVER_REQUIRED'
                err.status = 400
                err.requiredTurnover = totalDeposited
                err.currentWagered = totalWagered
                err.remainingTurnover = neededWager
                throw err
            }

            const currentBal = user.balances?.[currency] || 0
            if (parsedAmount > currentBal) {
                const err = new Error(`Insufficient ${currency} balance (Available: ${currency} ${currentBal.toLocaleString('en-IN')})`)
                err.status = 400
                throw err
            }

            const destNote = payoutMethod === 'BANK' && bankDetails
                ? `Bank A/C: ${bankDetails.accountNumber || ''} (${bankDetails.ifsc || ''}) - ${bankDetails.holder || ''}`
                : (payoutDestination || 'Registered UPI')

            const withdrawalResult = db.requestWithdrawal({
                userId: req.user.id,
                currency,
                amount: parsedAmount,
                payoutMethod,
                payoutDestination: destNote,
                bankDetails
            })

            // ── Middle Man Verification & Security Review Queue ──
            // Withdrawals (including profit earnings) are routed to the security middle-man queue.
            // Funds are NOT auto-released without human verification. The user waits 5–10 minutes for verification.
            const evaluation = automatedSettlement.evaluateWithdrawal(
                { currency, amount: parsedAmount, payoutMethod },
                user,
                db.data.withdrawals || []
            )

            let finalWithdrawal = withdrawalResult.withdrawal

            // Enforce middle man review queue
            finalWithdrawal.status = 'pending'
            finalWithdrawal.verificationStatus = 'UNDER_SECURITY_REVIEW'
            finalWithdrawal.estimatedArrival = '5-10 minutes'
            db.persist()

            return {
                ...withdrawalResult,
                withdrawal: finalWithdrawal,
                evaluation,
                instantPayout: false,
                totalDeposited,
                totalWagered
            }
        })

        const statusMsg = `Your withdrawal request of ₹${parsedAmount.toLocaleString('en-IN')} has been placed. Please wait 5–10 minutes for verification.`

        res.json({
            success: true,
            message: statusMsg,
            status: 'pending',
            verificationStatus: 'UNDER_SECURITY_REVIEW',
            instantPayout: false,
            dispatchRef: null,
            estimatedArrival: '5-10 minutes',
            balances: result.user.balances,
            totalDeposited: result.totalDeposited,
            totalWagered: result.totalWagered,
            canWithdraw: true,
            withdrawal: result.withdrawal,
            transaction: result.transaction
        })
    } catch (err) {
        res.status(err.status || 400).json({
            success: false,
            error: err.message,
            code: err.code,
            requiredDeposit: err.requiredDeposit,
            currentDeposited: err.currentDeposited,
            remainingNeeded: err.remainingNeeded,
            requiredTurnover: err.requiredTurnover,
            currentWagered: err.currentWagered,
            remainingTurnover: err.remainingTurnover
        })
    }
})

// GET /api/wallet/withdrawals
router.get('/withdrawals', requireAuth, (req, res) => {
    try {
        const userWithdrawals = db.getAllWithdrawals({ userId: req.user.id })
        res.json({
            success: true,
            withdrawals: userWithdrawals
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// GET /api/wallet/deposits
router.get('/deposits', requireAuth, (req, res) => {
    try {
        const userDeposits = db.getAllDeposits({ userId: req.user.id })
        res.json({
            success: true,
            deposits: userDeposits
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// GET /api/wallet/transactions
router.get('/transactions', requireAuth, (req, res) => {
    try {
        const userTxs = db.data.transactions
            .filter(t => t.userId === req.user.id)
            .sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0))
            .slice(0, 50)

        res.json({
            success: true,
            transactions: userTxs
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/wallet/webhook
// Automated Payment Webhook Handler (Dodo Payments / Razorpay / Custom Gateway)
router.post('/webhook', async (req, res) => {
    try {
        const rawSignature = req.headers['x-webhook-signature'] || req.headers['webhook-signature'] || req.headers['x-signature']
        const secret = CONFIG.DODO_PAYMENTS_WEBHOOK_SECRET
        const authHeader = req.headers['x-api-key'] || req.headers['authorization']
        const adminKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader?.trim()

        // Cryptographic constant-time HMAC-SHA256 signature verification or Admin API key authorization
        if (secret) {
            const payload = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body)
            const verification = webhookSignatureVerifier.verifyHmacSha256(payload, rawSignature, secret)
            if (!verification.valid) {
                return res.status(401).json({ success: false, error: `Invalid or missing cryptographic webhook signature: ${verification.error || 'unauthorized'}` })
            }
        } else if (!adminKey || adminKey !== CONFIG.ADMIN_API_KEY) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Webhook secret not configured and missing valid authorization key'
            })
        }

        // Validate timestamp freshness if timestamp header provided (defense against delayed replays)
        const timestampHeader = req.headers['x-webhook-timestamp'] || req.headers['x-timestamp']
        if (timestampHeader && !webhookSignatureVerifier.isTimestampFresh(timestampHeader)) {
            return res.status(401).json({ success: false, error: 'Webhook rejected: Timestamp expired or skewed beyond tolerance' })
        }

        const event = req.body || {}
        // Derive stable eventId from payload content if gateway lacks explicit id to strictly prevent replay attacks
        const payloadHash = crypto.createHash('sha256').update(req.rawBody ? req.rawBody.toString() : JSON.stringify(event)).digest('hex').slice(0, 16)
        const eventId = event.id || event.eventId || event.payment_id || event.payload?.payment?.id || `evt_${payloadHash}`

        // Idempotency check: strictly eliminate replay attacks and double crediting
        if (db.isWebhookProcessed(eventId)) {
            return res.json({ success: true, duplicate: true, message: 'Webhook event already processed' })
        }

        const eventType = event.type || event.event || 'payment.succeeded'
        const paymentData = event.data || event.payload?.payment?.entity || event

        if (eventType === 'payment.succeeded' || eventType === 'payment_successful' || eventType === 'deposit.completed') {
            const userId = paymentData.metadata?.userId || paymentData.userId || paymentData.customer_id
            const amount = parseFloat(paymentData.amount || paymentData.total_amount || 0)
            const currency = paymentData.currency || 'INR'
            const utrNumber = paymentData.utrNumber || paymentData.acquirer_data?.rrn || paymentData.id || ''

            if (!userId || isNaN(amount) || amount <= 0) {
                return res.status(400).json({ success: false, error: 'Invalid webhook payload: userId and positive amount required' })
            }

            const result = await db.withUserLock(userId, async () => {
                const user = db.findUserById(userId)
                if (!user) throw new Error('Target player account not found')

                // 1. Credit balance legitimately & capture linked ledger transaction
                const balResult = db.updateUserBalance(userId, currency, amount, `Automated Gateway Deposit (Ref: ${utrNumber})`)

                // 2. Accumulate totalDeposited in INR equivalent (unlocking withdrawal qualification)
                const curr = String(currency || 'INR').toUpperCase()
                let depositInr = amount
                if (curr === 'USDT') depositInr = amount * 90.0
                else if (curr === 'BTC') depositInr = amount * 8500000.0
                else if (curr === 'AMRAT') depositInr = 0

                user.totalDeposited = parseFloat(((user.totalDeposited || 0) + depositInr).toFixed(2))

                // 3. Record completed deposit record in db with linked transactionId
                const depositRecord = {
                    id: 'dep_gw_' + Date.now().toString(36),
                    transactionId: balResult?.transaction?.id || null,
                    userId,
                    username: user.username,
                    currency,
                    amount,
                    paymentMethod: 'GATEWAY_WEBHOOK',
                    utrNumber,
                    status: 'completed',
                    createdAt: new Date().toISOString(),
                    approvedAt: new Date().toISOString(),
                    approvedBy: 'SYSTEM_WEBHOOK'
                }
                if (balResult?.transaction) {
                    balResult.transaction.depositId = depositRecord.id
                }

                if (!db.data.deposits) db.data.deposits = []
                db.data.deposits.unshift(depositRecord)
                db.persist()

                // Durable outbox synchronization for Supabase cloud hydration
                if (db.durableOutbox) {
                    db.durableOutbox.enqueue('syncUser', user)
                    if (balResult?.transaction) db.durableOutbox.enqueue('syncTransaction', balResult.transaction)
                    db.durableOutbox.enqueue('syncDeposit', depositRecord)
                }

                broadcastEvent('DEPOSIT_STATUS_UPDATED', depositRecord)
                return { user, deposit: depositRecord }
            })

            // Mark webhook as processed in idempotency ledger
            db.markWebhookProcessed(eventId)

            return res.json({
                success: true,
                message: `Successfully processed deposit webhook for user ${userId}`,
                depositId: result.deposit.id,
                balances: result.user.balances
            })
        }

        db.markWebhookProcessed(eventId)
        res.json({ success: true, message: `Ignored unhandled webhook event: ${eventType}` })
    } catch (err) {
        console.error('[WEBHOOK ERROR]', err)
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/wallet/crypto-webhook
// Autonomous Blockchain Ingress & Instant Settlement Webhook (Protected via HMAC signature or shared secret)
router.post('/crypto-webhook', async (req, res) => {
    try {
        const rawSignature = req.headers['x-webhook-signature'] || req.headers['x-crypto-signature'] || req.headers['x-signature']
        const authHeader = req.headers['x-api-key'] || req.headers['authorization']
        const secret = CONFIG.CRYPTO_WEBHOOK_SECRET

        let isAuthorized = false

        // 1. Check API Key / Bearer Token authorization
        if (authHeader) {
            const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim()
            if (token && secret && token.length === secret.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
                isAuthorized = true
            } else if (token === CONFIG.ADMIN_API_KEY) {
                isAuthorized = true
            }
        }

        // 2. Check HMAC-SHA256 signature if provided
        if (!isAuthorized && rawSignature && secret) {
            const payload = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body)
            const verification = webhookSignatureVerifier.verifyHmacSha256(payload, rawSignature, secret)
            if (verification.valid) {
                isAuthorized = true
            }
        }

        if (!isAuthorized) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Invalid or missing crypto webhook signature or authorization token'
            })
        }

        const result = await automatedSettlement.processCryptoDepositWebhook(req.body, db)
        res.json({ success: true, ...result })
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

export default router

