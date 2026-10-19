/**
 * OOP Models for Admin Panel Domain Objects
 */

export class UserModel {
    constructor(data = {}) {
        this.id = data.id || ''
        this.username = data.username || 'Anonymous'
        this.email = data.email || ''
        this.phone = data.phone || ''
        this.role = data.role || 'player'
        this.status = data.status || 'active'
        this.balances = data.balances || { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 }
        this.isBanned = Boolean(data.isBanned)
        this.isBot = Boolean(data.isBot)
        this.isMarketMaker = Boolean(data.isMarketMaker)
        this.kycStatus = data.kycStatus || 'unverified'
        this.kycDocumentType = data.kycDocumentType || ''
        this.kycDocumentNumber = data.kycDocumentNumber || ''
        this.createdAt = data.createdAt || new Date().toISOString()
        this.lastLoginAt = data.lastLoginAt || new Date().toISOString()
        this.avatar = data.avatar || '👤'
    }

    isFakeOrDemo() {
        if (this.isBot || this.isMarketMaker) return true
        const id = (this.id || '').toLowerCase()
        if (id.startsWith('usr_bot_') || id.startsWith('usr_demo_') || id.startsWith('sim_') || id.startsWith('usr_play_')) return true
        const name = (this.username || '').toLowerCase()
        if (
            name.includes('bot') ||
            name.includes('tester') ||
            name.startsWith('hero_') ||
            name.startsWith('test_') ||
            name.includes('concurrency') ||
            name.includes('pipe_user') ||
            name.includes('audit_') ||
            name === 'player_0101' ||
            name.startsWith('sharma_vip_')
        ) return true
        const email = (this.email || '').toLowerCase()
        if (
            email.endsWith('@amratgames.internal') ||
            email.endsWith('@test.com') ||
            email.endsWith('@audit-test.com') ||
            email.includes('bot@') ||
            email.includes('_tester') ||
            email.includes('trashmail.com')
        ) return true
        return false
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

export class WithdrawalModel {
    constructor(data = {}) {
        this.id = data.id || ''
        this.userId = data.userId || ''
        this.username = data.username || 'Anonymous'
        this.userEmail = data.userEmail || ''
        this.userPhone = data.userPhone || ''
        this.currency = data.currency || 'INR'
        this.amount = typeof data.amount === 'number' ? data.amount : (parseFloat(data.amount) || 0)
        this.payoutMethod = data.payoutMethod || 'UPI'
        this.payoutDestination = data.payoutDestination || ''
        this.bankDetails = data.bankDetails || null
        this.status = data.status || 'pending'
        this.createdAt = data.createdAt || new Date().toISOString()
        this.processedAt = data.processedAt || null
        this.processedBy = data.processedBy || null
        this.adminNote = data.adminNote || ''
        this.transactionRef = data.transactionRef || ''
        this.rejectionReason = data.rejectionReason || ''
        this.transactionId = data.transactionId || ''
    }

    isPending() {
        return this.status === 'pending'
    }

    isApproved() {
        return this.status === 'approved'
    }

    isRejected() {
        return this.status === 'rejected'
    }

    getFormattedAmount() {
        return `₹${this.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    getFormattedDate() {
        try {
            return new Date(this.createdAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            })
        } catch {
            return this.createdAt
        }
    }

    getFormattedProcessedDate() {
        if (!this.processedAt) return '—'
        try {
            return new Date(this.processedAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            })
        } catch {
            return this.processedAt
        }
    }
}

export class DepositModel {
    constructor(data = {}) {
        this.id = data.id || ''
        this.transactionId = data.transactionId || ''
        this.userId = data.userId || ''
        this.username = data.username || 'Anonymous'
        this.userEmail = data.userEmail || ''
        this.userPhone = data.userPhone || ''
        this.currency = data.currency || 'INR'
        this.amount = typeof data.amount === 'number' ? data.amount : (parseFloat(data.amount) || 0)
        this.paymentMethod = data.paymentMethod || 'UPI'
        this.utrNumber = data.utrNumber || ''
        this.status = data.status || 'pending'
        this.createdAt = data.createdAt || new Date().toISOString()
        this.approvedAt = data.approvedAt || null
        this.approvedBy = data.approvedBy || null
        this.adminNote = data.adminNote || ''
        this.rejectionReason = data.rejectionReason || ''
    }

    isPending() {
        return this.status === 'pending'
    }

    isCompleted() {
        return this.status === 'completed'
    }

    isRejected() {
        return this.status === 'rejected'
    }

    isAutomatedGateway() {
        return (
            (this.paymentMethod && this.paymentMethod.toUpperCase().includes('YOUPI')) ||
            (this.paymentMethod && this.paymentMethod.toUpperCase().includes('GATEWAY')) ||
            (this.approvedBy && this.approvedBy.toUpperCase().includes('WEBHOOK'))
        )
    }

    getChannelLabel() {
        if (this.isAutomatedGateway()) return 'YouPi Gateway'
        return 'Manual UPI'
    }

    getFormattedAmount() {
        return `₹${this.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    getFormattedDate() {
        try {
            return new Date(this.createdAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            })
        } catch {
            return this.createdAt
        }
    }
}

