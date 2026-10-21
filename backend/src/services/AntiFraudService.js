// =============================================================================
// 👑 AmratGames.com — Anti-Sybil Sentinel & Automated Risk Scoring Engine
// Real-time IP collision, referral self-farming detection, and cashier risk rating
// =============================================================================

import { db } from '../db/db.js'

export class AntiFraudService {
    constructor() {
        this.ipMap = new Map() // ip -> Set(userIds)
        this.fingerprintMap = new Map() // fingerprint -> Set(userIds)
    }

    trackSession(userId, { ip = '127.0.0.1', userAgent = '', fingerprint = '' } = {}) {
        if (!userId) return

        // Clean IPv4-mapped IPv6 prefix (::ffff:1.2.3.4 -> 1.2.3.4), preserving native IPv6
        const cleanIp = String(ip || '127.0.0.1').trim().replace(/^::ffff:/i, '')

        if (!this.ipMap.has(cleanIp)) {
            this.ipMap.set(cleanIp, new Set())
        }
        this.ipMap.get(cleanIp).add(userId)

        if (fingerprint) {
            if (!this.fingerprintMap.has(fingerprint)) {
                this.fingerprintMap.set(fingerprint, new Set())
            }
            this.fingerprintMap.get(fingerprint).add(userId)
        }

        // Persist session metadata onto user
        const user = db.findUserById(userId)
        if (user) {
            if (!user.security) user.security = {}
            user.security.lastIp = cleanIp
            user.security.lastUserAgent = userAgent
            if (fingerprint) user.security.fingerprint = fingerprint
            user.security.lastActiveAt = new Date().toISOString()
        }
    }

    calculateRiskScore(userId) {
        const user = db.findUserById(userId)
        if (!user) {
            return { score: 0, level: 'LOW', flags: [] }
        }

        let score = 0
        const flags = []
        const userIp = user.security?.lastIp
        const userFingerprint = user.security?.fingerprint

        // 1. Referral Self-Farming & Sybil Collision Check (+40 Points)
        if (user.referredBy) {
            // Find the referrer account
            const referrer = db.data.users?.find(u => u.referralCode === user.referredBy || u.id === user.referredBy)
            if (referrer) {
                const referrerIp = referrer.security?.lastIp
                const referrerFp = referrer.security?.fingerprint

                if (userIp && referrerIp && userIp === referrerIp && userIp !== '127.0.0.1' && userIp !== 'localhost') {
                    score += 40
                    flags.push('SYBIL_REFERRAL_IP_COLLISION')
                } else if (userFingerprint && referrerFp && userFingerprint === referrerFp) {
                    score += 45
                    flags.push('SYBIL_REFERRAL_DEVICE_FINGERPRINT_MATCH')
                }
            }
        }

        // 2. Multi-Account IP Clustering Check (+30 Points)
        if (userIp && userIp !== '127.0.0.1' && userIp !== 'localhost') {
            const accountsOnSameIp = this.ipMap.get(userIp)
            const count = accountsOnSameIp ? accountsOnSameIp.size : 1
            if (count >= 3) {
                score += 30
                flags.push(`MULTI_ACCOUNT_CLUSTER (${count} accounts on IP ${userIp})`)
            } else if (count === 2) {
                score += 15
                flags.push('DUAL_ACCOUNT_IP_COLLISION')
            }
        }

        // 3. KYC Verification Status
        if (user.kycStatus !== 'verified') {
            score += 10
            flags.push('UNVERIFIED_KYC')
        }

        // 4. Turnover to Deposit Ratio Check (+20 Points)
        const totalDeposited = user.totalDeposited || 0
        const totalWagered = user.totalWagered || 0
        if (totalDeposited >= 500 && totalWagered < totalDeposited * 1.05) {
            score += 20
            flags.push('MINIMAL_TURNOVER_CASHIER_EVASION')
        }

        // 5. High Loss-to-Win Velocity Anomaly Check (+15 Points)
        const bets = db.getUserBets(userId, 20)
        if (bets.length >= 10) {
            const lossStreak = bets.filter(b => !b.won).length
            if (lossStreak >= 9) {
                score += 15
                flags.push('HIGH_CONSECUTIVE_LOSS_ANOMALY')
            }
        }

        const clampedScore = Math.min(100, Math.max(0, score))
        let level = 'LOW'
        if (clampedScore >= 70) level = 'CRITICAL'
        else if (clampedScore >= 30) level = 'ELEVATED'

        return {
            userId,
            username: user.username,
            score: clampedScore,
            level,
            flags,
            totalDeposited,
            totalWagered,
            kycStatus: user.kycStatus || 'unverified'
        }
    }
}

export const antiFraudService = new AntiFraudService()
