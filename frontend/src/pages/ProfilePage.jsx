import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWallet } from '../context/WalletContext'
import './ProfilePage.css'

export default function ProfilePage() {
    const { user, logout, updateProfile, changePassword, submitKycVerification, getBetsHistory, getPaymentsHistory } = useAuth()
    const { getVipStatus, claimVipRakeback, getAffiliateStats, claimAffiliateCommission, currencySymbol } = useWallet()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const [activeTab, setActiveTab] = useState(() => {
        const t = searchParams.get('tab')
        if (t && ['profile', 'vip', 'affiliate', 'payments', 'bets', 'support'].includes(t)) {
            return t
        }
        return 'profile'
    })

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
        if (t && ['profile', 'vip', 'affiliate', 'payments', 'bets', 'support'].includes(t)) {
            setActiveTab(t)
        }
    }, [searchParams])

    // Main Info Form State
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [dobDay, setDobDay] = useState('21')
    const [dobMonth, setDobMonth] = useState('4')
    const [dobYear, setDobYear] = useState('2005')
    const [gender, setGender] = useState('Male')
    const [country, setCountry] = useState('India')
    const [city, setCity] = useState('')
    const [newsletter, setNewsletter] = useState(true)
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
            if (user.dob) {
                setDobDay(user.dob.day || '21')
                setDobMonth(user.dob.month || '4')
                setDobYear(user.dob.year || '2005')
            }
            if (user.gender) setGender(user.gender)
            if (user.country) setCountry(user.country)
            if (user.city) setCity(user.city)
            if (user.newsletter !== undefined) setNewsletter(user.newsletter)
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
                firstName,
                lastName,
                dob: { day: dobDay, month: dobMonth, year: dobYear },
                gender,
                country,
                city,
                newsletter
            })
            setUpdateMsg('Profile data updated successfully!')
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
            {/* Top Sub-Navigation Tabs */}
            <div className="profile-subnav" role="tablist">
                <button
                    type="button"
                    className={`profile-subnav-btn ${activeTab === 'profile' ? 'active' : ''}`}
                    onClick={() => setActiveTab('profile')}
                >
                    Profile
                </button>
                <button
                    type="button"
                    className={`profile-subnav-btn ${activeTab === 'vip' ? 'active' : ''}`}
                    onClick={() => setActiveTab('vip')}
                >
                    👑 VIP Club
                </button>
                <button
                    type="button"
                    className={`profile-subnav-btn ${activeTab === 'affiliate' ? 'active' : ''}`}
                    onClick={() => setActiveTab('affiliate')}
                >
                    💸 Affiliates (0.3%)
                </button>
                <button
                    type="button"
                    className={`profile-subnav-btn ${activeTab === 'payments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('payments')}
                >
                    Payments History
                </button>
                <button
                    type="button"
                    className={`profile-subnav-btn ${activeTab === 'bets' ? 'active' : ''}`}
                    onClick={() => setActiveTab('bets')}
                >
                    Bets History
                </button>
                <button
                    type="button"
                    className={`profile-subnav-btn ${activeTab === 'support' ? 'active' : ''}`}
                    onClick={() => setActiveTab('support')}
                >
                    Support
                </button>
            </div>

            {/* TAB 1: PROFILE */}
            {activeTab === 'profile' && (
                <>
                    {/* Card 1: Phone Number */}
                    <div className="profile-card">
                        <div className="profile-card-title">Phone number</div>
                        <div className="profile-verified-field">
                            <div className="profile-flag-pill">
                                <span>🇮🇳</span>
                                <span>+91</span>
                            </div>
                            <input
                                type="text"
                                className="profile-verified-input"
                                value={user.phone || '7470718282'}
                                readOnly
                            />
                            <div className="profile-badge-check" title="Verified Phone Number">✓</div>
                        </div>
                    </div>

                    {/* Card 2: Email */}
                    <div className="profile-card">
                        <div className="profile-card-title">Email</div>
                        <div className="profile-verified-field">
                            <input
                                type="text"
                                className="profile-verified-input"
                                value={user.email || 'anuragsingh01321@gmail.com'}
                                readOnly
                            />
                            <div className="profile-badge-check" title="Verified Email">✓</div>
                        </div>
                    </div>

                    {/* Card 3: Main Info */}
                    <div className="profile-card">
                        <div className="profile-card-title">Main Info</div>

                        <form onSubmit={handleUpdateData}>
                            {/* UUID */}
                            <div className="profile-input-group">
                                <label className="profile-input-label">UUID</label>
                                <div className="profile-input-wrapper">
                                    <input
                                        type="text"
                                        className="profile-text-input"
                                        value={user.id}
                                        readOnly
                                        style={{ fontFamily: 'monospace', fontSize: '0.86rem', color: '#94a3b8' }}
                                    />
                                    <button
                                        type="button"
                                        className="profile-icon-btn"
                                        onClick={handleCopyUuid}
                                        title="Copy UUID"
                                    >
                                        {copiedUuid ? '✓ Copied' : '📋'}
                                    </button>
                                </div>
                            </div>

                            {/* Name */}
                            <div className="profile-input-group">
                                <label className="profile-input-label">Name</label>
                                <div className="profile-input-wrapper">
                                    <input
                                        type="text"
                                        className="profile-text-input"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="Your first name"
                                    />
                                    <span style={{ color: '#64748b', fontSize: '13px' }}>✏️</span>
                                </div>
                            </div>

                            {/* Surname */}
                            <div className="profile-input-group">
                                <label className="profile-input-label">Surname</label>
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

                            {/* Date of Birth */}
                            <div className="profile-input-group">
                                <label className="profile-input-label">Date of Birth</label>
                                <div className="profile-dob-row">
                                    <select
                                        className="profile-select"
                                        value={dobDay}
                                        onChange={(e) => setDobDay(e.target.value)}
                                    >
                                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="profile-select"
                                        value={dobMonth}
                                        onChange={(e) => setDobMonth(e.target.value)}
                                    >
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="profile-select"
                                        value={dobYear}
                                        onChange={(e) => setDobYear(e.target.value)}
                                    >
                                        {Array.from({ length: 58 }, (_, i) => 2007 - i).map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Gender */}
                            <div className="profile-input-group">
                                <label className="profile-input-label">Gender</label>
                                <select
                                    className="profile-select"
                                    value={gender}
                                    onChange={(e) => setGender(e.target.value)}
                                >
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            {/* Country */}
                            <div className="profile-input-group">
                                <label className="profile-input-label">Country</label>
                                <select
                                    className="profile-select"
                                    value={country}
                                    onChange={(e) => setCountry(e.target.value)}
                                >
                                    <option value="India">India</option>
                                    <option value="United Arab Emirates">United Arab Emirates</option>
                                    <option value="United Kingdom">United Kingdom</option>
                                    <option value="Canada">Canada</option>
                                </select>
                            </div>

                            {/* City */}
                            <div className="profile-input-group">
                                <label className="profile-input-label">City</label>
                                <div className="profile-input-wrapper">
                                    <input
                                        type="text"
                                        className="profile-text-input"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        placeholder="City name"
                                    />
                                    <span style={{ color: '#64748b', fontSize: '13px' }}>✏️</span>
                                </div>
                            </div>

                            {/* Newsletter Checkbox */}
                            <label className="profile-checkbox-row">
                                <input
                                    type="checkbox"
                                    className="profile-checkbox"
                                    checked={newsletter}
                                    onChange={(e) => setNewsletter(e.target.checked)}
                                />
                                <span>I want to receive newsletters and be updated on AmratGames news, events and offers.</span>
                            </label>

                            {/* Support notice */}
                            <div className="profile-support-notice">
                                <div className="profile-support-text">
                                    If you have a necessity to change data in some fields which are not editable - please <Link to="#" onClick={(e) => { e.preventDefault(); setActiveTab('support'); }} style={{ color: '#3b82f6', textDecoration: 'underline' }}>contact support</Link>
                                </div>
                                <button
                                    type="button"
                                    className="profile-support-btn"
                                    onClick={() => setActiveTab('support')}
                                    title="Live Support"
                                >
                                    💬
                                </button>
                            </div>

                            {updateMsg && (
                                <div style={{
                                    padding: '8px 12px',
                                    marginBottom: '12px',
                                    borderRadius: '8px',
                                    background: updateMsg.startsWith('Error') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                    color: updateMsg.startsWith('Error') ? '#f87171' : '#10b981',
                                    fontSize: '0.85rem'
                                }}>
                                    {updateMsg}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="profile-btn-primary"
                                disabled={isUpdating}
                            >
                                {isUpdating ? 'Updating...' : 'Update Data'}
                            </button>
                        </form>
                    </div>

                    {/* Card 4: Change Password */}
                    <div className="profile-card">
                        <div className="profile-card-title">Change password</div>

                        <form onSubmit={handleChangePassword}>
                            <div className="profile-input-group">
                                <div className="profile-input-wrapper">
                                    <input
                                        type={showOldPass ? 'text' : 'password'}
                                        className="profile-text-input"
                                        placeholder="Old password"
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
                                <div className="profile-input-wrapper">
                                    <input
                                        type={showNewPass ? 'text' : 'password'}
                                        className="profile-text-input"
                                        placeholder="New password"
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
                                <div className="profile-input-wrapper">
                                    <input
                                        type={showRepeatPass ? 'text' : 'password'}
                                        className="profile-text-input"
                                        placeholder="Repeat password"
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

                            {passError && (
                                <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '12px' }}>
                                    ⚠️ {passError}
                                </div>
                            )}

                            {passMsg && (
                                <div style={{ color: '#10b981', fontSize: '0.85rem', marginBottom: '12px' }}>
                                    ✓ {passMsg}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="profile-btn-primary"
                                style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.12)' }}
                                disabled={isChangingPass}
                            >
                                {isChangingPass ? 'Updating...' : 'Change Password'}
                            </button>
                        </form>
                    </div>

                    {/* Card 5: Profile Verification (KYC) */}
                    <div className="profile-card profile-verify-card">
                        <div className="profile-verify-badges">
                            <div className="profile-avatar-circle">👤</div>
                            <div className="profile-shield-circle">🛡️</div>
                        </div>

                        <div className="profile-verify-title">Profile verification</div>
                        <div className="profile-verify-desc">
                            Upgrade your account by completing verification to get exclusive offers and instant VIP payouts.
                        </div>

                        {user.kycStatus === 'verified' ? (
                            <div style={{
                                padding: '12px',
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                borderRadius: '10px',
                                color: '#10b981',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                marginBottom: '14px'
                            }}>
                                <span>👑</span>
                                <span>Account Verified (Level 2 VIP)</span>
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="profile-verify-btn"
                                onClick={() => setShowKycModal(true)}
                            >
                                VERIFICATION
                            </button>
                        )}
                    </div>

                    {/* Card 6: Logout */}
                    <div className="profile-card" style={{ padding: '8px' }}>
                        <button
                            type="button"
                            className="profile-btn-logout"
                            onClick={() => {
                                if (window.confirm('Are you sure you want to log out?')) {
                                    logout()
                                    navigate('/')
                                }
                            }}
                        >
                            LOGOUT
                        </button>
                    </div>
                </>
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
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Payout Request ({w.payoutMethod})</div>
                                                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                                        {new Date(w.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>To: {w.payoutDestination}</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
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
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{t.note || (t.type === 'credit' ? 'Deposit / Bonus' : 'Debit')}</div>
                                                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                                        {new Date(t.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
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
                        <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No bets played yet. Try Crash or Limbo!</div>
                    ) : (
                        <div>
                            {betsData
                                .filter(b => betsFilter === 'all' || (betsFilter === 'wins' && b.won) || (betsFilter === 'losses' && !b.won))
                                .map(b => (
                                    <div key={b.id} className="profile-item-row">
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.92rem', textTransform: 'capitalize' }}>
                                                {b.gameName || b.game}
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                                {new Date(b.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                            </div>
                                            {b.multiplier > 0 && (
                                                <div style={{ fontSize: '0.75rem', color: '#fbbf24' }}>Multiplier: {b.multiplier}x</div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
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

                    <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
                        <div style={{
                            padding: '14px',
                            background: '#1e293b',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Official Support Email</div>
                                <div style={{ fontSize: '0.8rem', color: '#3b82f6' }}>support@amratgames.com</div>
                            </div>
                            <a
                                href="mailto:support@amratgames.com"
                                style={{
                                    padding: '8px 14px',
                                    background: '#2563eb',
                                    color: '#fff',
                                    borderRadius: '6px',
                                    textDecoration: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.82rem'
                                }}
                            >
                                Email Us
                            </a>
                        </div>

                        <div style={{
                            padding: '14px',
                            background: '#1e293b',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Official Telegram Channel</div>
                                <div style={{ fontSize: '0.8rem', color: '#38bdf8' }}>@AmratGamesSupport</div>
                            </div>
                            <span style={{ fontSize: '18px' }}>✈️</span>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: VIP CLUB & RAKEBACK */}
            {activeTab === 'vip' && (
                <div className="profile-vip-section">
                    {/* VIP Luxury Status Card */}
                    <div className="profile-card" style={{
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
                        border: '1px solid rgba(245, 175, 25, 0.3)',
                        boxShadow: '0 8px 32px rgba(245, 175, 25, 0.15)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '-30px',
                            right: '-30px',
                            width: '140px',
                            height: '140px',
                            background: 'radial-gradient(circle, rgba(245, 175, 25, 0.2) 0%, transparent 70%)',
                            pointerEvents: 'none'
                        }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#f5af19', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>
                                    LOYALTY PROGRESSION
                                </div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                    <span>👑</span>
                                    <span>{vipData?.name || 'Bronze VIP'}</span>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        background: 'rgba(245, 175, 25, 0.2)',
                                        color: '#fbbf24',
                                        padding: '2px 8px',
                                        borderRadius: '20px',
                                        border: '1px solid rgba(245, 175, 25, 0.4)'
                                    }}>
                                        {((vipData?.rakebackRate || 0.03) * 100).toFixed(0)}% RAKEBACK
                                    </span>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Lifetime Wagered</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
                                    {currencySymbol}{parseFloat(vipData?.totalWagered || user?.totalWagered || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* Progress to Next Tier */}
                        {vipData?.nextTier && (
                            <div style={{ marginTop: '14px', marginBottom: '18px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                                    <span style={{ color: '#94a3b8' }}>Next Tier: <strong style={{ color: '#f8fafc' }}>{vipData.nextTier}</strong></span>
                                    <span style={{ color: '#f5af19', fontWeight: 700 }}>
                                        {currencySymbol}{parseFloat(vipData.totalWagered || 0).toLocaleString()} / {currencySymbol}{parseFloat(vipData.nextTierThreshold || 0).toLocaleString()} ({vipData.progressPct || 0}%)
                                    </span>
                                </div>
                                <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${Math.min(100, Math.max(0, vipData.progressPct || 0))}%`,
                                        height: '100%',
                                        background: 'linear-gradient(90deg, #f5af19 0%, #ffd700 100%)',
                                        borderRadius: '4px',
                                        transition: 'width 0.4s ease'
                                    }} />
                                </div>
                            </div>
                        )}

                        {/* Unclaimed Rakeback Box */}
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.7)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            padding: '16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px'
                        }}>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Unclaimed VIP Rakeback</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#4ade80' }}>
                                    {currencySymbol}{parseFloat(vipData?.unclaimedRakeback || 0).toFixed(2)}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                    Calculated on every single bet based on game house edge
                                </div>
                            </div>

                            <button
                                type="button"
                                className="profile-btn-primary"
                                style={{
                                    maxWidth: '180px',
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
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {[
                                { tier: 'Bronze', rate: '3%', threshold: '₹0+', perk: 'Instant 3% Rakeback on House Edge' },
                                { tier: 'Silver', rate: '5%', threshold: '₹50,000+', perk: '5% Rakeback + Faster Withdrawals' },
                                { tier: 'Gold', rate: '7%', threshold: '₹2,00,000+', perk: '7% Rakeback + Weekly Reload Bonuses' },
                                { tier: 'Platinum', rate: '10%', threshold: '₹10,00,000+', perk: '10% Rakeback + Dedicated VIP Host' },
                                { tier: 'Diamond', rate: '15%', threshold: '₹50,000,000+', perk: '15% Rakeback + Bespoke High-Roller Limits' },
                            ].map((lvl) => {
                                const isCurrent = vipData?.name?.toLowerCase().includes(lvl.tier.toLowerCase())
                                return (
                                    <div key={lvl.tier} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '12px 14px',
                                        background: isCurrent ? 'rgba(245, 175, 25, 0.12)' : '#1e293b',
                                        border: isCurrent ? '1px solid rgba(245, 175, 25, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                                        borderRadius: '10px'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: isCurrent ? '#fbbf24' : '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span>{lvl.tier}</span>
                                                {isCurrent && <span style={{ fontSize: '0.7rem', background: '#f5af19', color: '#000', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>ACTIVE</span>}
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>
                                                {lvl.perk}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#4ade80' }}>{lvl.rate}</div>
                                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{lvl.threshold}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 6: AFFILIATES & REFERRALS */}
            {activeTab === 'affiliate' && (
                <div className="profile-affiliate-section">
                    {/* Affiliate Hero & Referral Link */}
                    <div className="profile-card" style={{
                        background: 'linear-gradient(135deg, #0f172a 0%, #064e3b 100%)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        boxShadow: '0 8px 32px rgba(16, 185, 129, 0.15)'
                    }}>
                        <div style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
                            0.3% LIFETIME TURNOVER FLYWHEEL
                        </div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f8fafc', marginBottom: 12 }}>
                            Earn Commission on Every Bet Friends Make
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 16 }}>
                            Share your link. When players join and wager in any game (Crash, Plinko, Mines, Limbo, etc.), you get 0.3% of their total bet volume instantly credited to your affiliate vault — win or lose!
                        </p>

                        {/* Referral Link Box */}
                        <div style={{
                            background: '#0f172a',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '10px',
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px'
                        }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem', color: '#67e8f9', fontFamily: 'monospace' }}>
                                {affiliateData?.referralLink || `${window.location.origin}/?ref=${user?.referralCode || ''}`}
                            </div>
                            <button
                                type="button"
                                className="profile-btn-primary"
                                style={{
                                    maxWidth: '120px',
                                    padding: '8px 12px',
                                    fontSize: '0.8rem',
                                    background: copiedRefLink ? '#10b981' : '#2563eb'
                                }}
                                onClick={handleCopyRefLink}
                            >
                                {copiedRefLink ? '✓ Copied' : 'Copy Link'}
                            </button>
                        </div>
                    </div>

                    {/* 4-Stat Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                        <div className="profile-card" style={{ padding: '14px', textAlign: 'center', marginBottom: 0 }}>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Referred Users</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f8fafc', marginTop: 4 }}>
                                {affiliateData?.stats?.referredCount || 0}
                            </div>
                        </div>

                        <div className="profile-card" style={{ padding: '14px', textAlign: 'center', marginBottom: 0 }}>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Network Turnover</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#60a5fa', marginTop: 4 }}>
                                {currencySymbol}{parseFloat(affiliateData?.stats?.lifetimeTurnover || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </div>
                        </div>

                        <div className="profile-card" style={{ padding: '14px', textAlign: 'center', marginBottom: 0 }}>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Total Earned</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f5af19', marginTop: 4 }}>
                                {currencySymbol}{parseFloat(affiliateData?.stats?.totalTurnoverCommission || 0).toFixed(2)}
                            </div>
                        </div>

                        <div className="profile-card" style={{ padding: '14px', textAlign: 'center', marginBottom: 0 }}>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Unclaimed Vault</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#4ade80', marginTop: 4 }}>
                                {currencySymbol}{parseFloat(affiliateData?.stats?.pendingCommission || 0).toFixed(2)}
                            </div>
                        </div>
                    </div>

                    {/* Claim Commission Card */}
                    <div className="profile-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>
                                    Pending Commission Payout
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>
                                    Minimum claim threshold: ₹10. Directly credited to your main balance for playing or withdrawal.
                                </div>
                            </div>
                            <button
                                type="button"
                                className="profile-btn-primary"
                                style={{
                                    maxWidth: '180px',
                                    background: (affiliateData?.stats?.pendingCommission || 0) >= 10 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#334155',
                                    cursor: (affiliateData?.stats?.pendingCommission || 0) >= 10 ? 'pointer' : 'not-allowed'
                                }}
                                disabled={claimingCommission || (affiliateData?.stats?.pendingCommission || 0) < 10}
                                onClick={handleClaimCommission}
                            >
                                {claimingCommission ? 'Claiming...' : 'Claim to Wallet'}
                            </button>
                        </div>

                        {commissionMsg && (
                            <div style={{
                                marginTop: '12px',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                background: commissionMsg.startsWith('✓') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: commissionMsg.startsWith('✓') ? '#4ade80' : '#f87171',
                                fontSize: '0.82rem',
                                fontWeight: 600
                            }}>
                                {commissionMsg}
                            </div>
                        )}
                    </div>

                    {/* How It Works Infographic */}
                    <div className="profile-card">
                        <div className="profile-card-title">How the 0.3% Affiliate Model Works</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                            <div style={{ padding: '14px', background: '#1e293b', borderRadius: '10px' }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>1️⃣</div>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f8fafc' }}>Share Link</div>
                                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>
                                    Share your personalized link on WhatsApp, Telegram, or YouTube.
                                </div>
                            </div>
                            <div style={{ padding: '14px', background: '#1e293b', borderRadius: '10px' }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>2️⃣</div>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f8fafc' }}>Friends Play</div>
                                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>
                                    When they deposit and wager in Crash, Mines, Plinko or any game.
                                </div>
                            </div>
                            <div style={{ padding: '14px', background: '#1e293b', borderRadius: '10px' }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>3️⃣</div>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f8fafc' }}>Earn 0.3% Forever</div>
                                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>
                                    0.3% of every wager automatically accumulates into your vault with 1-click claims!
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
