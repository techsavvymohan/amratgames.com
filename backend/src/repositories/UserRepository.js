import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { BaseRepository } from './BaseRepository.js'
import { CONFIG } from '../config.js'
import { normalizePhone, getVipTier } from '../db/db.js'
import { houseVaultService } from '../services/HouseVaultService.js'

/**
 * 👤 UserRepository
 * Manages identity, authentication, OTPs, VIP tier progression, and affiliate tree.
 */
export class UserRepository extends BaseRepository {
    findUserById(id) {
        if (!id) return null
        return this.db._usersById.get(id) || this.data.users.find(u => u.id === id) || null
    }

    findUserByEmail(email) {
        if (!email) return null
        const key = String(email).toLowerCase()
        return this.db._usersByEmail.get(key) || this.data.users.find(u => u.email && u.email.toLowerCase() === key) || null
    }

    findUserByUsername(username) {
        if (!username) return null
        const key = String(username).toLowerCase()
        return this.db._usersByUsername.get(key) || this.data.users.find(u => u.username && u.username.toLowerCase() === key) || null
    }

    findUserByPhone(phone) {
        const normalized = normalizePhone(phone)
        if (!normalized) return null
        return this.db._usersByPhone.get(normalized) || this.data.users.find(u => u.phone && normalizePhone(u.phone) === normalized) || null
    }

    findUserByLogin(login) {
        if (!login) return null
        const str = String(login).trim()

        if (str.includes('@')) {
            return this.findUserByEmail(str)
        }

        const digitsOnly = normalizePhone(str)
        if (digitsOnly && digitsOnly.length >= 10) {
            const byPhone = this.findUserByPhone(digitsOnly)
            if (byPhone) return byPhone
        }

        return this.findUserByUsername(str)
    }

    generateOtp(identifier) {
        const key = String(identifier).trim().toLowerCase()
        const otp = Math.floor(100000 + Math.random() * 900000).toString()
        const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes valid

        this.db.otps.set(key, { otp, expiresAt, attempts: 0 })

        console.log(`\n======================================================`)
        console.log(`📲 [SMS / EMAIL OTP DISPATCH]`)
        console.log(`🎯 Recipient: ${key}`)
        console.log(`🔑 Verification Code: ${otp} (Valid for 5 mins)`)
        console.log(`💡 Demo Universal QA OTP: 777777 or 123456`)
        console.log(`======================================================\n`)

        this.enqueueOutbox('syncOtp', { identifier: key, otp, expiresAt })

        return { otp, expiresAt }
    }

