/**
 * OOP Models for Admin Panel Domain Objects
 */

export class UserModel {
    constructor(data = {}) {
        this.id = data.id || ''
        this.username = data.username || 'Anonymous'
        this.email = data.email || ''
        this.role = data.role || 'player'
        this.status = data.status || 'active'
        this.balances = data.balances || { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 }
        this.isBanned = Boolean(data.isBanned)
        this.kycStatus = data.kycStatus || 'unverified'
        this.createdAt = data.createdAt || new Date().toISOString()
        this.lastLoginAt = data.lastLoginAt || new Date().toISOString()
        this.avatar = data.avatar || '👤'
    }

    isAdmin() {
        return this.role === 'admin'
    }

    isVip() {
        return this.status === 'vip' && !this.isBanned
    }

    isSuspended() {
        return this.isBanned || this.status === 'banned'
    }

    getBalance(currency = 'INR') {
        return this.balances[currency] || 0
    }

    getFormattedBalance(currency = 'INR') {
        const val = this.getBalance(currency)
        if (currency === 'INR') {
            return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        }
        if (currency === 'BTC') return `₿${val.toFixed(4)}`
        if (currency === 'USDT') return `₮${val.toFixed(2)}`
        if (currency === 'AMRAT') return `👑 ${val.toLocaleString()}`
        return `${currency} ${val.toLocaleString()}`
    }

    matchesSearch(query) {
        if (!query) return true
        const q = query.toLowerCase()
        return (
            this.username.toLowerCase().includes(q) ||
            this.email.toLowerCase().includes(q) ||
            this.id.toLowerCase().includes(q)
        )
    }
}

export class AirdropModel {
    constructor(data = {}) {
        this.id = data.id || ''
        this.campaign = data.campaign || 'Token Airdrop'
        this.adminUsername = data.adminUsername || 'admin'
        this.token = data.token || 'AMRAT'
        this.amountPerUser = data.amountPerUser || 0
        this.recipientCount = data.recipientCount || 0
        this.totalAmount = data.totalAmount || (this.amountPerUser * this.recipientCount)
        this.targetGroup = data.targetGroup || 'all_players'
        this.note = data.note || ''
        this.timestamp = data.timestamp || new Date().toISOString()
    }

    getFormattedDate() {
        return new Date(this.timestamp).toLocaleDateString()
    }

    getFormattedTime() {
        return new Date(this.timestamp).toLocaleTimeString()
    }
}

export class TreasuryModel {
    constructor(data = {}) {
        this.totalSupply = data.totalSupply || 100000000
        this.circulatingSupply = data.circulatingSupply || 0
        this.treasuryBalance = data.treasuryBalance || (this.totalSupply - this.circulatingSupply)
        this.totalAirdropped = data.totalAirdropped || 0
    }

    getCirculatingPercentage() {
        if (!this.totalSupply) return 0
        return ((this.circulatingSupply / this.totalSupply) * 100).toFixed(2)
    }

    getReservePercentage() {
        if (!this.totalSupply) return 100
        return ((this.treasuryBalance / this.totalSupply) * 100).toFixed(2)
    }
}
