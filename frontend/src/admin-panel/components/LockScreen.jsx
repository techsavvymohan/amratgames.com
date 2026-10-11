import { Link } from 'react-router-dom'

export default function LockScreen({
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    loginError,
    onSubmit,
    onQuickAdmin
}) {
    return (
        <div className="admin-lock-screen">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <Link
                    to="/"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#fbbf24',
                        textDecoration: 'none',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'rgba(245, 175, 25, 0.1)'
                    }}
                >
                    <span>←</span>
                    <span>Back to Casino</span>
                </Link>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>AmratGames</span>
            </div>

            <div className="admin-lock-logo-wrapper">
                <img
                    src="/amrat-logo.png"
                    alt="AmratGames"
                    className="admin-lock-logo"
                />
            </div>
            <h2 style={{ margin: '0 0 6px', color: '#ffd700', fontSize: '1.4rem' }}>
                Admin Login
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '22px', lineHeight: 1.4 }}>
                Sign in to manage the platform.
            </p>

            {loginError && (
                <div style={{
                    padding: '10px 14px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '8px',
                    color: '#f87171',
                    fontSize: '0.82rem',
                    marginBottom: '16px',
                    textAlign: 'left'
                }}>
                    ⚠️ {loginError}
                </div>
            )}

            <form onSubmit={onSubmit} style={{ textAlign: 'left' }}>
                <div className="form-group">
                    <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Username, Email, or Phone</span>
                    </label>
                    <input
                        type="text"
                        className="form-input"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="Username, email, or phone"
                        required
                        autoFocus
                    />
                </div>
                <div className="form-group">
                    <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Password</span>
                    </label>
                    <input
                        type="password"
                        className="form-input"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                    />
                </div>
                <button type="submit" className="btn-airdrop-launch" style={{ marginTop: '10px', fontSize: '0.95rem' }}>
                    Sign In
                </button>
            </form>
        </div>
    )
}
