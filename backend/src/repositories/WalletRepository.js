import crypto from 'node:crypto'
import { BaseRepository } from './BaseRepository.js'
import { CONFIG } from '../config.js'
import { broadcastEvent } from '../websocket.js'
import { isFakeOrDemoUser } from '../admin-panel/utils/userFilter.js'

/**
 * 💳 WalletRepository
 * Handles player balance mutations, deposit/withdrawal lifecycles, UTR deduplication, and token treasury.
 */
export class WalletRepository extends BaseRepository {
    updateUserBalance(userId, currency, delta, note = '') {
        const user = this.db.findUserById(userId)
        if (!user) return null
        if (!user.balances) user.balances = { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 }

        const curr = String(currency || 'INR').toUpperCase()
        const precision = curr === 'BTC' ? 8 : (curr === 'USDT' ? 4 : 2)
        const currentBal = user.balances[currency] || 0
        const newBal = Math.max(0, parseFloat((currentBal + delta).toFixed(precision)))
        user.balances[currency] = newBal

        // Accumulate totalWagered on game bet deductions (AML Turnover tracking)
        if (delta < 0 && typeof note === 'string' && /(bet|launch|mines|crash|wager)/i.test(note)) {
            const wagerAmount = Math.abs(delta)
            // 🛡️ Only real currencies count towards AML deposit turnover
            if (curr === 'INR') {
                user.totalWagered = parseFloat(((user.totalWagered || 0) + wagerAmount).toFixed(2))
            } else if (curr === 'USDT') {
                user.totalWagered = parseFloat(((user.totalWagered || 0) + (wagerAmount * 90.0)).toFixed(2))
            } else if (curr === 'BTC') {
                user.totalWagered = parseFloat(((user.totalWagered || 0) + (wagerAmount * 8500000.0)).toFixed(2))
            }
            this.db.accumulateWagerRewards(user, wagerAmount, currency)
        }

        // Record transaction
        const tx = {
            id: 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            userId,
            username: user.username,
            type: delta >= 0 ? 'credit' : 'debit',
            currency,
            amount: delta,
            balanceAfter: newBal,
            note: note || 'Admin Adjustment',
            timestamp: new Date().toISOString()
        }
        this.data.transactions.unshift(tx)
        if (this.data.transactions.length > 5000) {
            this.data.transactions = this.data.transactions.slice(0, 5000)
        }
        this.updateTreasurySupply()
        this.persist()

        this.enqueueOutbox('syncUser', user)
        this.enqueueOutbox('syncTransaction', tx)

        return { user, transaction: tx }
    }

    requestWithdrawal({ userId, currency = 'INR', amount, payoutMethod = 'UPI', payoutDestination, bankDetails = null }) {
        const user = this.db.findUserById(userId)
        if (!user) throw new Error('User not found')
        if (!user.balances) user.balances = { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 }

        const currentBal = user.balances[currency] || 0
        if (amount > currentBal) {
            throw new Error(`Insufficient ${currency} balance (Available: ₹${currentBal.toLocaleString('en-IN')})`)
        }

        const curr = String(currency || 'INR').toUpperCase()
        const precision = curr === 'BTC' ? 8 : (curr === 'USDT' ? 4 : 2)
        const newBal = Math.max(0, parseFloat((currentBal - amount).toFixed(precision)))
        user.balances[currency] = newBal

        const withdrawalId = 'wd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
        const txId = 'tx_wd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

        const tx = {
            id: txId,
            userId: user.id,
            username: user.username,
            type: 'withdrawal',
            status: 'pending',
            currency,
            amount: -amount,
            balanceAfter: newBal,
            note: `Withdrawal to ${payoutDestination} [Pending Admin Approval]`,
            payoutMethod,
            payoutDestination,
            withdrawalId,
            timestamp: new Date().toISOString()
        }
        if (bankDetails) tx.bankDetails = bankDetails
        this.data.transactions.unshift(tx)
        if (this.data.transactions.length > 5000) {
            this.data.transactions = this.data.transactions.slice(0, 5000)
        }

        if (!this.data.withdrawals) this.data.withdrawals = []

        const withdrawal = {
            id: withdrawalId,
            userId: user.id,
            username: user.username,
            userEmail: user.email || '',
            userPhone: user.phone || '',
            currency,
            amount,
            payoutMethod,
            payoutDestination,
            bankDetails: bankDetails || null,
            status: 'pending',
            createdAt: new Date().toISOString(),
            processedAt: null,
            processedBy: null,
            adminNote: '',
            transactionRef: '',
            rejectionReason: '',
            transactionId: txId
        }
        this.data.withdrawals.unshift(withdrawal)

        this.persist()
        this.enqueueOutbox('syncUser', user)
        this.enqueueOutbox('syncTransaction', tx)
        this.enqueueOutbox('syncWithdrawal', withdrawal)

        broadcastEvent('NEW_WITHDRAWAL_REQUEST', withdrawal)

        return { user, withdrawal, transaction: tx }
    }