    verifyOtp(identifier, code) {
        if (!identifier || !code) return false
        const key = String(identifier).trim().toLowerCase()
        const codeStr = String(code).trim()

        const isAdminTarget = key === String(CONFIG.ADMIN_DEFAULT_EMAIL).toLowerCase() || 
                              key === normalizePhone(CONFIG.ADMIN_DEFAULT_PHONE)

        if (!CONFIG.isProduction && CONFIG.DEMO_OTP_BYPASS_ENABLED && !isAdminTarget) {
            if (codeStr === String(CONFIG.DEMO_OTP_CODE)) {
                this.db.otps.delete(key)
                this.enqueueOutbox('deleteOtp', { identifier: key })
                return true
            }
        }

        const record = this.db.otps.get(key)
        if (!record) return false

        if (Date.now() > record.expiresAt) {
            this.db.otps.delete(key)
            this.enqueueOutbox('deleteOtp', { identifier: key })
            return false
        }

        record.attempts += 1
        if (record.attempts > 5) {
            this.db.otps.delete(key)
            this.enqueueOutbox('deleteOtp', { identifier: key })
            return false
        }

        if (record.otp === codeStr) {
            this.db.otps.delete(key)
            this.enqueueOutbox('deleteOtp', { identifier: key })
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

        const baseRef = (userData.username || 'PLAYER').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()
        const referralCode = (baseRef + Math.random().toString(36).slice(2, 5)).toUpperCase()

        let referredBy = null
        const candidateCode = userData.referredBy || userData.referralCode
        if (candidateCode) {
            const cleanCode = String(candidateCode).trim().toUpperCase()
            const referrer = this.data.users.find(u => (u.referralCode && u.referralCode.toUpperCase() === cleanCode) || u.id === candidateCode)
            if (referrer && referrer.id !== id) {
                referredBy = referrer.id
                if (!referrer.affiliateStats) {
                    referrer.affiliateStats = {
                        totalReferred: 0,
                        totalTurnover: 0,
                        totalEarned: 0,
                        unclaimedEarnings: 0,
                        tier1Turnover: 0,
                        tier2Turnover: 0,
                        tier3Turnover: 0,
                        tier1Earned: 0,
                        tier2Earned: 0,
                        tier3Earned: 0
                    }
                }
                referrer.affiliateStats.totalReferred += 1
            }
        }

        const newUser = {
            id,
            role: 'player',
            status: 'active',
            balances: {
                INR: 100.00,
                BTC: 0.0000,
                USDT: 0.00,
                AMRAT: 0.00,
            },
            totalDeposited: 0,
            totalWagered: 0,
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
        this.db._indexUser(newUser)
        this.data.transactions.unshift(bonusTx)
        this.db.updateTreasurySupply()
        this.persist()

        this.enqueueOutbox('syncUser', newUser)
        this.enqueueOutbox('syncTransaction', bonusTx)

        return newUser
    }

    updateUser(id, updates) {
        const index = this.data.users.findIndex(u => u.id === id)
        if (index === -1) return null
        const oldUser = this.data.users[index]

        if (updates.email && updates.email !== oldUser.email) {
            this.db._usersByEmail.delete(String(oldUser.email).toLowerCase())
        }
        if (updates.username && updates.username !== oldUser.username) {
            this.db._usersByUsername.delete(String(oldUser.username).toLowerCase())
        }
        if (updates.phone && updates.phone !== oldUser.phone) {
            const oldNorm = normalizePhone(oldUser.phone)
            if (oldNorm) this.db._usersByPhone.delete(oldNorm)
        }

        const updated = { ...oldUser, ...updates }
        this.data.users[index] = updated
        this.db._indexUser(updated)
        this.db.updateTreasurySupply()
        this.persist()

        this.enqueueOutbox('syncUser', updated)

        return updated
    }

    accumulateWagerRewards(user, betAmount) {
        if (!user || betAmount <= 0) return

        // 1. VIP Tier & Rakeback Accumulation
        const tier = getVipTier(user.totalWagered)
        const rakeback = parseFloat((betAmount * 0.01 * tier.rakebackRate).toFixed(4))
        user.unclaimedRakeback = parseFloat(((user.unclaimedRakeback || 0) + rakeback).toFixed(4))
        user.totalRakebackEarned = parseFloat(((user.totalRakebackEarned || 0) + rakeback).toFixed(4))

        // 2. Multi-Tier Viral Affiliate Hierarchy
        if (user.referredBy) {
            const tier1User = this.findUserById(user.referredBy)
            if (tier1User) {
                if (!tier1User.affiliateStats) {
                    tier1User.affiliateStats = {
                        totalReferred: 0,
                        totalTurnover: 0,
                        totalEarned: 0,
                        unclaimedEarnings: 0,
                        tier1Turnover: 0,
                        tier2Turnover: 0,
                        tier3Turnover: 0,
                        tier1Earned: 0,
                        tier2Earned: 0,
                        tier3Earned: 0
                    }
                }
                const comm1 = parseFloat((betAmount * 0.003).toFixed(4))
                tier1User.affiliateStats.totalTurnover = parseFloat(((tier1User.affiliateStats.totalTurnover || 0) + betAmount).toFixed(2))
                tier1User.affiliateStats.tier1Turnover = parseFloat(((tier1User.affiliateStats.tier1Turnover || 0) + betAmount).toFixed(2))
                tier1User.affiliateStats.totalEarned = parseFloat(((tier1User.affiliateStats.totalEarned || 0) + comm1).toFixed(4))
                tier1User.affiliateStats.tier1Earned = parseFloat(((tier1User.affiliateStats.tier1Earned || 0) + comm1).toFixed(4))
                tier1User.affiliateStats.unclaimedEarnings = parseFloat(((tier1User.affiliateStats.unclaimedEarnings || 0) + comm1).toFixed(4))

                if (tier1User.referredBy) {
                    const tier2User = this.findUserById(tier1User.referredBy)
                    if (tier2User && tier2User.id !== user.id) {
                        if (!tier2User.affiliateStats) {
                            tier2User.affiliateStats = {
                                totalReferred: 0,
                                totalTurnover: 0,
                                totalEarned: 0,
                                unclaimedEarnings: 0,
                                tier1Turnover: 0,
                                tier2Turnover: 0,
                                tier3Turnover: 0,
                                tier1Earned: 0,
                                tier2Earned: 0,
                                tier3Earned: 0
                            }
                        }
                        const comm2 = parseFloat((betAmount * 0.001).toFixed(4))
                        tier2User.affiliateStats.totalTurnover = parseFloat(((tier2User.affiliateStats.totalTurnover || 0) + betAmount).toFixed(2))
                        tier2User.affiliateStats.tier2Turnover = parseFloat(((tier2User.affiliateStats.tier2Turnover || 0) + betAmount).toFixed(2))
                        tier2User.affiliateStats.totalEarned = parseFloat(((tier2User.affiliateStats.totalEarned || 0) + comm2).toFixed(4))
                        tier2User.affiliateStats.tier2Earned = parseFloat(((tier2User.affiliateStats.tier2Earned || 0) + comm2).toFixed(4))
                        tier2User.affiliateStats.unclaimedEarnings = parseFloat(((tier2User.affiliateStats.unclaimedEarnings || 0) + comm2).toFixed(4))

                        if (tier2User.referredBy) {
                            const tier3User = this.findUserById(tier2User.referredBy)
                            if (tier3User && tier3User.id !== user.id && tier3User.id !== tier1User.id) {
                                if (!tier3User.affiliateStats) {
                                    tier3User.affiliateStats = {
                                        totalReferred: 0,
                                        totalTurnover: 0,
                                        totalEarned: 0,
                                        unclaimedEarnings: 0,
                                        tier1Turnover: 0,
                                        tier2Turnover: 0,
                                        tier3Turnover: 0,
                                        tier1Earned: 0,
                                        tier2Earned: 0,
                                        tier3Earned: 0
                                    }
                                }
                                const comm3 = parseFloat((betAmount * 0.0005).toFixed(4))
                                tier3User.affiliateStats.totalTurnover = parseFloat(((tier3User.affiliateStats.totalTurnover || 0) + betAmount).toFixed(2))
                                tier3User.affiliateStats.tier3Turnover = parseFloat(((tier3User.affiliateStats.tier3Turnover || 0) + betAmount).toFixed(2))
                                tier3User.affiliateStats.totalEarned = parseFloat(((tier3User.affiliateStats.totalEarned || 0) + comm3).toFixed(4))
                                tier3User.affiliateStats.tier3Earned = parseFloat(((tier3User.affiliateStats.tier3Earned || 0) + comm3).toFixed(4))
                                tier3User.affiliateStats.unclaimedEarnings = parseFloat(((tier3User.affiliateStats.unclaimedEarnings || 0) + comm3).toFixed(4))
                            }
                        }
                    }
                }
            }
        }

        // 3. Yield to House Liquidity Vault
        try {
            if (houseVaultService && houseVaultService.distributeGameYield) {
                houseVaultService.distributeGameYield(betAmount)
            }
        } catch {}
    }

    getAffiliateStats(userId) {
        const user = this.findUserById(userId)
        if (!user) return null

        const users = this.data.users || []
        const tier1Users = users.filter(u => u.referredBy === userId)
        const tier1Ids = new Set(tier1Users.map(u => u.id))
        const tier2Users = users.filter(u => tier1Ids.has(u.referredBy))
        const tier2Ids = new Set(tier2Users.map(u => u.id))
        const tier3Users = users.filter(u => tier2Ids.has(u.referredBy))

        const totalReferred = tier1Users.length + tier2Users.length + tier3Users.length

        return {
            referralCode: user.referralCode || '',
            referralLink: `https://amratgames.com/?ref=${user.referralCode || ''}`,
            totalReferred,
            totalTurnover: user.affiliateStats?.totalTurnover || 0,
            totalEarned: user.affiliateStats?.totalEarned || 0,
            unclaimedEarnings: user.affiliateStats?.unclaimedEarnings || 0,
            canClaim: (user.affiliateStats?.unclaimedEarnings || 0) >= 10.0,
            tiers: {
                tier1: {
                    count: tier1Users.length,
                    turnover: user.affiliateStats?.tier1Turnover || (user.affiliateStats?.totalTurnover || 0),
                    earned: user.affiliateStats?.tier1Earned || (user.affiliateStats?.totalEarned || 0),
                    rate: '0.30%',
                    rateNum: 0.003
                },
                tier2: {
                    count: tier2Users.length,
                    turnover: user.affiliateStats?.tier2Turnover || 0,
                    earned: user.affiliateStats?.tier2Earned || 0,
                    rate: '0.10%',
                    rateNum: 0.001
                },
                tier3: {
                    count: tier3Users.length,
                    turnover: user.affiliateStats?.tier3Turnover || 0,
                    earned: user.affiliateStats?.tier3Earned || 0,
                    rate: '0.05%',
                    rateNum: 0.0005
                }
            },
            referredUsers: tier1Users.slice(0, 20).map(u => ({
                id: u.id,
                username: u.username ? (u.username.slice(0, 2) + '***' + u.username.slice(-1)) : 'Player',
                totalWagered: u.totalWagered || 0,
                createdAt: u.createdAt
            }))
        }
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
        return this.withLock(userId, async () => {
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
        return this.withLock(userId, async () => {
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
}

export default UserRepository
