/**
 * 💳 AmratGames Financial & Ledger Type Contracts
 * Multi-currency balances, cashier deposit/withdrawal lifecycles, and VIP tiers.
 */

import { SupportedCurrency } from './game.d.ts'

export interface WalletBalances {
    INR: number
    BTC: number
    USDT: number
    AMRAT: number
}

export type TransactionType = 
    | 'deposit'
    | 'withdrawal'
    | 'bet'
    | 'win'
    | 'rakeback'
    | 'referral'
    | 'airdrop'
    | 'credit'
    | 'debit'

export interface TransactionRecord {
    id: string
    userId: string
    username: string
    type: TransactionType
    currency: SupportedCurrency
    amount: number
    balanceAfter: number
    note?: string
    status?: 'pending' | 'completed' | 'approved' | 'rejected'
    depositId?: string
    withdrawalId?: string
    utrNumber?: string
    timestamp: string
}

export interface DepositRequestPayload {
    userId: string
    currency?: SupportedCurrency
    amount: number
    paymentMethod?: string
    utrNumber?: string
}

export interface DepositRecord {
    id: string
    transactionId: string
    userId: string
    username: string
    userEmail?: string
    userPhone?: string
    currency: SupportedCurrency
    amount: number
    paymentMethod: string
    utrNumber: string
    status: 'pending' | 'completed' | 'rejected'
    adminNote?: string
    rejectionReason?: string
    approvedBy?: string
    approvedAt?: string | null
    createdAt: string
}

export interface WithdrawalRequestPayload {
    userId: string
    currency?: SupportedCurrency
    amount: number
    payoutMethod?: string
    payoutDestination: string
    bankDetails?: Record<string, any> | null
}

export interface WithdrawalRecord {
    id: string
    transactionId: string
    userId: string
    username: string
    userEmail?: string
    userPhone?: string
    currency: SupportedCurrency
    amount: number
    payoutMethod: string
    payoutDestination: string
    bankDetails?: Record<string, any> | null
    status: 'pending' | 'approved' | 'rejected'
    transactionRef?: string
    adminNote?: string
    rejectionReason?: string
    processedBy?: string | null
    processedAt?: string | null
    createdAt: string
}

export interface VipTierInfo {
    tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond'
    level: number
    icon: string
    rakebackRate: number
    minWager: number
    nextTierWager: number | null
    progressPct: number
}

export interface VipStatusResponse {
    currentTier: string
    level: number
    icon: string
    rakebackRate: number
    rakebackPercent: string
    totalWagered: number
    unclaimedRakeback: number
    totalRakebackEarned: number
    minWager: number
    nextTierWager: number | null
    progressPct: number
    canClaim: boolean
}

export interface AffiliateTierDetails {
    count: number
    turnover: number
    earned: number
    rate: string
    rateNum: number
}

export interface AffiliateStatsResponse {
    referralCode: string
    referralLink: string
    totalReferred: number
    totalTurnover: number
    totalEarned: number
    unclaimedEarnings: number
    canClaim: boolean
    tiers: {
        tier1: AffiliateTierDetails
        tier2: AffiliateTierDetails
        tier3: AffiliateTierDetails
    }
    referredUsers: Array<{
        id: string
        username: string
        totalWagered: number
        createdAt: string
    }>
}
