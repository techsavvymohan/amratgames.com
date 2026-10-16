import { db } from '../../db/db.js'
import { UserEntity } from '../models/UserEntity.js'
import { isFakeOrDemoUser } from '../utils/userFilter.js'

/**
 * AdminUserManager — OOP Service managing user querying, balance adjustments & security status
 */
export class AdminUserManager {
    constructor(database = db) {
        this.db = database
    }

    /**
     * List users with optional search and filters.
     * Excludes simulated bots, QA testers, and demo players by default.
     */
    listUsers(filters = {}) {
        const rawUsers = this.db.getAllUsers(filters)
        return rawUsers
            .filter(u => {
                if (filters.includeBots === true) return true
                return !isFakeOrDemoUser(u)
            })
            .map(u => new UserEntity(u).toSafeJSON())
    }

    /**
     * Retrieve single user details with associated bets & transactions
     */
    getUserDetails(userId) {
        const rawUser = this.db.findUserById(userId)
        if (!rawUser) return null

        const user = new UserEntity(rawUser).toSafeJSON()
        const bets = this.db.getUserBets(userId, 50)
        const transactions = (this.db.data.transactions || [])
            .filter(t => t.userId === userId)
            .slice(0, 50)

        return { user, bets, transactions }
    }

    /**
     * Adjust user balance with audit logging
     */
    adjustBalance(userId, currency, amount, adminUsername, note) {
        const parsedAmount = parseFloat(amount)
        if (isNaN(parsedAmount) || !currency) {
            throw new Error('Valid currency and numeric amount are required')
        }

        const reason = note || `Manual adjustment by admin (${adminUsername})`
        const result = this.db.updateUserBalance(userId, currency, parsedAmount, reason)
        if (!result) {
            throw new Error('User not found')
        }

        return {
            user: new UserEntity(result.user).toSafeJSON(),
            transaction: result.transaction
        }
    }

    /**
     * Toggle ban or change player status
     */
    updateStatus(userId, { isBanned, status }) {
        const updates = {}
        if (isBanned !== undefined) {
            updates.isBanned = Boolean(isBanned)
            if (updates.isBanned) updates.status = 'banned'
            else if (status === undefined) updates.status = 'active'
        }
        if (status) {
            updates.status = status
            if (status === 'banned') updates.isBanned = true
        }

        const updated = this.db.updateUser(userId, updates)
        if (!updated) throw new Error('User not found')

        return new UserEntity(updated).toSafeJSON()
    }
}
