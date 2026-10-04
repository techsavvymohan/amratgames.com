import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { CONFIG } from '../config.js'
import { supabaseSync } from './SupabaseSyncService.js'
import { isSupabaseConfigured, testSupabaseConnection } from './SupabaseClient.js'

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

class Database {
    constructor() {
        this.dir = CONFIG.DATA_DIR
        this.filePath = path.join(this.dir, 'amratgames_db.json')
        this.otps = new Map() // identifier -> { otp, expiresAt, attempts }
        this.data = {
            users: [],
            transactions: [],
            bets: [],
            airdrops: [],
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
    }

    init() {
        if (!fs.existsSync(this.dir)) {
            fs.mkdirSync(this.dir, { recursive: true })
        }

        if (fs.existsSync(this.filePath)) {
            try {
                const raw = fs.readFileSync(this.filePath, 'utf-8')
                this.data = JSON.parse(raw)
            } catch (err) {
                console.error('[DB] Error loading existing db file, initializing fresh store:', err)
                this.seedInitialData()
                this.persist()
            }
        } else {
            this.seedInitialData()
            this.persist()
        }

        // Migrate and ensure phone numbers for seeded users
        const phoneMap = {
            'usr_admin_001': '9876500001',
            'usr_play_101': '9876510101',
            'usr_play_102': '9876510202',
            'usr_play_103': '9876510303',
            'usr_play_104': '9876510404',
            'usr_play_105': '9876510505',
            'usr_play_106': '9876510606',
        }
        for (const u of this.data.users) {
            if (!u.phone && phoneMap[u.id]) {
                u.phone = phoneMap[u.id]
                u.phoneVerified = true
            }
        }
        this.persist()

        // Compute current server seed hash
        if (this.data.settings?.currentServerSeed) {
            this.data.settings.serverSeedHash = crypto
                .createHash('sha256')
                .update(this.data.settings.currentServerSeed)
                .digest('hex')
        }
    }

    persist() {
        try {
            const tempFile = `${this.filePath}.tmp`
            fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8')
            fs.renameSync(tempFile, this.filePath)
        } catch (err) {
            console.error('[DB] Persist error:', err)
        }
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
                INR: 500000.00,
                BTC: 5.5000,
                USDT: 50000.00,
                AMRAT: 1000000.00,
            },
            isBanned: false,
            kycStatus: 'verified',
            createdAt: '2025-01-01T00:00:00.000Z',
            lastLoginAt: now,
            avatar: '👑'
        }

        // 2. Realistic Players for Platform Atmosphere
        const initialPlayers = [
            {
                id: 'usr_play_101',
                username: 'aarav_king',
                email: 'aarav.royal@gmail.com',
                passwordHash: playerPasswordHash,
                role: 'player',
                status: 'vip',
                balances: { INR: 84250.00, BTC: 0.1250, USDT: 2450.00, AMRAT: 12500.00 },
                isBanned: false,
                kycStatus: 'verified',
                createdAt: '2025-01-10T12:00:00.000Z',
                lastLoginAt: now,
                avatar: '🦁'
            },
            {
                id: 'usr_play_102',
                username: 'priya_crypto',
                email: 'priya.trader@yahoo.com',
                passwordHash: playerPasswordHash,
                role: 'player',
                status: 'active',
                balances: { INR: 32400.00, BTC: 0.4500, USDT: 5120.00, AMRAT: 8200.00 },
                isBanned: false,
                kycStatus: 'verified',
                createdAt: '2025-01-14T14:30:00.000Z',
                lastLoginAt: now,
                avatar: '💎'
            },
            {
                id: 'usr_play_103',
                username: 'vikram_dice',
                email: 'vikram.dice@gmail.com',
                passwordHash: playerPasswordHash,
                role: 'player',
                status: 'active',
                balances: { INR: 15800.00, BTC: 0.0400, USDT: 800.00, AMRAT: 3500.00 },
                isBanned: false,
                kycStatus: 'pending',
                createdAt: '2025-01-20T08:15:00.000Z',
                lastLoginAt: now,
                avatar: '🎲'
            },
            {
                id: 'usr_play_104',
                username: 'rohit_777',
                email: 'rohit777@hotmail.com',
                passwordHash: playerPasswordHash,
                role: 'player',
                status: 'vip',
                balances: { INR: 124500.00, BTC: 1.2000, USDT: 14200.00, AMRAT: 45000.00 },
                isBanned: false,
                kycStatus: 'verified',
                createdAt: '2025-01-22T19:40:00.000Z',
                lastLoginAt: now,
                avatar: '⚡'
            },
            {
                id: 'usr_play_105',
                username: 'neha_lucky',
                email: 'neha.luck@outlook.com',
                passwordHash: playerPasswordHash,
                role: 'player',
                status: 'active',
                balances: { INR: 9800.00, BTC: 0.0150, USDT: 320.00, AMRAT: 1500.00 },
                isBanned: false,
                kycStatus: 'verified',
                createdAt: '2025-02-01T11:20:00.000Z',
                lastLoginAt: now,
                avatar: '🍀'
            },
            {
                id: 'usr_play_106',
                username: 'kabir_whale',
                email: 'kabir.whale@proton.me',
                passwordHash: playerPasswordHash,
                role: 'player',
                status: 'vip',
                balances: { INR: 350000.00, BTC: 3.8500, USDT: 48900.00, AMRAT: 120000.00 },
                isBanned: false,
                kycStatus: 'verified',
                createdAt: '2025-02-05T16:00:00.000Z',
                lastLoginAt: now,
                avatar: '🐋'
            },
            {
                id: 'usr_play_107',
                username: 'suspect_bot99',
                email: 'bot99@trashmail.com',
                passwordHash: playerPasswordHash,
                role: 'player',
                status: 'banned',
                balances: { INR: 120.00, BTC: 0.0001, USDT: 5.00, AMRAT: 0.00 },
                isBanned: true,
                kycStatus: 'rejected',
                createdAt: '2025-02-10T02:00:00.000Z',
                lastLoginAt: '2025-02-10T03:10:00.000Z',
                avatar: '🤖'
            }
        ]

