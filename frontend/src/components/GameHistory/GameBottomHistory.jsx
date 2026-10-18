import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWebSocket } from '../../context/WebSocketContext'
import './GameBottomHistory.css'

export default function GameBottomHistory({ gameKey = 'coin-toss', gameTitle = 'Coin Toss', localRounds = [] }) {
    const { user, token } = useAuth()
    const { subscribe } = useWebSocket()
    const [activeTab, setActiveTab] = useState('my_bets') // 'my_bets' | 'all_players'
    const [serverMyBets, setServerMyBets] = useState([])
    const [allPlayersBets, setAllPlayersBets] = useState([])
    const [loading, setLoading] = useState(false)

    // Normalize game key comparison (e.g. 'coin-toss', 'cointoss')
    const normalizedKey = useMemo(() => {
        return String(gameKey || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    }, [gameKey])

    // Fetch user-specific bets for this game
    const fetchMyBets = async () => {
        if (!token) return
        try {
            const res = await fetch(`/api/auth/bets-history?game=${encodeURIComponent(gameKey)}&limit=30`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success && Array.isArray(data.bets)) {
                setServerMyBets(data.bets)
            }
        } catch {
            // keep local
        }
    }

    // Fetch all players recent bets for this game
    const fetchAllBets = async () => {
        try {
            const res = await fetch(`/api/games/recent?game=${encodeURIComponent(gameKey)}&limit=30`)
            const data = await res.json()
            if (data.success && Array.isArray(data.bets)) {
                setAllPlayersBets(data.bets)
            }
        } catch {
            // keep local
        }
    }

    useEffect(() => {
        fetchMyBets()
        fetchAllBets()

        // Real-time WebSocket updates via centralized provider
        const unsubscribe = subscribe('NEW_BET', (bet) => {
            if (!bet) return
            const betGame = String(bet.game || bet.gameName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
            if (betGame.includes(normalizedKey) || normalizedKey.includes(betGame)) {
                setAllPlayersBets((prev) => [bet, ...prev.filter((b) => b.id !== bet.id)].slice(0, 30))
                if (user?.id && (bet.userId === user.id || bet.username === user.username)) {
                    setServerMyBets((prev) => [bet, ...prev.filter((b) => b.id !== bet.id)].slice(0, 30))
                }
            }
        })

        return () => {
            unsubscribe()
        }
    }, [gameKey, normalizedKey, token, user?.id, user?.username, subscribe])

    const storageKey = useMemo(() => {
        return `amrat_game_bottom_history_${normalizedKey}_${user?.id || 'guest'}`
    }, [normalizedKey, user?.id])

    // Load initial persisted history from localStorage
    const [cachedBets, setCachedBets] = useState(() => {
        try {
            const raw = localStorage.getItem(`amrat_game_bottom_history_${normalizedKey}_${user?.id || 'guest'}`) ||
                        localStorage.getItem(`amrat_game_bottom_history_${normalizedKey}_guest`)
            return raw ? JSON.parse(raw) : []
        } catch {
            return []
        }
    })

    // Merge local session rounds, server recorded bets, and persisted localStorage bets
    const displayedMyBets = useMemo(() => {
        const list = []
        const seenIds = new Set()

        // 1. Session local rounds (placed right now in this component)
        if (Array.isArray(localRounds)) {
            for (const r of localRounds) {
                const id = r.id || `${r.timestamp || r.createdAt || Date.now()}-${r.betAmount || 0}`
                if (!seenIds.has(id)) {
                    seenIds.add(id)
                    list.push({
                        id,
                        game: gameKey,
                        gameName: gameTitle,
                        choice: r.choice || r.picked || r.selection,
                        outcome: r.outcome || r.result,
                        betAmount: r.betAmount || r.amount || 0,
                        multiplier: r.multiplier !== undefined ? r.multiplier : (r.won ? 1.95 : 0),
                        payout: r.payout !== undefined ? r.payout : (r.won ? (r.betAmount * 1.95) : 0),
                        won: Boolean(r.won || (r.payout > (r.betAmount || 0))),
                        createdAt: r.timestamp || r.createdAt || new Date().toISOString(),
                        isLocal: true
                    })
                }
            }
        }

        // 2. Server recorded bets
        for (const b of serverMyBets) {
            const id = b.id || `${b.createdAt}-${b.betAmount}`
            if (!seenIds.has(id)) {
                seenIds.add(id)
                list.push(b)
            }
        }

        // 3. Persisted cached bets from previous sessions
        for (const c of cachedBets) {
            const id = c.id || `${c.createdAt}-${c.betAmount}`
            if (!seenIds.has(id)) {
                seenIds.add(id)
                list.push(c)
            }
        }

        // Sort descending by creation date
        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

        const finalSlice = list.slice(0, 50)

        // Keep localStorage synced so it NEVER disappears when leaving the game
        try {
            if (finalSlice.length > 0) {
                localStorage.setItem(storageKey, JSON.stringify(finalSlice))
            }
        } catch {}

        return finalSlice
    }, [localRounds, serverMyBets, cachedBets, gameKey, gameTitle, storageKey])

    const displayedList = activeTab === 'my_bets' ? displayedMyBets : allPlayersBets

    const formatTime = (ts) => {
        if (!ts) return 'Just now'
        const d = new Date(ts)
        if (isNaN(d.getTime())) return 'Just now'
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }

    const maskName = (name) => {
        if (!name) return 'Player'
        if (name.length <= 3) return name + '***'
        return name.slice(0, 2) + '***' + name.slice(-1)
    }

    return (
        <section className="game-bottom-history-container" aria-label={`${gameTitle} Round History`}>
            {/* Header with Title and Tabs */}
            <div className="game-history-header">
                <div className="game-history-title-wrap">
                    <span className="game-history-icon">📜</span>
                    <h3 className="game-history-title">{gameTitle} History</h3>
                    <span className="game-history-live-pill">
                        <span className="live-dot-pulse" /> Live
                    </span>
                </div>

                <div className="game-history-tabs">
                    <button
                        type="button"
                        className={`history-tab-btn ${activeTab === 'my_bets' ? 'active' : ''}`}
                        onClick={() => setActiveTab('my_bets')}
                    >
                        <span>👤</span>
                        <span>My Bets</span>
                        {displayedMyBets.length > 0 && (
                            <span className="history-tab-count">{displayedMyBets.length}</span>
                        )}
                    </button>
                    <button
                        type="button"
                        className={`history-tab-btn ${activeTab === 'all_players' ? 'active' : ''}`}
                        onClick={() => setActiveTab('all_players')}
                    >
                        <span>🌐</span>
                        <span>All Players</span>
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div className="game-history-table-wrapper">
                <table className="game-history-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            {activeTab === 'all_players' && <th>Player</th>}
                            <th>Round Details</th>
                            <th>Bet Amount</th>
                            <th>Multiplier</th>
                            <th style={{ textAlign: 'right' }}>Payout / Profit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayedList.length === 0 ? (
                            <tr>
                                <td colSpan={activeTab === 'all_players' ? 6 : 5} className="history-empty-row">
                                    <div className="history-empty-content">
                                        <span style={{ fontSize: '24px' }}>🎲</span>
                                        <span>
                                            {activeTab === 'my_bets'
                                                ? `No ${gameTitle} rounds played yet. Place a wager to track your history here!`
                                                : `Waiting for live ${gameTitle} activity...`}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            displayedList.map((item, idx) => {
                                const isWin = Boolean(item.won || (item.payout > item.betAmount))
                                const betAmt = Number(item.betAmount || 0)
                                const payoutAmt = Number(item.payout || 0)
                                const profitAmt = isWin ? payoutAmt - betAmt : -betAmt
                                const mult = Number(item.multiplier || (isWin ? (betAmt > 0 ? payoutAmt / betAmt : 1.96) : 0)).toFixed(2)

                                // Detail formatting
                                let detailText = item.outcome || item.choice || '-'
                                if (gameKey === 'coin-toss') {
                                    const pick = item.choice ? String(item.choice).toUpperCase() : ''
                                    const out = item.outcome ? String(item.outcome).toUpperCase() : ''
                                    detailText = pick ? `${pick} → ${out || pick}` : out || 'FLIP'
                                }

                                return (
                                    <tr key={item.id || idx} className={`history-row ${isWin ? 'row-won' : 'row-lost'}`}>
                                        <td className="col-time">{formatTime(item.createdAt)}</td>
                                        {activeTab === 'all_players' && (
                                            <td className="col-player">
                                                <span className="player-badge">
                                                    {user && (item.userId === user.id || item.username === user.username)
                                                        ? 'You'
                                                        : maskName(item.username)}
                                                </span>
                                            </td>
                                        )}
                                        <td className="col-detail">
                                            <span className={`detail-pill ${isWin ? 'won' : 'lost'}`}>
                                                {gameKey === 'coin-toss' && '🪙 '}
                                                {detailText}
                                            </span>
                                        </td>
                                        <td className="col-amount">
                                            ₹{betAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="col-multiplier">
                                            <span className={`multiplier-tag ${isWin ? 'mult-win' : 'mult-bust'}`}>
                                                {mult}×
                                            </span>
                                        </td>
                                        <td className="col-payout" style={{ textAlign: 'right' }}>
                                            <span className={`profit-text ${isWin ? 'text-profit' : 'text-loss'}`}>
                                                {isWin ? '+' : ''}₹{Math.abs(profitAmt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    )
}
