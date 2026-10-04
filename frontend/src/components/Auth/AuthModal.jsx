import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import './AuthModal.css'

export default function AuthModal() {
    const {
        isAuthModalOpen,
        authModalMode,
        closeAuthModal,
        setAuthModalMode,
        login,
        sendOtp,
        verifyOtp,
        register
    } = useAuth()

    // ── Mode Switch & Reset ──
    const mode = authModalMode || 'login'

    // Form States
    // 1. Password Login
    const [loginId, setLoginId] = useState('')
    const [loginPassword, setLoginPassword] = useState('')
    const [showLoginPassword, setShowLoginPassword] = useState(false)

    // 2. Fast OTP Login
    const [otpIdentifier, setOtpIdentifier] = useState('')
    const [otpCode, setOtpCode] = useState('')
    const [otpSent, setOtpSent] = useState(false)
    const [otpNotice, setOtpNotice] = useState(null)
    const [resendCountdown, setResendCountdown] = useState(0)
    const [otpUsername, setOtpUsername] = useState('')

    // 3. Register
    const [regUsername, setRegUsername] = useState('')
    const [regPhone, setRegPhone] = useState('')
    const [regEmail, setRegEmail] = useState('')
    const [regPassword, setRegPassword] = useState('')
    const [regOtp, setRegOtp] = useState('')
    const [regOtpSent, setRegOtpSent] = useState(false)
    const [regOtpNotice, setRegOtpNotice] = useState(null)

    // Global Status
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState(null)
    const [successMsg, setSuccessMsg] = useState(null)

    // Clear notices when tab changes
    useEffect(() => {
        setErrorMsg(null)
        setSuccessMsg(null)
    }, [mode])

    // Resend countdown timer
    useEffect(() => {
        if (resendCountdown <= 0) return
        const timer = setTimeout(() => {
            setResendCountdown((prev) => prev - 1)
        }, 1000)
        return () => clearTimeout(timer)
    }, [resendCountdown])

    // Escape key listener to close
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isAuthModalOpen) {
                closeAuthModal()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isAuthModalOpen, closeAuthModal])

    if (!isAuthModalOpen) return null

    // ── Handle Password Login ──
    const handlePasswordLogin = async (e) => {
        e.preventDefault()
        setErrorMsg(null)
        setSuccessMsg(null)

        if (!loginId.trim()) {
            setErrorMsg('Please enter your email, mobile number, or username')
            return
        }
        if (!loginPassword) {
            setErrorMsg('Please enter your password')
            return
        }

        try {
            setLoading(true)
            const user = await login(loginId.trim(), loginPassword)
            setSuccessMsg(`Welcome back, ${user.username}!`)
        } catch (err) {
            setErrorMsg(err.message || 'Authentication failed. Please check your credentials.')
        } finally {
            setLoading(false)
        }
    }

    // ── Handle Send OTP ──
    const handleSendOtp = async (targetId, isForRegister = false) => {
        setErrorMsg(null)
        setSuccessMsg(null)

        if (!targetId || targetId.trim().length < 3) {
            setErrorMsg('Please enter a valid 10-digit mobile number or email address')
            return
        }

        try {
            setLoading(true)
            const res = await sendOtp(targetId.trim())
            if (isForRegister) {
                setRegOtpSent(true)
            } else {
                setOtpSent(true)
                setResendCountdown(30)
            }
            setSuccessMsg(res.message || 'Verification OTP sent!')
        } catch (err) {
            setErrorMsg(err.message || 'Failed to dispatch verification OTP')
        } finally {
            setLoading(false)
        }
    }

    // ── Handle Verify OTP ──
    const handleVerifyOtp = async (e) => {
        e.preventDefault()
        setErrorMsg(null)
        setSuccessMsg(null)

        if (!otpIdentifier.trim()) {
            setErrorMsg('Please enter your mobile number or email')
            return
        }
        if (!otpCode.trim() || otpCode.trim().length < 6) {
            setErrorMsg('Please enter the complete 6-digit OTP code')
            return
        }

        try {
            setLoading(true)
            const res = await verifyOtp(otpIdentifier.trim(), otpCode.trim(), otpUsername.trim() || undefined)
            setSuccessMsg(res.message || 'OTP verified successfully!')
        } catch (err) {
            setErrorMsg(err.message || 'Invalid or expired OTP code')
        } finally {
            setLoading(false)
        }
    }

    // ── Handle Register ──
    const handleRegister = async (e) => {
        e.preventDefault()
        setErrorMsg(null)
        setSuccessMsg(null)

        if (!regUsername.trim() || regUsername.trim().length < 3) {
            setErrorMsg('Username must be at least 3 characters')
            return
        }
        if (!regPhone.trim() && !regEmail.trim()) {
            setErrorMsg('Please provide either a mobile number or an email')
            return
        }
        if (!regPassword || regPassword.length < 6) {
            setErrorMsg('Password must be at least 6 characters')
            return
        }

        try {
            setLoading(true)
            const newUser = await register({
                username: regUsername.trim(),
                phone: regPhone.trim() || undefined,
                email: regEmail.trim() || undefined,
                password: regPassword,
                otp: regOtp.trim() || undefined
            })
            setSuccessMsg(`Welcome to AmratGames, ${newUser.username}!`)
        } catch (err) {
            setErrorMsg(err.message || 'Registration failed. Please check the entered details.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="amrat-auth-overlay" onClick={closeAuthModal} role="dialog" aria-modal="true">
            <div className="amrat-auth-card" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button
                    type="button"
                    className="amrat-auth-close"
                    onClick={closeAuthModal}
                    aria-label="Close authentication modal"
                >
                    ✕
                </button>

                {/* Header */}
                <div className="amrat-auth-header">
                    <div className="amrat-auth-crown">👑</div>
                    <h2 className="amrat-auth-title">AmratGames.com</h2>
                    <p className="amrat-auth-subtitle">
                        Sign in or register to play
                    </p>
                </div>

                {/* Navigation Tabs */}
                <div className="amrat-auth-tabs">
                    <button
                        type="button"
                        className={`amrat-auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
                        onClick={() => setAuthModalMode('login')}
                    >
                        <span>🔑</span>
                        <span>Password</span>
                    </button>
                    <button
                        type="button"
                        className={`amrat-auth-tab-btn ${mode === 'otp' ? 'active' : ''}`}
                        onClick={() => setAuthModalMode('otp')}
                    >
                        <span>⚡</span>
                        <span>OTP</span>
                    </button>
                    <button
                        type="button"
                        className={`amrat-auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
                        onClick={() => setAuthModalMode('register')}
                    >
                        <span>🎁</span>
                        <span>Register</span>
                    </button>
                </div>

                {/* Welcome Bonus Notice */}
                <div className="amrat-bonus-banner">
                    <span className="gift-icon">🎁</span>
                    <div>
                        <strong>₹10,000 Free Bonus</strong> on registration
                    </div>
                </div>

                {/* Status Messages */}
                {errorMsg && (
                    <div className="amrat-alert-error" style={{ marginBottom: '14px' }}>
                        <span>⚠️</span>
                        <span>{errorMsg}</span>
                    </div>
                )}
                {successMsg && (
                    <div className="amrat-alert-success" style={{ marginBottom: '14px' }}>
                        <span>✓</span>
                        <span>{successMsg}</span>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    TAB 1: PASSWORD LOGIN (Email OR Mobile OR Username)
                   ══════════════════════════════════════════════════════════ */}
                {mode === 'login' && (
                    <form onSubmit={handlePasswordLogin} className="amrat-auth-form">
                        <div className="amrat-form-group">
                            <label className="amrat-form-label">
                                <span>Phone, Email or Username</span>
                            </label>
                            <div className="amrat-input-wrapper">
                                <input
                                    type="text"
                                    className="amrat-input"
                                    placeholder="Phone, email or username"
                                    value={loginId}
                                    onChange={(e) => setLoginId(e.target.value)}
                                    autoFocus
                                    required
                                />
                            </div>
                        </div>

                        <div className="amrat-form-group">
                            <label className="amrat-form-label">
                                <span>Password</span>
                            </label>
                            <div className="amrat-input-wrapper">
                                <input
                                    type={showLoginPassword ? 'text' : 'password'}
                                    className="amrat-input"
                                    placeholder="••••••••••••"
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="amrat-input-toggle-pwd"
                                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                                    title="Show/Hide Password"
                                >
                                    {showLoginPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="amrat-submit-btn"
                            disabled={loading}
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '4px' }}>
                            <button
                                type="button"
                                onClick={() => setAuthModalMode('otp')}
                                style={{ background: 'none', border: 'none', color: '#fbbf24', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                Sign in with OTP →
                            </button>
                        </div>
                    </form>
                )}

                {/* ══════════════════════════════════════════════════════════
                    TAB 2: FAST OTP LOGIN (SMS or Email OTP)
                   ══════════════════════════════════════════════════════════ */}
                {mode === 'otp' && (
                    <form onSubmit={handleVerifyOtp} className="amrat-auth-form">
                        <div className="amrat-form-group">
                            <label className="amrat-form-label">
                                <span>Mobile or Email</span>
                            </label>
                            <div className="amrat-input-wrapper">
                                {!otpIdentifier.includes('@') && otpIdentifier.length > 0 && (
                                    <span className="amrat-input-prefix">+91</span>
                                )}
                                <input
                                    type="text"
                                    className={`amrat-input ${!otpIdentifier.includes('@') && otpIdentifier.length > 0 ? 'has-prefix' : ''}`}
                                    placeholder="Mobile number or email"
                                    value={otpIdentifier}
                                    onChange={(e) => setOtpIdentifier(e.target.value)}
                                    autoFocus
                                    required
                                />
                            </div>
                        </div>

                        {!otpSent ? (
                            <button
                                type="button"
                                className="amrat-submit-btn"
                                onClick={() => handleSendOtp(otpIdentifier)}
                                disabled={loading || !otpIdentifier.trim()}
                            >
                                {loading ? 'Sending...' : 'Send OTP'}
                            </button>
                        ) : (
                            <>
                                <div className="amrat-form-group">
                                    <label className="amrat-form-label">
                                        <span>Enter OTP</span>
                                        {resendCountdown > 0 ? (
                                            <small>Resend in {resendCountdown}s</small>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleSendOtp(otpIdentifier)}
                                                className="amrat-secondary-btn"
                                                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                                            >
                                                Resend
                                            </button>
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        className="amrat-otp-box"
                                        placeholder="••••••"
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                        autoFocus
                                        required
                                    />
                                </div>

                                <div className="amrat-form-group">
                                    <label className="amrat-form-label">
                                        <span>Username (Optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="amrat-input"
                                        placeholder="Choose a username"
                                        value={otpUsername}
                                        onChange={(e) => setOtpUsername(e.target.value)}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="amrat-submit-btn"
                                    disabled={loading || otpCode.length < 6}
                                >
                                    {loading ? 'Verifying...' : 'Verify & Play'}
                                </button>
                            </>
                        )}
                    </form>
                )}

                {/* ══════════════════════════════════════════════════════════
                    TAB 3: FULL REGISTRATION
                   ══════════════════════════════════════════════════════════ */}
                {mode === 'register' && (
                    <form onSubmit={handleRegister} className="amrat-auth-form">
                        <div className="amrat-form-group">
                            <label className="amrat-form-label">
                                <span>Username</span>
                            </label>
                            <input
                                type="text"
                                className="amrat-input"
                                placeholder="Username"
                                value={regUsername}
                                onChange={(e) => setRegUsername(e.target.value)}
                                required
                            />
                        </div>

                        <div className="amrat-form-group">
                            <label className="amrat-form-label">
                                <span>Mobile Number</span>
                            </label>
                            <div className="amrat-input-wrapper">
                                <span className="amrat-input-prefix">+91</span>
                                <input
                                    type="tel"
                                    className="amrat-input has-prefix"
                                    placeholder="10-digit number"
                                    value={regPhone}
                                    onChange={(e) => setRegPhone(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="amrat-form-group">
                            <label className="amrat-form-label">
                                <span>Email (Optional)</span>
                            </label>
                            <input
                                type="email"
                                className="amrat-input"
                                placeholder="Email address"
                                value={regEmail}
                                onChange={(e) => setRegEmail(e.target.value)}
                            />
                        </div>

                        <div className="amrat-form-group">
                            <label className="amrat-form-label">
                                <span>Password</span>
                            </label>
                            <input
                                type="password"
                                className="amrat-input"
                                placeholder="Password (6+ characters)"
                                value={regPassword}
                                onChange={(e) => setRegPassword(e.target.value)}
                                required
                            />
                        </div>

                        {/* Optional OTP Verification for registration */}
                        {regPhone.length >= 10 && (
                            <div className="amrat-form-group" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: 600 }}>Verify Phone (OTP)</span>
                                    <button
                                        type="button"
                                        className="amrat-secondary-btn"
                                        style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                        onClick={() => handleSendOtp(regPhone, true)}
                                        disabled={loading}
                                    >
                                        {regOtpSent ? 'Resend' : 'Send OTP'}
                                    </button>
                                </div>
                                {regOtpSent && (
                                    <>
                                        <input
                                            type="text"
                                            maxLength={6}
                                            className="amrat-otp-box"
                                            style={{ fontSize: '1.1rem', letterSpacing: '8px', padding: '8px' }}
                                            placeholder="••••••"
                                            value={regOtp}
                                            onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ''))}
                                        />
                                    </>
                                )}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="amrat-submit-btn"
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create Account'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}
