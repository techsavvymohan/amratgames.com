import { UserModel, AirdropModel, TreasuryModel, WithdrawalModel, DepositModel } from '../models/AdminModels.js'

/**
 * AdminApiClient — OOP Service for interacting with AmratGames Admin API
 */
export class AdminApiClient {
    constructor(tokenProvider = () => '') {
        this.tokenProvider = tokenProvider
        this.baseUrl = '/api/admin'
    }

    _getHeaders() {
        const token = this.tokenProvider()
        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
    }

    async getStats() {
        const res = await fetch(`${this.baseUrl}/stats`, { headers: this._getHeaders() })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch platform stats')
        return {
            ...data.stats,
            treasury: new TreasuryModel(data.stats.treasury)
        }
    }

    async getUsers(filters = {}) {
        const queryParams = new URLSearchParams()
        if (filters.search) queryParams.set('search', filters.search)
        if (filters.status && filters.status !== 'all') queryParams.set('status', filters.status)

        const res = await fetch(`${this.baseUrl}/users?${queryParams.toString()}`, { headers: this._getHeaders() })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch users')
        return (data.users || []).map(u => new UserModel(u))
    }

    async getUserDetails(userId) {
        const res = await fetch(`${this.baseUrl}/users/${userId}`, { headers: this._getHeaders() })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch user details')
        return {
            user: new UserModel(data.user),
            bets: data.bets || [],
            transactions: data.transactions || []
        }
    }

    async adjustBalance(userId, currency, amount, note) {
        const res = await fetch(`${this.baseUrl}/users/${userId}/balance`, {
            method: 'PATCH',
            headers: this._getHeaders(),
            body: JSON.stringify({ currency, amount: parseFloat(amount), note })
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update balance')
        return {
            user: new UserModel(data.user),
            transaction: data.transaction
        }
    }

    async setUserStatus(userId, { isBanned, status }) {
        const res = await fetch(`${this.baseUrl}/users/${userId}/status`, {
            method: 'PATCH',
            headers: this._getHeaders(),
            body: JSON.stringify({ isBanned, status })
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update status')
        return new UserModel(data.user)
    }

    async getWithdrawals(filters = {}) {
        const queryParams = new URLSearchParams()
        if (filters.status && filters.status !== 'all') queryParams.set('status', filters.status)
        if (filters.search) queryParams.set('search', filters.search)
        if (filters.userId) queryParams.set('userId', filters.userId)

        const res = await fetch(`${this.baseUrl}/withdrawals?${queryParams.toString()}`, { headers: this._getHeaders() })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch withdrawals')
        return (data.withdrawals || []).map(w => new WithdrawalModel(w))
    }

    async getWithdrawalStats() {
        const res = await fetch(`${this.baseUrl}/withdrawals/stats`, { headers: this._getHeaders() })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch withdrawal stats')
        return data.stats
    }

    async approveWithdrawal(id, { transactionRef, adminNote } = {}) {
        const res = await fetch(`${this.baseUrl}/withdrawals/${id}/approve`, {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify({ transactionRef, adminNote })
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to approve withdrawal')
        return new WithdrawalModel(data.withdrawal)
    }

    async rejectWithdrawal(id, { rejectionReason, adminNote } = {}) {
        const res = await fetch(`${this.baseUrl}/withdrawals/${id}/reject`, {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify({ rejectionReason, adminNote })
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to reject withdrawal')
        return new WithdrawalModel(data.withdrawal)
    }

    async getDeposits(filters = {}) {
        const queryParams = new URLSearchParams()
        if (filters.status && filters.status !== 'all') queryParams.set('status', filters.status)
        if (filters.search) queryParams.set('search', filters.search)
        if (filters.userId) queryParams.set('userId', filters.userId)

        const res = await fetch(`${this.baseUrl}/deposits?${queryParams.toString()}`, { headers: this._getHeaders() })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch deposits')
        return (data.deposits || []).map(d => new DepositModel(d))
    }

    async approveDeposit(id, { adminNote = '' } = {}) {
        const res = await fetch(`${this.baseUrl}/deposits/${id}/approve`, {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify({ adminNote })
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to approve deposit')
        return new DepositModel(data.deposit)
    }

    async rejectDeposit(id, { rejectionReason = 'Invalid UTR / Payment Not Received' } = {}) {
        const res = await fetch(`${this.baseUrl}/deposits/${id}/reject`, {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify({ rejectionReason })
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to reject deposit')
        return new DepositModel(data.deposit)
    }

    async approveKYC(userId) {
        const res = await fetch(`${this.baseUrl}/users/${userId}/kyc/approve`, {
            method: 'POST',
            headers: this._getHeaders()
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to approve KYC')
        return new UserModel(data.user)
    }

    async rejectKYC(userId, { reason = 'Document verification failed' } = {}) {
        const res = await fetch(`${this.baseUrl}/users/${userId}/kyc/reject`, {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify({ reason })
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to reject KYC')
        return new UserModel(data.user)
    }

    async distributeTokens(payload) {
        const res = await fetch(`${this.baseUrl}/tokens/distribute`, {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify(payload)
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to distribute tokens')
        return data
    }

    async getAirdropHistory() {
        const res = await fetch(`${this.baseUrl}/tokens/history`, { headers: this._getHeaders() })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch history')
        return (data.airdrops || []).map(a => new AirdropModel(a))
    }

    async getSettings() {
        const res = await fetch(`${this.baseUrl}/settings`, { headers: this._getHeaders() })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch settings')
        return data.settings
    }

    async updateSettings(settings) {
        const res = await fetch(`${this.baseUrl}/settings`, {
            method: 'PATCH',
            headers: this._getHeaders(),
            body: JSON.stringify(settings)
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update settings')
        return data.settings
    }

    async rotateSeed() {
        const res = await fetch(`${this.baseUrl}/seed/rotate`, {
            method: 'POST',
            headers: this._getHeaders()
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to rotate seed')
        return data
    }

    async getRecentBets(limit = 25) {
        const res = await fetch(`/api/games/recent?limit=${limit}`)
        const data = await res.json()
        return data.bets || []
    }

    async getSupabaseStatus() {
        const res = await fetch(`${this.baseUrl}/supabase/status`, { headers: this._getHeaders() })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch Supabase status')
        return data
    }

    async migrateToSupabase() {
        const res = await fetch(`${this.baseUrl}/supabase/migrate`, {
            method: 'POST',
            headers: this._getHeaders()
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to migrate to Supabase')
        return data.report
    }
}