    getAllWithdrawals(filters = {}) {
        if (!this.data.withdrawals) this.data.withdrawals = []
        let list = [...this.data.withdrawals]

        if (filters.userId) {
            list = list.filter(w => w.userId === filters.userId)
        }
        if (filters.status && filters.status !== 'all') {
            list = list.filter(w => w.status === filters.status)
        }
        if (filters.search) {
            const s = filters.search.toLowerCase().trim()
            list = list.filter(w =>
                (w.username && w.username.toLowerCase().includes(s)) ||
                (w.id && w.id.toLowerCase().includes(s)) ||
                (w.payoutDestination && w.payoutDestination.toLowerCase().includes(s)) ||
                (w.userPhone && w.userPhone.includes(s)) ||
                (w.userEmail && w.userEmail.toLowerCase().includes(s))
            )
        }

        if (!filters.includeBots) {
            list = list.filter(w => !isFakeOrDemoUser({ id: w.userId, username: w.username, email: w.userEmail }))
        }

        return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    }

    findWithdrawalById(id) {
        if (!this.data.withdrawals) this.data.withdrawals = []
        return this.data.withdrawals.find(w => w.id === id)
    }

    approveWithdrawal(id, { adminUsername = 'admin', transactionRef = '', adminNote = '' } = {}) {
        const w = this.findWithdrawalById(id)
        if (!w) throw new Error('Withdrawal request not found')
        if (w.status !== 'pending') throw new Error(`Withdrawal has already been ${w.status}`)

        w.status = 'approved'
        w.processedAt = new Date().toISOString()
        w.processedBy = adminUsername
        w.transactionRef = transactionRef || ''
        w.adminNote = adminNote || (transactionRef ? `Sent via Admin Transfer (Ref: ${transactionRef})` : 'Payout Approved & Sent')

        const tx = (this.data.transactions || []).find(t => t.id === w.transactionId || t.withdrawalId === w.id)
        if (tx) {
            tx.status = 'approved'
            tx.note = `Withdrawal Approved to ${w.payoutDestination}${transactionRef ? ` (Ref: ${transactionRef})` : ''}`
        }

        this.persist()
        if (tx) this.enqueueOutbox('syncTransaction', tx)
        this.enqueueOutbox('syncWithdrawal', w)

        broadcastEvent('WITHDRAWAL_STATUS_UPDATED', w)
        return w
    }

    rejectWithdrawal(id, { adminUsername = 'admin', rejectionReason = 'Rejected by Admin', adminNote = '' } = {}) {
        const w = this.findWithdrawalById(id)
        if (!w) throw new Error('Withdrawal request not found')
        if (w.status !== 'pending') throw new Error(`Withdrawal has already been ${w.status}`)

        w.status = 'rejected'
        w.processedAt = new Date().toISOString()
        w.processedBy = adminUsername
        w.rejectionReason = rejectionReason || 'Rejected by cashier'
        w.adminNote = adminNote || ''

        const user = this.db.findUserById(w.userId)
        let refundTx = null
        if (user) {
            if (!user.balances) user.balances = { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 }
            const curr = String(w.currency || 'INR').toUpperCase()
            const precision = curr === 'BTC' ? 8 : (curr === 'USDT' ? 4 : 2)
            const currentBal = user.balances[w.currency] || 0
            const refundedBal = parseFloat((currentBal + w.amount).toFixed(precision))
            user.balances[w.currency] = refundedBal

            refundTx = {
                id: 'tx_refund_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                userId: user.id,
                username: user.username,
                type: 'credit',
                status: 'completed',
                currency: w.currency,
                amount: w.amount,
                balanceAfter: refundedBal,
                note: `Refund: Withdrawal #${w.id} rejected (${w.rejectionReason})`,
                withdrawalId: w.id,
                timestamp: new Date().toISOString()
            }
            this.data.transactions.unshift(refundTx)
            if (this.data.transactions.length > 5000) {
                this.data.transactions = this.data.transactions.slice(0, 5000)
            }
            this.updateTreasurySupply()

            this.enqueueOutbox('syncUser', user)
            this.enqueueOutbox('syncTransaction', refundTx)
        }

        const tx = (this.data.transactions || []).find(t => t.id === w.transactionId || t.withdrawalId === w.id)
        if (tx) {
            tx.status = 'rejected'
            tx.note = `Withdrawal Rejected (${w.rejectionReason}) [Balance Refunded]`
            this.enqueueOutbox('syncTransaction', tx)
        }

        this.persist()
        this.enqueueOutbox('syncWithdrawal', w)
        broadcastEvent('WITHDRAWAL_STATUS_UPDATED', w)

        return { withdrawal: w, user, refundTransaction: refundTx }
    }

