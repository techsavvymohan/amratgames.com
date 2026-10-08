import express from 'express'
import { db } from '../db/db.js'
import { requireAuth } from '../middleware/auth.js'

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

// POST /api/wallet/deposit
router.post('/deposit', requireAuth, (req, res) => {
    try {
        const { currency = 'INR', amount, paymentMethod = 'UPI', utrNumber = '' } = req.body
        const parsedAmount = parseFloat(amount)

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid deposit amount required' })
        }

        const user = db.findUserById(req.user.id)
        if (!user) return res.status(404).json({ success: false, error: 'User not found' })

        // Create pending deposit verification request — NO instant balance credit
        const { deposit, transaction } = db.requestDeposit({
            userId: req.user.id,
            currency,
            amount: parsedAmount,
            paymentMethod,
            utrNumber
        })

        res.json({
            success: true,
            status: 'pending',
            message: `Deposit request for ${currency} ${parsedAmount.toLocaleString('en-IN')} submitted! Funds will be credited once verified.`,
            depositId: deposit.id,
            deposit,
            transaction
        })
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

// POST /api/wallet/withdraw
router.post('/withdraw', requireAuth, async (req, res) => {
    try {
        const { currency = 'INR', amount, payoutDestination, payoutMethod = 'UPI', bankDetails = null } = req.body
        const parsedAmount = parseFloat(amount)

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid withdrawal amount required' })
        }

        const result = await db.withUserLock(req.user.id, async () => {
            const user = db.findUserById(req.user.id)
            if (!user) {
                const err = new Error('User not found')
                err.status = 404
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

            return {
                ...withdrawalResult,
                totalDeposited,
                totalWagered
            }
        })

        res.json({
            success: true,
            message: `Withdrawal request for ${currency} ${parsedAmount.toLocaleString('en-IN')} submitted successfully! Your request is pending admin cashier review.`,
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

export default router
