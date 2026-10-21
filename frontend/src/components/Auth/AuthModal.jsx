import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getOptimizedImageUrl } from '../../utils/cloudinary'
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
        register,
        forgotPassword,
        resetPassword
    } = useAuth()

    // ── Mode Switch: 'login' | 'register' | 'forgot-password' ──
    const mode = (authModalMode === 'otp' || authModalMode === 'login') ? 'login' : (authModalMode || 'login')

    // Sign In Sub-Method: 'password' (default) | 'otp'
    const [signInMethod, setSignInMethod] = useState(authModalMode === 'otp' ? 'otp' : 'password')

    // Form States
    // 1. Password Login
    const [loginId, setLoginId] = useState('')
    const [loginPassword, setLoginPassword] = useState('')
    const [showLoginPassword, setShowLoginPassword] = useState(false)

    // 2. Fast OTP Login
    const [otpIdentifier, setOtpIdentifier] = useState('')
    const [otpCode, setOtpCode] = useState('')
    const [otpSent, setOtpSent] = useState(false)
    const [resendCountdown, setResendCountdown] = useState(0)

    // 3. Register
    const [regUsername, setRegUsername] = useState('')
    const [regPhone, setRegPhone] = useState('')
    const [regEmail, setRegEmail] = useState('')
    const [regPassword, setRegPassword] = useState('')
    const [showRegPassword, setShowRegPassword] = useState(false)
    const [regOtp, setRegOtp] = useState('')
    const [regOtpSent, setRegOtpSent] = useState(false)

    // 4. Forgot Password
    const [forgotId, setForgotId] = useState('')
    const [forgotEmail, setForgotEmail] = useState('')
    const [forgotOtp, setForgotOtp] = useState('')
    const [forgotNewPassword, setForgotNewPassword] = useState('')
    const [forgotStep, setForgotStep] = useState(1) // 1: send OTP, 2: verify & set new pass

    // Global Status
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState(null)
    const [successMsg, setSuccessMsg] = useState(null)

    // Sync sub-method when authModalMode opens
    useEffect(() => {
        if (authModalMode === 'otp') {
            setSignInMethod('otp')
        } else if (authModalMode === 'login') {
            setSignInMethod('password')
        }
        setErrorMsg(null)
        setSuccessMsg(null)
    }, [authModalMode])

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

    // ── Handle Send OTP with Purpose Guard ──
    const handleSendOtp = async (targetId, isForRegister = false, purpose = 'general') => {
        setErrorMsg(null)
        setSuccessMsg(null)

        if (purpose === 'login' && (!targetId || !targetId.includes('@'))) {
            setErrorMsg('Please enter your registered email address. Mobile SMS OTP is currently unavailable.')
            return
        }
        if (!targetId || targetId.trim().length < 3) {
            setErrorMsg('Please enter a valid email address')
            return
        }

        try {
            setLoading(true)
            const channel = targetId.includes('@') ? 'email' : 'sms'
            const res = await sendOtp(targetId.trim(), channel, purpose)
            if (isForRegister) {
                setRegOtpSent(true)
            } else {
                setOtpSent(true)
            }
            setResendCountdown(30)
            setSuccessMsg(res.message || 'Verification OTP sent!')
        } catch (err) {
            setErrorMsg(err.message || 'Failed to dispatch verification OTP')
        } finally {
            setLoading(false)
        }
    }

    // ── Handle Verify OTP for Login ──
    const handleVerifyOtpLogin = async (e) => {
        e.preventDefault()
        setErrorMsg(null)
        setSuccessMsg(null)

        if (!otpIdentifier.trim() || !otpIdentifier.includes('@')) {
            setErrorMsg('Please enter your registered email address')
            return
        }
        if (!otpCode.trim() || otpCode.trim().length < 6) {
            setErrorMsg('Please enter the complete 6-digit OTP code')
            return
        }

        try {
            setLoading(true)
            const res = await verifyOtp(otpIdentifier.trim().toLowerCase(), otpCode.trim(), undefined, 'login')
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
        if (!regPhone.trim() || regPhone.trim().replace(/\D/g, '').length < 10) {
            setErrorMsg('Please enter a valid 10-digit mobile number')
            return
        }
        if (!regEmail.trim() || !regEmail.includes('@')) {
            setErrorMsg('Please enter a valid email address')
            return
        }
        if (!regPassword || regPassword.length < 6) {
            setErrorMsg('Password must be at least 6 characters')
            return
        }
        if (!regOtp.trim() || regOtp.trim().length < 6) {
            setErrorMsg('Please enter the 6-digit verification OTP sent to your email')
            return
        }

        try {
            setLoading(true)
            const newUser = await register({
                username: regUsername.trim(),
                phone: regPhone.trim(),
                email: regEmail.trim(),
                password: regPassword,
                otp: regOtp.trim()
            })
            setSuccessMsg(`Welcome to AmratGames, ${newUser.username}! ₹100 Welcome Bonus credited!`)
        } catch (err) {
            setErrorMsg(err.message || 'Registration failed. Please check the entered details.')
        } finally {
            setLoading(false)
        }
    }

    // ── Handle Request Reset Password OTP ──
    const handleRequestResetOtp = async (e) => {
        if (e) e.preventDefault()
        setErrorMsg(null)
        setSuccessMsg(null)

        if (!forgotId.trim()) {
            setErrorMsg('Please enter your email, mobile number, or username')
            return
        }

        try {
            setLoading(true)
            const res = await forgotPassword(forgotId.trim())
            setForgotEmail(res.email)
            setForgotStep(2)
            setSuccessMsg(res.message || 'Password reset OTP sent to your registered email!')
        } catch (err) {
            setErrorMsg(err.message || 'Could not find account. Please check details.')
        } finally {
            setLoading(false)
        }
    }

    // ── Handle Reset Password Submit ──
    const handleResetPasswordSubmit = async (e) => {
        if (e) e.preventDefault()
        setErrorMsg(null)
        setSuccessMsg(null)

        if (!forgotOtp.trim() || forgotOtp.trim().length < 6) {
            setErrorMsg('Please enter the 6-digit OTP sent to your email')
            return
        }
        if (!forgotNewPassword || forgotNewPassword.length < 6) {
            setErrorMsg('New password must be at least 6 characters')
            return
        }

        try {
            setLoading(true)
            const res = await resetPassword(forgotId.trim(), forgotOtp.trim(), forgotNewPassword)
            setSuccessMsg(res.message || 'Password reset successfully! Please sign in with your new password.')
            setTimeout(() => {
                setAuthModalMode('login')
                setSignInMethod('password')
                setForgotStep(1)
            }, 1500)
        } catch (err) {
            setErrorMsg(err.message || 'Failed to reset password. Please check your OTP.')
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
                    <img
                        src={getOptimizedImageUrl('/amrat-logo.png', { width: 96 })}
                        alt="AmratGames"
                        className="amrat-auth-logo"
                    />
                </div>

                {/* Navigation Tabs — Exactly 2 Clear Tabs: Sign In & Register */}
                {mode !== 'forgot-password' && (
                    <div className="amrat-auth-tabs">
                        <button
                            type="button"
                            className={`amrat-auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
                            onClick={() => { setAuthModalMode('login'); setErrorMsg(null); setSuccessMsg(null) }}
                        >
                            <span>🔑</span>
                            <span>Sign In</span>
                        </button>
                        <button
                            type="button"
                            className={`amrat-auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
                            onClick={() => { setAuthModalMode('register'); setErrorMsg(null); setSuccessMsg(null) }}
                        >
                            <span>🎁</span>
                            <span>Register</span>
                        </button>
                    </div>
                )}

                {/* Welcome Bonus Notice (Shown on Register) */}
                {mode === 'register' && (
                    <div className="amrat-bonus-banner">
                        <span className="gift-icon">🎁</span>
                        <div>
                            <strong>₹100 Free Welcome Bonus</strong> credited instantly on registration!
                        </div>
                    </div>
                )}

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
                    TAB 1: SIGN IN (PASSWORD OR FAST OTP LOGIN)
                   ══════════════════════════════════════════════════════════ */}
                {mode === 'login' && (
                    <div>
                        {/* Sub-Method Switcher */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '8px' }}>
                            <button
                                type="button"
                                onClick={() => { setSignInMethod('password'); setErrorMsg(null); }}
                                style={{
                                    flex: 1,
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: signInMethod === 'password' ? '#f59e0b' : 'transparent',
                                    color: signInMethod === 'password' ? '#000' : '#94a3b8',
                                    fontWeight: signInMethod === 'password' ? 700 : 500,
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                🔑 Password
                            </button>
                            <button
                                type="button"
                                onClick={() => { setSignInMethod('otp'); setErrorMsg(null); }}
                                style={{
                                    flex: 1,
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: signInMethod === 'otp' ? '#f59e0b' : 'transparent',
                                    color: signInMethod === 'otp' ? '#000' : '#94a3b8',
                                    fontWeight: signInMethod === 'otp' ? 700 : 500,
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                ⚡ Email OTP
                            </button>
                        </div>

                        {/* Sub-Mode A: Password Sign In */}
                        {signInMethod === 'password' && (
                            <form onSubmit={handlePasswordLogin} className="amrat-auth-form">
                                <div className="amrat-form-group">
                                    <label className="amrat-form-label">
                                        <span>Phone, Email or Username</span>
                                    </label>
                                    <div className="amrat-input-wrapper">
                                        <input
                                            type="text"
                                            className="amrat-input"
                                            placeholder="Enter phone, email or username"
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

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => { setAuthModalMode('forgot-password'); setForgotStep(1) }}
                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        Forgot Password?
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAuthModalMode('register')}
                                        style={{ background: 'none', border: 'none', color: '#fbbf24', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        Need an account? Register →
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Sub-Mode B: OTP Sign In (Restricted to Registered Accounts) */}
                        {signInMethod === 'otp' && (
                            <form onSubmit={handleVerifyOtpLogin} className="amrat-auth-form">
                                <div className="amrat-form-group">
                                    <label className="amrat-form-label">
                                        <span>Registered Email Address</span>
                                    </label>
                                    <div className="amrat-input-wrapper">
                                        <input
                                            type="email"
                                            className="amrat-input"
                                            placeholder="Enter your registered email address"
                                            value={otpIdentifier}
                                            onChange={(e) => setOtpIdentifier(e.target.value)}
                                            autoFocus
                                            required
                                        />
                                    </div>
                                    <small style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', marginTop: '4px', display: 'block' }}>
                                        💡 A 6-digit verification code will be sent to your registered email.
                                    </small>
                                </div>

                                {!otpSent ? (
                                    <button
                                        type="button"
                                        className="amrat-submit-btn"
                                        onClick={() => handleSendOtp(otpIdentifier, false, 'login')}
                                        disabled={loading || !otpIdentifier.trim()}
                                    >
                                        {loading ? 'Checking Account & Sending...' : 'Send Login OTP'}
                                    </button>
                                ) : (
                                    <>
                                        <div className="amrat-form-group">
                                            <label className="amrat-form-label">
                                                <span>Enter 6-Digit Email OTP</span>
                                                {resendCountdown > 0 ? (
                                                    <small>Resend in {resendCountdown}s</small>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSendOtp(otpIdentifier, false, 'login')}
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

                                        <button
                                            type="submit"
                                            className="amrat-submit-btn"
                                            disabled={loading || otpCode.length < 6}
                                        >
                                            {loading ? 'Verifying...' : 'Sign In with Email OTP'}
                                        </button>
                                    </>
                                )}

                                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setAuthModalMode('register')}
                                        style={{ background: 'none', border: 'none', color: '#fbbf24', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        Don't have an account? Register here →
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    TAB 2: REGISTER (CREATES ACCOUNT + ₹100 BONUS)
                   ══════════════════════════════════════════════════════════ */}
                {mode === 'register' && (
                    <form onSubmit={handleRegister} className="amrat-auth-form">
                        <div className="amrat-form-group">
                            <label className="amrat-form-label">
                                <span>Player Username</span>
                            </label>
                            <input
                                type="text"
                                className="amrat-input"
                                placeholder="Choose a username"
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
                                    placeholder="10-digit mobile number"
                                    value={regPhone}
                                    onChange={(e) => setRegPhone(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="amrat-form-group">
                            <label className="amrat-form-label">
                                <span>Email Address</span>
                            </label>
                            <input
                                type="email"
                                className="amrat-input"
                                placeholder="name@example.com"
                                value={regEmail}
                                onChange={(e) => setRegEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="amrat-form-group">
                            <label className="amrat-form-label">
                                <span>Password</span>
                            </label>
                            <div className="amrat-input-wrapper">
                                <input
                                    type={showRegPassword ? 'text' : 'password'}
                                    className="amrat-input"
                                    placeholder="Create password (min 6 characters)"
                                    value={regPassword}
                                    onChange={(e) => setRegPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="amrat-input-toggle-pwd"
                                    onClick={() => setShowRegPassword(!showRegPassword)}
                                    title="Show/Hide Password"
                                >
                                    {showRegPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>

                        {/* Email OTP Verification Section */}
                        {regEmail.includes('@') && regEmail.length >= 5 && (
                            <div className="amrat-form-group" style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(245, 175, 25, 0.25)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: 600 }}>
                                        Verify Email Address *
                                    </span>
                                    <button
                                        type="button"
                                        className="amrat-secondary-btn"
                                        style={{ padding: '3px 10px', fontSize: '0.72rem' }}
                                        onClick={() => handleSendOtp(regEmail.trim(), true, 'register')}
                                        disabled={loading || !regEmail.includes('@') || resendCountdown > 0}
                                    >
                                        {resendCountdown > 0 ? `Resend (${resendCountdown}s)` : (regOtpSent ? 'Resend OTP' : 'Send Verification OTP')}
                                    </button>
                                </div>
                                {regOtpSent && (
                                    <input
                                        type="text"
                                        maxLength={6}
                                        className="amrat-otp-box"
                                        style={{ fontSize: '1.1rem', letterSpacing: '8px', padding: '8px' }}
                                        placeholder="••••••"
                                        value={regOtp}
                                        onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ''))}
                                        required
                                    />
                                )}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="amrat-submit-btn"
                            disabled={loading || !regOtpSent || regOtp.length < 6}
                        >
                            {loading ? 'Creating Account...' : 'Create Account & Claim ₹100 Free'}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '12px' }}>
                            <button
                                type="button"
                                onClick={() => setAuthModalMode('login')}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                Already have an account? Sign In →
                            </button>
                        </div>
                    </form>
                )}

                {/* ══════════════════════════════════════════════════════════
                    TAB 3: FORGOT PASSWORD (EMAIL OTP RESET)
                   ══════════════════════════════════════════════════════════ */}
                {mode === 'forgot-password' && (
                    <div className="amrat-auth-form">
                        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>Reset Your Password</h3>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                                {forgotStep === 1 
                                    ? 'Enter your email, phone, or username to receive a verification code' 
                                    : `Enter the OTP sent to ${forgotEmail} and set your new password`}
                            </p>
                        </div>

                        {forgotStep === 1 ? (
                            <form onSubmit={handleRequestResetOtp}>
                                <div className="amrat-form-group">
                                    <label className="amrat-form-label">
                                        <span>Registered Email, Phone, or Username</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="amrat-input"
                                        placeholder="Email, phone or username"
                                        value={forgotId}
                                        onChange={(e) => setForgotId(e.target.value)}
                                        autoFocus
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="amrat-submit-btn"
                                    disabled={loading || !forgotId.trim()}
                                >
                                    {loading ? 'Sending OTP...' : 'Send Reset Code'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleResetPasswordSubmit}>
                                <div className="amrat-form-group">
                                    <label className="amrat-form-label">
                                        <span>6-Digit Verification OTP</span>
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        className="amrat-otp-box"
                                        style={{ fontSize: '1.2rem', letterSpacing: '8px', padding: '10px' }}
                                        placeholder="••••••"
                                        value={forgotOtp}
                                        onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                                        autoFocus
                                        required
                                    />
                                </div>

                                <div className="amrat-form-group">
                                    <label className="amrat-form-label">
                                        <span>New Password (6+ characters)</span>
                                    </label>
                                    <input
                                        type="password"
                                        className="amrat-input"
                                        placeholder="Enter new password"
                                        value={forgotNewPassword}
                                        onChange={(e) => setForgotNewPassword(e.target.value)}
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="amrat-submit-btn"
                                    disabled={loading || forgotOtp.length < 6 || forgotNewPassword.length < 6}
                                >
                                    {loading ? 'Resetting Password...' : 'Reset Password & Sign In'}
                                </button>
                            </form>
                        )}

                        <div style={{ textAlign: 'center', marginTop: '12px' }}>
                            <button
                                type="button"
                                onClick={() => { setAuthModalMode('login'); setForgotStep(1) }}
                                style={{ background: 'none', border: 'none', color: '#fbbf24', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                ← Back to Sign In
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
