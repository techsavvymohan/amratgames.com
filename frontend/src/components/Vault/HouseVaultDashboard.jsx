import { useState, useEffect, useCallback } from 'react'
import {
    BankOutlined,
    SafetyCertificateOutlined,
    RiseOutlined,
    CheckCircleFilled,
    FireOutlined,
    ReloadOutlined,
    WalletOutlined
} from '@ant-design/icons'
import { useAuth } from '../../context/AuthContext'
import { useWallet } from '../../context/WalletContext'
import casinoAudio from '../../utils/casinoAudio'
import './HouseVaultDashboard.css'

const STAKE_PRESETS = [500, 1000, 2500, 5000, 10000]

export default function HouseVaultDashboard() {
    const { user, token, openAuthModal } = useAuth()
    const { balance, currencySymbol, refreshBalance, showToast } = useWallet()

    const [vaultData, setVaultData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [activeAction, setActiveAction] = useState('stake') // 'stake' | 'unstake'
    const [inputAmount, setInputAmount] = useState(1000)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isHarvesting, setIsHarvesting] = useState(false)

    const fetchVaultOverview = useCallback(async () => {
        setLoading(true)
        try {
            const headers = {}
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch('/api/vault/overview', { headers })
            const data = await res.json()
            if (data.success && data.vault) {
                setVaultData(data.vault)
            }
        } catch (err) {
            console.error('[VAULT] Error loading overview:', err)
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => {
        fetchVaultOverview()
    }, [fetchVaultOverview])

    const handleStake = async () => {
        if (!user) {
            if (openAuthModal) openAuthModal('login')
            return
        }
        const amt = parseFloat(inputAmount) || 0
        if (amt < 100) {
            showToast('warning', 'Minimum Stake', 'Minimum vault deposit is ₹100')
            return
        }
        if (amt > balance) {
            showToast('error', 'Insufficient Funds', 'Deposit funds to stake into the house vault')
            return
        }

        setIsSubmitting(true)
        casinoAudio.playChip()

        try {
            const res = await fetch('/api/vault/stake', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ amount: amt })
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                showToast('error', 'Stake Failed', data.error || 'Unable to stake')
                casinoAudio.playLoss()
            } else {
                casinoAudio.playWin()
                showToast('success', 'Staked Successfully!', `₹${amt.toLocaleString('en-IN')} added to House Vault`)
                if (refreshBalance) refreshBalance()
                fetchVaultOverview()
            }
        } catch (err) {
            showToast('error', 'Network Error', err.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleUnstake = async () => {
        if (!user) return
        const amt = parseFloat(inputAmount) || 0
        const userStaked = vaultData?.userPosition?.stakedINR || 0
        if (amt <= 0 || amt > userStaked) {
            showToast('error', 'Invalid Amount', `You can unstake up to ₹${userStaked.toLocaleString('en-IN')}`)
            return
        }

        setIsSubmitting(true)
        casinoAudio.playChip()

        try {
            const res = await fetch('/api/vault/unstake', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ amount: amt })
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                showToast('error', 'Unstake Failed', data.error || 'Unable to unstake')
                casinoAudio.playLoss()
            } else {
                casinoAudio.playWin()
                showToast('info', 'Unstaked!', `₹${amt.toLocaleString('en-IN')} returned to your active wallet`)
                if (refreshBalance) refreshBalance()
                fetchVaultOverview()
            }
        } catch (err) {
            showToast('error', 'Network Error', err.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleHarvest = async () => {
        if (!user || !vaultData?.userPosition?.canClaim) return
        setIsHarvesting(true)
        casinoAudio.playChip()

        try {
            const res = await fetch('/api/vault/claim', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                showToast('error', 'Harvest Failed', data.error || 'Unable to harvest dividends')
                casinoAudio.playLoss()
            } else {
                casinoAudio.playWin()
                showToast('success', 'Dividends Harvested!', `₹${data.claimedAmount?.toFixed(2)} credited to your wallet`)
                if (refreshBalance) refreshBalance()
                fetchVaultOverview()
            }
        } catch (err) {
            showToast('error', 'Network Error', err.message)
        } finally {
            setIsHarvesting(false)
        }
    }

    const pos = vaultData?.userPosition || {
        stakedINR: 0,
        poolSharePct: 0,
        unclaimedDividendsINR: 0,
        totalClaimedINR: 0,
        canClaim: false
    }

    return (
        <div className="vault-dashboard-wrap">
            {/* Hero Banner */}
            <div className="vault-hero-card">
                <div className="vault-hero-top">
                    <div className="vault-hero-title">
                        <span>🏛️ Amrat Royal House Vault</span>
                        <span className="vault-hero-badge">Be The House</span>
                        <span className="vault-hero-badge" style={{ background: '#3b82f6', color: '#fff' }}>
                            {vaultData?.dynamicApy || 18.5}% Dynamic APY
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={fetchVaultOverview}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                        title="Refresh Vault Metrics"
                    >
                        <ReloadOutlined spin={loading} />
                    </button>
                </div>

                <div className="vault-metrics-grid">
                    <div className="vault-metric-box">
                        <span className="vault-metric-lbl">Total Staked in Vault</span>
                        <span className="vault-metric-val accent-gold">
                            {currencySymbol}{Number(vaultData?.totalStakedINR || 0).toLocaleString('en-IN')}
                        </span>
                    </div>

                    <div className="vault-metric-box">
                        <span className="vault-metric-lbl">Projected Annual APY</span>
                        <span className="vault-metric-val accent-green">
                            {vaultData?.dynamicApy || 18.5}% APY
                        </span>
                    </div>

                    <div className="vault-metric-box">
                        <span className="vault-metric-lbl">Total Yield Distributed</span>
                        <span className="vault-metric-val">
                            {currencySymbol}{Number(vaultData?.totalDividendsDistributedINR || 0).toFixed(2)}
                        </span>
                    </div>

                    <div className="vault-metric-box">
                        <span className="vault-metric-lbl">Active Stakers</span>
                        <span className="vault-metric-val">
                            {vaultData?.activeStakersCount || 0}
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Interactive Grid */}
            <div className="vault-main-grid">
                {/* Left Card: User Personal Staking Position */}
                <div className="vault-card">
                    <div className="vault-card-header">
                        <div className="vault-card-title">
                            <RiseOutlined style={{ color: '#34d399' }} />
                            <span>Your Staking Position</span>
                        </div>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Pro-Rata Shareholder</span>
                    </div>

                    <div className="vault-position-rows">
                        <div className="vault-pos-row">
                            <span className="lbl">Your Staked Capital:</span>
                            <span className="val" style={{ color: '#fbbf24' }}>
                                {currencySymbol}{pos.stakedINR.toLocaleString('en-IN')}
                            </span>
                        </div>

                        <div className="vault-pos-row">
                            <span className="lbl">Pool Ownership Share:</span>
                            <span className="val">
                                {pos.poolSharePct}% of House Vault
                            </span>
                        </div>

                        <div className="vault-pos-row">
                            <span className="lbl">Lifetime Dividends Harvested:</span>
                            <span className="val" style={{ color: '#34d399' }}>
                                +{currencySymbol}{pos.totalClaimedINR.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Unclaimed Yield Harvest Box */}
                    <div className="vault-harvest-box">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700 }}>
                                UNCLAIMED HOUSE YIELD
                            </span>
                            <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#34d399' }}>
                                {currencySymbol}{pos.unclaimedDividendsINR.toFixed(4)}
                            </span>
                        </div>

                        <button
                            type="button"
                            className="vault-harvest-btn"
                            onClick={handleHarvest}
                            disabled={isHarvesting || !pos.canClaim}
                        >
                            {isHarvesting ? 'HARVESTING...' : '🌾 HARVEST YIELD'}
                        </button>
                    </div>
                </div>

                {/* Right Card: Stake & Unstake Action Controls */}
                <div className="vault-card">
                    <div className="vault-card-header">
                        <div className="vault-card-title">
                            <BankOutlined style={{ color: '#fbbf24' }} />
                            <span>Vault Controls</span>
                        </div>

                        {/* Switcher Tabs */}
                        <div className="vault-action-tabs">
                            <button
                                type="button"
                                className={`vault-tab-btn ${activeAction === 'stake' ? 'active' : ''}`}
                                onClick={() => setActiveAction('stake')}
                            >
                                Deposit & Stake
                            </button>
                            <button
                                type="button"
                                className={`vault-tab-btn ${activeAction === 'unstake' ? 'active' : ''}`}
                                onClick={() => setActiveAction('unstake')}
                            >
                                Unstake
                            </button>
                        </div>
                    </div>

                    {/* Stake Mode */}
                    {activeAction === 'stake' && (
                        <div className="vault-input-box">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Amount to Stake</span>
                                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                    Wallet: {currencySymbol}{Number(balance || 0).toLocaleString('en-IN')}
                                </span>
                            </div>

                            <div className="bet-input-box">
                                <span className="input-currency">{currencySymbol}</span>
                                <input
                                    type="number"
                                    min={100}
                                    step="100"
                                    className="bet-input-field"
                                    value={inputAmount}
                                    onChange={(e) => setInputAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                />
                            </div>

                            {/* Preset Chips */}
                            <div className="preset-chips-row">
                                {STAKE_PRESETS.map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        className={`preset-chip ${inputAmount === p ? 'active' : ''}`}
                                        onClick={() => {
                                            casinoAudio.playChip()
                                            setInputAmount(p)
                                        }}
                                    >
                                        +{currencySymbol}{p}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                className="vault-action-btn"
                                onClick={handleStake}
                                disabled={isSubmitting || inputAmount > balance || inputAmount < 100}
                                style={{ marginTop: 8 }}
                            >
                                {isSubmitting ? 'STAKING...' : `🏛️ STAKE ${currencySymbol}${inputAmount.toLocaleString('en-IN')} IN VAULT`}
                            </button>
                        </div>
                    )}

                    {/* Unstake Mode */}
                    {activeAction === 'unstake' && (
                        <div className="vault-input-box">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Amount to Unstake</span>
                                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                    Available: {currencySymbol}{pos.stakedINR.toLocaleString('en-IN')}
                                </span>
                            </div>

                            <div className="bet-input-box">
                                <span className="input-currency">{currencySymbol}</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={pos.stakedINR}
                                    step="100"
                                    className="bet-input-field"
                                    value={inputAmount}
                                    onChange={(e) => setInputAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                />
                            </div>

                            <button
                                type="button"
                                className="vault-action-btn"
                                onClick={handleUnstake}
                                disabled={isSubmitting || inputAmount > pos.stakedINR || pos.stakedINR <= 0}
                                style={{ marginTop: 8, background: '#1e293b', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.15)' }}
                            >
                                {isSubmitting ? 'UNSTAKING...' : `↩️ UNSTAKE ${currencySymbol}${inputAmount.toLocaleString('en-IN')} TO WALLET`}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Transparency & Economics Infobox */}
            <div className="vault-info-banner">
                <strong>💡 How the "Be the House" Vault Works:</strong> When community members stake funds into the Amrat House Vault, their liquidity backs the casino bankroll. In exchange, <strong>15% of the casino house edge</strong> generated on all single-player bets (Limbo, Mines, Crash, Coin Toss) and PvP duel rake fees is distributed pro-rata to vault stakers in real time. Stakers earn sustainable yield with zero lockup penalty.
            </div>
        </div>
    )
}
