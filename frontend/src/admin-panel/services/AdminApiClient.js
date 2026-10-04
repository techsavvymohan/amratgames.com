import { UserModel, AirdropModel, TreasuryModel } from '../models/AdminModels.js'

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
}
