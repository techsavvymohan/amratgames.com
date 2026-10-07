import express from 'express'
import { db } from '../db/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// GET /api/wallet/balance
router.get('/balance', requireAuth, (req, res) => {
    try {
        const user = db.findUserById(req.user.id)
        const totalDeposited = user?.totalDeposited || 0
        res.json({
            success: true,
            balances: user?.balances || { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 },
            totalDeposited,
            minDepositRequired: 300,
            canWithdraw: totalDeposited >= 300
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

        const depositNote = utrNumber 
            ? `Deposit via ${paymentMethod} (UTR: ${utrNumber})`
            : `Deposit via ${paymentMethod}`

        const result = db.updateUserBalance(
            req.user.id,
            currency,
            parsedAmount,
            depositNote
        )

        // Attach UTR to transaction record if provided
        if (utrNumber && result?.transaction) {
            result.transaction.utrNumber = utrNumber
            db.persist()
        }

        // Accumulate user's total deposits
        const newTotalDeposit = parseFloat(((user.totalDeposited || 0) + parsedAmount).toFixed(2))
        db.updateUser(user.id, { totalDeposited: newTotalDeposit })

        res.json({
            success: true,
            message: `Deposited ${currency} ${parsedAmount.toLocaleString('en-IN')} successfully!`,
            balances: result.user.balances,
            totalDeposited: newTotalDeposit,
            canWithdraw: newTotalDeposit >= 300,
            transaction: result.transaction
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/wallet/withdraw
router.post('/withdraw', requireAuth, (req, res) => {
    try {
        const { currency = 'INR', amount, payoutDestination, payoutMethod = 'UPI', bankDetails = null } = req.body
        const parsedAmount = parseFloat(amount)

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid withdrawal amount required' })
        }

        const user = db.findUserById(req.user.id)
        if (!user) return res.status(404).json({ success: false, error: 'User not found' })

        // ── Rule: User must deposit minimum ₹300 before requesting any withdrawal ──
        const totalDeposited = user.totalDeposited || 0
        if (totalDeposited < 300) {
            const needed = 300 - totalDeposited
            return res.status(400).json({
                success: false,
                error: `Minimum deposit of ₹300 is required before making a withdrawal. You have currently deposited ₹${totalDeposited}. Please deposit at least ₹${needed} more to activate withdrawals.`,
                code: 'MINIMUM_DEPOSIT_REQUIRED',
                requiredDeposit: 300,
                currentDeposited: totalDeposited,
                remainingNeeded: needed
            })
        }

        const currentBal = user.balances?.[currency] || 0
        if (parsedAmount > currentBal) {
            return res.status(400).json({
                success: false,
                error: `Insufficient ${currency} balance (Available: ${currency} ${currentBal.toLocaleString('en-IN')})`
            })
        }

        const destNote = payoutMethod === 'BANK' && bankDetails
            ? `Bank A/C: ${bankDetails.accountNumber || ''} (${bankDetails.ifsc || ''}) - ${bankDetails.holder || ''}`
            : (payoutDestination || 'Registered UPI')

        const result = db.requestWithdrawal({
            userId: req.user.id,
            currency,
            amount: parsedAmount,
            payoutMethod,
            payoutDestination: destNote,
            bankDetails
        })

        res.json({
            success: true,
            message: `Withdrawal request for ${currency} ${parsedAmount.toLocaleString('en-IN')} submitted successfully! Your request is pending admin cashier review.`,
            balances: result.user.balances,
            totalDeposited,
            canWithdraw: true,
            withdrawal: result.withdrawal,
            transaction: result.transaction
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
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
