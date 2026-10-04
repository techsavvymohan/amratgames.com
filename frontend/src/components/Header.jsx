import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useWallet, CURRENCIES } from '../context/WalletContext'
import { useThemeSettings } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { isGamePath, GAMES } from '../games'

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

function Header({ menuOpen, menuButtonRef, onMenuClick }) {
    const location = useLocation()
    const { balance, currency, currencySymbol, currencyConfig, setCurrency, deposit, withdraw, totalDeposited, canWithdraw, transactions, toasts } = useWallet()
    const { paletteId, palettes, setPaletteId } = useThemeSettings()
    const { user, logout, openAuthModal } = useAuth()
    const [showWalletDropdown, setShowWalletDropdown] = useState(false)
    const [showUserDropdown, setShowUserDropdown] = useState(false)
    const [walletTab, setWalletTab] = useState('deposit') // 'deposit' | 'withdraw'
    const [depositAmount, setDepositAmount] = useState('')
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [payoutDestination, setPayoutDestination] = useState('')
    const [withdrawSubmitting, setWithdrawSubmitting] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchOpen, setSearchOpen] = useState(false)
    const dropdownRef = useRef(null)
    const userDropdownRef = useRef(null)
    const searchRef = useRef(null)

    const isGamePage = isGamePath(location.pathname)
    const isHomePage = location.pathname === '/'

    const searchResults = searchQuery.trim()
        ? GAMES.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
        : []

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowWalletDropdown(false)
            }
            if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
                setShowUserDropdown(false)
            }
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setSearchOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleDeposit = () => {
        const amt = parseFloat(depositAmount)
        if (!isNaN(amt) && amt > 0) {
            deposit(amt)
            setDepositAmount('')
        }
    }

    const handleWithdraw = async (e) => {
        e?.preventDefault()
        const amt = parseFloat(withdrawAmount)
        if (isNaN(amt) || amt <= 0) return
        try {
            setWithdrawSubmitting(true)
            await withdraw(amt, payoutDestination)
            setWithdrawAmount('')
            setPayoutDestination('')
        } catch {
            // Toast notification triggered in WalletContext
        } finally {
            setWithdrawSubmitting(false)
        }
    }

    const formattedBalance = balance.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })

    return (
        <header className={`header ${isHomePage ? 'header-home' : ''}`}>
            <div className="header-left">
                <Link to="/" className="logo-link" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                    <img src="/amrat-logo.png" alt="AmratGames" className="header-logo-img" style={{ height: '32px', width: '32px', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(245, 175, 25, 0.5))' }} />
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
                        className="mobile-wallet-balance"
                        aria-label={`Open wallet, balance ${currencySymbol}${formattedBalance}`}
                        aria-expanded={showWalletDropdown}
                        onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                    >
                        <CurrencyIcon symbol={currencySymbol} currency={currency} size={18} fontSize={11} />
                        <span>{formattedBalance}</span>
                    </button>
                    {isGamePage && (
                        <>
                            <div className="wallet-balance-display">
                                <CurrencyIcon symbol={currencySymbol} currency={currency} size={18} fontSize={11} />
                                <span className="wallet-balance-amount">{formattedBalance}</span>
                                <button
                                    className="wallet-dropdown-toggle"
                                    onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                                >
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                                        <path d="M7 10l5 5 5-5z" />
                                    </svg>
                                </button>
                            </div>
                            <button className="wallet-btn" onClick={() => setShowWalletDropdown(!showWalletDropdown)}>
                                Wallet
                            </button>
                        </>
                    )}

                    {/* Wallet Dropdown */}
                    {showWalletDropdown && (
                        <div className="wallet-dropdown" ref={dropdownRef}>
                            <div className="wallet-dropdown-header">
                                <div>
                                    <h4 style={{ margin: 0 }}>Wallet ({currency})</h4>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>UPI · NetBanking · Crypto</span>
                                </div>
                                <button className="wallet-close-btn" onClick={() => setShowWalletDropdown(false)}>
                                    ✕
                                </button>
                            </div>

                            <div className="wallet-balance-section">
                                <div className="wallet-balance-label">Active Balance</div>
                                <div className="wallet-balance-big">
                                    <CurrencyIcon symbol={currencySymbol} currency={currency} size={28} fontSize={16} />
                                    {formattedBalance}
                                </div>
                            </div>

                            {/* Currency Selection inside Wallet */}
                            <div style={{
                                padding: '0 16px 12px',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                                gap: '6px'
                            }}>
                                {Object.values(CURRENCIES).map((curr) => (
                                    <button
                                        key={curr.id}
                                        type="button"
                                        onClick={() => setCurrency(curr.id)}
                                        style={{
                                            padding: '6px 4px',
                                            borderRadius: '6px',
                                            border: currency === curr.id ? '1px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                                            background: currency === curr.id ? 'rgba(245, 175, 25, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                            color: currency === curr.id ? 'var(--primary)' : 'var(--text-secondary)',
                                            fontWeight: 700,
                                            fontSize: '11px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '3px',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <span>{curr.flag}</span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{curr.id}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Wallet Action Tabs: Deposit vs Withdraw */}
                            <div style={{
                                display: 'flex',
                                gap: '6px',
                                background: 'rgba(0,0,0,0.3)',
                                padding: '4px',
                                borderRadius: '8px',
                                margin: '8px 0 12px'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setWalletTab('deposit')}
                                    style={{
                                        flex: 1,
                                        padding: '7px 0',
                                        fontSize: '0.82rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: walletTab === 'deposit' ? '#10b981' : 'transparent',
                                        color: walletTab === 'deposit' ? '#000' : '#94a3b8',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    💰 Deposit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setWalletTab('withdraw')}
                                    style={{
                                        flex: 1,
                                        padding: '7px 0',
                                        fontSize: '0.82rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: walletTab === 'withdraw' ? '#f59e0b' : 'transparent',
                                        color: walletTab === 'withdraw' ? '#000' : '#94a3b8',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    🏧 Withdraw
                                </button>
                            </div>

                            {/* DEPOSIT VIEW */}
                            {walletTab === 'deposit' && (
                                <div className="wallet-actions">
                                    <div className="wallet-deposit-row">
                                        <input
                                            type="number"
                                            value={depositAmount}
                                            onChange={(e) => setDepositAmount(e.target.value)}
                                            placeholder="Amount"
                                            className="wallet-deposit-input"
                                            min="1"
                                            step="1"
                                        />
                                        <button className="wallet-deposit-btn" onClick={handleDeposit}>
                                            Add Funds
                                        </button>
                                    </div>
                                    <div className="wallet-quick-amounts">
                                        {currencyConfig.presets.map(amt => (
                                            <button key={amt} className="wallet-quick-btn" onClick={() => deposit(amt)}>
                                                +{currencySymbol}{amt.toLocaleString('en-IN')}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px', textAlign: 'center' }}>
                                        Instant UPI · NetBanking · IMPS with 0% Fee
                                    </div>
                                </div>
                            )}

                            {/* WITHDRAW VIEW */}
                            {walletTab === 'withdraw' && (
                                <div className="wallet-actions" style={{ textAlign: 'left' }}>
                                    {!canWithdraw ? (
                                        <div style={{
                                            background: 'rgba(239, 68, 68, 0.12)',
                                            border: '1px solid rgba(239, 68, 68, 0.35)',
                                            borderRadius: '8px',
                                            padding: '10px 12px',
                                            marginBottom: '8px'
                                        }}>
                                            <div style={{ color: '#f87171', fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px' }}>
                                                🔒 Minimum ₹300 Deposit Required
                                            </div>
                                            <div style={{ color: '#cbd5e1', fontSize: '0.75rem', lineHeight: 1.4 }}>
                                                To withdraw your winnings, you must make a minimum deposit of <strong>₹300</strong> to verify your payout account.
                                            </div>
                                            <div style={{
                                                margin: '8px 0 4px',
                                                background: 'rgba(0,0,0,0.4)',
                                                borderRadius: '6px',
                                                height: '6px',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: `${Math.min(100, ((totalDeposited || 0) / 300) * 100)}%`,
                                                    background: '#10b981'
                                                }} />
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '10px' }}>
                                                Deposited so far: <strong>₹{totalDeposited || 0}</strong> / ₹300
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setWalletTab('deposit')
                                                    setDepositAmount(String(Math.max(300, 300 - (totalDeposited || 0))))
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    background: '#10b981',
                                                    color: '#000',
                                                    fontWeight: 600,
                                                    fontSize: '0.8rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Deposit ₹{Math.max(300, 300 - (totalDeposited || 0))} Now
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleWithdraw}>
                                            <div style={{
                                                background: 'rgba(16, 185, 129, 0.12)',
                                                border: '1px solid rgba(16, 185, 129, 0.35)',
                                                borderRadius: '8px',
                                                padding: '6px 10px',
                                                marginBottom: '8px',
                                                fontSize: '0.75rem',
                                                color: '#34d399'
                                            }}>
                                                ✓ Payouts Unlocked (Deposited: ₹{totalDeposited})
                                            </div>
                                            <div style={{ marginBottom: '8px' }}>
                                                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>
                                                    Withdraw Amount ({currencySymbol})
                                                </label>
                                                <input
                                                    type="number"
                                                    value={withdrawAmount}
                                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                                    placeholder={`Max: ${currencySymbol}${balance.toFixed(2)}`}
                                                    className="wallet-deposit-input"
                                                    style={{ width: '100%' }}
                                                    min="1"
                                                    max={balance}
                                                    step="1"
                                                    required
                                                />
                                            </div>
                                            <div style={{ marginBottom: '10px' }}>
                                                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>
                                                    UPI ID or Bank Details
                                                </label>
                                                <input
                                                    type="text"
                                                    value={payoutDestination}
                                                    onChange={(e) => setPayoutDestination(e.target.value)}
                                                    placeholder="e.g. mobile@upi or A/C + IFSC"
                                                    className="wallet-deposit-input"
                                                    style={{ width: '100%' }}
                                                    required
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={withdrawSubmitting || balance <= 0}
                                                style={{
                                                    width: '100%',
                                                    padding: '9px',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    background: '#f59e0b',
                                                    color: '#000',
                                                    fontWeight: 700,
                                                    fontSize: '0.85rem',
                                                    cursor: balance > 0 ? 'pointer' : 'not-allowed',
                                                    opacity: balance > 0 ? 1 : 0.6
                                                }}
                                            >
                                                {withdrawSubmitting ? 'Submitting...' : 'Request Payout'}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}

                            {/* Recent Transactions */}
                            <div className="wallet-transactions">
                                <h5>Recent Activity</h5>
                                {transactions.length === 0 ? (
                                    <div className="wallet-no-tx">No transactions yet</div>
                                ) : (
                                    <div className="wallet-tx-list">
                                        {transactions.slice(0, 8).map(tx => (
                                            <div key={tx.id} className={`wallet-tx-item ${tx.type}`}>
                                                <div className="wallet-tx-info">
                                                    <span className="wallet-tx-type">
                                                        {tx.type === 'bet' && '🎲 Bet'}
                                                        {tx.type === 'win' && '🏆 Win'}
                                                        {tx.type === 'deposit' && '💰 Deposit'}
                                                        {tx.type === 'reset' && '🔄 Reset'}
                                                    </span>
                                                    <span className="wallet-tx-time">
                                                        {(tx.timestamp instanceof Date ? tx.timestamp : new Date(tx.timestamp)).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <span className={`wallet-tx-amount ${tx.amount >= 0 ? 'positive' : 'negative'}`}>
                                                    {tx.amount >= 0 ? '+' : ''}{tx.symbol || currencySymbol}{Math.abs(tx.amount).toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Game Toasts */}
                    {isGamePage && toasts.length > 0 && (
                        <div className="wallet-toast-container">
                            {toasts.map(toast => (
                                <div key={toast.id} className={`wallet-toast wallet-toast-${toast.type}`}>
                                    <div className="wallet-toast-icon">
                                        {toast.type === 'bet' && (
                                            <CurrencyIcon symbol={currencySymbol} currency={currency} size={20} fontSize={11} />
                                        )}
                                        {toast.type === 'win' && (
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        )}
                                        {toast.type === 'loss' && (
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ed4245" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        )}
                                        {toast.type === 'error' && (
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f7931a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="8" x2="12" y2="12" />
                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="wallet-toast-content">
                                        <span className="wallet-toast-title">{toast.title}</span>
                                        <span className="wallet-toast-desc">{toast.description}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
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
                {/* Currency Switcher */}
                <label className="palette-select-label" style={{ marginRight: '6px' }}>
                    <span className="palette-select-text">Currency</span>
                    <select
                        className="palette-select"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        aria-label="Select Currency"
                    >
                        <option value="INR">🇮🇳 INR (₹)</option>
                        <option value="BTC">₿ Bitcoin</option>
                        <option value="USDT">₮ USDT</option>
                        <option value="AMRAT">👑 $AMRAT</option>
                    </select>
                </label>



                {/* Theme Palette Switcher */}
                <label className="palette-select-label">
                    <span className="palette-select-text">Palette</span>
                    <select
                        className="palette-select"
                        value={paletteId}
                        onChange={(event) => setPaletteId(event.target.value)}
                        aria-label="Color palette"
                    >
                        {palettes.map((palette) => (
                            <option key={palette.id} value={palette.id}>{palette.name}</option>
                        ))}
                    </select>
                </label>

                {isGamePage ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', position: 'relative' }} ref={userDropdownRef}>
                        <button className="header-icon-btn" title="Search">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path></svg>
                        </button>
                        <button
                            className="header-icon-btn"
                            title={user ? `Logged in as ${user.username}` : "Sign In"}
                            onClick={user ? () => setShowUserDropdown(!showUserDropdown) : () => openAuthModal('login')}
                        >
                            {user ? (
                                <span style={{ fontWeight: 800, color: '#fbbf24', fontSize: '13px' }}>
                                    {user.username.charAt(0).toUpperCase()}
                                </span>
                            ) : (
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>
                            )}
                        </button>
                        <button className="header-icon-btn" title="Notifications">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"></path></svg>
                        </button>

                        {user && showUserDropdown && (
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
                ) : user ? (
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
                    <>
                        <button className="btn btn-login" onClick={() => openAuthModal('login')}>Sign In</button>
                        <button className="btn btn-register" onClick={() => openAuthModal('register')}>Register</button>
                    </>
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
