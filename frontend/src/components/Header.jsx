import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useWallet, CURRENCIES } from '../context/WalletContext'
import { useThemeSettings } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { isGamePath, GAMES } from '../games'
import { getOptimizedImageUrl } from '../utils/cloudinary'

// Dynamic currency icon component for INR, BTC, and USDT
export const CurrencyIcon = ({ symbol = '₹', size = 20, fontSize = 12, currency = 'INR' }) => {
    const isINR = currency === 'INR' || symbol === '₹'
    const isBTC = currency === 'BTC' || symbol === '₿'
    const isAMRAT = currency === 'AMRAT' || symbol === '👑'
    
    let bg = 'linear-gradient(135deg, #26a17b, #137554)'
    if (isINR) bg = 'linear-gradient(135deg, #f5af19, #d49110)'
    else if (isBTC) bg = 'linear-gradient(135deg, #f7931a, #ffb347)'
    else if (isAMRAT) bg = 'linear-gradient(135deg, #ffd700, #ff8c00)'

    return (
        <div style={{
            width: size,
            height: size,
            minWidth: size,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: bg,
            color: '#fff',
            fontWeight: 800,
            fontSize: fontSize,
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35)',
            lineHeight: 1,
        }}>{symbol}</div>
    )
}

function Header({
    menuOpen,
    menuButtonRef,
    onMenuClick,
    onOpenRace,
    onOpenVerifier
}) {
    const location = useLocation()
    const { balance, currency, currencySymbol, currencyConfig, setCurrency, deposit, withdraw, totalDeposited, canWithdraw, transactions, toasts, openWalletModal } = useWallet()
    const { paletteId, palettes, setPaletteId } = useThemeSettings()
    const { user, logout, openAuthModal } = useAuth()
    const [showUserDropdown, setShowUserDropdown] = useState(false)
    const [showPaletteMenu, setShowPaletteMenu] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchOpen, setSearchOpen] = useState(false)
    const userDropdownRef = useRef(null)
    const paletteMenuRef = useRef(null)
    const searchRef = useRef(null)

    const isGamePage = isGamePath(location.pathname)
    const isHomePage = location.pathname === '/'

    const searchResults = searchQuery.trim()
        ? GAMES.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
        : []

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
                setShowUserDropdown(false)
            }
            if (paletteMenuRef.current && !paletteMenuRef.current.contains(e.target)) {
                setShowPaletteMenu(false)
            }
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setSearchOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const maxDecimals = currency === 'BTC' ? 8 : (currency === 'USDT' ? 4 : 2)
    const minDecimals = currency === 'BTC' ? 4 : 2
    const formattedBalance = balance.toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', {
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals,
    })

    return (
        <header className={`header ${isHomePage ? 'header-home' : ''}`}>
            <div className="header-left">
                <Link to="/" className="logo-link" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                    <img src={getOptimizedImageUrl('/amrat-logo.png', { width: 96 })} alt="AmratGames" className="header-logo-img" style={{ height: '32px', width: '32px', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(245, 175, 25, 0.5))' }} />
                    <span className="logo logo-text" style={{
                        background: 'linear-gradient(135deg, #fff3cc 0%, #f5af19 50%, #d49110 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontSize: '1.25rem',
                        fontWeight: '900',
                        letterSpacing: '-0.02em',
                        lineHeight: 1
                    }}>
                        AmratGames<span style={{ WebkitTextFillColor: '#fbbf24', fontWeight: 600 }}>.com</span>
                    </span>
                </Link>
            </div>

            <div className="header-center">
                <div className="header-wallet">
                    <button
                        type="button"
                        id="header-mobile-wallet-btn"
                        className="mobile-wallet-balance"
                        aria-label={`Open wallet, balance ${currencySymbol}${formattedBalance}`}
                        onClick={() => {
                            if (!user) {
                                openAuthModal('login')
                            } else {
                                openWalletModal('deposit')
                            }
                        }}
                        title="1-Tap Deposit & Withdraw"
                    >
                        <CurrencyIcon symbol={currencySymbol} currency={currency} size={18} fontSize={11} />
                        <span className="mobile-bal-text">{formattedBalance}</span>
                        <span className="mobile-deposit-plus" aria-hidden="true">+</span>
                    </button>
                    {isGamePage && (
                        <>
                            <div
                                id="header-wallet-balance-display"
                                className="wallet-balance-display"
                                onClick={() => {
                                    if (!user) {
                                        openAuthModal('login')
                                    } else {
                                        openWalletModal('deposit')
                                    }
                                }}
                                style={{ cursor: 'pointer' }}
                                title="Click to Open Wallet / Cashier"
                            >
                                <CurrencyIcon symbol={currencySymbol} currency={currency} size={18} fontSize={11} />
                                <span className="wallet-balance-amount">{formattedBalance}</span>
                                <button
                                    id="header-wallet-dropdown-btn"
                                    className="wallet-dropdown-toggle"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if (!user) {
                                            openAuthModal('login')
                                        } else {
                                            openWalletModal('deposit')
                                        }
                                    }}
                                    title="Open Cashier"
                                >
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                                        <path d="M7 10l5 5 5-5z" />
                                    </svg>
                                </button>
                            </div>
                            <button
                                id="header-wallet-modal-btn"
                                className="wallet-btn"
                                onClick={() => {
                                    if (!user) {
                                        openAuthModal('login')
                                    } else {
                                        openWalletModal('deposit')
                                    }
                                }}
                            >
                                Wallet
                            </button>
                        </>
                    )}
                </div>

                    {/* Compact Game Micro-Toast (Simplest, shortest, non-intrusive) */}
                    {isGamePage && toasts.length > 0 && (
                        <div className="wallet-toast-container">
                            {toasts.map(toast => (
                                <div key={toast.id} className={`wallet-toast wallet-toast-${toast.type}`}>
                                    <div className="wallet-toast-icon">
                                        {toast.type === 'bet' && (
                                            <CurrencyIcon symbol={currencySymbol} currency={currency} size={13} fontSize={9} />
                                        )}
                                        {toast.type === 'win' && (
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        )}
                                        {toast.type === 'loss' && (
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        )}
                                        {toast.type !== 'bet' && toast.type !== 'win' && toast.type !== 'loss' && (
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="8" x2="12" y2="12" />
                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="wallet-toast-content">
                                        {toast.title && <span className="wallet-toast-title">{toast.title}</span>}
                                        {toast.title && toast.description && <span className="wallet-toast-dot">·</span>}
                                        {toast.description && <span className="wallet-toast-desc">{toast.description}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                {!isGamePage && (
                    <div className="search-input-wrapper" ref={searchRef} style={{ position: 'relative' }}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--text-secondary)" className="search-icon"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path></svg>
                        <input
                            type="text"
                            placeholder="Search games..."
                            className="search-input"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setSearchOpen(true)
                            }}
                            onFocus={() => setSearchOpen(true)}
                        />
                        {searchOpen && searchResults.length > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: 'calc(100% + 6px)',
                                left: 0,
                                right: 0,
                                minWidth: '220px',
                                background: '#131b2e',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '8px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                                zIndex: 999,
                                overflow: 'hidden'
                            }}>
                                {searchResults.map((game) => (
                                    <Link
                                        key={game.id}
                                        to={game.path}
                                        onClick={() => {
                                            setSearchOpen(false)
                                            setSearchQuery('')
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '10px 14px',
                                            color: '#f8fafc',
                                            textDecoration: 'none',
                                            fontSize: '13px',
                                            borderBottom: '1px solid rgba(255,255,255,0.06)'
                                        }}
                                    >
                                        <span style={{ fontWeight: 600 }}>{game.name}</span>
                                        <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>{game.rtp}</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="header-right">

                {/* ⚖️ Provably Fair Verifier Button */}
                <button
                    type="button"
                    className="header-icon-btn desktop-only-control"
                    onClick={() => onOpenVerifier && onOpenVerifier()}
                    title="Provably Fair Verifier"
                    style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        width: '34px',
                        height: '34px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                    }}
                >
                    <span style={{ fontSize: '15px' }}>⚖️</span>
                </button>

                {/* Currency Switcher Pill */}
                <div className="header-currency-pill desktop-only-control" title="Change display currency">
                    <select
                        className="header-currency-select"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        aria-label="Select Currency"
                    >
                        <option value="INR">🇮🇳 INR (₹)</option>
                        <option value="BTC">₿ BTC</option>
                        <option value="USDT">₮ USDT</option>
                        <option value="AMRAT">👑 AMRAT</option>
                    </select>
                    <span className="currency-pill-caret" aria-hidden="true">▾</span>
                </div>

                {/* Theme Palette Switcher Icon & Dropdown */}
                <div className="header-palette-wrapper desktop-only-control" ref={paletteMenuRef} style={{ position: 'relative' }}>
                    <button
                        type="button"
                        className={`header-icon-btn ${showPaletteMenu ? 'active' : ''}`}
                        onClick={() => setShowPaletteMenu(!showPaletteMenu)}
                        title="Theme Color Palette"
                        aria-label="Theme Color Palette"
                        style={{
                            background: showPaletteMenu ? 'rgba(245, 175, 25, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            border: showPaletteMenu ? '1px solid #f5af19' : '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            width: '34px',
                            height: '34px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                    >
                        <span style={{ fontSize: '15px' }}>🎨</span>
                    </button>
                    {showPaletteMenu && (
                        <div className="header-palette-dropdown">
                            <div className="header-palette-dropdown-title">Theme Palette</div>
                            {palettes.map((p) => {
                                const color = p.tokens?.primary || '#f5af19'
                                const isActive = paletteId === p.id
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        className={`palette-dropdown-item ${isActive ? 'active' : ''}`}
                                        onClick={() => {
                                            setPaletteId(p.id)
                                            setShowPaletteMenu(false)
                                        }}
                                    >
                                        <span className="palette-color-dot" style={{ backgroundColor: color }}></span>
                                        <span className="palette-name">{p.name}</span>
                                        {isActive && <span className="palette-check">✓</span>}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="desktop-auth-container">
                    {user ? (
                        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} ref={userDropdownRef}>
                            <button
                                type="button"
                                className="amrat-user-badge-btn"
                                onClick={() => setShowUserDropdown(!showUserDropdown)}
                                title={`Account: ${user.username}`}
                            >
                                <div className="amrat-user-avatar">
                                    {user.username ? user.username.charAt(0).toUpperCase() : '👤'}
                                </div>
                                <span style={{ maxWidth: '85px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {user.username}
                                </span>
                                <span style={{ fontSize: '9px', color: '#94a3b8' }}>▼</span>
                            </button>
                            {showUserDropdown && (
                                <div className="amrat-user-dropdown">
                                    <div className="amrat-user-dropdown-header">
                                        <div className="amrat-user-dropdown-name">{user.username}</div>
                                        <div className="amrat-user-dropdown-role">
                                            {user.role === 'admin' ? 'Admin' : 'VIP Player'}
                                        </div>
                                        {user.phone && (
                                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                                📱 +91 {user.phone}
                                            </div>
                                        )}
                                        {user.email && (
                                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', wordBreak: 'break-all' }}>
                                                ✉️ {user.email}
                                            </div>
                                        )}
                                    </div>

                                    <Link
                                        to="/profile"
                                        className="amrat-user-dropdown-action"
                                        onClick={() => setShowUserDropdown(false)}
                                        style={{
                                            textDecoration: 'none',
                                            color: '#f8fafc',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '10px 14px',
                                            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                            fontSize: '13px',
                                            fontWeight: 600
                                        }}
                                    >
                                        <span>👤</span>
                                        <span>My Profile & KYC</span>
                                    </Link>

                                    <Link
                                        to="/profile?tab=vip"
                                        className="amrat-user-dropdown-action"
                                        onClick={() => setShowUserDropdown(false)}
                                        style={{
                                            textDecoration: 'none',
                                            color: '#fbbf24',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '10px 14px',
                                            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                            fontSize: '13px',
                                            fontWeight: 600
                                        }}
                                    >
                                        <span>👑</span>
                                        <span>VIP Club & Rakeback</span>
                                    </Link>

                                    <Link
                                        to="/profile?tab=affiliate"
                                        className="amrat-user-dropdown-action"
                                        onClick={() => setShowUserDropdown(false)}
                                        style={{
                                            textDecoration: 'none',
                                            color: '#34d399',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '10px 14px',
                                            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                            fontSize: '13px',
                                            fontWeight: 600
                                        }}
                                    >
                                        <span>💸</span>
                                        <span>Affiliates (0.3% Share)</span>
                                    </Link>

                                    <button
                                        type="button"
                                        className="amrat-user-dropdown-action"
                                        onClick={() => {
                                            setShowUserDropdown(false)
                                            onOpenVerifier && onOpenVerifier()
                                        }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                            color: '#38bdf8',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '10px 14px',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            width: '100%',
                                            textAlign: 'left',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <span>⚖️</span>
                                        <span>Provably Fair Verifier</span>
                                    </button>

                                    <button
                                        type="button"
                                        className="amrat-user-dropdown-action logout"
                                        onClick={() => {
                                            logout()
                                            setShowUserDropdown(false)
                                        }}
                                    >
                                        <span>🚪</span>
                                        <span>Sign Out</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="header-auth-buttons">
                            <button id="header-login-btn" className="btn btn-login" onClick={() => openAuthModal('login')}>Sign In</button>
                            <button id="header-register-btn" className="btn btn-register" onClick={() => openAuthModal('register')}>Register</button>
                        </div>
                    )}
                </div>

                {!user && (
                    <button
                        type="button"
                        id="header-mobile-auth-btn"
                        className="mobile-auth-btn"
                        onClick={() => openAuthModal('login')}
                        aria-label="Sign In or Register"
                    >
                        Sign In
                    </button>
                )}

                <button
                    ref={menuButtonRef}
                    type="button"
                    className="mobile-menu-button"
                    aria-label="Open navigation menu"
                    aria-haspopup="dialog"
                    aria-expanded={menuOpen}
                    onClick={onMenuClick}
                >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                        <path d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2z" />
                    </svg>
                </button>
            </div>
        </header>
    )
}

export default Header
