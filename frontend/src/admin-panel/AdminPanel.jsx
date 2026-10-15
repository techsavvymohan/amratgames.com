import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../context/WebSocketContext'
import { AdminApiClient } from './services/AdminApiClient'
import { TreasuryModel, UserModel } from './models/AdminModels'

import OverviewTab from './components/OverviewTab'
import UserManagementTab from './components/UserManagementTab'
import TokenDistributionTab from './components/TokenDistributionTab'
import SettingsTab from './components/SettingsTab'
import WithdrawalsTab from './components/WithdrawalsTab'
import DepositsTab from './components/DepositsTab'
import BalanceModal from './components/BalanceModal'
import LockScreen from './components/LockScreen'

import './AdminPanel.css'

export default function AdminPanel() {
    const { user, token, isAdmin, login, quickAdminLogin, logout, backendOnline } = useAuth()
    const { subscribe } = useWebSocket()

    const apiClient = useMemo(() => new AdminApiClient(() => token), [token])

    // Ensure the page document is scrollable while on the Admin Panel
    useEffect(() => {
        document.documentElement.classList.add('admin-page-active')
        document.body.classList.add('admin-page-active')
        return () => {
            document.documentElement.classList.remove('admin-page-active')
            document.body.classList.remove('admin-page-active')
        }
    }, [])

    // Tabs & View State
    const [currentTab, setCurrentTab] = useState('overview') // 'overview' | 'withdrawals' | 'deposits' | 'users' | 'tokens' | 'settings'
    const [loading, setLoading] = useState(false)
    const [stats, setStats] = useState(null)
    const [users, setUsers] = useState([])
    const [withdrawals, setWithdrawals] = useState([])
    const [deposits, setDeposits] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [liveBets, setLiveBets] = useState([])
    const [airdrops, setAirdrops] = useState([])
    const [treasury, setTreasury] = useState(new TreasuryModel())
    const [settings, setSettings] = useState({
        rtp: 99.00,
        houseEdge: 1.00,
        maintenanceMode: false,
        activeAnnouncements: '👑 Welcome to AmratGames!'
    })

    // Auth Form State
    const [loginEmail, setLoginEmail] = useState('')
    const [loginPassword, setLoginPassword] = useState('')
    const [loginError, setLoginError] = useState('')

    // Modal State
    const [selectedUserForBalance, setSelectedUserForBalance] = useState(null)
    const [adjustCurrency, setAdjustCurrency] = useState('INR')
    const [adjustAmount, setAdjustAmount] = useState('')
    const [adjustNote, setAdjustNote] = useState('')

    // Airdrop Form State
    const [airdropToken, setAirdropToken] = useState('AMRAT')
    const [airdropAmount, setAirdropAmount] = useState('500')
    const [airdropTarget, setAirdropTarget] = useState('all_players')
    const [airdropCampaign, setAirdropCampaign] = useState('Royal Loyalty Drop')
    const [airdropNote, setAirdropNote] = useState('Community VIP Token Grant')
    const [airdropStatus, setAirdropStatus] = useState('')

    // Toast Notification
    const [toastMessage, setToastMessage] = useState(null)
    const triggerToast = (msg) => {
        setToastMessage(msg)
        setTimeout(() => setToastMessage(null), 4000)
    }

    // Load Data via OOP API Client
    const loadData = useCallback(async () => {
        if (!isAdmin) return
        setLoading(true)
        try {
            // 1. Stats
            const statsData = await apiClient.getStats().catch(() => null)
            if (statsData) {
                setStats(statsData)
                if (statsData.treasury) setTreasury(statsData.treasury)
                if (statsData.settings) setSettings(statsData.settings)
            }

            // 2. Users
            const userModels = await apiClient.getUsers().catch(() => [])
            setUsers(userModels)

            // 3. Airdrops
            const airdropModels = await apiClient.getAirdropHistory().catch(() => [])
            setAirdrops(airdropModels)

            // 4. Recent Bets
            const bets = await apiClient.getRecentBets(25).catch(() => [])
            if (bets && bets.length > 0) setLiveBets(bets)

            // 5. Withdrawals
            const withdrawalModels = await apiClient.getWithdrawals().catch(() => [])
            setWithdrawals(withdrawalModels)

            // 6. Deposits (Cashier Verification Queue)
            const depositModels = await apiClient.getDeposits().catch(() => [])
            setDeposits(depositModels)
        } catch (err) {
            console.warn('Admin data load notice:', err)
        } finally {
            setLoading(false)
        }
    }, [isAdmin, apiClient])

    useEffect(() => {
        if (isAdmin) {
            loadData()
        }
    }, [isAdmin, loadData])

    // Real-time WebSocket subscriptions
    useEffect(() => {
        if (!isAdmin) return

        const unsubs = [
            subscribe('NEW_BET', (bet) => {
                if (bet) setLiveBets((prev) => [bet, ...prev].slice(0, 30))
            }),
            subscribe('NEW_WITHDRAWAL_REQUEST', (payload) => {
                if (payload) triggerToast(`🔔 New Withdrawal: ₹${payload.amount} requested by ${payload.username}!`)
                loadData()
            }),
            subscribe('WITHDRAWAL_STATUS_UPDATED', () => {
                loadData()
            }),
            subscribe('NEW_DEPOSIT_REQUEST', (payload) => {
                if (payload) triggerToast(`🔔 New Deposit: ₹${payload.amount} submitted by ${payload.username}!`)
                loadData()
            }),
            subscribe('DEPOSIT_STATUS_UPDATED', () => {
                loadData()
            })
        ]

        return () => {
            unsubs.forEach((unsub) => {
                if (typeof unsub === 'function') unsub()
            })
        }
    }, [isAdmin, subscribe, loadData])

    // Handlers
    const handleLoginSubmit = async (e) => {
        e.preventDefault()
        setLoginError('')
        try {
            await login(loginEmail, loginPassword)
        } catch (err) {
            setLoginError(err.message || 'Login failed')
        }
    }

    const handleQuickAdmin = async () => {
        setLoginError('')
        try {
            await quickAdminLogin()
        } catch (err) {
            setLoginError(err.message || 'Quick sign-in failed')
        }
    }

    const handleAdjustBalanceSubmit = async (e) => {
        e.preventDefault()
        if (!selectedUserForBalance || !adjustAmount) return

        try {
            const result = await apiClient.adjustBalance(
                selectedUserForBalance.id,
                adjustCurrency,
                adjustAmount,
                adjustNote || 'Manual Admin Credit/Debit'
            )
            triggerToast(`Balance updated for ${result.user.username}`)
            setSelectedUserForBalance(null)
            setAdjustAmount('')
            setAdjustNote('')
            loadData()
        } catch (err) {
            alert('Error updating balance: ' + err.message)
        }
    }

    const handleToggleBan = async (u) => {
        const nextBanned = !u.isSuspended()
        const confirmMsg = nextBanned
            ? `Suspend and ban player ${u.username}?`
            : `Unban and restore player ${u.username}?`
        if (!window.confirm(confirmMsg)) return

        try {
            await apiClient.setUserStatus(u.id, { isBanned: nextBanned })
            triggerToast(nextBanned ? `User ${u.username} banned` : `User ${u.username} unbanned`)
            loadData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    const handleLaunchAirdrop = async (e) => {
        e.preventDefault()
        const amt = parseFloat(airdropAmount)
        if (isNaN(amt) || amt <= 0) {
            alert('Please specify a positive distribution amount')
            return
        }

        setAirdropStatus('Processing distribution...')
        try {
            const data = await apiClient.distributeTokens({
                token: airdropToken,
                amount: amt,
                targetGroup: airdropTarget,
                campaign: airdropCampaign,
                note: airdropNote
            })
            triggerToast(`🎉 ${data.message}`)
            setAirdropStatus(`Success! Distributed to ${data.data.recipientsCount} players.`)
            loadData()
        } catch (err) {
            setAirdropStatus(`Failed: ${err.message}`)
        }
    }

    const handleRotateSeed = async () => {
        if (!window.confirm('Rotate provably fair server seed now? The previous secret seed will be publicly revealed.')) return
        try {
            await apiClient.rotateSeed()
            triggerToast('Server seed rotated! Previous seed revealed.')
            loadData()
        } catch (err) {
            alert('Failed to rotate seed: ' + err.message)
        }
    }

    const handleSaveSettings = async (e) => {
        e.preventDefault()
        try {
            await apiClient.updateSettings(settings)
            triggerToast('Platform settings saved successfully!')
            loadData()
        } catch (err) {
            alert('Failed to save settings: ' + err.message)
        }
    }

    const handleApproveWithdrawal = async (id, { transactionRef, adminNote }) => {
        try {
            const result = await apiClient.approveWithdrawal(id, { transactionRef, adminNote })
            triggerToast(`✓ Withdrawal #${id} approved! Payout confirmed.`)
            loadData()
            return result
        } catch (err) {
            alert('Error approving payout: ' + err.message)
            throw err
        }
    }

    const handleRejectWithdrawal = async (id, { rejectionReason, adminNote }) => {
        try {
            const result = await apiClient.rejectWithdrawal(id, { rejectionReason, adminNote })
            triggerToast(`✕ Withdrawal #${id} rejected. Balance refunded to player.`)
            loadData()
            return result
        } catch (err) {
            alert('Error rejecting withdrawal: ' + err.message)
            throw err
        }
    }

    const handleApproveDeposit = async (id, { adminNote }) => {
        try {
            const result = await apiClient.approveDeposit(id, { adminNote })
            triggerToast(`✓ Deposit approved and credited to player balance!`)
            loadData()
            return result
        } catch (err) {
            alert('Error approving deposit: ' + err.message)
            throw err
        }
    }

    const handleRejectDeposit = async (id, { rejectionReason }) => {
        try {
            const result = await apiClient.rejectDeposit(id, { rejectionReason })
            triggerToast(`✕ Deposit rejected.`)
            loadData()
            return result
        } catch (err) {
            alert('Error rejecting deposit: ' + err.message)
            throw err
        }
    }

    const handleApproveKYC = async (userId) => {
        try {
            const result = await apiClient.approveKYC(userId)
            triggerToast(`✓ KYC approved for player!`)
            loadData()
            return result
        } catch (err) {
            alert('Error approving KYC: ' + err.message)
        }
    }

    const handleRejectKYC = async (userId) => {
        const reason = window.prompt('Enter reason for KYC rejection:', 'Document verification failed')
        if (reason === null) return
        try {
            const result = await apiClient.rejectKYC(userId, { reason })
            triggerToast(`✕ KYC rejected.`)
            loadData()
            return result
        } catch (err) {
            alert('Error rejecting KYC: ' + err.message)
        }
    }

    // If NOT logged in as Admin, show Modular Lock Screen
    if (!isAdmin) {
        return (
            <div className="admin-container">
                <LockScreen
                    loginEmail={loginEmail}
                    setLoginEmail={setLoginEmail}
                    loginPassword={loginPassword}
                    setLoginPassword={setLoginPassword}
                    loginError={loginError}
                    onSubmit={handleLoginSubmit}
                    onQuickAdmin={handleQuickAdmin}
                />
            </div>
        )
    }

    const eligiblePlayersCount = users.filter((u) => !u.isAdmin() && !u.isSuspended()).length
    const vipCount = users.filter((u) => u.isVip()).length
    const pendingWithdrawalsCount = withdrawals.filter((w) => w.status === 'pending').length
    const pendingDepositsCount = deposits.filter((d) => d.status === 'pending').length

    return (
        <div className="admin-container">
            {/* Toast */}
            {toastMessage && (
                <div style={{
                    position: 'fixed',
                    top: '24px',
                    right: '24px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    padding: '12px 20px',
                    borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    fontWeight: 700,
                    zIndex: 10000,
                }}>
                    {toastMessage}
                </div>
            )}

            {/* Header */}
            <div className="admin-header">
                <div className="admin-title-area">
                    <img
                        src="/amrat-logo.png"
                        alt="AmratGames"
                        className="admin-logo-badge"
                    />
                    <div>
                        <h1>Admin Dashboard</h1>
                        <p className="admin-subtitle">Platform Controls &amp; Operations</p>
                    </div>
                </div>

                <div className="admin-status-indicators">
                    <div className="status-pill">
                        <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
                        <span>{backendOnline ? 'Online' : 'Demo Mode'}</span>
                    </div>

                    <div className="admin-user-pill">
                        <span>🛡️</span>
                        <span>Admin: {user?.username || 'admin'}</span>
                    </div>

                    <Link
                        to="/"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            borderRadius: '20px',
                            background: 'rgba(245, 175, 25, 0.15)',
                            border: '1px solid rgba(245, 175, 25, 0.4)',
                            color: '#fbbf24',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            textDecoration: 'none',
                            cursor: 'pointer'
                        }}
                        title="Back to Casino"
                    >
                        <span>🎰</span>
                        <span>Back to Casino</span>
                    </Link>

                    <button
                        className="btn-action danger"
                        onClick={logout}
                        title="Sign Out"
                    >
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="admin-nav-tabs">
                <button
                    className={`admin-tab-btn ${currentTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('overview')}
                >
                    <span>📊</span>
                    <span>Overview</span>
                </button>
                <button
                    className={`admin-tab-btn ${currentTab === 'deposits' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('deposits')}
                    style={pendingDepositsCount > 0 ? { position: 'relative' } : {}}
                >
                    <span>📥</span>
                    <span>Deposits</span>
                    {pendingDepositsCount > 0 && (
                        <span style={{
                            background: '#fbbf24',
                            color: '#000',
                            borderRadius: '10px',
                            padding: '1px 7px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            marginLeft: '6px'
                        }}>
                            {pendingDepositsCount}
                        </span>
                    )}
                </button>
                <button
                    className={`admin-tab-btn ${currentTab === 'withdrawals' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('withdrawals')}
                    style={pendingWithdrawalsCount > 0 ? { position: 'relative' } : {}}
                >
                    <span>🏧</span>
                    <span>Withdrawals</span>
                    {pendingWithdrawalsCount > 0 && (
                        <span style={{
                            background: '#f59e0b',
                            color: '#000',
                            borderRadius: '10px',
                            padding: '1px 7px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            marginLeft: '6px'
                        }}>
                            {pendingWithdrawalsCount}
                        </span>
                    )}
                </button>
                <button
                    className={`admin-tab-btn ${currentTab === 'users' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('users')}
                >
                    <span>👥</span>
                    <span>Players ({users.length})</span>
                </button>
                <button
                    className={`admin-tab-btn ${currentTab === 'tokens' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('tokens')}
                >
                    <span>🎁</span>
                    <span>Bonus &amp; Tokens</span>
                </button>
                <button
                    className={`admin-tab-btn ${currentTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('settings')}
                >
                    <span>⚙️</span>
                    <span>Settings</span>
                </button>
            </div>

            {/* Render Active Modular Tab */}
            {currentTab === 'overview' && (
                <OverviewTab
                    stats={stats}
                    treasury={treasury}
                    users={users}
                    liveBets={liveBets}
                    withdrawals={withdrawals}
                    onSwitchTab={setCurrentTab}
                    onRotateSeed={handleRotateSeed}
                />
            )}

            {currentTab === 'deposits' && (
                <DepositsTab
                    deposits={deposits}
                    loading={loading}
                    onApprove={handleApproveDeposit}
                    onReject={handleRejectDeposit}
                    onRefresh={loadData}
                    triggerToast={triggerToast}
                />
            )}

            {currentTab === 'withdrawals' && (
                <WithdrawalsTab
                    withdrawals={withdrawals}
                    stats={stats}
                    loading={loading}
                    onApprove={handleApproveWithdrawal}
                    onReject={handleRejectWithdrawal}
                    onRefresh={loadData}
                    triggerToast={triggerToast}
                />
            )}

            {currentTab === 'users' && (
                <UserManagementTab
                    users={users}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    onSelectUserForBalance={setSelectedUserForBalance}
                    onToggleBan={handleToggleBan}
                    onApproveKYC={handleApproveKYC}
                    onRejectKYC={handleRejectKYC}
                    onRefresh={loadData}
                />
            )}

            {currentTab === 'tokens' && (
                <TokenDistributionTab
                    treasury={treasury}
                    airdrops={airdrops}
                    eligiblePlayersCount={eligiblePlayersCount}
                    vipCount={vipCount}
                    airdropToken={airdropToken}
                    setAirdropToken={setAirdropToken}
                    airdropAmount={airdropAmount}
                    setAirdropAmount={setAirdropAmount}
                    airdropTarget={airdropTarget}
                    setAirdropTarget={setAirdropTarget}
                    airdropCampaign={airdropCampaign}
                    setAirdropCampaign={setAirdropCampaign}
                    airdropNote={airdropNote}
                    setAirdropNote={setAirdropNote}
                    airdropStatus={airdropStatus}
                    onLaunchAirdrop={handleLaunchAirdrop}
                />
            )}

            {currentTab === 'settings' && (
                <SettingsTab
                    settings={settings}
                    setSettings={setSettings}
                    stats={stats}
                    onRotateSeed={handleRotateSeed}
                    onSaveSettings={handleSaveSettings}
                    apiClient={apiClient}
                    triggerToast={triggerToast}
                />
            )}

            {/* Balance Modal */}
            <BalanceModal
                user={selectedUserForBalance}
                adjustCurrency={adjustCurrency}
                setAdjustCurrency={setAdjustCurrency}
                adjustAmount={adjustAmount}
                setAdjustAmount={setAdjustAmount}
                adjustNote={adjustNote}
                setAdjustNote={setAdjustNote}
                onClose={() => setSelectedUserForBalance(null)}
                onSubmit={handleAdjustBalanceSubmit}
            />
        </div>
    )
}
