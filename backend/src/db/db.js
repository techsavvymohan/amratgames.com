import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { CONFIG } from '../config.js'
import { supabaseSync } from './SupabaseSyncService.js'
import { durableOutbox } from './DurableOutboxService.js'
import { isSupabaseConfigured, testSupabaseConnection } from './SupabaseClient.js'
import { broadcastEvent } from '../websocket.js'
import { userLockManager } from './UserLockManager.js'
import { bankrollRisk } from '../services/BankrollRiskService.js'
import { houseVaultService } from '../services/HouseVaultService.js'
import { UserRepository } from '../repositories/UserRepository.js'
import { WalletRepository } from '../repositories/WalletRepository.js'
import { BetRepository } from '../repositories/BetRepository.js'
import { DatabaseDriverFactory } from './DatabaseDriverFactory.js'

export function normalizePhone(phone) {
    if (!phone) return ''
    const cleaned = String(phone).replace(/\D/g, '')
    // Strip India country code (91) if 12 digits
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
        return cleaned.slice(2)
    }
    // Strip leading 0 if 11 digits
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
        return cleaned.slice(1)
    }
    return cleaned
}

export function getVipTier(totalWagered = 0) {
    const wager = Math.max(0, parseFloat(totalWagered) || 0)
    if (wager >= 1000000) {
        return { tier: 'Diamond', level: 5, icon: '👑', rakebackRate: 0.15, minWager: 1000000, nextTierWager: null, progressPct: 100 }
    }
    if (wager >= 250000) {
        const next = 1000000
        const prog = Math.min(100, Math.floor(((wager - 250000) / (next - 250000)) * 100))
        return { tier: 'Platinum', level: 4, icon: '💎', rakebackRate: 0.10, minWager: 250000, nextTierWager: next, progressPct: prog }
    }
    if (wager >= 50000) {
        const next = 250000
        const prog = Math.min(100, Math.floor(((wager - 50000) / (next - 50000)) * 100))
        return { tier: 'Gold', level: 3, icon: '🥇', rakebackRate: 0.07, minWager: 50000, nextTierWager: next, progressPct: prog }
    }
    if (wager >= 10000) {
        const next = 50000
        const prog = Math.min(100, Math.floor(((wager - 10000) / (next - 10000)) * 100))
        return { tier: 'Silver', level: 2, icon: '🥈', rakebackRate: 0.05, minWager: 10000, nextTierWager: next, progressPct: prog }
    }
    const next = 10000
    const prog = Math.min(100, Math.floor((wager / next) * 100))
    return { tier: 'Bronze', level: 1, icon: '🥉', rakebackRate: 0.03, minWager: 0, nextTierWager: next, progressPct: prog }
}

export class Database {
    constructor(driver = null) {
        this.driver = driver || DatabaseDriverFactory.createDriver()
        this.dir = CONFIG.DATA_DIR
        this.filePath = path.join(this.dir, 'amratgames_db.json')
        this.otps = new Map() // identifier -> { otp, expiresAt, attempts }
        this._flushTimer = null
        this._isFlushing = false
        this._needsFlushAgain = false
        this._usersById = new Map()
        this._usersByEmail = new Map()
        this._usersByUsername = new Map()
        this._usersByPhone = new Map()
        this.data = {
            users: [],
            transactions: [],
            bets: [],
            airdrops: [],
            withdrawals: [],
            deposits: [],
            processedWebhooks: [],
            settings: {
                rtp: CONFIG.DEFAULT_RTP,
                houseEdge: CONFIG.HOUSE_EDGE,
                maintenanceMode: false,
                currentServerSeed: crypto.randomBytes(32).toString('hex'),
                serverSeedHash: '',
                activeAnnouncements: '👑 Welcome to AmratGames.com — India\'s Premier Provably Fair Gaming Platform! ₹10,000 Free Practice Bonus Active!',
                tokenTreasury: {
                    totalSupply: CONFIG.TOKEN_INITIAL_TREASURY,
                    circulatingSupply: 0,
                    treasuryBalance: CONFIG.TOKEN_INITIAL_TREASURY,
                    totalAirdropped: 0,
                }
            }
        }
        this.init()
        this.userRepository = new UserRepository(this)
        this.walletRepository = new WalletRepository(this)
        this.betRepository = new BetRepository(this)
        this.attachShutdownHooks()
    }

