import { useState, useEffect, useCallback } from 'react'
import {
    ShareAltOutlined,
    CopyOutlined,
    CheckOutlined,
    TeamOutlined,
    DollarOutlined,
    TrophyOutlined,
    ReloadOutlined
} from '@ant-design/icons'
import { useAuth } from '../../context/AuthContext'
import { useWallet } from '../../context/WalletContext'
import casinoAudio from '../../utils/casinoAudio'
import './MultiTierAffiliateDashboard.css'

export default function MultiTierAffiliateDashboard() {
    const { user, token } = useAuth()
    const { currencySymbol, refreshBalance, showToast } = useWallet()

    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [isClaiming, setIsClaiming] = useState(false)
    const [copiedCode, setCopiedCode] = useState(false)
    const [copiedLink, setCopiedLink] = useState(false)

    const fetchStats = useCallback(async () => {
        if (!token) return
        setLoading(true)
        try {
            const res = await fetch('/api/affiliate/stats', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) {
                setStats(data)
            }
        } catch (err) {
            console.error('[AFFILIATE] Error loading stats:', err)
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    const handleCopy = (text, isCode = true) => {
        navigator.clipboard.writeText(text)
        casinoAudio.playChip()
        if (isCode) {
            setCopiedCode(true)
            setTimeout(() => setCopiedCode(false), 2000)
        } else {
            setCopiedLink(true)
            setTimeout(() => setCopiedLink(false), 2000)
        }
        showToast('info', 'Copied!', `${isCode ? 'Referral code' : 'Referral link'} copied to clipboard`)
    }

    const handleClaim = async () => {
        if (!token || !stats?.canClaim) return
        setIsClaiming(true)
        casinoAudio.playChip()

        try {
            const res = await fetch('/api/affiliate/claim', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                showToast('error', 'Claim Failed', data.error || 'Unable to claim commission')
                casinoAudio.playLoss()
            } else {
                casinoAudio.playWin()
                showToast('success', 'Commission Claimed!', `₹${data.claimedAmount?.toFixed(2)} credited to your wallet`)
                if (refreshBalance) refreshBalance()
                fetchStats()
            }
        } catch (err) {
            showToast('error', 'Network Error', err.message)
        } finally {
            setIsClaiming(false)
        }
    }

    if (loading && !stats) {
        return (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: '#94a3b8' }}>
                <ReloadOutlined spin style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                <div>Loading Viral Affiliate Tree...</div>
            </div>
        )
    }

    const referralCode = stats?.referralCode || user?.referralCode || 'AMRATVIP'
    const referralLink = stats?.referralLink || `https://amratgames.com/?ref=${referralCode}`
    const shareMessage = encodeURIComponent(
        `🔥 Join AmratGames.com using my referral code ${referralCode} and claim an instant ₹100 Free Welcome Bonus!\nPlay Crash, Limbo, Mines, and 1v1 PvP Duels:\n${referralLink}`
    )

    const tiers = stats?.tiers || {
        tier1: { count: 0, turnover: 0, earned: 0, rate: '0.30%' },
        tier2: { count: 0, turnover: 0, earned: 0, rate: '0.10%' },
        tier3: { count: 0, turnover: 0, earned: 0, rate: '0.05%' }
    }

    return (
        <div className="affiliate-dashboard-wrap">
            {/* Hero Banner */}
            <div className="affiliate-hero-card">
                <div className="affiliate-hero-top">
                    <div className="affiliate-hero-title">
                        <span>🤝 Multi-Tier Viral Affiliate Flywheel</span>
                        <span className="affiliate-hero-badge">Super-Agent Tree</span>
                    </div>

                    <button
                        type="button"
                        onClick={fetchStats}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                        title="Refresh Stats"
                    >
                        <ReloadOutlined spin={loading} />
                    </button>
                </div>

                <div className="affiliate-hero-stats-grid">
                    <div className="affiliate-stat-box">
                        <span className="affiliate-stat-lbl">Network Members</span>
                        <span className="affiliate-stat-val accent-gold">
                            {stats?.totalReferred || 0}
                        </span>
                    </div>

                    <div className="affiliate-stat-box">
                        <span className="affiliate-stat-lbl">Network Turnover</span>
                        <span className="affiliate-stat-val">
                            {currencySymbol}{Number(stats?.totalTurnover || 0).toLocaleString('en-IN')}
                        </span>
                    </div>

                    <div className="affiliate-stat-box">
                        <span className="affiliate-stat-lbl">Total Commission Earned</span>
                        <span className="affiliate-stat-val accent-green">
                            {currencySymbol}{Number(stats?.totalEarned || 0).toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>

            {/* 3-Tier Hierarchy Tree Cards */}
            <div className="affiliate-tiers-grid">
                {/* Tier 1 Card */}
                <div className="affiliate-tier-card tier-1">
                    <div className="affiliate-tier-header">
                        <span className="affiliate-tier-name">🥇 Tier 1: Direct Referrals</span>
                        <span className="affiliate-tier-rate-badge">0.30% Commission</span>
                    </div>
                    <p className="affiliate-tier-desc">
                        Players directly invited via your personal referral link or code.
                    </p>
                    <div className="affiliate-tier-meta-row">
                        <span>Members:</span>
                        <strong>{tiers.tier1.count} players</strong>
                    </div>
                    <div className="affiliate-tier-meta-row">
                        <span>Turnover:</span>
                        <strong>{currencySymbol}{Number(tiers.tier1.turnover || 0).toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="affiliate-tier-meta-row">
                        <span>Earned:</span>
                        <strong style={{ color: '#fbbf24' }}>
                            {currencySymbol}{Number(tiers.tier1.earned || 0).toFixed(2)}
                        </strong>
                    </div>
                </div>

                {/* Tier 2 Card */}
                <div className="affiliate-tier-card tier-2">
                    <div className="affiliate-tier-header">
                        <span className="affiliate-tier-name">🥈 Tier 2: Sub-Affiliates</span>
                        <span className="affiliate-tier-rate-badge">0.10% Commission</span>
                    </div>
                    <p className="affiliate-tier-desc">
                        Players referred by your Tier 1 direct promoters downline.
                    </p>
                    <div className="affiliate-tier-meta-row">
                        <span>Members:</span>
                        <strong>{tiers.tier2.count} players</strong>
                    </div>
                    <div className="affiliate-tier-meta-row">
                        <span>Turnover:</span>
                        <strong>{currencySymbol}{Number(tiers.tier2.turnover || 0).toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="affiliate-tier-meta-row">
                        <span>Earned:</span>
                        <strong style={{ color: '#60a5fa' }}>
                            {currencySymbol}{Number(tiers.tier2.earned || 0).toFixed(2)}
                        </strong>
                    </div>
                </div>

                {/* Tier 3 Card */}
                <div className="affiliate-tier-card tier-3">
                    <div className="affiliate-tier-header">
                        <span className="affiliate-tier-name">🥉 Tier 3: 3rd Generation</span>
                        <span className="affiliate-tier-rate-badge">0.05% Commission</span>
                    </div>
                    <p className="affiliate-tier-desc">
                        Extended viral network members recruited by your Tier 2 network.
                    </p>
                    <div className="affiliate-tier-meta-row">
                        <span>Members:</span>
                        <strong>{tiers.tier3.count} players</strong>
                    </div>
                    <div className="affiliate-tier-meta-row">
                        <span>Turnover:</span>
                        <strong>{currencySymbol}{Number(tiers.tier3.turnover || 0).toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="affiliate-tier-meta-row">
                        <span>Earned:</span>
                        <strong style={{ color: '#c4b5fd' }}>
                            {currencySymbol}{Number(tiers.tier3.earned || 0).toFixed(2)}
                        </strong>
                    </div>
                </div>
            </div>

            {/* Instant Commission Claim Card */}
            <div className="affiliate-claim-card">
                <div className="affiliate-claim-info">
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700 }}>
                        UNCLAIMED COMMISSION BALANCE
                    </span>
                    <span className="affiliate-claim-amount">
                        {currencySymbol}{Number(stats?.unclaimedEarnings || 0).toFixed(2)}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Minimum claim: ₹10.00 • Instant zero-fee deposit into your active casino balance.
                    </span>
                </div>

                <button
                    type="button"
                    className="affiliate-claim-btn"
                    onClick={handleClaim}
                    disabled={isClaiming || !stats?.canClaim}
                >
                    {isClaiming ? 'TRANSFERRING...' : '💸 CLAIM COMMISSION TO WALLET'}
                </button>
            </div>

            {/* Referral Sharing Links & Social Presets */}
            <div className="affiliate-share-grid">
                {/* Referral Code Box */}
                <div className="affiliate-share-card">
                    <div className="affiliate-share-title">
                        <ShareAltOutlined style={{ color: '#fbbf24' }} />
                        <span>Your Referral Code</span>
                    </div>
                    <div className="affiliate-copy-input-row">
                        <input
                            type="text"
                            readOnly
                            className="affiliate-copy-input"
                            value={referralCode}
                        />
                        <button
                            type="button"
                            className="affiliate-copy-btn"
                            onClick={() => handleCopy(referralCode, true)}
                        >
                            {copiedCode ? <CheckOutlined style={{ color: '#34d399' }} /> : <CopyOutlined />}
                        </button>
                    </div>

                    <div className="affiliate-share-title" style={{ marginTop: 6 }}>
                        <span>Full Invite URL</span>
                    </div>
                    <div className="affiliate-copy-input-row">
                        <input
                            type="text"
                            readOnly
                            className="affiliate-copy-input"
                            value={referralLink}
                        />
                        <button
                            type="button"
                            className="affiliate-copy-btn"
                            onClick={() => handleCopy(referralLink, false)}
                        >
                            {copiedLink ? <CheckOutlined style={{ color: '#34d399' }} /> : <CopyOutlined />}
                        </button>
                    </div>
                </div>

                {/* 1-Click Viral Social Sharing */}
                <div className="affiliate-share-card">
                    <div className="affiliate-share-title">
                        <span>🚀 1-Click Viral Sharing</span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
                        Share directly to your groups and channels. Every friend who signs up receives ₹100 Free Welcome Bonus immediately, and you earn multi-tier lifetime turnover commission!
                    </p>

                    <div className="affiliate-social-buttons">
                        <a
                            href={`https://wa.me/?text=${shareMessage}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="affiliate-social-btn whatsapp"
                        >
                            <span>💬 Share on WhatsApp</span>
                        </a>

                        <a
                            href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Join AmratGames for ₹100 Free Welcome Bonus!')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="affiliate-social-btn telegram"
                        >
                            <span>✈️ Share on Telegram</span>
                        </a>
                    </div>
                </div>
            </div>

            {/* Direct Referrals List */}
            {stats?.referredUsers && stats.referredUsers.length > 0 && (
                <div className="affiliate-table-card">
                    <div className="affiliate-table-header">
                        <span className="affiliate-table-title">Recent Direct Recruits</span>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            Masked for privacy compliance
                        </span>
                    </div>

                    <div className="affiliate-table-list">
                        {stats.referredUsers.map((u, i) => (
                            <div key={u.id || i} className="affiliate-table-row">
                                <span style={{ fontWeight: 700, color: '#f1f5f9' }}>
                                    👤 {u.username}
                                </span>
                                <span style={{ color: '#94a3b8' }}>
                                    Turnover: {currencySymbol}{Number(u.totalWagered || 0).toLocaleString('en-IN')}
                                </span>
                                <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
                                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : 'Active'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
