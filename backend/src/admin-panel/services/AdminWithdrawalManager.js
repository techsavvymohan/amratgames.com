import { db } from '../../db/db.js'

/**
 * AdminWithdrawalManager — OOP Service managing player withdrawal requests, manual approval, and rejection
 */
export class AdminWithdrawalManager {
    constructor(database = db) {
        this.db = database
    }

    /**
     * List withdrawal requests with optional filtering and search
     */
    listWithdrawals(filters = {}) {
        return this.db.getAllWithdrawals(filters)
    }

    /**
     * Get single withdrawal details including player account context
     */
    getWithdrawalDetails(id) {
        const withdrawal = this.db.findWithdrawalById(id)
        if (!withdrawal) return null

        const user = this.db.findUserById(withdrawal.userId)
        return {
            withdrawal,
            user: user ? {
                id: user.id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                balances: user.balances,
                totalDeposited: user.totalDeposited
            } : null
        }
    }

    /**
     * Approve withdrawal after admin manually sends payout
     */
    approveWithdrawal(id, { adminUsername = 'admin', transactionRef = '', adminNote = '' } = {}) {
        return this.db.approveWithdrawal(id, { adminUsername, transactionRef, adminNote })
    }

    /**
     * Reject withdrawal and refund player balance
     */
    rejectWithdrawal(id, { adminUsername = 'admin', rejectionReason = 'Rejected by Admin', adminNote = '' } = {}) {
        return this.db.rejectWithdrawal(id, { adminUsername, rejectionReason, adminNote })
    }

    /**
     * Aggregate statistics for withdrawal overview cards
     */
    getStats() {
        return this.db.getWithdrawalStats()
    }
}