    attachShutdownHooks() {
        // Guarantee clean, synchronous flush on process termination to prevent data loss
        if (typeof process !== 'undefined') {
            const onExit = () => {
                try { this.flushSync() } catch {}
            }
            process.once('beforeExit', onExit)
            process.once('SIGINT', () => { onExit(); process.exit(0) })
            process.once('SIGTERM', () => { onExit(); process.exit(0) })
        }
    }

    init() {
        const loadedState = this.driver.loadState()
        if (loadedState && typeof loadedState === 'object') {
            this.data = loadedState
        } else {
            this.seedInitialData()
            this.flushSync()
        }

        // Ensure withdrawals array exists in runtime state
        if (!this.data.withdrawals) {
            this.data.withdrawals = []
        }
        if (!this.data.deposits) {
            this.data.deposits = []
        }
        if (!Array.isArray(this.data.processedWebhooks)) {
            this.data.processedWebhooks = []
        }

        // Ensure settings defaults
        if (!this.data.settings) this.data.settings = {}
        if (this.data.settings.maintenanceMode === undefined) this.data.settings.maintenanceMode = false
        if (!Array.isArray(this.data.settings.disabledGames)) this.data.settings.disabledGames = []

        // Ensure phone numbers and clean balance for master admin
        const masterAdmin = this.data.users.find(u => u.id === 'usr_admin_001')
        if (masterAdmin) {
            if (!masterAdmin.phone) {
                masterAdmin.phone = '9876500001'
                masterAdmin.phoneVerified = true
            }
            if (masterAdmin.balances?.INR === 500000 || masterAdmin.balances?.INR > 50000) {
                masterAdmin.balances = {
                    INR: 100.00,
                    BTC: 0.0000,
                    USDT: 0.00,
                    AMRAT: 0.00,
                }
            }
            this.flushSync()
        }

        // Ensure all users have totalWagered, totalDeposited, referralCode, and VIP fields initialized
        if (Array.isArray(this.data.users)) {
            for (const u of this.data.users) {
                if (typeof u.totalWagered !== 'number') u.totalWagered = 0
                if (typeof u.totalDeposited !== 'number') u.totalDeposited = 0
                if (!u.referralCode) {
                    u.referralCode = (u.username || 'PLAYER').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()
                }
                if (!u.affiliateStats) {
                    u.affiliateStats = { totalReferred: 0, totalTurnover: 0, totalEarned: 0, unclaimedEarnings: 0 }
                }
                if (typeof u.unclaimedRakeback !== 'number') u.unclaimedRakeback = 0
                if (typeof u.totalRakebackEarned !== 'number') u.totalRakebackEarned = 0
            }
        }

        // Compute current server seed hash
        if (this.data.settings?.currentServerSeed) {
            this.data.settings.serverSeedHash = crypto
                .createHash('sha256')
                .update(this.data.settings.currentServerSeed)
                .digest('hex')
        }
        this._rebuildUserIndexes()
    }

    _rebuildUserIndexes() {
        this._usersById.clear()
        this._usersByEmail.clear()
        this._usersByUsername.clear()
        this._usersByPhone.clear()
        if (Array.isArray(this.data.users)) {
            for (const u of this.data.users) {
                this._indexUser(u)
            }
        }
    }

    _indexUser(u) {
        if (!u) return
        if (u.id) this._usersById.set(u.id, u)
        if (u.email) this._usersByEmail.set(String(u.email).toLowerCase(), u)
        if (u.username) this._usersByUsername.set(String(u.username).toLowerCase(), u)
        if (u.phone) {
            const norm = normalizePhone(u.phone)
            if (norm) this._usersByPhone.set(norm, u)
        }
    }