        this.data.users = [adminUser, ...initialPlayers]

        // 3. Seeded Initial Airdrop History
        this.data.airdrops = [
            {
                id: 'airdrop_init_001',
                campaign: 'Genesis Community Welcome Airdrop',
                adminId: 'usr_admin_001',
                adminUsername: 'amrat_master',
                token: 'AMRAT',
                amountPerUser: 1000,
                recipientCount: 6,
                totalAmount: 6000,
                targetGroup: 'all_players',
                note: 'Initial $AMRAT loyalty bonus grant to registered Indian high rollers',
                timestamp: '2025-02-15T10:00:00.000Z'
            },
            {
                id: 'airdrop_init_002',
                campaign: 'VIP Whale Staking Bonus',
                adminId: 'usr_admin_001',
                adminUsername: 'amrat_master',
                token: 'AMRAT',
                amountPerUser: 15000,
                recipientCount: 3,
                totalAmount: 45000,
                targetGroup: 'vip',
                note: 'Special VIP staking dividend reward for top wagerers',
                timestamp: '2025-02-28T18:30:00.000Z'
            }
        ]

        // Calculate circulating supply from seed
        const totalAirdropped = this.data.airdrops.reduce((acc, a) => acc + a.totalAmount, 0)
        const totalUserAmrat = this.data.users.reduce((acc, u) => acc + (u.balances?.AMRAT || 0), 0)

        this.data.settings.tokenTreasury = {
            totalSupply: CONFIG.TOKEN_INITIAL_TREASURY,
            circulatingSupply: totalUserAmrat,
            treasuryBalance: CONFIG.TOKEN_INITIAL_TREASURY - totalUserAmrat,
            totalAirdropped: totalAirdropped
        }

        // 4. Seeded Recent Bets Feed
        this.data.bets = [
            {
                id: 'bet_101',
                userId: 'usr_play_101',
                username: 'aarav_king',
                game: 'crash',
                gameName: 'Crash 1000x',
                currency: 'INR',
                betAmount: 2500,
                multiplier: 3.45,
                payout: 8625,
                profit: 6125,
                won: true,
                timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
                hash: crypto.randomBytes(16).toString('hex')
            },
            {
                id: 'bet_102',
                userId: 'usr_play_106',
                username: 'kabir_whale',
                game: 'plinko',
                gameName: 'Plinko 16-Pin',
                currency: 'USDT',
                betAmount: 100,
                multiplier: 29.00,
                payout: 2900,
                profit: 2800,
                won: true,
                timestamp: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
                hash: crypto.randomBytes(16).toString('hex')
            },
            {
                id: 'bet_103',
                userId: 'usr_play_104',
                username: 'rohit_777',
                game: 'mines',
                gameName: 'Mines 5x5',
                currency: 'INR',
                betAmount: 5000,
                multiplier: 0.00,
                payout: 0,
                profit: -5000,
                won: false,
                timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
                hash: crypto.randomBytes(16).toString('hex')
            },
            {
                id: 'bet_104',
                userId: 'usr_play_102',
                username: 'priya_crypto',
                game: 'limbo',
                gameName: 'Limbo Turbo',
                currency: 'BTC',
                betAmount: 0.005,
                multiplier: 12.50,
                payout: 0.0625,
                profit: 0.0575,
                won: true,
                timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
                hash: crypto.randomBytes(16).toString('hex')
            }
        ]

