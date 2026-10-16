/**
 * 👤 AmratGames User & Identity Type Contracts
 * Player profiles, security statuses, roles, and KYC lifecycles.
 */

import { WalletBalances } from './financial.d.ts'

export type UserRole = 'admin' | 'moderator' | 'player'
export type UserStatus = 'active' | 'suspended' | 'banned'
export type KycStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

export interface UserRecord {
    id: string
    username: string
    email?: string
    phone?: string
    passwordHash: string
    role: UserRole
    status: UserStatus
    isBanned: boolean
    kycStatus: KycStatus
    phoneVerified: boolean
    emailVerified: boolean
    avatar: string
    balances: WalletBalances
    totalWagered: number
    totalDeposited: number
    referralCode: string
    referredBy?: string | null
    affiliateStats: {
        totalReferred: number
        totalTurnover: number
        totalEarned: number
        unclaimedEarnings: number
        tier1Turnover?: number
        tier2Turnover?: number
        tier3Turnover?: number
        tier1Earned?: number
        tier2Earned?: number
        tier3Earned?: number
    }
    unclaimedRakeback: number
    totalRakebackEarned: number
    nonce?: number
    createdAt: string
    lastLoginAt: string
}

export interface CreateUserPayload {
    username: string
    email?: string
    phone?: string
    passwordHash?: string
    password?: string
    referredBy?: string | null
    role?: UserRole
}

export interface UpdateUserPayload {
    username?: string
    email?: string
    phone?: string
    passwordHash?: string
    role?: UserRole
    status?: UserStatus
    isBanned?: boolean
    kycStatus?: KycStatus
    phoneVerified?: boolean
    emailVerified?: boolean
    avatar?: string
    totalWagered?: number
    totalDeposited?: number
    unclaimedRakeback?: number
    totalRakebackEarned?: number
}
