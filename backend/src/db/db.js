import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { CONFIG } from '../config.js'
import { supabaseSync } from './SupabaseSyncService.js'
import { isSupabaseConfigured, testSupabaseConnection } from './SupabaseClient.js'
import { broadcastEvent } from '../websocket.js'
import { userLockManager } from './UserLockManager.js'

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

class Database {
    constructor() {
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
        if (!fs.existsSync(this.dir)) {
            fs.mkdirSync(this.dir, { recursive: true })
        }

        // Clean up any dangling temporary files from previous unexpected halts
        try {
            if (fs.existsSync(this.dir)) {
                const files = fs.readdirSync(this.dir)
                for (const f of files) {
                    if (f.endsWith('.tmp') && f.startsWith('amratgames_db.json')) {
                        try { fs.unlinkSync(path.join(this.dir, f)) } catch {}
                    }
                }
            }
        } catch {}

        if (fs.existsSync(this.filePath)) {
            try {
                const raw = fs.readFileSync(this.filePath, 'utf-8')
                this.data = JSON.parse(raw)
            } catch (err) {
                console.error('[DB] Error loading existing db file, initializing fresh store:', err)
                this.seedInitialData()
                this.flushSync()
            }
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
        if (this._flushTimer) return
        this._flushTimer = setTimeout(() => {
            this._flushTimer = null
            this.flushAsync().catch(err => {
                console.error('[DB] Flush error:', err)
            })
        }, 25)
    }

    async flushAsync() {
        if (this._isFlushing) {
            this._needsFlushAgain = true
            return
        }
        this._isFlushing = true
        this._needsFlushAgain = false

        let tempFile = null
        try {
            tempFile = `${this.filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`
            const serialized = CONFIG.isProduction ? JSON.stringify(this.data) : JSON.stringify(this.data, null, 2)
            await fs.promises.writeFile(tempFile, serialized, 'utf-8')
            try {
                await fs.promises.rename(tempFile, this.filePath)
            } catch (renameErr) {
                // Windows NTFS lock fallback: copyFile + unlink
                await fs.promises.copyFile(tempFile, this.filePath)
                await fs.promises.unlink(tempFile).catch(() => {})
            }
        } catch (err) {
            console.error('[DB] Async persist error:', err)
            if (tempFile) {
                await fs.promises.unlink(tempFile).catch(() => {})
            }
        } finally {
            this._isFlushing = false
            if (this._needsFlushAgain) {
                this.scheduleFlush()
            }
        }
    }

    flushSync() {
        let tempFile = null
        try {
            tempFile = `${this.filePath}.${Date.now()}.tmp`
            const serialized = CONFIG.isProduction ? JSON.stringify(this.data) : JSON.stringify(this.data, null, 2)
            fs.writeFileSync(tempFile, serialized, 'utf-8')
            try {
                fs.renameSync(tempFile, this.filePath)
            } catch (renameErr) {
                fs.copyFileSync(tempFile, this.filePath)
                try { fs.unlinkSync(tempFile) } catch {}
            }
        } catch (err) {
            console.error('[DB] Synchronous flush error:', err)
            if (tempFile) {
                try { fs.unlinkSync(tempFile) } catch {}
            }
        }
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

    // ── User Methods (O(1) Hash Map Indexed) ─────────────────
    findUserById(id) {
        if (!id) return null
        return this._usersById.get(id) || this.data.users.find(u => u.id === id) || null
    }

    findUserByEmail(email) {
        if (!email) return null
        const key = String(email).toLowerCase()
        return this._usersByEmail.get(key) || this.data.users.find(u => u.email && u.email.toLowerCase() === key) || null
    }

    findUserByUsername(username) {
        if (!username) return null
        const key = String(username).toLowerCase()
        return this._usersByUsername.get(key) || this.data.users.find(u => u.username && u.username.toLowerCase() === key) || null
    }

    findUserByPhone(phone) {
        const normalized = normalizePhone(phone)
        if (!normalized) return null
        return this._usersByPhone.get(normalized) || this.data.users.find(u => u.phone && normalizePhone(u.phone) === normalized) || null
    }

    findUserByLogin(login) {
        if (!login) return null
        const str = String(login).trim()
        
        // 1. If it looks like an email
        if (str.includes('@')) {
            return this.findUserByEmail(str)
        }

        // 2. If it's a mobile number (10 to 13 digits)
        const digitsOnly = normalizePhone(str)
        if (digitsOnly && digitsOnly.length >= 10) {
            const byPhone = this.findUserByPhone(digitsOnly)
            if (byPhone) return byPhone
        }

        // 3. Fallback to username
        return this.findUserByUsername(str)
    }

    // ── OTP System ────────────────────────────────────────────
    generateOtp(identifier) {
        const key = String(identifier).trim().toLowerCase()
        // Generate random 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString()
        const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes valid

        this.otps.set(key, { otp, expiresAt, attempts: 0 })

        console.log(`\n======================================================`)
        console.log(`📲 [SMS / EMAIL OTP DISPATCH]`)
        console.log(`🎯 Recipient: ${key}`)
        console.log(`🔑 Verification Code: ${otp} (Valid for 5 mins)`)
        console.log(`💡 Demo Universal QA OTP: 777777 or 123456`)
        console.log(`======================================================\n`)

        if (CONFIG.USE_SUPABASE) {
            supabaseSync.syncOtp(key, otp, expiresAt).catch(() => {})
        }

        return { otp, expiresAt }
    }

    verifyOtp(identifier, code) {
        if (!identifier || !code) return false
        const key = String(identifier).trim().toLowerCase()
        const codeStr = String(code).trim()

        // Secure Demo QA Code: NEVER allowed in Production; NEVER allowed for Admin accounts
        const isAdminTarget = key === String(CONFIG.ADMIN_DEFAULT_EMAIL).toLowerCase() || 
                              key === normalizePhone(CONFIG.ADMIN_DEFAULT_PHONE)

        if (!CONFIG.isProduction && CONFIG.DEMO_OTP_BYPASS_ENABLED && !isAdminTarget) {
            if (codeStr === String(CONFIG.DEMO_OTP_CODE)) {
                this.otps.delete(key)
                if (CONFIG.USE_SUPABASE) {
                    supabaseSync.deleteOtp(key).catch(() => {})
                }
                return true
            }
        }

        const record = this.otps.get(key)
        if (!record) return false

        if (Date.now() > record.expiresAt) {
            this.otps.delete(key)
            if (CONFIG.USE_SUPABASE) {
                supabaseSync.deleteOtp(key).catch(() => {})
            }
            return false
        }

        record.attempts += 1
        if (record.attempts > 5) {
            this.otps.delete(key)
            if (CONFIG.USE_SUPABASE) {
                supabaseSync.deleteOtp(key).catch(() => {})
            }
            return false
        }

        if (record.otp === codeStr) {
            this.otps.delete(key)
            if (CONFIG.USE_SUPABASE) {
                supabaseSync.deleteOtp(key).catch(() => {})
            }
            return true
        }

        return false
    }

    getAllUsers(filters = {}) {
        let users = [...this.data.users]
        if (filters.search) {
            const s = filters.search.toLowerCase()
            users = users.filter(u =>
                (u.username && u.username.toLowerCase().includes(s)) ||
                (u.email && u.email.toLowerCase().includes(s)) ||
                (u.id && u.id.toLowerCase().includes(s))
            )
        }
        if (filters.role) {
            users = users.filter(u => u.role === filters.role)
        }
        if (filters.status) {
            users = users.filter(u => u.status === filters.status)
        }
        if (filters.isBanned !== undefined) {
            users = users.filter(u => u.isBanned === filters.isBanned)
        }
        return users
    }

    createUser(userData) {
        const id = 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

        // Generate unique referral code
        const baseRef = (userData.username || 'PLAYER').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()
        const referralCode = (baseRef + Math.random().toString(36).slice(2, 5)).toUpperCase()

        // Resolve referredBy if provided
        let referredBy = null
        const candidateCode = userData.referredBy || userData.referralCode
        if (candidateCode) {
            const cleanCode = String(candidateCode).trim().toUpperCase()
            const referrer = this.data.users.find(u => u.referralCode && u.referralCode.toUpperCase() === cleanCode)
            if (referrer && referrer.id !== id) {
                referredBy = referrer.id
                if (!referrer.affiliateStats) {
                    referrer.affiliateStats = { totalReferred: 0, totalTurnover: 0, totalEarned: 0, unclaimedEarnings: 0 }
                }
                referrer.affiliateStats.totalReferred += 1
            }
        }

        const newUser = {
            id,
            role: 'player',
            status: 'active',
            balances: {
                INR: 100.00, // ₹100 Welcome Bonus to start playing!
                BTC: 0.0000,
                USDT: 0.00,
                AMRAT: 0.00,
            },
            totalDeposited: 0, // Enforces ₹300 minimum deposit before withdrawal
            totalWagered: 0, // 1.0x AML turnover requirement on deposits
            referralCode,
            referredBy,
            affiliateStats: {
                totalReferred: 0,
                totalTurnover: 0,
                totalEarned: 0,
                unclaimedEarnings: 0
            },
            unclaimedRakeback: 0,
            totalRakebackEarned: 0,
            isBanned: false,
            kycStatus: 'unverified',
            phone: userData.phone ? normalizePhone(userData.phone) : '',
            phoneVerified: Boolean(userData.phoneVerified),
            emailVerified: Boolean(userData.emailVerified),
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            avatar: '👤',
            passwordHash: userData.passwordHash || bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10),
            ...userData,
            referralCode,
            referredBy
        }

        // Automatic ₹100 Welcome Bonus Transaction record
        const bonusTx = {
            id: 'tx_bonus_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            userId: id,
            username: newUser.username,
            type: 'credit',
            currency: 'INR',
            amount: 100.00,
            balanceAfter: 100.00,
            note: '🎁 Welcome Bonus: ₹100 Free Sign-Up Reward',
            timestamp: new Date().toISOString()
        }

        this.data.users.push(newUser)
        this._indexUser(newUser)
        this.data.transactions.unshift(bonusTx)
        this.updateTreasurySupply()
        this.persist()

        if (CONFIG.USE_SUPABASE) {
            supabaseSync.syncUser(newUser).catch(() => {})
            supabaseSync.syncTransaction(bonusTx).catch(() => {})
        }

        return newUser
    }

    updateUser(id, updates) {
        const index = this.data.users.findIndex(u => u.id === id)
        if (index === -1) return null
        const oldUser = this.data.users[index]

        if (updates.email && updates.email !== oldUser.email) {
            this._usersByEmail.delete(String(oldUser.email).toLowerCase())
        }
        if (updates.username && updates.username !== oldUser.username) {
            this._usersByUsername.delete(String(oldUser.username).toLowerCase())
        }
        if (updates.phone && updates.phone !== oldUser.phone) {
            const oldNorm = normalizePhone(oldUser.phone)
            if (oldNorm) this._usersByPhone.delete(oldNorm)
        }

        const updated = { ...oldUser, ...updates }
        this.data.users[index] = updated
        this._indexUser(updated)
        this.updateTreasurySupply()
        this.persist()

        if (CONFIG.USE_SUPABASE) {
            supabaseSync.syncUser(updated).catch(() => {})
        }

        return updated
    }

    updateUserBalance(userId, currency, delta, note = '') {
        const user = this.findUserById(userId)
        if (!user) return null
        if (!user.balances) user.balances = { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 }
        
        const currentBal = user.balances[currency] || 0
        const newBal = Math.max(0, parseFloat((currentBal + delta).toFixed(4)))
        user.balances[currency] = newBal

        // Accumulate totalWagered on game bet deductions (AML Turnover tracking)
        if (delta < 0 && typeof note === 'string' && /(bet|launch|mines|crash|wager)/i.test(note)) {
            user.totalWagered = parseFloat(((user.totalWagered || 0) + Math.abs(delta)).toFixed(2))
            this.accumulateWagerRewards(user, Math.abs(delta))
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

        if (CONFIG.USE_SUPABASE) {
            supabaseSync.syncUser(user).catch(() => {})
            supabaseSync.syncTransaction(tx).catch(() => {})
        }

        return { user, transaction: tx }
    }

    // ── Concurrency & Transactional Lock Engine ───────────────
    async withUserLock(userId, task) {
        return userLockManager.withLock(userId, task)
    }

    accumulateWagerRewards(user, betAmount) {
        if (!user || betAmount <= 0) return

        // 1. VIP Tier & Rakeback Accumulation
        const tier = getVipTier(user.totalWagered)
        const rakeback = parseFloat((betAmount * 0.01 * tier.rakebackRate).toFixed(4))
        user.unclaimedRakeback = parseFloat(((user.unclaimedRakeback || 0) + rakeback).toFixed(4))
        user.totalRakebackEarned = parseFloat(((user.totalRakebackEarned || 0) + rakeback).toFixed(4))

        // 2. Affiliate Commission Accumulation for Referrer (0.3% turnover)
        if (user.referredBy) {
            const referrer = this.findUserById(user.referredBy)
            if (referrer) {
                if (!referrer.affiliateStats) {
                    referrer.affiliateStats = { totalReferred: 0, totalTurnover: 0, totalEarned: 0, unclaimedEarnings: 0 }
                }
                const comm = parseFloat((betAmount * 0.003).toFixed(4))
                referrer.affiliateStats.totalTurnover = parseFloat(((referrer.affiliateStats.totalTurnover || 0) + betAmount).toFixed(2))
                referrer.affiliateStats.totalEarned = parseFloat(((referrer.affiliateStats.totalEarned || 0) + comm).toFixed(4))
                referrer.affiliateStats.unclaimedEarnings = parseFloat(((referrer.affiliateStats.unclaimedEarnings || 0) + comm).toFixed(4))
            }
        }
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

    getAffiliateStats(userId) {
        const user = this.findUserById(userId)
        if (!user) return null

        const referredUsers = (this.data.users || [])
            .filter(u => u.referredBy === userId)
            .map(u => ({
                id: u.id,
                username: u.username ? (u.username.slice(0, 2) + '***' + u.username.slice(-1)) : 'Player',
                totalWagered: u.totalWagered || 0,
                createdAt: u.createdAt
            }))

        return {
            referralCode: user.referralCode || '',
            referralLink: `https://amratgames.com/?ref=${user.referralCode || ''}`,
            totalReferred: referredUsers.length,
            totalTurnover: user.affiliateStats?.totalTurnover || 0,
            totalEarned: user.affiliateStats?.totalEarned || 0,
            unclaimedEarnings: user.affiliateStats?.unclaimedEarnings || 0,
            referredUsers: referredUsers.slice(0, 20)
        }
    }

    getVipTier(totalWagered) {
        return getVipTier(totalWagered)
    }

    getVipStatus(userId) {
        const user = this.findUserById(userId)
        if (!user) return null
        const totalWagered = user.totalWagered || 0
        const tier = getVipTier(totalWagered)

        return {
            currentTier: tier.tier,
            level: tier.level,
            icon: tier.icon,
            rakebackRate: tier.rakebackRate,
            rakebackPercent: `${(tier.rakebackRate * 100).toFixed(0)}%`,
            totalWagered,
            unclaimedRakeback: user.unclaimedRakeback || 0,
            totalRakebackEarned: user.totalRakebackEarned || 0,
            minWager: tier.minWager,
            nextTierWager: tier.nextTierWager,
            progressPct: tier.progressPct,
            canClaim: (user.unclaimedRakeback || 0) >= 1.0
        }
    }

    async claimRakeback(userId) {
        return this.withUserLock(userId, async () => {
            const user = this.findUserById(userId)
            if (!user) throw new Error('User not found')
            const amount = user.unclaimedRakeback || 0
            if (amount < 1) {
                const err = new Error('Minimum claimable rakeback is ₹1.00')
                err.status = 400
                throw err
            }

            const currentBal = user.balances?.INR || 0
            const newBal = parseFloat((currentBal + amount).toFixed(2))
            user.balances.INR = newBal
            user.unclaimedRakeback = 0

            const tx = {
                id: 'tx_rakeback_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
                userId: user.id,
                username: user.username,
                type: 'credit',
                currency: 'INR',
                amount,
                balanceAfter: newBal,
                note: '👑 VIP Rakeback Reward Claimed',
                timestamp: new Date().toISOString()
            }
            this.data.transactions.unshift(tx)
            this.persist()

            return { user, claimedAmount: amount, newBalance: newBal, transaction: tx }
        })
    }

    async claimAffiliateCommission(userId) {
        return this.withUserLock(userId, async () => {
            const user = this.findUserById(userId)
            if (!user) throw new Error('User not found')
            const amount = user.affiliateStats?.unclaimedEarnings || 0
            if (amount < 10) {
                const err = new Error('Minimum claimable affiliate commission is ₹10.00')
                err.status = 400
                throw err
            }

            const currentBal = user.balances?.INR || 0
            const newBal = parseFloat((currentBal + amount).toFixed(2))
            user.balances.INR = newBal
            user.affiliateStats.unclaimedEarnings = 0

            const tx = {
                id: 'tx_aff_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
                userId: user.id,
                username: user.username,
                type: 'credit',
                currency: 'INR',
                amount,
                balanceAfter: newBal,
                note: '🤝 Affiliate Referral Commission Claimed',
                timestamp: new Date().toISOString()
            }
            this.data.transactions.unshift(tx)
            this.persist()

            return { user, claimedAmount: amount, newBalance: newBal, transaction: tx }
        })
    }

    async executeAtomicBet({ userId, currency = 'INR', betAmount, game, gameName, evaluator }) {
        return this.withUserLock(userId, async () => {
            const user = this.findUserById(userId)
            if (!user) throw new Error('User account not found')
            if (!user.balances) user.balances = { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 }

            const currentBal = user.balances[currency] || 0
            if (betAmount > currentBal + 0.0001) {
                const err = new Error(`Insufficient ${currency} balance to place bet`)
                err.code = 'INSUFFICIENT_BALANCE'
                err.status = 400
                throw err
            }

            // 1. Deduct bet amount immediately under exclusive lock
            const balanceAfterDeduct = Math.max(0, parseFloat((currentBal - betAmount).toFixed(4)))
            user.balances[currency] = balanceAfterDeduct
            user.totalWagered = parseFloat(((user.totalWagered || 0) + betAmount).toFixed(2))
            this.accumulateWagerRewards(user, betAmount)

            // 2. Evaluate Provably Fair outcome
            const evaluation = await evaluator()
            const won = Boolean(evaluation.won)
            const multiplier = evaluation.multiplier || 0
            const payout = evaluation.payout || 0
            const profit = payout - betAmount

            // 3. Credit payout if won
            if (won && payout > 0) {
                user.balances[currency] = parseFloat((user.balances[currency] + payout).toFixed(4))
            }
            const finalBal = user.balances[currency]

            // 4. Record transaction in atomic ledger
            const tx = {
                id: 'tx_bet_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
                userId: user.id,
                username: user.username,
                type: won ? 'win' : 'bet',
                currency,
                amount: profit,
                balanceAfter: finalBal,
                note: `Bet on ${gameName} (${won ? `Won ${multiplier}x` : 'Lost'})`,
                timestamp: new Date().toISOString()
            }
            this.data.transactions.unshift(tx)
            if (this.data.transactions.length > 5000) {
                this.data.transactions = this.data.transactions.slice(0, 5000)
            }

            // 5. Record bet in historical roll
            const betRecord = {
                id: 'bet_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
                userId: user.id,
                username: user.username,
                game,
                gameName,
                currency,
                betAmount,
                multiplier,
                payout,
                profit,
                won,
                hash: evaluation.hash || crypto.randomBytes(16).toString('hex'),
                timestamp: new Date().toISOString()
            }
            this.data.bets.unshift(betRecord)
            if (this.data.bets.length > 500) {
                this.data.bets = this.data.bets.slice(0, 500)
            }

            this.updateTreasurySupply()
            this.persist()

            if (CONFIG.USE_SUPABASE) {
                supabaseSync.syncUser(user).catch(() => {})
                supabaseSync.syncTransaction(tx).catch(() => {})
                supabaseSync.syncBet(betRecord).catch(() => {})
            }

            return {
                user,
                bet: betRecord,
                evaluation,
                won,
                multiplier,
                payout,
                balances: user.balances
            }
        })
    }

    // ── Withdrawal Methods ────────────────────────────────────
    requestWithdrawal({ userId, currency = 'INR', amount, payoutMethod = 'UPI', payoutDestination, bankDetails = null }) {
        const user = this.findUserById(userId)
        if (!user) throw new Error('User not found')
        if (!user.balances) user.balances = { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 }

        const currentBal = user.balances[currency] || 0
        if (amount > currentBal) {
            throw new Error(`Insufficient ${currency} balance (Available: ₹${currentBal.toLocaleString('en-IN')})`)
        }

        // Deduct balance from user
        const newBal = Math.max(0, parseFloat((currentBal - amount).toFixed(4)))
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

        if (CONFIG.USE_SUPABASE) {
            supabaseSync.syncUser(user).catch(() => {})
            supabaseSync.syncTransaction(tx).catch(() => {})
        }

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

        // Update corresponding transaction in transactions history
        const tx = (this.data.transactions || []).find(t => t.id === w.transactionId || t.withdrawalId === w.id)
        if (tx) {
            tx.status = 'approved'
            tx.note = `Withdrawal Approved to ${w.payoutDestination}${transactionRef ? ` (Ref: ${transactionRef})` : ''}`
        }

        this.persist()

        if (CONFIG.USE_SUPABASE && tx) {
            supabaseSync.syncTransaction(tx).catch(() => {})
        }

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

        // Refund player balance
        const user = this.findUserById(w.userId)
        let refundTx = null
        if (user) {
            if (!user.balances) user.balances = { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 }
            const currentBal = user.balances[w.currency] || 0
            const refundedBal = parseFloat((currentBal + w.amount).toFixed(4))
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

            if (CONFIG.USE_SUPABASE) {
                supabaseSync.syncUser(user).catch(() => {})
                supabaseSync.syncTransaction(refundTx).catch(() => {})
            }
        }

        // Update original transaction
        const tx = (this.data.transactions || []).find(t => t.id === w.transactionId || t.withdrawalId === w.id)
        if (tx) {
            tx.status = 'rejected'
            tx.note = `Withdrawal Rejected (${w.rejectionReason}) [Balance Refunded]`
            if (CONFIG.USE_SUPABASE) {
                supabaseSync.syncTransaction(tx).catch(() => {})
            }
        }

        this.persist()

        broadcastEvent('WITHDRAWAL_STATUS_UPDATED', w)

        return { withdrawal: w, user, refundTransaction: refundTx }
    }

    getWithdrawalStats() {
        if (!this.data.withdrawals) this.data.withdrawals = []
        const list = this.data.withdrawals
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

    // ── Deposit Verification Methods ───────────────────────────
    requestDeposit({ userId, currency = 'INR', amount, paymentMethod = 'UPI', utrNumber = '' }) {
        const user = this.findUserById(userId)
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
        if (cleanUtr && cleanUtr.length < 6) {
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
        this.data.transactions.unshift(tx)
        if (this.data.transactions.length > 5000) {
            this.data.transactions = this.data.transactions.slice(0, 5000)
        }

        this.persist()

        if (CONFIG.USE_SUPABASE) {
            supabaseSync.syncTransaction(tx).catch(() => {})
        }

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
                (d.userPhone && d.userPhone.includes(s))
            )
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

        const user = this.findUserById(deposit.userId)
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

        // 2. Accumulate legitimate totalDeposited (now unlocking withdrawals)
        const newTotalDeposit = parseFloat(((user.totalDeposited || 0) + deposit.amount).toFixed(2))
        this.updateUser(user.id, { totalDeposited: newTotalDeposit })

        // 3. Update original transaction
        const tx = (this.data.transactions || []).find(t => t.id === deposit.transactionId || t.depositId === deposit.id)
        if (tx) {
            tx.status = 'completed'
            tx.balanceAfter = user.balances?.[deposit.currency] || 0
            tx.note = `Deposit Approved (UTR: ${deposit.utrNumber || 'N/A'})`
        }

        this.persist()

        if (CONFIG.USE_SUPABASE) {
            supabaseSync.syncUser(user).catch(() => {})
            if (tx) supabaseSync.syncTransaction(tx).catch(() => {})
        }

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
        }

        this.persist()

        broadcastEvent('DEPOSIT_STATUS_UPDATED', deposit)

        return { deposit }
    }

    // ── Token Distribution / Airdrop Methods ──────────────────
    distributeTokens({ adminId, adminUsername, token = 'AMRAT', amount, targetGroup = 'all_players', targetUserId = null, campaign = '', note = '' }) {
        const parsedAmount = parseFloat(amount)
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            throw new Error('Invalid distribution amount')
        }

        let recipients = []
        if (targetUserId) {
            const user = this.findUserById(targetUserId)
            if (!user) throw new Error('Target user not found')
            recipients = [user]
        } else if (targetGroup === 'vip') {
            recipients = this.data.users.filter(u => u.status === 'vip' && !u.isBanned)
        } else if (targetGroup === 'active_24h') {
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            recipients = this.data.users.filter(u => u.lastLoginAt >= dayAgo && !u.isBanned)
        } else {
            // all players
            recipients = this.data.users.filter(u => u.role !== 'admin' && !u.isBanned)
        }

        if (recipients.length === 0) {
            throw new Error('No eligible recipients found for this target group')
        }

        const totalDistributed = parsedAmount * recipients.length

        // If distributing AMRAT token, verify treasury balance
        if (token === 'AMRAT') {
            if (this.data.settings.tokenTreasury.treasuryBalance < totalDistributed) {
                throw new Error(`Insufficient $AMRAT in platform treasury. Available: ${this.data.settings.tokenTreasury.treasuryBalance}, Required: ${totalDistributed}`)
            }
        }

        // Credit each recipient
        const timestamp = new Date().toISOString()
        for (const user of recipients) {
            if (!user.balances) user.balances = { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 }
            user.balances[token] = Math.max(0, parseFloat(((user.balances[token] || 0) + parsedAmount).toFixed(4)))

            // Add player transaction entry
            this.data.transactions.unshift({
                id: 'tx_airdrop_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                userId: user.id,
                username: user.username,
                type: 'airdrop',
                currency: token,
                amount: parsedAmount,
                balanceAfter: user.balances[token],
                note: campaign ? `[Airdrop] ${campaign}: ${note}` : `[Airdrop] ${note}`,
                timestamp
            })
        }

        // Record airdrop event
        const airdropRecord = {
            id: 'airdrop_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            campaign: campaign || 'Royal Platform Airdrop',
            adminId,
            adminUsername,
            token,
            amountPerUser: parsedAmount,
            recipientCount: recipients.length,
            totalAmount: totalDistributed,
            targetGroup: targetUserId ? `User: ${recipients[0].username}` : targetGroup,
            note,
            timestamp
        }

        this.data.airdrops.unshift(airdropRecord)
        this.updateTreasurySupply()
        this.persist()

        if (CONFIG.USE_SUPABASE) {
            supabaseSync.syncAirdrop(airdropRecord).catch(() => {})
            for (const user of recipients) {
                supabaseSync.syncUser(user).catch(() => {})
            }
        }

        return {
            airdrop: airdropRecord,
            recipientsCount: recipients.length,
            totalDistributed
        }
    }

    updateTreasurySupply() {
        const totalUserAmrat = this.data.users.reduce((acc, u) => acc + (u.balances?.AMRAT || 0), 0)
        const totalAirdropped = this.data.airdrops
            .filter(a => a.token === 'AMRAT')
            .reduce((acc, a) => acc + a.totalAmount, 0)

        this.data.settings.tokenTreasury = {
            totalSupply: CONFIG.TOKEN_INITIAL_TREASURY,
            circulatingSupply: parseFloat(totalUserAmrat.toFixed(2)),
            treasuryBalance: Math.max(0, parseFloat((CONFIG.TOKEN_INITIAL_TREASURY - totalUserAmrat).toFixed(2))),
            totalAirdropped: parseFloat(totalAirdropped.toFixed(2))
        }
    }

    // ── Bets & Games Methods ──────────────────────────────────
    recordBet(betData) {
        const bet = {
            id: 'bet_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            timestamp: new Date().toISOString(),
            ...betData
        }
        this.data.bets.unshift(bet)
        if (this.data.bets.length > 500) {
            this.data.bets = this.data.bets.slice(0, 500)
        }
        this.persist()

        if (CONFIG.USE_SUPABASE) {
            supabaseSync.syncBet(bet).catch(() => {})
        }

        return bet
    }

    getRecentBets(limit = 25) {
        return this.data.bets.slice(0, limit)
    }

    getUserBets(userId, limit = 50) {
        return this.data.bets.filter(b => b.userId === userId).slice(0, limit)
    }

    getUserTransactions(userId, limit = 50) {
        if (!this.data.transactions) this.data.transactions = []
        return this.data.transactions.filter(t => t.userId === userId).slice(0, limit)
    }

    // ── Platform Analytics ────────────────────────────────────
    getPlatformStats() {
        const totalUsers = this.data.users.length
        const activeUsers = this.data.users.filter(u => !u.isBanned).length
        const totalBetsCount = this.data.bets.length
        
        let totalWageredINR = 0
        let totalPayoutINR = 0

        for (const b of this.data.bets) {
            // Normalize approx to INR for high-level aggregate dashboard
            let multiplier = 1
            if (b.currency === 'USDT') multiplier = 86
            if (b.currency === 'BTC') multiplier = 8500000
            if (b.currency === 'AMRAT') multiplier = 10

            totalWageredINR += (b.betAmount || 0) * multiplier
            totalPayoutINR += (b.payout || 0) * multiplier
        }

        const netHouseProfitINR = totalWageredINR - totalPayoutINR
        const ggr = totalWageredINR > 0 ? ((netHouseProfitINR / totalWageredINR) * 100).toFixed(2) : '1.00'

        return {
            totalUsers,
            activeUsers,
            totalBetsCount,
            totalWageredApproxINR: Math.round(totalWageredINR),
            totalPayoutApproxINR: Math.round(totalPayoutINR),
            netHouseProfitINR: Math.round(netHouseProfitINR),
            ggrPercentage: ggr,
            settings: this.data.settings,
            treasury: this.data.settings.tokenTreasury,
            recentAirdropsCount: this.data.airdrops.length,
            withdrawalStats: this.getWithdrawalStats()
        }
    }

    rotateServerSeed() {
        const oldSeed = this.data.settings.currentServerSeed
        const newSeed = crypto.randomBytes(32).toString('hex')
        const newHash = crypto.createHash('sha256').update(newSeed).digest('hex')

        this.data.settings.currentServerSeed = newSeed
        this.data.settings.serverSeedHash = newHash
        this.persist()

        if (CONFIG.USE_SUPABASE) {
            supabaseSync.syncSettings(this.data.settings).catch(() => {})
        }

        return {
            revealedPreviousSeed: oldSeed,
            newServerSeedHash: newHash
        }
    }

    updateSettings(newSettings) {
        this.data.settings = { ...this.data.settings, ...newSettings }
        this.persist()

        if (CONFIG.USE_SUPABASE) {
            supabaseSync.syncSettings(this.data.settings).catch(() => {})
        }

        return this.data.settings
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
