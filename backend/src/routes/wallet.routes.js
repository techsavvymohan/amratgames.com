import express from 'express'
import { db } from '../db/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// GET /api/wallet/balance
router.get('/balance', requireAuth, (req, res) => {
    try {
        const user = db.findUserById(req.user.id)
        res.json({
            success: true,
            balances: user.balances || { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 }
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/wallet/deposit
router.post('/deposit', requireAuth, (req, res) => {
    try {
        const { currency = 'INR', amount, paymentMethod = 'UPI' } = req.body
        const parsedAmount = parseFloat(amount)

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid deposit amount required' })
        }

        const result = db.updateUserBalance(
            req.user.id,
            currency,
            parsedAmount,
            `Deposit via ${paymentMethod}`
        )

        res.json({
            success: true,
            message: `Deposited ${currency} ${parsedAmount.toLocaleString()} successfully!`,
            balances: result.user.balances,
            transaction: result.transaction
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/wallet/withdraw
router.post('/withdraw', requireAuth, (req, res) => {
    try {
        const { currency = 'INR', amount, payoutDestination } = req.body
        const parsedAmount = parseFloat(amount)

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid withdrawal amount required' })
        }

        const user = db.findUserById(req.user.id)
        const currentBal = user.balances?.[currency] || 0

        if (parsedAmount > currentBal) {
            return res.status(400).json({ success: false, error: `Insufficient ${currency} balance` })
        }

        const result = db.updateUserBalance(
            req.user.id,
            currency,
            -parsedAmount,
            `Withdrawal to ${payoutDestination || 'Registered UPI / Address'}`
        )

        res.json({
            success: true,
            message: `Withdrawal request for ${currency} ${parsedAmount.toLocaleString()} submitted successfully!`,
            balances: result.user.balances,
            transaction: result.transaction
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
