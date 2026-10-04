/**
 * UserEntity — Domain model encapsulating user data & business rules
 */
export class UserEntity {
    constructor(userData = {}) {
        this.id = userData.id || ''
        this.username = userData.username || ''
        this.email = userData.email || ''
        this.phone = userData.phone || ''
        this.phoneVerified = Boolean(userData.phoneVerified)
        this.emailVerified = Boolean(userData.emailVerified)
        this.role = userData.role || 'player'
        this.status = userData.status || 'active'
        this.balances = userData.balances || { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 }
        this.isBanned = Boolean(userData.isBanned)
        this.kycStatus = userData.kycStatus || 'unverified'
        this.createdAt = userData.createdAt || new Date().toISOString()
        this.lastLoginAt = userData.lastLoginAt || new Date().toISOString()
        this.avatar = userData.avatar || '👤'
    }

    isAdmin() {
        return this.role === 'admin'
    }

    isVip() {
        return this.status === 'vip'
    }

    canPlay() {
        return !this.isBanned
    }

    getBalance(currency = 'INR') {
        return this.balances[currency] || 0
    }

    setBalance(currency, amount) {
        this.balances[currency] = Math.max(0, parseFloat(amount.toFixed(4)))
    }

    adjustBalance(currency, delta) {
        const current = this.getBalance(currency)
        const next = Math.max(0, parseFloat((current + delta).toFixed(4)))
        this.balances[currency] = next
        return next
    }

    toSafeJSON() {
        return {
            id: this.id,
            username: this.username,
            email: this.email,
            phone: this.phone,
            phoneVerified: this.phoneVerified,
            emailVerified: this.emailVerified,
            role: this.role,
            status: this.status,
            balances: this.balances,
            isBanned: this.isBanned,
            kycStatus: this.kycStatus,
            createdAt: this.createdAt,
            lastLoginAt: this.lastLoginAt,
            avatar: this.avatar,
        }
    }
}