    scheduleFlush() {
        if (typeof this.driver.scheduleFlush === 'function') {
            this.driver.scheduleFlush(this.data)
        } else {
            this.flushAsync().catch(err => {
                console.error('[DB] Flush error:', err)
            })
        }
    }

    async flushAsync() {
        return this.driver.flushState(this.data)
    }

    flushSync() {
        return this.driver.flushStateSync(this.data)
    }

    persist() {
        this.scheduleFlush()
    }

    seedInitialData() {
        console.log('[DB] Seeding initial database with Admin and Platform Data...')
        const salt = bcrypt.genSaltSync(10)
        const adminPasswordHash = bcrypt.hashSync(CONFIG.ADMIN_DEFAULT_PASSWORD, salt)
        const playerPasswordHash = bcrypt.hashSync('Player123!', salt)

        const now = new Date().toISOString()

        // 1. Admin User
        const adminUser = {
            id: 'usr_admin_001',
            username: 'amrat_master',
            email: CONFIG.ADMIN_DEFAULT_EMAIL,
            passwordHash: adminPasswordHash,
            role: 'admin',
            status: 'active',
            balances: {
                INR: 100.00, // Standard ₹100 Welcome Bonus (No demo 500000)
                BTC: 0.0000,
                USDT: 0.00,
                AMRAT: 0.00,
            },
            isBanned: false,
            kycStatus: 'verified',
            createdAt: '2025-01-01T00:00:00.000Z',
            lastLoginAt: now,
            avatar: '👑'
        }

        // Production User Pool — Clean Start (Only Master Administrator)
        this.data.users = [adminUser]

        // Clean Platform History (100% Dynamic Player Driven)
        this.data.airdrops = []
        this.data.bets = []
        this.data.transactions = []
        this.data.withdrawals = []
        this.data.deposits = []

        this.data.settings.tokenTreasury = {
            totalSupply: CONFIG.TOKEN_INITIAL_TREASURY,
            circulatingSupply: 0,
            treasuryBalance: CONFIG.TOKEN_INITIAL_TREASURY,
            totalAirdropped: 0
        }
    }

    // ── Concurrency & Transactional Lock Engine ───────────────
    async withUserLock(userId, task) {
        return userLockManager.withLock(userId, task)
    }

    // ── User Repository Facade Delegations ────────────────────
    findUserById(id) {
        return this.userRepository.findUserById(id)
    }

    findUserByEmail(email) {
        return this.userRepository.findUserByEmail(email)
    }

    findUserByUsername(username) {
        return this.userRepository.findUserByUsername(username)
    }

    findUserByPhone(phone) {
        return this.userRepository.findUserByPhone(phone)
    }

    findUserByLogin(login) {
        return this.userRepository.findUserByLogin(login)
    }

    generateOtp(identifier) {
        return this.userRepository.generateOtp(identifier)
    }

    verifyOtp(identifier, code) {
        return this.userRepository.verifyOtp(identifier, code)
    }

    getAllUsers(filters = {}) {
        return this.userRepository.getAllUsers(filters)
    }

    createUser(userData) {
        return this.userRepository.createUser(userData)
    }

    updateUser(id, updates) {
        return this.userRepository.updateUser(id, updates)
    }

    accumulateWagerRewards(user, betAmount) {
        return this.userRepository.accumulateWagerRewards(user, betAmount)
    }

    getAffiliateStats(userId) {
        return this.userRepository.getAffiliateStats(userId)
    }

    getVipTier(totalWagered) {
        return getVipTier(totalWagered)
    }

    getVipStatus(userId) {
        return this.userRepository.getVipStatus(userId)
    }

    async claimRakeback(userId) {
        return this.userRepository.claimRakeback(userId)
    }