    getWithdrawalStats() {
        if (!this.data.withdrawals) this.data.withdrawals = []
        const list = this.data.withdrawals.filter(w => !isFakeOrDemoUser({ id: w.userId, username: w.username, email: w.userEmail }))
        const pending = list.filter(w => w.status === 'pending')
        const approved = list.filter(w => w.status === 'approved')
        const rejected = list.filter(w => w.status === 'rejected')

        return {
            totalCount: list.length,
            pendingCount: pending.length,
            pendingAmount: pending.reduce((sum, w) => sum + (w.amount || 0), 0),
            approvedCount: approved.length,
            approvedAmount: approved.reduce((sum, w) => sum + (w.amount || 0), 0),
            rejectedCount: rejected.length,
            rejectedAmount: rejected.reduce((sum, w) => sum + (w.amount || 0), 0)
        }
    }

    requestDeposit({ userId, currency = 'INR', amount, paymentMethod = 'UPI', utrNumber = '' }) {
        const user = this.db.findUserById(userId)
        if (!user) throw new Error('User not found')

        const parsedAmount = parseFloat(amount)
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            throw new Error('Valid deposit amount is required')
        }
        if (parsedAmount < 100) {
            throw new Error('Minimum deposit amount is ₹100')
        }
        if (parsedAmount > 500000) {
            throw new Error('Maximum deposit limit per transaction is ₹5,00,000')
        }

        const cleanUtr = String(utrNumber || '').trim()
        if (!cleanUtr || cleanUtr.length < 6) {
            throw new Error('Please enter a valid 12-digit UPI UTR / Transaction Reference Number')
        }

        // Prevent duplicate UTR submission
        if (cleanUtr) {
            const existingUtr = (this.data.deposits || []).find(d => d.utrNumber === cleanUtr && d.status !== 'rejected')
            if (existingUtr) {
                throw new Error('This UTR number has already been submitted and is currently being processed')
            }
        }

