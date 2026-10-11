// =============================================================================
// 👑 AmratGames.com — Automated Settlement & Instant Payout Service
// Pillar 3: Automated Settlement Rails & Hot-Wallet Infrastructure
// =============================================================================

import crypto from 'node:crypto'
import { CONFIG } from '../config.js'
import { broadcastEvent } from '../websocket.js'

export class AutomatedSettlementService {
    constructor() {
        // Instant automated payout limits (anything below threshold is auto-disbursed)
        this.instantPayoutThresholds = {
            INR: 10000.00,  // Up to ₹10,000 auto-approved and dispatched instantly
            USDT: 120.00,   // Up to $120 USDT auto-approved
            BTC: 0.0015,    // Up to 0.0015 BTC
            AMRAT: 1000.00  // Up to 1,000 AMRAT
        }

        // Velocity guardrails: maximum instant payouts per 24h rolling window
        this.maxDailyAutoPayoutCount = 3
        this.maxDailyAutoPayoutAmount = 25000.00 // ₹25,000 max cumulative instant auto-payouts/day

        // Master Hot/Cold Settlement Vaults
        this.vaultAddresses = {
            USDT_TRC20: process.env.CRYPTO_RECEIVER_USDT_TRC20 || 'TYDndL5m6Ea41bVpC89pX5R62LMNb7gUo1',
            USDT_TON: process.env.CRYPTO_RECEIVER_TON || 'EQBvW8m54HM5UfL8Z-p-kP_z16C4_p66p6N1gK8k8k8k8k8k',
            USDT_BEP20: process.env.CRYPTO_RECEIVER_USDT_BEP20 || CONFIG.CRYPTO_RECEIVER_USDT,
            BTC: CONFIG.CRYPTO_RECEIVER_BTC
        }

        // Crypto conversion peg for display and auto-crediting
        this.exchangeRates = {
            USDT: 90.00,       // 1 USDT = ₹90 INR
            TON: 500.00,       // 1 TON = ₹500 INR
            BTC: 8500000.00    // 1 BTC = ₹85,00,000 INR
        }
    }

    /**
     * Get deterministic crypto deposit coordinates for a player
     * Enables autonomous, un-freezable deposit ingress without third-party bank freeze risk
     */
    getDepositCoordinates(userId, { currency = 'USDT', network = 'TRC20' } = {}) {
        const curr = String(currency).toUpperCase()
        const net = String(network).toUpperCase()
        const userTag = 'AG-' + crypto.createHash('sha256').update(`${userId}:amrat_settlement`).digest('hex').slice(0, 8).toUpperCase()

        let vaultKey = `${curr}_${net}`
        if (!this.vaultAddresses[vaultKey]) {
            vaultKey = curr === 'BTC' ? 'BTC' : 'USDT_TRC20'
        }

        const address = this.vaultAddresses[vaultKey] || this.vaultAddresses.USDT_TRC20
        const minDepositUsdt = 5.00
        const minDepositInr = 450.00

        // Create standard payment URI / QR payload
        let qrPayload = ''
        if (net === 'TRC20') {
            qrPayload = `tron:${address}?memo=${userTag}`
        } else if (net === 'TON') {
            qrPayload = `ton://transfer/${address}?text=${userTag}`
        } else {
            qrPayload = address
        }

        return {
            currency: curr,
            network: net,
            address,
            memoTag: userTag,
            qrPayload,
            minDeposit: curr === 'USDT' ? minDepositUsdt : 0.0001,
            minDepositInr,
            rateInr: this.exchangeRates[curr] || 90.00,
            instructions: `Send ${curr} (${net}) to the address above. You MUST include Memo/Tag: ${userTag} for instant zero-confirmation balance crediting.`,
            confirmationsRequired: 1,
            estimatedTimeSeconds: 45
        }
    }