        // 5. Seeded Transaction records
        this.data.transactions = [
            {
                id: 'tx_001',
                userId: 'usr_play_101',
                type: 'deposit',
                currency: 'INR',
                amount: 50000,
                note: 'UPI Instant Settlement (GPay)',
                timestamp: '2025-02-20T10:14:00.000Z'
            },
            {
                id: 'tx_002',
                userId: 'usr_play_106',
                type: 'deposit',
                currency: 'USDT',
                amount: 50000,
                note: 'TRC20 Blockchain Transfer',
                timestamp: '2025-02-21T14:22:00.000Z'
            }
        ]
    }

    // ── User Methods ──────────────────────────────────────────
    findUserById(id) {
        return this.data.users.find(u => u.id === id)
    }

    findUserByEmail(email) {
        return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase())
    }

    findUserByUsername(username) {
        return this.data.users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase())
    }

    findUserByPhone(phone) {
        const normalized = normalizePhone(phone)
        if (!normalized) return null
        return this.data.users.find(u => u.phone && normalizePhone(u.phone) === normalized)
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

        // Universal Demo QA Codes
        if (codeStr === '777777' || codeStr === '123456') {
            this.otps.delete(key)
            if (CONFIG.USE_SUPABASE) {
                supabaseSync.deleteOtp(key).catch(() => {})
            }
            return true
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
                u.username.toLowerCase().includes(s) ||
                u.email.toLowerCase().includes(s) ||
                u.id.toLowerCase().includes(s)
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
        const newUser = {
            id,
            role: 'player',
            status: 'active',
            balances: {
                INR: 10000.00, // Free 10,000 INR practice wallet
                BTC: 0.0000,
                USDT: 0.00,
                AMRAT: 500.00, // 500 Welcome AMRAT Tokens
            },
            isBanned: false,
            kycStatus: 'unverified',
            phone: userData.phone ? normalizePhone(userData.phone) : '',
            phoneVerified: Boolean(userData.phoneVerified),
            emailVerified: Boolean(userData.emailVerified),
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            avatar: '👤',
            ...userData
        }
        this.data.users.push(newUser)
        this.updateTreasurySupply()
        this.persist()

        if (CONFIG.USE_SUPABASE) {
            supabaseSync.syncUser(newUser).catch(() => {})
        }

        return newUser
    }

    updateUser(id, updates) {
        const index = this.data.users.findIndex(u => u.id === id)
        if (index === -1) return null
        this.data.users[index] = { ...this.data.users[index], ...updates }
        this.updateTreasurySupply()
        this.persist()

        if (CONFIG.USE_SUPABASE) {
            supabaseSync.syncUser(this.data.users[index]).catch(() => {})
        }

        return this.data.users[index]
    }

    updateUserBalance(userId, currency, delta, note = '') {
        const user = this.findUserById(userId)
        if (!user) return null
        if (!user.balances) user.balances = { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 }
        
        const currentBal = user.balances[currency] || 0
        const newBal = Math.max(0, parseFloat((currentBal + delta).toFixed(4)))
        user.balances[currency] = newBal

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
        this.updateTreasurySupply()
        this.persist()

        if (CONFIG.USE_SUPABASE) {
            supabaseSync.syncUser(user).catch(() => {})
            supabaseSync.syncTransaction(tx).catch(() => {})
        }

        return { user, transaction: tx }
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
            recentAirdropsCount: this.data.airdrops.length
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
                const mappedUsers = cloudUsers.map(u => ({
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
                    balances: u.balances || { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 },
                    createdAt: u.created_at,
                    lastLoginAt: u.last_login_at
                }))

                const userMap = new Map()
                for (const lu of this.data.users) userMap.set(lu.id, lu)
                for (const cu of mappedUsers) userMap.set(cu.id, cu)
                this.data.users = Array.from(userMap.values())
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
