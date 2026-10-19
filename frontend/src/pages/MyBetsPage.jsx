import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWallet } from '../context/WalletContext'
import '../styles/hubPages.css'

export default function MyBetsPage() {
    const navigate = useNavigate()
    const { user, openAuthModal, getBetsHistory } = useAuth()
    const { currencySymbol } = useWallet()

    const [bets, setBets] = useState([])
    const [loading, setLoading] = useState(false)
    const [resultFilter, setResultFilter] = useState('all') // 'all' | 'wins' | 'losses'
    const [gameFilter, setGameFilter] = useState('all')

    useEffect(() => {
        let isMounted = true
        if (user) {
            setLoading(true)
            getBetsHistory()
                .then(data => {
                    if (isMounted) {
                        setBets(Array.isArray(data) ? data : [])
                    }
                })
                .catch(() => {
                    if (isMounted) setBets([])
                })
                .finally(() => {
                    if (isMounted) setLoading(false)
                })
        } else {
            // Check for guest bets in local storage
            try {
                const guestCrash = JSON.parse(localStorage.getItem('amrat_crash_history') || '[]')
                const guestCoin = JSON.parse(localStorage.getItem('amrat_cointoss_history') || '[]')
                const combined = [
                    ...guestCrash.map(b => ({ ...b, game: 'crash' })),
                    ...guestCoin.map(b => ({ ...b, game: 'coin-toss' }))
                ]
                setBets(combined)
            } catch {
                setBets([])
            }
        }

        return () => { isMounted = false }
    }, [user, getBetsHistory])

    // Filter bets
    const filteredBets = useMemo(() => {
        return bets.filter(bet => {
            const isWin = Boolean(bet.won || parseFloat(bet.payout || 0) > parseFloat(bet.betAmount || bet.amount || 0))
            if (resultFilter === 'wins' && !isWin) return false
            if (resultFilter === 'losses' && isWin) return false

            if (gameFilter !== 'all') {
                const g = String(bet.game || '').toLowerCase()
                if (!g.includes(gameFilter.toLowerCase())) return false
            }

            return true
        })
    }, [bets, resultFilter, gameFilter])

    // Metrics calculations
    const metrics = useMemo(() => {
        let totalWagered = 0
        let totalPayout = 0
        let winsCount = 0

        bets.forEach(b => {
            const betAmt = parseFloat(b.betAmount || b.amount || 0)
            const payout = parseFloat(b.payout || 0)
            totalWagered += betAmt
            totalPayout += payout
            if (b.won || payout > betAmt) winsCount++
        })

        const netProfit = totalPayout - totalWagered
        const winRate = bets.length > 0 ? ((winsCount / bets.length) * 100).toFixed(1) : '0.0'

        return {
            totalBets: bets.length,
            totalWagered: totalWagered.toFixed(2),
            totalPayout: totalPayout.toFixed(2),
            netProfit: netProfit.toFixed(2),
            isProfit: netProfit >= 0,
            winRate
        }
    }, [bets])

    const getGameIcon = (gameKey) => {
        const k = String(gameKey || '').toLowerCase()
        if (k.includes('crash')) return '🚀'
        if (k.includes('coin')) return '🪙'
        if (k.includes('mines')) return '💣'
        if (k.includes('limbo')) return '⚡'
        if (k.includes('plinko')) return '🎯'
        if (k.includes('dragon')) return '🐉'
        if (k.includes('color')) return '🎨'
        return '🎲'
    }

    return (
        <div className="hub-page-container">
            {/* Header */}
            <div className="hub-header">
                <div className="hub-header-left">
                    <div className="hub-header-icon" aria-hidden="true">📋</div>
                    <div className="hub-title-wrap">
                        <h1>
                            My Bets History
                            <span className="hub-badge">{bets.length} Recorded</span>
                        </h1>
                        <p>Complete ledger of your wagers, multipliers, and Provably Fair outcomes</p>
                    </div>
                </div>
                <div className="hub-header-actions">
                    <Link to="/profile" className="hub-tab-btn">
                        <span>👤 Player Profile</span>
                    </Link>
                </div>
            </div>

            {/* Auth Banner if Guest */}
            {!user && (
                <div className="hub-auth-prompt">
                    <div className="hub-auth-prompt-left">
                        <div className="hub-auth-icon">🔒</div>
                        <div>
                            <h3>Sign In to Save Your Bet History Forever</h3>
                            <p>Register in 10 seconds to sync your bets across all devices and claim your ₹100 welcome bonus.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="hub-auth-btn"
                        onClick={() => openAuthModal('login')}
                    >
                        ⚡ Sign In / Register
                    </button>
                </div>
            )}

            {/* Summary Metrics */}
            <div className="hub-metrics-grid">
                <div className="hub-metric-card">
                    <div className="hub-metric-icon">🎲</div>
                    <div className="hub-metric-info">
                        <span className="hub-metric-label">Total Bets Placed</span>
                        <span className="hub-metric-value">{metrics.totalBets}</span>
                    </div>
                </div>
                <div className="hub-metric-card">
                    <div className="hub-metric-icon">💳</div>
                    <div className="hub-metric-info">
                        <span className="hub-metric-label">Total Wagered</span>
                        <span className="hub-metric-value">{currencySymbol}{metrics.totalWagered}</span>
                    </div>
                </div>
                <div className="hub-metric-card">
                    <div className="hub-metric-icon">💰</div>
                    <div className="hub-metric-info">
                        <span className="hub-metric-label">Total Payout</span>
                        <span className="hub-metric-value" style={{ color: '#10b981' }}>{currencySymbol}{metrics.totalPayout}</span>
                    </div>
                </div>
                <div className="hub-metric-card">
                    <div className="hub-metric-icon">📈</div>
                    <div className="hub-metric-info">
                        <span className="hub-metric-label">Net Return / Profit</span>
                        <span className="hub-metric-value" style={{ color: metrics.isProfit ? '#10b981' : '#f87171' }}>
                            {metrics.isProfit ? '+' : ''}{currencySymbol}{metrics.netProfit}
                        </span>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div className="hub-nav-tabs" style={{ margin: 0 }}>
                    <button
                        type="button"
                        className={`hub-tab-btn ${resultFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setResultFilter('all')}
                    >
                        All Bets ({bets.length})
                    </button>
                    <button
                        type="button"
                        className={`hub-tab-btn ${resultFilter === 'wins' ? 'active' : ''}`}
                        onClick={() => setResultFilter('wins')}
                    >
                        <span>✅ Winning Bets</span>
                    </button>
                    <button
                        type="button"
                        className={`hub-tab-btn ${resultFilter === 'losses' ? 'active' : ''}`}
                        onClick={() => setResultFilter('losses')}
                    >
                        <span>❌ Losses</span>
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>Filter by Game:</label>
                    <select
                        value={gameFilter}
                        onChange={(e) => setGameFilter(e.target.value)}
                        style={{
                            background: 'rgba(16, 36, 58, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '8px',
                            color: '#fff',
                            padding: '6px 12px',
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        <option value="all">All Games</option>
                        <option value="crash">Crash (Rocket)</option>
                        <option value="coin">Coin Toss</option>
                        <option value="mines">Mines (Diamonds)</option>
                        <option value="limbo">Limbo Turbo</option>
                        <option value="plinko">Plinko</option>
                        <option value="dragon">Dragon Tiger</option>
                        <option value="color">Color Match</option>
                    </select>
                </div>
            </div>

            {/* Bets Ledger Table */}
            <div className="hub-table-wrapper">
                <table className="hub-table">
                    <thead>
                        <tr>
                            <th>Game</th>
                            <th>Date & Time</th>
                            <th>Bet Amount</th>
                            <th>Multiplier</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Payout</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                                    Loading your betting ledger...
                                </td>
                            </tr>
                        ) : filteredBets.length > 0 ? (
                            filteredBets.map((bet, idx) => {
                                const betAmt = parseFloat(bet.betAmount || bet.amount || 0)
                                const payout = parseFloat(bet.payout || 0)
                                const mult = parseFloat(bet.multiplier || 0)
                                const isWin = Boolean(bet.won || payout > betAmt)

                                return (
                                    <tr key={bet.id || `bet_${idx}`}>
                                        <td>
                                            <span className="hub-game-pill">
                                                <span>{getGameIcon(bet.game)}</span>
                                                <span style={{ textTransform: 'capitalize' }}>
                                                    {bet.gameName || bet.game || 'Game'}
                                                </span>
                                            </span>
                                        </td>
                                        <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                            {bet.createdAt ? new Date(bet.createdAt).toLocaleString() : 'Recently'}
                                        </td>
                                        <td style={{ fontWeight: 700 }}>
                                            {currencySymbol}{betAmt.toFixed(2)}
                                        </td>
                                        <td>
                                            <span className={isWin ? 'hub-multiplier-win' : 'hub-multiplier-loss'}>
                                                {mult > 0 ? `${mult.toFixed(2)}x` : '0.00x'}
                                            </span>
                                        </td>
                                        <td>
                                            <span
                                                className="hub-badge"
                                                style={{
                                                    background: isWin ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                                                    borderColor: isWin ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.3)',
                                                    color: isWin ? '#34d399' : '#f87171'
                                                }}
                                            >
                                                {isWin ? 'WON' : 'LOST'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span className={isWin ? 'hub-payout-win' : 'hub-payout-loss'}>
                                                {isWin ? `+${currencySymbol}${payout.toFixed(2)}` : `${currencySymbol}0.00`}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })
                        ) : (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎲</div>
                                    <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>No bets match this filter</div>
                                    <div style={{ fontSize: '0.85rem' }}>Launch any game from the sidebar to place your first bet!</div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