    /**
     * Evaluate withdrawal request against automated qualification and risk heuristics
     * Returns whether the request is:
     * 1. REJECTED (Hard AML / balance / deposit failure)
     * 2. AUTO_APPROVED (Eligible for sub-60-second autonomous instant settlement)
     * 3. MANUAL_REVIEW (High value or elevated risk score routed to multi-sig cashier)
     */
    evaluateWithdrawal(withdrawalParams, user, pastWithdrawals = []) {
        const { currency = 'INR', amount } = withdrawalParams
        const parsedAmount = parseFloat(amount)
        const curr = String(currency).toUpperCase()

        const totalDeposited = user?.totalDeposited || 0
        const totalWagered = user?.totalWagered || 0

        // 1. Hard AML & Lifetime Deposit Gate
        if (totalDeposited < 300) {
            return {
                qualified: false,
                canProceed: false,
                reason: 'MIN_DEPOSIT_REQUIRED',
                error: `Minimum lifetime deposit of ₹300 required before withdrawing (Deposited: ₹${totalDeposited}).`
            }
        }

        if (totalWagered < totalDeposited) {
            const remaining = parseFloat((totalDeposited - totalWagered).toFixed(2))
            return {
                qualified: false,
                canProceed: false,
                reason: 'AML_TURNOVER_REQUIRED',
                error: `Anti-Money Laundering (AML) turnover not met. Must wager ₹${remaining} more.`
            }
        }

        // 2. Velocity Check: Count successful or approved auto-payouts in last 24 hours
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000
        const recentUserPayouts = pastWithdrawals.filter(w =>
            w.userId === user.id &&
            (w.status === 'approved' || w.status === 'completed') &&
            new Date(w.createdAt || w.processedAt || 0).getTime() > twentyFourHoursAgo
        )

        const recentAmountSum = recentUserPayouts.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0)

        if (recentUserPayouts.length >= this.maxDailyAutoPayoutCount) {
            return {
                qualified: true,
                instantPayout: false,
                status: 'pending',
                reason: 'VELOCITY_LIMIT_EXCEEDED',
                reviewReason: 'Exceeded maximum 3 automated withdrawals per 24 hours. Queued for standard cashier review.',
                eta: '15-30 minutes'
            }
        }

        if ((recentAmountSum + parsedAmount) > this.maxDailyAutoPayoutAmount) {
            return {
                qualified: true,
                instantPayout: false,
                status: 'pending',
                reason: 'DAILY_AMOUNT_CAP_EXCEEDED',
                reviewReason: 'Exceeded cumulative ₹25,000 automated daily limit. Queued for standard cashier review.',
                eta: '15-30 minutes'
            }
        }

        // 3. Fraud & Risk Score Check
        const antiSybilScore = user.antiSybilRiskScore || 0
        if (antiSybilScore >= 25 || user.isFlagged) {
            return {
                qualified: true,
                instantPayout: false,
                status: 'pending',
                reason: 'RISK_SCORE_ELEVATED',
                reviewReason: `Account risk score elevated (${antiSybilScore}/100). Routed to compliance cashier review.`,
                eta: '15-30 minutes'
            }
        }

        // 4. Threshold Check for Autonomous Settlement
        const maxThreshold = this.instantPayoutThresholds[curr] || this.instantPayoutThresholds.INR

        if (parsedAmount <= maxThreshold) {
            const dispatchRef = 'APO_' + crypto.randomBytes(6).toString('hex').toUpperCase()
            return {
                qualified: true,
                instantPayout: true,
                status: 'approved',
                reason: 'AUTO_APPROVED_LOW_RISK',
                reviewReason: 'Qualified for Autonomous Instant Settlement Rail (Sub-60s Execution)',
                dispatchRef,
                payoutRail: withdrawalParams.payoutMethod === 'BANK' ? 'IMPS_HIGH_SPEED' : 'UPI_AUTONOMOUS_RAIL',
                eta: 'Instant (60 seconds)'
            }
        }

