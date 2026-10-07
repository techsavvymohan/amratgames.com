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
        this.totalDeposited = userData.totalDeposited || 0
        this.isBanned = Boolean(userData.isBanned)
        this.kycStatus = userData.kycStatus || 'unverified'
        this.firstName = userData.firstName || ''
        this.lastName = userData.lastName || ''
        this.dob = userData.dob || { day: '21', month: '4', year: '2005' }
        this.gender = userData.gender || 'Male'
        this.country = userData.country || 'India'
        this.city = userData.city || ''
        this.newsletter = Boolean(userData.newsletter !== false)
        this.kycSubmittedAt = userData.kycSubmittedAt || null
        this.kycDocumentType = userData.kycDocumentType || ''
        this.kycDocumentNumber = userData.kycDocumentNumber || ''
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
            firstName: this.firstName,
            lastName: this.lastName,
            dob: this.dob,
            gender: this.gender,
            country: this.country,
            city: this.city,
            newsletter: this.newsletter,
            role: this.role,
            status: this.status,
            balances: this.balances,
            totalDeposited: this.totalDeposited,
            isBanned: this.isBanned,
            kycStatus: this.kycStatus,
            kycSubmittedAt: this.kycSubmittedAt,
            kycDocumentType: this.kycDocumentType,
            createdAt: this.createdAt,
            lastLoginAt: this.lastLoginAt,
            avatar: this.avatar,
        }
    }
}