        const depositId = 'dep_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex')
        const txId = 'tx_dep_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex')

        const depositRecord = {
            id: depositId,
            transactionId: txId,
            userId: user.id,
            username: user.username,
            userEmail: user.email || '',
            userPhone: user.phone || '',
            currency,
            amount: parsedAmount,
            paymentMethod,
            utrNumber: cleanUtr,
            status: 'pending', // PENDING VERIFICATION
            createdAt: new Date().toISOString(),
            approvedAt: null,
            approvedBy: null,
            adminNote: '',
            rejectionReason: ''
        }

        const tx = {
            id: txId,
            depositId,
            userId: user.id,
            username: user.username,
            type: 'deposit',
            status: 'pending',
            currency,
            amount: parsedAmount,
            balanceAfter: user.balances?.[currency] || 0, // Balance NOT credited yet
            note: cleanUtr ? `Deposit via ${paymentMethod} (UTR: ${cleanUtr}) [Pending Cashier Verification]` : `Deposit via ${paymentMethod} [Pending Verification]`,
            utrNumber: cleanUtr,
            timestamp: new Date().toISOString()
        }

        if (!this.data.deposits) this.data.deposits = []
        this.data.deposits.unshift(depositRecord)
        if (!this.data.transactions) this.data.transactions = []
        this.data.transactions.unshift(tx)

        this.persist()

        this.enqueueOutbox('syncTransaction', tx)
        this.enqueueOutbox('syncDeposit', depositRecord)

        broadcastEvent('NEW_DEPOSIT_REQUEST', depositRecord)

        return { deposit: depositRecord, transaction: tx }
    }

    getAllDeposits(filters = {}) {
        if (!this.data.deposits) this.data.deposits = []
        let list = [...this.data.deposits]

        if (filters.userId) {
            list = list.filter(d => d.userId === filters.userId)
        }
        if (filters.status && filters.status !== 'all') {
            list = list.filter(d => d.status === filters.status)
        }
        if (filters.search) {
            const s = filters.search.toLowerCase().trim()
            list = list.filter(d =>
                (d.username && d.username.toLowerCase().includes(s)) ||
                (d.id && d.id.toLowerCase().includes(s)) ||
                (d.utrNumber && d.utrNumber.toLowerCase().includes(s)) ||
                (d.userPhone && d.userPhone.includes(s)) ||
                (d.userEmail && d.userEmail.toLowerCase().includes(s))
            )
        }

        if (!filters.includeBots) {
            list = list.filter(d => !isFakeOrDemoUser({ id: d.userId, username: d.username, email: d.userEmail }))
        }

        return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    }

    findDepositById(id) {
        if (!this.data.deposits) this.data.deposits = []
        return this.data.deposits.find(d => d.id === id)
    }

    approveDeposit(id, { adminUsername = 'admin', adminNote = '' } = {}) {
        const deposit = this.findDepositById(id)
        if (!deposit) throw new Error('Deposit request not found')
        if (deposit.status !== 'pending') throw new Error(`Deposit has already been ${deposit.status}`)

        const user = this.db.findUserById(deposit.userId)
        if (!user) throw new Error('Associated player account not found')

        deposit.status = 'completed'
        deposit.approvedAt = new Date().toISOString()
        deposit.approvedBy = adminUsername
        deposit.adminNote = adminNote || 'UTR Verified & Funds Credited'

        // 1. Credit balance legitimately
        const balResult = this.updateUserBalance(
            user.id,
            deposit.currency,
            deposit.amount,
            `Deposit Verified via ${deposit.paymentMethod} (UTR: ${deposit.utrNumber || 'Verified'})`
        )

        // 2. Accumulate legitimate totalDeposited in INR equivalent (now unlocking withdrawals)
        const depCurr = String(deposit.currency || 'INR').toUpperCase()
        let depositInr = deposit.amount
        if (depCurr === 'USDT') depositInr = deposit.amount * 90.0
        else if (depCurr === 'BTC') depositInr = deposit.amount * 8500000.0
        else if (depCurr === 'AMRAT') depositInr = 0

        const newTotalDeposit = parseFloat(((user.totalDeposited || 0) + depositInr).toFixed(2))
        user.totalDeposited = newTotalDeposit
        this.db.updateUser(user.id, { totalDeposited: newTotalDeposit })

        // 3. Update original transaction
        const tx = (this.data.transactions || []).find(t => t.id === deposit.transactionId || t.depositId === deposit.id)
        if (tx) {
            tx.status = 'completed'
            tx.balanceAfter = user.balances?.[deposit.currency] || 0
            tx.note = `Deposit Approved (UTR: ${deposit.utrNumber || 'N/A'})`
        }

        this.persist()

        this.enqueueOutbox('syncUser', user)
        if (tx) this.enqueueOutbox('syncTransaction', tx)
        this.enqueueOutbox('syncDeposit', deposit)

        broadcastEvent('DEPOSIT_STATUS_UPDATED', deposit)

        return { deposit, user, transaction: balResult.transaction }
    }

    rejectDeposit(id, { adminUsername = 'admin', rejectionReason = 'Invalid UTR / Payment Not Received' } = {}) {
        const deposit = this.findDepositById(id)
        if (!deposit) throw new Error('Deposit request not found')
        if (deposit.status !== 'pending') throw new Error(`Deposit has already been ${deposit.status}`)

        deposit.status = 'rejected'
        deposit.processedAt = new Date().toISOString()
        deposit.processedBy = adminUsername
        deposit.rejectionReason = rejectionReason

        const tx = (this.data.transactions || []).find(t => t.id === deposit.transactionId || t.depositId === deposit.id)
        if (tx) {
            tx.status = 'rejected'
            tx.note = `Deposit Rejected: ${rejectionReason}`
            this.enqueueOutbox('syncTransaction', tx)
        }

        this.persist()
        this.enqueueOutbox('syncDeposit', deposit)

        broadcastEvent('DEPOSIT_STATUS_UPDATED', deposit)

        return { deposit }
    }

    distributeTokens({ adminId, adminUsername, token = 'AMRAT', amount, targetGroup = 'all_players', targetUserId = null, campaign = '', note = '' }) {
        const parsedAmount = parseFloat(amount)
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            throw new Error('Valid token amount is required')
        }

        const validTokens = ['AMRAT', 'INR', 'USDT']
        const targetToken = String(token).toUpperCase()
        if (!validTokens.includes(targetToken)) {
            throw new Error(`Token ${targetToken} is not eligible for distribution`)
        }

        let recipients = []
        if (targetGroup === 'single_user') {
            if (!targetUserId) throw new Error('targetUserId is required for single_user distribution')
            const u = this.db.findUserById(targetUserId)
            if (!u) throw new Error('Target user not found')
            recipients = [u]
        } else if (targetGroup === 'active_today') {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            recipients = this.data.users.filter(u => u.role !== 'admin' && (u.lastLoginAt >= oneDayAgo || u.createdAt >= oneDayAgo))
        } else if (targetGroup === 'vip_only') {
            recipients = this.data.users.filter(u => u.role !== 'admin' && (u.totalWagered || 0) >= 10000)
        } else {
            recipients = this.data.users.filter(u => u.role !== 'admin')
        }

        if (recipients.length === 0) {
            throw new Error('No eligible recipients found for the selected distribution group')
        }

        const totalDistributed = parseFloat((parsedAmount * recipients.length).toFixed(2))

        if (targetToken === 'AMRAT') {
            const treasury = this.data.settings?.tokenTreasury
            if (treasury && treasury.treasuryBalance < totalDistributed) {
                throw new Error(`Insufficient treasury reserve balance (Available: ${treasury.treasuryBalance.toLocaleString()} AMRAT, Required: ${totalDistributed.toLocaleString()} AMRAT)`)
            }
        }

        const airdropId = 'drop_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
        const timestamp = new Date().toISOString()

        for (const player of recipients) {
            if (!player.balances) player.balances = { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 }
            const curr = player.balances[targetToken] || 0
            const nextBal = parseFloat((curr + parsedAmount).toFixed(4))
            player.balances[targetToken] = nextBal

            const tx = {
                id: 'tx_drop_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                userId: player.id,
                username: player.username,
                type: 'credit',
                currency: targetToken,
                amount: parsedAmount,
                balanceAfter: nextBal,
                note: `🎁 Token Airdrop: ${campaign || 'Platform Reward'} (${parsedAmount} ${targetToken})`,
                timestamp
            }
            this.data.transactions.unshift(tx)
            this.enqueueOutbox('syncUser', player)
            this.enqueueOutbox('syncTransaction', tx)
        }

        if (targetToken === 'AMRAT' && this.data.settings?.tokenTreasury) {
            const t = this.data.settings.tokenTreasury
            t.circulatingSupply = parseFloat((t.circulatingSupply + totalDistributed).toFixed(2))
            t.treasuryBalance = parseFloat(Math.max(0, t.treasuryBalance - totalDistributed).toFixed(2))
            t.totalAirdropped = parseFloat((t.totalAirdropped + totalDistributed).toFixed(2))
        }

        if (!this.data.airdrops) this.data.airdrops = []
        const airdropRecord = {
            id: airdropId,
            adminId,
            adminUsername,
            token: targetToken,
            amountPerUser: parsedAmount,
            totalDistributed,
            recipientCount: recipients.length,
            targetGroup,
            campaign: campaign || 'Ecosystem Airdrop',
            note: note || '',
            timestamp
        }
        this.data.airdrops.unshift(airdropRecord)

        this.updateTreasurySupply()
        this.persist()

        broadcastEvent('TOKEN_AIRDROP_DISPATCHED', {
            token: targetToken,
            amount: parsedAmount,
            campaign: airdropRecord.campaign,
            recipientCount: recipients.length
        })

        return airdropRecord
    }

    updateTreasurySupply() {
        if (!this.data.settings?.tokenTreasury) return

        let circulating = 0
        for (const u of (this.data.users || [])) {
            circulating += (u.balances?.AMRAT || 0)
        }

        const t = this.data.settings.tokenTreasury
        t.circulatingSupply = parseFloat(circulating.toFixed(2))
        t.treasuryBalance = parseFloat(Math.max(0, t.totalSupply - circulating).toFixed(2))
    }

    isWebhookProcessed(id) {
        if (!this.data.processedWebhooks) this.data.processedWebhooks = []
        return this.data.processedWebhooks.includes(id)
    }

    markWebhookProcessed(id) {
        if (!this.data.processedWebhooks) this.data.processedWebhooks = []
        this.data.processedWebhooks.push(id)
        if (this.data.processedWebhooks.length > 2000) {
            this.data.processedWebhooks = this.data.processedWebhooks.slice(-2000)
        }
        this.persist()
    }
}

export default WalletRepository