        // High Roller Tier: Legitimate but exceeds instant auto-payout threshold
        return {
            qualified: true,
            instantPayout: false,
            status: 'pending',
            reason: 'HIGH_VALUE_THRESHOLD',
            reviewReason: `Withdrawal of ${curr} ${parsedAmount.toLocaleString('en-IN')} exceeds instant ₹${maxThreshold.toLocaleString('en-IN')} threshold. Queued for priority cashier dispatch.`,
            eta: '10-20 minutes'
        }
    }

    /**
     * Dispatch automated instant payout: updates withdrawal record and ledger
     */
    dispatchInstantPayout(withdrawal, database, evaluation) {
        if (!withdrawal || !database) return null

        withdrawal.status = 'approved'
        withdrawal.processedAt = new Date().toISOString()
        withdrawal.processedBy = 'SYSTEM_AUTO_SETTLEMENT'
        withdrawal.transactionRef = evaluation.dispatchRef || ('APO_' + crypto.randomBytes(6).toString('hex').toUpperCase())
        withdrawal.adminNote = `⚡ Autonomous Instant Settlement Dispatched (${evaluation.payoutRail || 'HIGH_SPEED_RAIL'}). Ref: ${withdrawal.transactionRef}`

        // Update ledger transaction record
        const tx = (database.data.transactions || []).find(t => t.id === withdrawal.transactionId || t.withdrawalId === withdrawal.id)
        if (tx) {
            tx.status = 'approved'
            tx.note = `Withdrawal Auto-Dispatched to ${withdrawal.payoutDestination} [Ref: ${withdrawal.transactionRef}]`
        }

        database.persist()

        if (CONFIG.USE_SUPABASE && database.durableOutbox && tx) {
            database.durableOutbox.enqueue('syncTransaction', tx)
        }

        broadcastEvent('WITHDRAWAL_STATUS_UPDATED', withdrawal)
        return withdrawal
    }

    /**
     * Process incoming automated crypto deposit webhook
     * Deduplicates via txHash and instantly credits the user
     */
    async processCryptoDepositWebhook(payload, database) {
        const { txHash, network = 'TRC20', currency = 'USDT', amount, memoTag } = payload
        const parsedAmount = parseFloat(amount)

        if (!txHash || !parsedAmount || parsedAmount <= 0) {
            throw new Error('Valid txHash and positive amount required')
        }

        // Check idempotency
        const eventKey = `crypto_${network}_${txHash}`
        if (database.isWebhookProcessed(eventKey)) {
            return { duplicate: true, message: 'Transaction already processed' }
        }

        // Locate user by memo tag or userId in metadata
        let targetUser = null
        if (memoTag) {
            targetUser = (database.data.users || []).find(u => {
                const userTag = 'AG-' + crypto.createHash('sha256').update(`${u.id}:amrat_settlement`).digest('hex').slice(0, 8).toUpperCase()
                return userTag.toUpperCase() === String(memoTag).trim().toUpperCase()
            })
        }

        if (!targetUser && payload.userId) {
            targetUser = database.findUserById(payload.userId)
        }

        if (!targetUser) {
            throw new Error(`Target player account not found for memo tag ${memoTag}`)
        }

        return await database.withUserLock(targetUser.id, async () => {
            const user = database.findUserById(targetUser.id)
            if (!user) throw new Error('Player account locked or missing')

            // Calculate INR equivalent if crediting INR balance, or credit USDT directly
            const targetCurrency = payload.creditCurrency === 'INR' ? 'INR' : (currency || 'USDT')
            const creditAmount = targetCurrency === 'INR'
                ? parseFloat((parsedAmount * (this.exchangeRates[currency] || 90.00)).toFixed(2))
                : parsedAmount

            // 1. Credit balance
            database.updateUserBalance(
                user.id,
                targetCurrency,
                creditAmount,
                `Instant Crypto Deposit (${currency} ${parsedAmount} via ${network} [Tx: ${txHash.slice(0, 10)}...])`
            )

            // 2. Increment lifetime deposited
            const depositInrEquiv = targetCurrency === 'INR'
                ? creditAmount
                : parseFloat((parsedAmount * (this.exchangeRates[currency] || 90.00)).toFixed(2))

            user.totalDeposited = parseFloat(((user.totalDeposited || 0) + depositInrEquiv).toFixed(2))

            // 3. Record completed deposit record in database
            const depositRecord = {
                id: 'dep_crypto_' + Date.now().toString(36),
                userId: user.id,
                username: user.username,
                currency: targetCurrency,
                amount: creditAmount,
                paymentMethod: `CRYPTO_${network}`,
                utrNumber: txHash,
                status: 'completed',
                createdAt: new Date().toISOString(),
                approvedAt: new Date().toISOString(),
                approvedBy: 'SYSTEM_BLOCKCHAIN_INGRESS'
            }

            if (!database.data.deposits) database.data.deposits = []
            database.data.deposits.unshift(depositRecord)
            database.persist()

            // Mark event processed
            database.markWebhookProcessed(eventKey)

            broadcastEvent('DEPOSIT_STATUS_UPDATED', depositRecord)

            return {
                success: true,
                user,
                deposit: depositRecord,
                creditedAmount: creditAmount,
                currency: targetCurrency
            }
        })
    }
}

export const automatedSettlement = new AutomatedSettlementService()