    async claimAffiliateCommission(userId) {
        return this.userRepository.claimAffiliateCommission(userId)
    }

    // ── Wallet & Ledger Facade Delegations ───────────────────
    updateUserBalance(userId, currency, delta, note = '') {
        return this.walletRepository.updateUserBalance(userId, currency, delta, note)
    }

    isWebhookProcessed(id) {
        return this.walletRepository.isWebhookProcessed(id)
    }

    markWebhookProcessed(id) {
        return this.walletRepository.markWebhookProcessed(id)
    }

    requestWithdrawal(payload) {
        return this.walletRepository.requestWithdrawal(payload)
    }

    getAllWithdrawals(filters = {}) {
        return this.walletRepository.getAllWithdrawals(filters)
    }

    findWithdrawalById(id) {
        return this.walletRepository.findWithdrawalById(id)
    }

    approveWithdrawal(id, options = {}) {
        return this.walletRepository.approveWithdrawal(id, options)
    }

    rejectWithdrawal(id, options = {}) {
        return this.walletRepository.rejectWithdrawal(id, options)
    }

    getWithdrawalStats() {
        return this.walletRepository.getWithdrawalStats()
    }

    requestDeposit(payload) {
        return this.walletRepository.requestDeposit(payload)
    }

    getAllDeposits(filters = {}) {
        return this.walletRepository.getAllDeposits(filters)
    }

    findDepositById(id) {
        return this.walletRepository.findDepositById(id)
    }

    approveDeposit(id, options = {}) {
        return this.walletRepository.approveDeposit(id, options)
    }

    rejectDeposit(id, options = {}) {
        return this.walletRepository.rejectDeposit(id, options)
    }

    distributeTokens(options) {
        return this.walletRepository.distributeTokens(options)
    }

    updateTreasurySupply() {
        return this.walletRepository.updateTreasurySupply()
    }

    // ── Bets & Games Facade Delegations ───────────────────────
    async executeAtomicBet(payload) {
        return this.betRepository.executeAtomicBet(payload)
    }

    recordBet(betData) {
        return this.betRepository.recordBet(betData)
    }

    getRecentBets(limit = 25) {
        return this.betRepository.getRecentBets(limit)
    }

    getUserBets(userId, limit = 50) {
        return this.betRepository.getUserBets(userId, limit)
    }

    getUserTransactions(userId, limit = 50) {
        return this.betRepository.getUserTransactions(userId, limit)
    }

    getPlatformStats() {
        return this.betRepository.getPlatformStats()
    }

    rotateServerSeed() {
        return this.betRepository.rotateServerSeed()
    }

    updateSettings(newSettings) {
        return this.betRepository.updateSettings(newSettings)
    }

    // ── Supabase Cloud Integration Methods ───────────────────
    async testSupabase() {
        return testSupabaseConnection()
    }

    async migrateToSupabase() {
        return supabaseSync.migrateLocalToSupabase(this.data)
    }

