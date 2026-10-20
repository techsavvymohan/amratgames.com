import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GAMES } from '../games'
import { getRecentGames } from '../utils/userGamePreferences'
import { useAuth } from '../context/AuthContext'
import { useWallet } from '../context/WalletContext'
import { useWebSocket } from '../context/WebSocketContext'
import '../styles/hubPages.css'

function formatRelativeTime(timestamp) {
    if (!timestamp) return 'Recently'
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

export default function RecentPage() {
    const navigate = useNavigate()
    const { user, openAuthModal, getBetsHistory } = useAuth()
    const { currencySymbol } = useWallet()
    const { subscribe, recentBets: sharedBets } = useWebSocket()

    const [activeTab, setActiveTab] = useState('played') // 'played' | 'live' | 'my-bets'
    const [recentGamesList, setRecentGamesList] = useState(() => getRecentGames())
    const [liveBets, setLiveBets] = useState([])
    const [myBets, setMyBets] = useState([])
    const [loadingBets, setLoadingBets] = useState(false)
    const [betFilter, setBetFilter] = useState('all') // 'all' | 'high-mult' | 'big-wager'

    // Synchronize recently played games
    useEffect(() => {
        const handleSync = (e) => {
            if (e.detail?.recentGames) {
                setRecentGamesList(e.detail.recentGames)
            } else {
                setRecentGamesList(getRecentGames())
            }
        }
        window.addEventListener('amrat_recent_games_changed', handleSync)
        return () => window.removeEventListener('amrat_recent_games_changed', handleSync)
    }, [])

    // Sync from shared WebSocket context bets if available
    useEffect(() => {
        if (Array.isArray(sharedBets) && sharedBets.length > 0) {
            setLiveBets(prev => {
                const combined = [...sharedBets, ...prev]
                const seen = new Set()
                return combined.filter(b => {
                    const id = b.id || b.hash
                    if (!id || seen.has(id)) return false
                    seen.add(id)
                    return true
                }).slice(0, 30)
            })
        }
    }, [sharedBets])

    // Fetch and subscribe to live platform bets
    useEffect(() => {
        let isMounted = true

        const fetchLiveBets = async () => {
            try {
                const res = await fetch('/api/games/recent?limit=30')
                const data = await res.json()
                if (data.success && Array.isArray(data.bets) && isMounted) {
                    setLiveBets(prev => {
                        const combined = [...data.bets, ...prev]
                        const seen = new Set()
                        return combined.filter(b => {
                            const id = b.id || b.hash
                            if (!id || seen.has(id)) return false
                            seen.add(id)
                            return true
                        }).slice(0, 30)
                    })
                }
            } catch {}
        }

        fetchLiveBets()
        const interval = setInterval(fetchLiveBets, 12000)

        let unsubscribe = null
        if (typeof subscribe === 'function') {
            unsubscribe = subscribe('NEW_BET', (payload) => {
                if (payload && isMounted) {
                    setLiveBets(prev => [payload, ...prev.filter(b => b.id !== payload.id)].slice(0, 30))
                }
            })
        }

        return () => {
            isMounted = false
            clearInterval(interval)
            if (typeof unsubscribe === 'function') unsubscribe()
        }
    }, [subscribe])

    // Fetch user's personal recent bets when on 'my-bets' tab
    useEffect(() => {
        if (activeTab === 'my-bets' && user) {
            setLoadingBets(true)
            getBetsHistory()
                .then(res => {
                    setMyBets(Array.isArray(res) ? res : [])
                })
                .catch(() => {})
                .finally(() => setLoadingBets(false))
        }
    }, [activeTab, user, getBetsHistory])

    // Match recently played IDs to full game objects
    const matchedRecentGames = recentGamesList
        .map(item => {
            const game = GAMES.find(g => g.id === item.gameId)
            return game ? { ...game, lastPlayed: item.timestamp } : null
        })
        .filter(Boolean)

    // Fallback if user hasn't played anything yet
    const displayGames = matchedRecentGames.length > 0 ? matchedRecentGames : GAMES.slice(0, 4)

    // Filter live bets
    const filteredLiveBets = liveBets.filter(bet => {
        const mult = parseFloat(bet.multiplier || 0)
        const amt = parseFloat(bet.betAmount || bet.amount || 0)
        if (betFilter === 'high-mult') return mult >= 5.0
        if (betFilter === 'big-wager') return amt >= 200
        return true
    })

    return (
        <div className="hub-page-container">
            <div className="hub-page-content">
                {/* Header */}
            <div className="hub-header">
                <div className="hub-header-left">
                    <div className="hub-header-icon" aria-hidden="true">🕒</div>
                    <div className="hub-title-wrap">
                        <h1>
                            Recent Activity
                            <span className="hub-badge">Live Feed</span>
                        </h1>
                        <p>Your recently played games and real-time casino floor wagers</p>
                    </div>
                </div>
                <div className="hub-header-actions">
                    <Link to="/favourites" className="hub-tab-btn">
                        <span>⭐ Favourites</span>
                    </Link>
                </div>
            </div>

            {/* Nav Switcher */}
            <div className="hub-nav-tabs">
                <button
                    type="button"
                    className={`hub-tab-btn ${activeTab === 'played' ? 'active' : ''}`}
                    onClick={() => setActiveTab('played')}
                >
                    <span>🎮 Recently Played</span>
                    <span className="hub-badge" style={{ padding: '1px 6px', fontSize: '11px' }}>
                        {matchedRecentGames.length}
                    </span>
                </button>
                <button
                    type="button"
                    className={`hub-tab-btn ${activeTab === 'live' ? 'active' : ''}`}
                    onClick={() => setActiveTab('live')}
                >
                    <span style={{ color: '#10b981' }}>●</span>
                    <span>Live Floor Bets</span>
                    <span className="hub-badge" style={{ padding: '1px 6px', fontSize: '11px' }}>
                        {liveBets.length}
                    </span>
                </button>
                <button
                    type="button"
                    className={`hub-tab-btn ${activeTab === 'my-bets' ? 'active' : ''}`}
                    onClick={() => setActiveTab('my-bets')}
                >
                    <span>📋 My Bets</span>
                </button>
            </div>

            {/* TAB 1: RECENTLY PLAYED GAMES */}
            {activeTab === 'played' && (
                <div>
                    <div className="hub-section-title">
                        <span>🕹️</span> {matchedRecentGames.length > 0 ? 'Your Recently Played Games' : 'Suggested Fast Originals'}
                    </div>

                    <div className="hub-games-grid">
                        {displayGames.map(game => (
                            <div
                                key={game.id}
                                className="hub-game-card"
                                onClick={() => navigate(game.path)}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="hub-game-art-wrap">
                                    <img src={game.image} alt={game.name} className="hub-game-art" loading="lazy" />
                                    <div className="hub-game-badges">
                                        {game.badge && <span className="hub-badge">{game.badge}</span>}
                                        <span className="hub-badge" style={{ color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                                            {game.rtp?.split(' ')[0] || '99%'} RTP
                                        </span>
                                    </div>
                                </div>
                                <div className="hub-game-info">
                                    <h3 className="hub-game-title">{game.name}</h3>
                                    <div className="hub-game-meta">
                                        <span>{game.lastPlayed ? formatRelativeTime(game.lastPlayed) : game.volatility}</span>
                                        <span className="hub-game-maxwin">Max: {game.maxWin}</span>
                                    </div>
                                    <button type="button" className="hub-game-play-btn">
                                        <span>{game.lastPlayed ? 'RESUME PLAY' : 'PLAY NOW'}</span>
                                        <span>▶</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {matchedRecentGames.length === 0 && (
                        <div className="hub-empty-state" style={{ marginTop: '20px' }}>
                            <div className="hub-empty-icon">🎲</div>
                            <div className="hub-empty-title">Ready for Your Next Win?</div>
                            <p className="hub-empty-desc">
                                As you play Aviator, Mines, Limbo, or Coin Toss, your recent game sessions will be recorded here for instant access.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: LIVE CASINO FLOOR BETS */}
            {activeTab === 'live' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <div className="hub-section-title" style={{ margin: 0 }}>
                            <span style={{ color: '#10b981' }}>●</span> Real-Time Platform Bets
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                className={`hub-tab-btn ${betFilter === 'all' ? 'active' : ''}`}
                                style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                                onClick={() => setBetFilter('all')}
                            >
                                All Bets
                            </button>
                            <button
                                type="button"
                                className={`hub-tab-btn ${betFilter === 'high-mult' ? 'active' : ''}`}
                                style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                                onClick={() => setBetFilter('high-mult')}
                            >
                                🚀 Big Wins (5x+)
                            </button>
                            <button
                                type="button"
                                className={`hub-tab-btn ${betFilter === 'big-wager' ? 'active' : ''}`}
                                style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                                onClick={() => setBetFilter('big-wager')}
                            >
                                💰 High Rollers (₹200+)
                            </button>
                        </div>
                    </div>

                    <div className="hub-table-wrapper">
                        <table className="hub-table">
                            <thead>
                                <tr>
                                    <th>Game</th>
                                    <th>Player</th>
                                    <th>Time</th>
                                    <th>Bet</th>
                                    <th>Multiplier</th>
                                    <th style={{ textAlign: 'right' }}>Payout</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLiveBets.length > 0 ? (
                                    filteredLiveBets.map((bet, idx) => {
                                        const mult = parseFloat(bet.multiplier || 0)
                                        const isWin = mult > 1.0 || bet.won
                                        const payout = parseFloat(bet.payout || 0)
                                        const betAmt = parseFloat(bet.betAmount || bet.amount || 0)

                                        return (
                                            <tr key={bet.id || `live_bet_${idx}`}>
                                                <td>
                                                    <span className="hub-game-pill">
                                                        <span>{bet.game === 'crash' ? '🚀' : bet.game === 'mines' ? '💣' : bet.game === 'limbo' ? '⚡' : bet.game === 'cointoss' || bet.game === 'coin-toss' ? '🪙' : '🎲'}</span>
                                                        <span>{bet.gameName || bet.game || 'Amrat Original'}</span>
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>
                                                        {bet.username ? (bet.username.length > 4 ? `${bet.username.slice(0, 3)}***` : bet.username) : 'Player***'}
                                                    </span>
                                                </td>
                                                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                                    {bet.timestamp ? formatRelativeTime(bet.timestamp) : 'Just now'}
                                                </td>
                                                <td style={{ fontWeight: 700 }}>
                                                    {currencySymbol}{betAmt.toFixed(2)}
                                                </td>
                                                <td>
                                                    <span className={isWin ? 'hub-multiplier-win' : 'hub-multiplier-loss'}>
                                                        {mult > 0 ? `${mult.toFixed(2)}x` : '0.00x'}
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
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                                            Connecting to live platform bet stream...
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: MY RECENT BETS */}
            {activeTab === 'my-bets' && (
                <div>
                    {!user ? (
                        <div className="hub-auth-prompt">
                            <div className="hub-auth-prompt-left">
                                <div className="hub-auth-icon">🔒</div>
                                <div>
                                    <h3>Sign In to View Your Bet History</h3>
                                    <p>Track all your wagers, multipliers, and Provably Fair payouts in one secure ledger.</p>
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
                    ) : (
                        <div className="hub-table-wrapper">
                            <div className="hub-table-header">
                                <span className="hub-table-header-title">
                                    <span>👤</span> Your Personal Bet History
                                </span>
                                <Link to="/my-bets" className="hub-badge" style={{ textDecoration: 'none', color: '#fbbf24' }}>
                                    Full Dashboard →
                                </Link>
                            </div>
                            <table className="hub-table">
                                <thead>
                                    <tr>
                                        <th>Game</th>
                                        <th>Date & Time</th>
                                        <th>Bet Amount</th>
                                        <th>Multiplier</th>
                                        <th style={{ textAlign: 'right' }}>Payout</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingBets ? (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                                                Loading your bets...
                                            </td>
                                        </tr>
                                    ) : myBets.length > 0 ? (
                                        myBets.slice(0, 15).map((bet, idx) => {
                                            const isWin = Boolean(bet.won)
                                            const mult = parseFloat(bet.multiplier || 0)
                                            const payout = parseFloat(bet.payout || 0)
                                            const betAmt = parseFloat(bet.betAmount || 0)

                                            return (
                                                <tr key={bet.id || `my_bet_${idx}`}>
                                                    <td>
                                                        <span className="hub-game-pill">
                                                            <span>🎲</span>
                                                            <span>{bet.game || 'Game'}</span>
                                                        </span>
                                                    </td>
                                                    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                                        {bet.createdAt ? new Date(bet.createdAt).toLocaleString() : 'Recent'}
                                                    </td>
                                                    <td style={{ fontWeight: 700 }}>
                                                        {currencySymbol}{betAmt.toFixed(2)}
                                                    </td>
                                                    <td>
                                                        <span className={isWin ? 'hub-multiplier-win' : 'hub-multiplier-loss'}>
                                                            {mult > 0 ? `${mult.toFixed(2)}x` : '0.00x'}
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
                                            <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                                                No bets played yet on this account. Try Aviator or Limbo!
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
            </div>
        </div>
    )
}
