import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWallet } from '../context/WalletContext'
import MultiTierAffiliateDashboard from '../components/Affiliate/MultiTierAffiliateDashboard'
import HouseVaultDashboard from '../components/Vault/HouseVaultDashboard'
import './ProfilePage.css'

export default function ProfilePage() {
    const { user, logout, updateProfile, changePassword, submitKycVerification, getBetsHistory, getPaymentsHistory } = useAuth()
    const { getVipStatus, claimVipRakeback, getAffiliateStats, claimAffiliateCommission, currencySymbol } = useWallet()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const subnavRef = useRef(null)

    const [activeTab, setActiveTab] = useState(() => {
        const t = searchParams.get('tab')
        if (t && ['profile', 'vip', 'affiliate', 'vault', 'payments', 'bets', 'support'].includes(t)) {
            return t
        }
        return 'profile'
    })

    // Auto-scroll active subnav chip into view horizontally on mobile (without vertical jump)
    useEffect(() => {
        if (subnavRef.current) {
            const activeBtn = subnavRef.current.querySelector(`.profile-subnav-btn[data-tab="${activeTab}"]`)
            if (activeBtn) {
                const container = subnavRef.current
                const scrollLeft = activeBtn.offsetLeft - (container.clientWidth / 2) + (activeBtn.clientWidth / 2)
                container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' })
            }
        }
    }, [activeTab])

    // VIP Loyalty Engine State
    const [vipData, setVipData] = useState(null)
    const [loadingVip, setLoadingVip] = useState(false)
    const [claimingRakeback, setClaimingRakeback] = useState(false)
    const [rakebackMsg, setRakebackMsg] = useState('')

    // Viral Affiliate Flywheel State
    const [affiliateData, setAffiliateData] = useState(null)
    const [loadingAffiliate, setLoadingAffiliate] = useState(false)
    const [claimingCommission, setClaimingCommission] = useState(false)
    const [commissionMsg, setCommissionMsg] = useState('')
    const [copiedRefLink, setCopiedRefLink] = useState(false)

    // Sync tab when query param changes
    useEffect(() => {
        const t = searchParams.get('tab')
        if (t && ['profile', 'vip', 'affiliate', 'vault', 'payments', 'bets', 'support'].includes(t)) {
            setActiveTab(t)
        }
    }, [searchParams])

    // Main Info Form State (Streamlined & Professional)
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [copiedUuid, setCopiedUuid] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)
    const [updateMsg, setUpdateMsg] = useState('')

    // Password Form State
    const [oldPassword, setOldPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [repeatPassword, setRepeatPassword] = useState('')
    const [showOldPass, setShowOldPass] = useState(false)
    const [showNewPass, setShowNewPass] = useState(false)
    const [showRepeatPass, setShowRepeatPass] = useState(false)
    const [isChangingPass, setIsChangingPass] = useState(false)
    const [passMsg, setPassMsg] = useState('')
    const [passError, setPassError] = useState('')

    // KYC Verification Modal State
    const [showKycModal, setShowKycModal] = useState(false)
    const [docType, setDocType] = useState('aadhaar')
    const [docNumber, setDocNumber] = useState('')
    const [legalName, setLegalName] = useState('')
    const [isSubmittingKyc, setIsSubmittingKyc] = useState(false)
    const [kycSuccessMsg, setKycSuccessMsg] = useState('')

    // History States
    const [paymentsFilter, setPaymentsFilter] = useState('all')
    const [paymentsData, setPaymentsData] = useState({ transactions: [], withdrawals: [] })
    const [betsFilter, setBetsFilter] = useState('all')
    const [betsData, setBetsData] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    // Sync state with user data
    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || user.username || '')
            setLastName(user.lastName || '')
            setLegalName(`${user.firstName || user.username || ''} ${user.lastName || ''}`.trim())
        }
    }, [user])

    // VIP & Affiliate Loader Callbacks
    const loadVip = useCallback(async () => {
        setLoadingVip(true)
        const res = await getVipStatus()
        if (res && res.success) {
            setVipData(res)
        }
        setLoadingVip(false)
    }, [getVipStatus])

    const handleClaimRakeback = async () => {
        setClaimingRakeback(true)
        setRakebackMsg('')
        const res = await claimVipRakeback()
        if (res && res.success) {
            setRakebackMsg(`✓ Claimed ${currencySymbol}${res.claimedAmount.toFixed(2)} rakeback directly to your wallet!`)
            loadVip()
        } else {
            setRakebackMsg(`⚠️ ${res?.error || 'Failed to claim rakeback'}`)
        }
        setClaimingRakeback(false)
    }

    const loadAffiliate = useCallback(async () => {
        setLoadingAffiliate(true)
        const res = await getAffiliateStats()
        if (res && res.success) {
            setAffiliateData(res)
        }
        setLoadingAffiliate(false)
    }, [getAffiliateStats])

    const handleClaimCommission = async () => {
        setClaimingCommission(true)
        setCommissionMsg('')
        const res = await claimAffiliateCommission()
        if (res && res.success) {
            setCommissionMsg(`✓ Claimed ${currencySymbol}${res.claimedAmount.toFixed(2)} commission directly to your wallet!`)
            loadAffiliate()
        } else {
            setCommissionMsg(`⚠️ ${res?.error || 'Failed to claim commission'}`)
        }
        setClaimingCommission(false)
    }

    const handleCopyRefLink = () => {
        const link = affiliateData?.referralLink || `${window.location.origin}/?ref=${user?.referralCode || ''}`
        navigator.clipboard.writeText(link)
        setCopiedRefLink(true)
        setTimeout(() => setCopiedRefLink(false), 2000)
    }

    // Load tab-specific data when tab switches
    useEffect(() => {
        if (activeTab === 'vip') {
            loadVip()
        } else if (activeTab === 'affiliate') {
            loadAffiliate()
        } else if (activeTab === 'payments') {
            setLoadingHistory(true)
            getPaymentsHistory().then(res => {
                setPaymentsData(res)
                setLoadingHistory(false)
            })
        } else if (activeTab === 'bets') {
            setLoadingHistory(true)
            getBetsHistory().then(res => {
                setBetsData(res)
                setLoadingHistory(false)
            })
        }
    }, [activeTab, loadVip, loadAffiliate, getPaymentsHistory, getBetsHistory])

    const handleCopyUuid = () => {
        if (!user?.id) return
        navigator.clipboard.writeText(user.id)
        setCopiedUuid(true)
        setTimeout(() => setCopiedUuid(false), 2000)
    }

    const handleUpdateData = async (e) => {
        e.preventDefault()
        setIsUpdating(true)
        setUpdateMsg('')
        try {
            await updateProfile({
                firstName: firstName.trim(),
                lastName: lastName.trim()
            })
            setUpdateMsg('Profile updated successfully!')
            setTimeout(() => setUpdateMsg(''), 3000)
        } catch (err) {
            setUpdateMsg('Error: ' + err.message)
        } finally {
            setIsUpdating(false)
        }
    }

    const handleChangePassword = async (e) => {
        e.preventDefault()
        setPassMsg('')
        setPassError('')

        if (newPassword !== repeatPassword) {
            setPassError('New passwords do not match')
            return
        }
        if (newPassword.length < 6) {
            setPassError('Password must be at least 6 characters')
            return
        }

        setIsChangingPass(true)
        try {
            await changePassword(oldPassword, newPassword)
            setPassMsg('Password changed successfully!')
            setOldPassword('')
            setNewPassword('')
            setRepeatPassword('')
            setTimeout(() => setPassMsg(''), 3000)
        } catch (err) {
            setPassError(err.message || 'Failed to change password')
        } finally {
            setIsChangingPass(false)
        }
    }

    const handleSubmitKyc = async (e) => {
        e.preventDefault()
        if (!docNumber.trim()) return
        setIsSubmittingKyc(true)
        try {
            await submitKycVerification({
                documentType: docType,
                documentNumber: docNumber.trim(),
                fullName: legalName.trim()
            })
            setKycSuccessMsg('KYC Verified! Your account is now official Level 2 Verified.')
            setTimeout(() => {
                setShowKycModal(false)
                setKycSuccessMsg('')
            }, 2000)
        } catch (err) {
            alert('KYC submission error: ' + err.message)
        } finally {
            setIsSubmittingKyc(false)
        }
    }

    if (!user) {
        return (
            <div className="profile-page-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <h2>Please Sign In</h2>
                <p style={{ color: '#94a3b8', margin: '12px 0 24px' }}>Sign in to view and manage your verified casino profile.</p>
                <Link to="/" className="profile-btn-primary" style={{ display: 'inline-block', maxWidth: '200px', textDecoration: 'none' }}>
                    Return to Lobby
                </Link>
            </div>
        )
    }

    return (
        <div className="profile-page-container">
            {/* VIP Profile Hero Banner */}
            <div className="profile-hero-banner">
                <div className="profile-hero-top-group">
                    <div className="profile-hero-avatar-wrap">
                        <div className="profile-hero-avatar">
                            {user.username ? user.username.charAt(0).toUpperCase() : '👤'}
                        </div>
                        <div className="profile-hero-badge" title="Verified Account">✓</div>
                    </div>
                    <div className="profile-hero-info">
                        <div className="profile-hero-name-row">
                            <h2 className="profile-hero-name">{user.username || 'Amrat VIP Player'}</h2>
                            <span className="profile-hero-vip-tag">
                                👑 {vipData?.name || 'Bronze VIP'}
                            </span>
                            {user.kycStatus === 'verified' ? (
                                <span className="profile-hero-verified-tag">🛡️ Verified Level 2</span>
                            ) : (
                                <button
                                    type="button"
                                    className="profile-hero-unverified-tag"
                                    onClick={() => setShowKycModal(true)}
                                >
                                    ⚡ Verify KYC
                                </button>
                            )}
                        </div>
                        <div className="profile-hero-meta">
                            {user.phone && <span className="profile-meta-item">📱 +91 {user.phone}</span>}
                            {user.email && <span className="profile-meta-item">✉️ {user.email}</span>}
                            <span className="profile-meta-item">🪙 {(user.balances?.AMRAT || 0).toLocaleString()} $AMRAT</span>
                        </div>
                    </div>
                </div>
                <div className="profile-hero-balance-box">
                    <div className="profile-hero-balance-label">Cash Wallet</div>
                    <div className="profile-hero-balance-val">
                        {currencySymbol}{(user.balances?.INR || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="profile-hero-sub-balance">
                        Vault: {(user.balances?.AMRAT || 0).toLocaleString()} $AMRAT
                    </div>
                </div>
            </div>

            <div className="profile-main-layout">
                {/* Navigation Sidebar Rail */}
                <aside className="profile-sidebar-rail">
                    <div className="profile-subnav" role="tablist" ref={subnavRef}>
                        <button
                            type="button"
                            data-tab="profile"
                            className={`profile-subnav-btn ${activeTab === 'profile' ? 'active' : ''}`}
                            onClick={() => setActiveTab('profile')}
                        >
                            <span>👤</span>
                            <span>Profile</span>
                        </button>
                        <button
                            type="button"
                            data-tab="vip"
                            className={`profile-subnav-btn ${activeTab === 'vip' ? 'active' : ''}`}
                            onClick={() => setActiveTab('vip')}
                        >
                            <span>👑</span>
                            <span>VIP Club</span>
                        </button>
                        <button
                            type="button"
                            data-tab="affiliate"
                            className={`profile-subnav-btn ${activeTab === 'affiliate' ? 'active' : ''}`}
                            onClick={() => setActiveTab('affiliate')}
                        >
                            <span>💸</span>
                            <span>Affiliates</span>
                        </button>
                        <button
                            type="button"
                            data-tab="vault"
                            className={`profile-subnav-btn ${activeTab === 'vault' ? 'active' : ''}`}
                            onClick={() => setActiveTab('vault')}
                        >
                            <span>🏛️</span>
                            <span>House Vault</span>
                        </button>
                        <button
                            type="button"
                            data-tab="payments"
                            className={`profile-subnav-btn ${activeTab === 'payments' ? 'active' : ''}`}
                            onClick={() => setActiveTab('payments')}
                        >
                            <span>💳</span>
                            <span>Transactions</span>
                        </button>
                        <button
                            type="button"
                            data-tab="bets"
                            className={`profile-subnav-btn ${activeTab === 'bets' ? 'active' : ''}`}
                            onClick={() => setActiveTab('bets')}
                        >
                            <span>🎲</span>
                            <span>Bets</span>
                        </button>
                        <button
                            type="button"
                            data-tab="support"
                            className={`profile-subnav-btn ${activeTab === 'support' ? 'active' : ''}`}
                            onClick={() => setActiveTab('support')}
                        >
                            <span>🎧</span>
                            <span>Support</span>
                        </button>
                    </div>

                    <div className="profile-sidebar-logout-card">
                        <button
                            type="button"
                            className="profile-btn-logout-sidebar"
                            onClick={() => {
                                if (window.confirm('Are you sure you want to log out?')) {
                                    logout()
                                    navigate('/')
                                }
                            }}
                        >
                            <span>🚪</span>
                            <span>Log Out</span>
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="profile-content-area">
                    {/* TAB 1: PROFILE */}
                    {activeTab === 'profile' && (
                        <div className="profile-tab-content">
                            {/* Card 1: Account Identity */}
                            <div className="profile-card">
                                <div className="profile-card-header-row">
                                    <div className="profile-card-title">Account Identity</div>
                                    {user.kycStatus === 'verified' ? (
                                        <span className="profile-badge-verified-pill">🛡️ KYC Level 2 Verified</span>
                                    ) : (
                                        <button
                                            type="button"
                                            className="profile-btn-verify-mini"
                                            onClick={() => setShowKycModal(true)}
                                        >
                                            ⚡ Complete KYC
                                        </button>
                                    )}
                                </div>

                                <form onSubmit={handleUpdateData} className="profile-clean-form">
                                    <div className="profile-form-grid-2col">
                                        {/* Display Name */}
                                        <div className="profile-input-group">
                                            <label className="profile-input-label">First Name / Display Name</label>
                                            <div className="profile-input-wrapper">
                                                <input
                                                    type="text"
                                                    className="profile-text-input"
                                                    value={firstName}
                                                    onChange={(e) => setFirstName(e.target.value)}
                                                    placeholder="Your name"
                                                />
                                                <span style={{ color: '#64748b', fontSize: '13px' }}>✏️</span>
                                            </div>
                                        </div>

                                        {/* Surname */}
                                        <div className="profile-input-group">
                                            <label className="profile-input-label">Last Name</label>
                                            <div className="profile-input-wrapper">
                                                <input
                                                    type="text"
                                                    className="profile-text-input"
                                                    value={lastName}
                                                    onChange={(e) => setLastName(e.target.value)}
                                                    placeholder="Your surname"
                                                />
                                                <span style={{ color: '#64748b', fontSize: '13px' }}>✏️</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Account UUID */}
                                    <div className="profile-input-group">
                                        <label className="profile-input-label">Account Player UUID</label>
                                        <div className="profile-input-wrapper">
                                            <input
                                                type="text"
                                                className="profile-text-input profile-mono-input"
                                                value={user.id}
                                                readOnly
                                            />
                                            <button
                                                type="button"
                                                className="profile-copy-btn"
                                                onClick={handleCopyUuid}
                                                title="Copy UUID"
                                            >
                                                {copiedUuid ? '✓ Copied' : '📋 Copy UUID'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Contact Information (Phone & Email) */}
                                    <div className="profile-form-grid-2col">
                                        <div className="profile-input-group">
                                            <label className="profile-input-label">Verified Mobile Number</label>
                                            <div className="profile-verified-field">
                                                <div className="profile-flag-pill">
                                                    <span>🇮🇳</span>
                                                    <span>+91</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    className="profile-verified-input"
                                                    value={user.phone || 'Not linked'}
                                                    readOnly
                                                />
                                                <div className="profile-badge-check" title="Verified Phone Number">✓</div>
                                            </div>
                                        </div>

                                        <div className="profile-input-group">
                                            <label className="profile-input-label">Verified Email Address</label>
                                            <div className="profile-verified-field">
                                                <input
                                                    type="text"
                                                    className="profile-verified-input"
                                                    value={user.email || 'Not linked'}
                                                    readOnly
                                                />
                                                <div className="profile-badge-check" title="Verified Email">✓</div>
                                            </div>
                                        </div>
                                    </div>

                                    {updateMsg && (
                                        <div className={`profile-feedback-msg ${updateMsg.startsWith('Error') ? 'error' : 'success'}`}>
                                            {updateMsg}
                                        </div>
                                    )}

                                    <div className="profile-form-actions">
                                        <button
                                            type="submit"
                                            className="profile-btn-primary"
                                            disabled={isUpdating}
                                        >
                                            {isUpdating ? 'Saving...' : 'Save Profile Changes'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Card 2: Security & Credentials */}
                            <div className="profile-card">
                                <div className="profile-card-title">Security & Password</div>
                                <p className="profile-card-desc">Protect your gaming balance by maintaining a strong, confidential password.</p>

                                <form onSubmit={handleChangePassword} className="profile-clean-form">
                                    <div className="profile-form-grid-3col">
                                        <div className="profile-input-group">
                                            <label className="profile-input-label">Current Password</label>
                                            <div className="profile-input-wrapper">
                                                <input
                                                    type={showOldPass ? 'text' : 'password'}
                                                    className="profile-text-input"
                                                    placeholder="Enter old password"
                                                    value={oldPassword}
                                                    onChange={(e) => setOldPassword(e.target.value)}
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    className="profile-icon-btn"
                                                    onClick={() => setShowOldPass(!showOldPass)}
                                                >
                                                    {showOldPass ? '👁️' : '🙈'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="profile-input-group">
                                            <label className="profile-input-label">New Password</label>
                                            <div className="profile-input-wrapper">
                                                <input
                                                    type={showNewPass ? 'text' : 'password'}
                                                    className="profile-text-input"
                                                    placeholder="Min 6 characters"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    className="profile-icon-btn"
                                                    onClick={() => setShowNewPass(!showNewPass)}
                                                >
                                                    {showNewPass ? '👁️' : '🙈'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="profile-input-group">
                                            <label className="profile-input-label">Confirm New Password</label>
                                            <div className="profile-input-wrapper">
                                                <input
                                                    type={showRepeatPass ? 'text' : 'password'}
                                                    className="profile-text-input"
                                                    placeholder="Repeat new password"
                                                    value={repeatPassword}
                                                    onChange={(e) => setRepeatPassword(e.target.value)}
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    className="profile-icon-btn"
                                                    onClick={() => setShowRepeatPass(!showRepeatPass)}
                                                >
                                                    {showRepeatPass ? '👁️' : '🙈'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {passError && (
                                        <div className="profile-feedback-msg error">
                                            ⚠️ {passError}
                                        </div>
                                    )}

                                    {passMsg && (
                                        <div className="profile-feedback-msg success">
                                            ✓ {passMsg}
                                        </div>
                                    )}

                                    <div className="profile-form-actions">
                                        <button
                                            type="submit"
                                            className="profile-btn-primary profile-btn-secondary"
                                            disabled={isChangingPass}
                                        >
                                            {isChangingPass ? 'Updating...' : 'Update Password'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Card 3: Session Logout */}
                            <div className="profile-card profile-logout-card">
                                <div className="profile-logout-info">
                                    <div className="profile-logout-title">Sign Out of Account</div>
                                    <div className="profile-logout-desc">Safely terminate your active casino session on this device.</div>
                                </div>
                                <button
                                    type="button"
                                    className="profile-btn-logout-clean"
                                    onClick={() => {
                                        if (window.confirm('Are you sure you want to log out?')) {
                                            logout()
                                            navigate('/')
                                        }
                                    }}
                                >
                                    🚪 Log Out
                                </button>
                            </div>
                        </div>
                    )}

            {/* TAB 2: PAYMENTS HISTORY */}
            {activeTab === 'payments' && (
                <div className="profile-history-card">
                    <div className="profile-card-title">Payments & Cashier History</div>

                    <div className="profile-history-filters">
                        <button
                            type="button"
                            className={`profile-filter-pill ${paymentsFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setPaymentsFilter('all')}
                        >
                            All
                        </button>
                        <button
                            type="button"
                            className={`profile-filter-pill ${paymentsFilter === 'deposits' ? 'active' : ''}`}
                            onClick={() => setPaymentsFilter('deposits')}
                        >
                            Deposits
                        </button>
                        <button
                            type="button"
                            className={`profile-filter-pill ${paymentsFilter === 'withdrawals' ? 'active' : ''}`}
                            onClick={() => setPaymentsFilter('withdrawals')}
                        >
                            Withdrawals
                        </button>
                    </div>

                    {loadingHistory ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>Loading payments...</div>
                    ) : (
                        <div>
                            {/* Merge withdrawals and transactions */}
                            {paymentsData.withdrawals?.length === 0 && paymentsData.transactions?.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No payment history recorded yet.</div>
                            ) : (
                                <>
                                    {paymentsData.withdrawals
                                        ?.filter(w => paymentsFilter === 'all' || paymentsFilter === 'withdrawals')
                                        .map(w => (
                                            <div key={w.id} className="profile-item-row">
                                                <div className="profile-item-details">
                                                    <div className="profile-item-title">Payout Request ({w.payoutMethod})</div>
                                                    <div className="profile-item-meta">
                                                        {new Date(w.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </div>
                                                    <div className="profile-item-submeta">To: {w.payoutDestination}</div>
                                                </div>
                                                <div className="profile-item-action">
                                                    <div style={{ fontWeight: 800, color: '#f87171', fontSize: '0.95rem' }}>-₹{w.amount}</div>
                                                    <span className={`profile-status-badge ${w.status}`}>
                                                        {w.status === 'pending' ? 'Pending Cashier' : w.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}

                                    {paymentsData.transactions
                                        ?.filter(t => paymentsFilter === 'all' || (paymentsFilter === 'deposits' && t.type === 'credit'))
                                        .map(t => (
                                            <div key={t.id} className="profile-item-row">
                                                <div className="profile-item-details">
                                                    <div className="profile-item-title">{t.note || (t.type === 'credit' ? 'Deposit / Bonus' : 'Debit')}</div>
                                                    <div className="profile-item-meta">
                                                        {new Date(t.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </div>
                                                </div>
                                                <div className="profile-item-action">
                                                    <div style={{
                                                        fontWeight: 800,
                                                        color: t.amount > 0 ? '#10b981' : '#f87171',
                                                        fontSize: '0.95rem'
                                                    }}>
                                                        {t.amount > 0 ? `+₹${t.amount}` : `-₹${Math.abs(t.amount)}`}
                                                    </div>
                                                    <span className="profile-status-badge approved">Success</span>
                                                </div>
                                            </div>
                                        ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: BETS HISTORY */}
            {activeTab === 'bets' && (
                <div className="profile-history-card">
                    <div className="profile-card-title">Bets History</div>

                    <div className="profile-history-filters">
                        <button
                            type="button"
                            className={`profile-filter-pill ${betsFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setBetsFilter('all')}
                        >
                            All Bets
                        </button>
                        <button
                            type="button"
                            className={`profile-filter-pill ${betsFilter === 'wins' ? 'active' : ''}`}
                            onClick={() => setBetsFilter('wins')}
                        >
                            Wins Only
                        </button>
                        <button
                            type="button"
                            className={`profile-filter-pill ${betsFilter === 'losses' ? 'active' : ''}`}
                            onClick={() => setBetsFilter('losses')}
                        >
                            Losses
                        </button>
                    </div>

                    {loadingHistory ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>Loading bets...</div>
                    ) : betsData.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No bets played yet. Try Aviator or Limbo!</div>
                    ) : (
                        <div>
                            {betsData
                                .filter(b => betsFilter === 'all' || (betsFilter === 'wins' && b.won) || (betsFilter === 'losses' && !b.won))
                                .map(b => (
                                    <div key={b.id} className="profile-item-row">
                                        <div className="profile-item-details">
                                            <div className="profile-item-title" style={{ textTransform: 'capitalize' }}>
                                                {b.gameName || b.game}
                                            </div>
                                            <div className="profile-item-meta">
                                                {new Date(b.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                            </div>
                                            {b.multiplier > 0 && (
                                                <div className="profile-item-submeta" style={{ color: '#fbbf24' }}>Multiplier: {b.multiplier}x</div>
                                            )}
                                        </div>
                                        <div className="profile-item-action">
                                            <div style={{
                                                fontWeight: 800,
                                                color: b.won ? '#10b981' : '#f87171',
                                                fontSize: '0.95rem'
                                            }}>
                                                {b.won ? `+₹${b.payout || b.betAmount}` : `-₹${b.betAmount}`}
                                            </div>
                                            <span className={`profile-status-badge ${b.won ? 'won' : 'lost'}`}>
                                                {b.won ? 'Won' : 'Lost'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 4: SUPPORT */}
            {activeTab === 'support' && (
                <div className="profile-card">
                    <div className="profile-card-title">24/7 Player Support</div>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '20px', lineHeight: 1.5 }}>
                        Need help with verification, account limits, or deposit/withdrawal? Our VIP support team is available around the clock.
                    </p>

                    <div className="profile-support-list">
                        <div className="profile-support-row">
                            <div className="profile-support-row-info">
                                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Official Support Email</div>
                                <div style={{ fontSize: '0.8rem', color: '#3b82f6', wordBreak: 'break-all' }}>support@amratgames.com</div>
                            </div>
                            <a
                                href="mailto:support@amratgames.com"
                                className="profile-support-action-btn"
                            >
                                Email Us
                            </a>
                        </div>

                        <div className="profile-support-row">
                            <div className="profile-support-row-info">
                                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Official Telegram Channel</div>
                                <div style={{ fontSize: '0.8rem', color: '#38bdf8' }}>@AmratGamesSupport</div>
                            </div>
                            <span style={{ fontSize: '20px' }}>✈️</span>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: VIP CLUB & RAKEBACK */}
            {activeTab === 'vip' && (
                <div className="profile-vip-section">
                    {/* VIP Luxury Status Card */}
                    <div className="profile-vip-card">
                        <div className="profile-vip-card-glow" />

                        <div className="profile-vip-header">
                            <div className="profile-vip-title-col">
                                <div className="profile-vip-eyebrow">
                                    LOYALTY PROGRESSION
                                </div>
                                <div className="profile-vip-tier-headline">
                                    <span>👑</span>
                                    <span>{vipData?.name || 'Bronze VIP'}</span>
                                    <span className="profile-vip-badge-pill">
                                        {((vipData?.rakebackRate || 0.03) * 100).toFixed(0)}% RAKEBACK
                                    </span>
                                </div>
                            </div>
                            <div className="profile-vip-wager-col">
                                <div className="profile-vip-wager-lbl">Lifetime Wagered</div>
                                <div className="profile-vip-wager-val">
                                    {currencySymbol}{parseFloat(vipData?.totalWagered || user?.totalWagered || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* Progress to Next Tier */}
                        {vipData?.nextTier && (
                            <div className="profile-vip-progress-wrap">
                                <div className="profile-vip-progress-header">
                                    <span style={{ color: '#94a3b8' }}>Next Tier: <strong style={{ color: '#f8fafc' }}>{vipData.nextTier}</strong></span>
                                    <span style={{ color: '#f5af19', fontWeight: 700 }}>
                                        {currencySymbol}{parseFloat(vipData.totalWagered || 0).toLocaleString()} / {currencySymbol}{parseFloat(vipData.nextTierThreshold || 0).toLocaleString()} ({vipData.progressPct || 0}%)
                                    </span>
                                </div>
                                <div className="profile-vip-progress-bar">
                                    <div
                                        className="profile-vip-progress-fill"
                                        style={{ width: `${Math.min(100, Math.max(0, vipData.progressPct || 0))}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Unclaimed Rakeback Box */}
                        <div className="profile-vip-claim-box">
                            <div className="profile-vip-claim-info">
                                <div className="profile-vip-claim-lbl">Unclaimed VIP Rakeback</div>
                                <div className="profile-vip-claim-val">
                                    {currencySymbol}{parseFloat(vipData?.unclaimedRakeback || 0).toFixed(2)}
                                </div>
                                <div className="profile-vip-claim-subtext">
                                    Calculated on every single bet based on game house edge
                                </div>
                            </div>

                            <button
                                type="button"
                                className="profile-btn-primary profile-vip-claim-btn"
                                style={{
                                    background: (vipData?.unclaimedRakeback || 0) > 0 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#334155',
                                    cursor: (vipData?.unclaimedRakeback || 0) > 0 ? 'pointer' : 'not-allowed',
                                    boxShadow: (vipData?.unclaimedRakeback || 0) > 0 ? '0 4px 16px rgba(16, 185, 129, 0.3)' : 'none'
                                }}
                                disabled={claimingRakeback || (vipData?.unclaimedRakeback || 0) <= 0}
                                onClick={handleClaimRakeback}
                            >
                                {claimingRakeback ? 'Claiming...' : 'Claim Rakeback'}
                            </button>
                        </div>

                        {rakebackMsg && (
                            <div style={{
                                marginTop: '12px',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                background: rakebackMsg.startsWith('✓') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: rakebackMsg.startsWith('✓') ? '#4ade80' : '#f87171',
                                fontSize: '0.82rem',
                                fontWeight: 600
                            }}>
                                {rakebackMsg}
                            </div>
                        )}
                    </div>

                    {/* VIP Tier Matrix Card */}
                    <div className="profile-card">
                        <div className="profile-card-title">VIP Loyalty Progression Tiers</div>
                        <div className="profile-vip-tiers-list">
                            {[
                                { tier: 'Bronze', rate: '3%', threshold: '₹0+', perk: 'Instant 3% Rakeback on House Edge' },
                                { tier: 'Silver', rate: '5%', threshold: '₹50,000+', perk: '5% Rakeback + Faster Withdrawals' },
                                { tier: 'Gold', rate: '7%', threshold: '₹2,00,000+', perk: '7% Rakeback + Weekly Reload Bonuses' },
                                { tier: 'Platinum', rate: '10%', threshold: '₹10,00,000+', perk: '10% Rakeback + Dedicated VIP Host' },
                                { tier: 'Diamond', rate: '15%', threshold: '₹50,000,000+', perk: '15% Rakeback + Bespoke High-Roller Limits' },
                            ].map((lvl) => {
                                const isCurrent = vipData?.name?.toLowerCase().includes(lvl.tier.toLowerCase())
                                return (
                                    <div key={lvl.tier} className={`profile-vip-tier-row ${isCurrent ? 'active' : ''}`}>
                                        <div className="profile-vip-tier-info">
                                            <div className="profile-vip-tier-name-row">
                                                <span>{lvl.tier}</span>
                                                {isCurrent && <span className="profile-vip-tier-badge">ACTIVE</span>}
                                            </div>
                                            <div className="profile-vip-tier-perk">
                                                {lvl.perk}
                                            </div>
                                        </div>
                                        <div className="profile-vip-tier-stats">
                                            <div className="profile-vip-tier-rate">{lvl.rate}</div>
                                            <div className="profile-vip-tier-threshold">{lvl.threshold}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: MULTI-TIER VIRAL AFFILIATE TREE */}
            {activeTab === 'affiliate' && <MultiTierAffiliateDashboard />}

            {/* TAB: BE THE HOUSE LIQUIDITY VAULT */}
            {activeTab === 'vault' && <HouseVaultDashboard />}
                </main>
            </div>

            {/* KYC VERIFICATION MODAL */}
            {showKycModal && (
                <div className="profile-kyc-modal-overlay">
                    <div className="profile-kyc-modal">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '20px' }}>🛡️</span>
                                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#f8fafc' }}>Real Account Verification</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowKycModal(false)}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '18px', lineHeight: 1.4 }}>
                            Provide official identity documentation to complete regulatory compliance and unlock unrestricted cashier payouts.
                        </p>

                        <form onSubmit={handleSubmitKyc}>
                            <div className="profile-input-group">
                                <label className="profile-input-label">Identity Document Type</label>
                                <select
                                    className="profile-select"
                                    value={docType}
                                    onChange={(e) => setDocType(e.target.value)}
                                >
                                    <option value="aadhaar">🪪 Aadhaar Card (UIDAI)</option>
                                    <option value="pan">💳 PAN Card</option>
                                    <option value="passport">🛂 Passport</option>
                                    <option value="voter_id">🗳️ Voter ID Card</option>
                                </select>
                            </div>

                            <div className="profile-input-group">
                                <label className="profile-input-label">Document Identification Number</label>
                                <div className="profile-input-wrapper">
                                    <input
                                        type="text"
                                        className="profile-text-input"
                                        placeholder={docType === 'aadhaar' ? '12-digit Aadhaar Number' : 'Document Number'}
                                        value={docNumber}
                                        onChange={(e) => setDocNumber(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="profile-input-group">
                                <label className="profile-input-label">Full Legal Name (as printed on document)</label>
                                <div className="profile-input-wrapper">
                                    <input
                                        type="text"
                                        className="profile-text-input"
                                        placeholder="Full Name"
                                        value={legalName}
                                        onChange={(e) => setLegalName(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{
                                padding: '10px 12px',
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                borderRadius: '8px',
                                color: '#93c5fd',
                                fontSize: '0.78rem',
                                marginBottom: '18px'
                            }}>
                                🔒 Your identity verification documents are securely encrypted with 256-bit bank-grade SSL.
                            </div>

                            {kycSuccessMsg && (
                                <div style={{
                                    padding: '10px',
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    color: '#10b981',
                                    borderRadius: '8px',
                                    fontSize: '0.85rem',
                                    marginBottom: '16px'
                                }}>
                                    {kycSuccessMsg}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="profile-btn-primary"
                                disabled={isSubmittingKyc}
                            >
                                {isSubmittingKyc ? 'Verifying...' : 'Submit Verification'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