    async hydrateFromSupabase() {
        if (!CONFIG.USE_SUPABASE || !isSupabaseConfigured()) {
            return false
        }
        try {
            const client = supabaseSync.getClient()
            if (!client) return false

            console.log('[DB] Hydrating state from Supabase Cloud PostgreSQL...')

            // 1. Fetch settings
            const { data: cloudSettings, error: sErr } = await client
                .from('platform_settings')
                .select('*')
                .eq('id', 'default')
                .maybeSingle()

            if (!sErr && cloudSettings) {
                this.data.settings = {
                    ...this.data.settings,
                    rtp: parseFloat(cloudSettings.rtp) || this.data.settings.rtp,
                    houseEdge: parseFloat(cloudSettings.house_edge) || this.data.settings.houseEdge,
                    maintenanceMode: Boolean(cloudSettings.maintenance_mode),
                    activeAnnouncements: cloudSettings.active_announcements || this.data.settings.activeAnnouncements,
                    currentServerSeed: cloudSettings.current_server_seed || this.data.settings.currentServerSeed,
                    serverSeedHash: cloudSettings.server_seed_hash || this.data.settings.serverSeedHash,
                    tokenTreasury: cloudSettings.token_treasury || this.data.settings.tokenTreasury
                }
            }

            // 2. Fetch users
            const { data: cloudUsers, error: uErr } = await client
                .from('users')
                .select('*')
                .limit(1000)

            if (!uErr && cloudUsers && cloudUsers.length > 0) {
                const mappedUsers = cloudUsers.map(u => {
                    const balances = u.balances || { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 }
                    const totalDeposited = typeof balances.totalDeposited === 'number'
                        ? balances.totalDeposited
                        : (parseFloat(balances.totalDeposited) || parseFloat(u.total_deposited) || 0)

                    const referralCode = u.referral_code || balances.referralCode || (u.username || 'PLAYER').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()
                    const referredBy = u.referred_by || balances.referredBy || null
                    const totalWagered = typeof balances.totalWagered === 'number' ? balances.totalWagered : (parseFloat(u.total_wagered) || 0)
                    const unclaimedRakeback = typeof balances.unclaimedRakeback === 'number' ? balances.unclaimedRakeback : (parseFloat(u.unclaimed_rakeback) || 0)
                    const totalRakebackEarned = typeof balances.totalRakebackEarned === 'number' ? balances.totalRakebackEarned : (parseFloat(u.total_rakeback_earned) || 0)

                    return {
                        id: u.id,
                        username: u.username,
                        email: u.email || '',
                        phone: u.phone || '',
                        passwordHash: u.password_hash,
                        role: u.role || 'player',
                        status: u.status || 'active',
                        isBanned: Boolean(u.is_banned),
                        kycStatus: u.kyc_status || 'unverified',
                        phoneVerified: Boolean(u.phone_verified),
                        emailVerified: Boolean(u.email_verified),
                        avatar: u.avatar || '👤',
                        balances,
                        totalDeposited,
                        totalWagered,
                        referralCode,
                        referredBy,
                        affiliateStats: {
                            totalReferred: 0,
                            totalTurnover: 0,
                            totalEarned: 0,
                            unclaimedEarnings: 0
                        },
                        unclaimedRakeback,
                        totalRakebackEarned,
                        createdAt: u.created_at,
                        lastLoginAt: u.last_login_at
                    }
                })

                const userMap = new Map()
                for (const lu of this.data.users) userMap.set(lu.id, lu)
                for (const cu of mappedUsers) userMap.set(cu.id, cu)
                this.data.users = Array.from(userMap.values())
                this._rebuildUserIndexes()
                console.log(`[DB] Successfully synced ${mappedUsers.length} user accounts from Supabase!`)
            }

            // 3. Fetch recent bets
            const { data: cloudBets, error: bErr } = await client
                .from('bets')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100)

            if (!bErr && cloudBets && cloudBets.length > 0) {
                const mappedBets = cloudBets.map(b => ({
                    id: b.id,
                    userId: b.user_id,
                    username: b.username,
                    game: b.game,
                    gameName: b.game_name,
                    currency: b.currency,
                    betAmount: parseFloat(b.bet_amount),
                    multiplier: parseFloat(b.multiplier),
                    payout: parseFloat(b.payout),
                    profit: parseFloat(b.profit),
                    won: Boolean(b.won),
                    hash: b.hash,
                    roundData: b.round_data,
                    timestamp: b.created_at
                }))
                this.data.bets = mappedBets
            }

            this.updateTreasurySupply()
            this.persist()
            return true
        } catch (err) {
            console.warn('[DB] Supabase hydration notice:', err.message)
            return false
        }
    }
}

export const db = new Database()
export const driver = db.driver
export const userRepository = db.userRepository
export const walletRepository = db.walletRepository
export const betRepository = db.betRepository
export { DatabaseDriverFactory }
export default db
