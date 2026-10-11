import { useState, useEffect } from 'react'
import { Tooltip, Modal, Tag, Typography } from 'antd'
import {
    SafetyCertificateOutlined,
    ThunderboltOutlined,
    TrophyOutlined,
    CheckCircleOutlined
} from '@ant-design/icons'
import { useWebSocket } from '../context/WebSocketContext'
import './LivePlatformBets.css'

const { Text, Paragraph } = Typography

const GAME_META = {
    mines: { name: 'Mines', icon: '💣', color: '#f59e0b' },
    crash: { name: 'Crash 1000x', icon: '🚀', color: '#ef4444' },
    plinko: { name: 'Plinko', icon: '🔴', color: '#ec4899' },
    limbo: { name: 'Limbo', icon: '🎲', color: '#8b5cf6' },
    'coin-toss': { name: 'Coin Toss', icon: '🪙', color: '#f59e0b' },
    cointoss: { name: 'Coin Toss', icon: '🪙', color: '#f59e0b' },
    'dragon-tiger': { name: 'Dragon Tiger', icon: '🐉', color: '#eab308' },
    'color-match': { name: 'Color Match', icon: '🎨', color: '#10b981' },
    dino: { name: 'Dino Run', icon: '🦖', color: '#06b6d4' }
}

function maskUsername(username) {
    if (!username) return 'Player'
    if (username.length <= 3) return username + '***'
    return username.slice(0, 2) + '***' + username.slice(-1)
}

export default function LivePlatformBets() {
    const { recentBets: sharedBets, subscribe } = useWebSocket()
    const [bets, setBets] = useState([])
    const [activeTab, setActiveTab] = useState('all') // 'all' | 'high_rollers'
    const [selectedHash, setSelectedHash] = useState(null)

    // Sync from shared WebSocket context
    useEffect(() => {
        if (Array.isArray(sharedBets) && sharedBets.length > 0) {
            setBets(prev => {
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

    // Initial fetch and subscription
    useEffect(() => {
        let isMounted = true

        const fetchRecent = async () => {
            try {
                const res = await fetch('/api/games/recent?limit=20')
                const data = await res.json()
                if (data.success && Array.isArray(data.bets) && isMounted) {
                    setBets(data.bets)
                }
            } catch {
                // Keep local or empty
            }
        }

        fetchRecent()
        const pollInterval = setInterval(fetchRecent, 15000)

        // Real-time listener on shared WebSocket
        const unsubscribe = subscribe('NEW_BET', (payload) => {
            if (payload && isMounted) {
                setBets((prev) => [payload, ...prev.filter((b) => b.id !== payload.id)].slice(0, 30))
            }
        })

        return () => {
            isMounted = false
            clearInterval(pollInterval)
            unsubscribe()
        }
    }, [subscribe])

    const filteredBets = activeTab === 'high_rollers'
        ? bets.filter(b => (b.betAmount >= 500 || (b.payout >= 1000)))
        : bets

    return (
        <section className="live-bets-section" aria-label="Live Platform Bets">
            <div className="live-bets-header">
                <div className="live-bets-title-group">
                    <span className="live-indicator-dot"></span>
                    <h3 className="live-bets-heading">Live Platform Activity</h3>
                    <span className="live-tag">Provably Fair Wagers</span>
                </div>
                <div className="live-bets-tabs">
                    <button
                        type="button"
                        className={`live-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                        onClick={() => setActiveTab('all')}
                    >
                        <ThunderboltOutlined style={{ marginRight: 6 }} /> All Bets
                    </button>
                    <button
                        type="button"
                        className={`live-tab-btn ${activeTab === 'high_rollers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('high_rollers')}
                    >
                        <TrophyOutlined style={{ marginRight: 6, color: '#f59e0b' }} /> High Rollers
                    </button>
                </div>
            </div>

            <div className="live-bets-table-wrapper">
                <table className="live-bets-table">
                    <thead>
                        <tr>
                            <th>Game</th>
                            <th>Player</th>
                            <th>Bet Amount</th>
                            <th>Multiplier</th>
                            <th>Payout</th>
                            <th style={{ textAlign: 'right' }}>Fairness</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBets.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="live-bets-empty">
                                    <div className="empty-content">
                                        <ThunderboltOutlined style={{ fontSize: 24, opacity: 0.3, marginBottom: 8 }} />
                                        <p>No recent wagers recorded. Place a bet in any game to lead the board!</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredBets.slice(0, 12).map((bet) => {
                                const rawGame = String(bet.game || '').toLowerCase().trim()
                                const gameKey = rawGame.replace(/_/g, '-')
                                let rawName = bet.gameName || 'Casino Game'
                                if (rawName.includes('(')) rawName = rawName.split('(')[0].trim()
                                const meta = GAME_META[gameKey] || GAME_META[rawGame] || { name: rawName, icon: '🎰', color: '#3b82f6' }
                                const won = Boolean(bet.won && bet.payout > 0)
                                const symbol = bet.currency === 'INR' ? '₹' : (bet.currency === 'BTC' ? '₿' : (bet.currency === 'AMRAT' ? '👑' : '$'))

                                return (
                                    <tr key={bet.id} className="live-bet-row fade-in">
                                        <td className="col-game">
                                            <span className="game-icon-pill" style={{ borderColor: `${meta.color}40`, background: `${meta.color}15` }}>
                                                <span className="game-emoji">{meta.icon}</span>
                                                <span className="game-label">{meta.name}</span>
                                            </span>
                                        </td>
                                        <td className="col-player">
                                            <span className="player-handle">{maskUsername(bet.username)}</span>
                                        </td>
                                        <td className="col-bet">
                                            <span className="amount-val">{symbol}{Number(bet.betAmount || 0).toFixed(2)}</span>
                                        </td>
                                        <td className="col-mult">
                                            <span className={`mult-pill ${won ? 'win' : 'bust'}`}>
                                                {Number(bet.multiplier || 0).toFixed(2)}×
                                            </span>
                                        </td>
                                        <td className="col-payout">
                                            <span className={`payout-val ${won ? 'is-profit' : 'is-loss'}`}>
                                                {won ? `+${symbol}${Number(bet.payout || 0).toFixed(2)}` : `${symbol}0.00`}
                                            </span>
                                        </td>
                                        <td className="col-verify" style={{ textAlign: 'right' }}>
                                            <Tooltip title="View Provably Fair SHA-256 Hash">
                                                <button
                                                    type="button"
                                                    className="hash-verify-btn"
                                                    onClick={() => setSelectedHash(bet)}
                                                >
                                                    <SafetyCertificateOutlined style={{ color: '#10b981' }} />
                                                </button>
                                            </Tooltip>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Provably Fair Hash Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f8fafc' }}>
                        <SafetyCertificateOutlined style={{ color: '#10b981', fontSize: 20 }} />
                        <span>Provably Fair Verification</span>
                    </div>
                }
                open={Boolean(selectedHash)}
                onCancel={() => setSelectedHash(null)}
                footer={null}
                width={480}
                centered
                styles={{
                    content: { background: '#0e1d2c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 }
                }}
            >
                {selectedHash && (
                    <div className="hash-modal-body" style={{ color: '#cbd5e1', paddingTop: 12 }}>
                        <Paragraph style={{ color: '#94a3b8', fontSize: 13 }}>
                            Every round on AmratGames is deterministically generated and cryptographically verifiable with HMAC-SHA256.
                        </Paragraph>

                        <div className="hash-data-card" style={{ background: 'rgba(0,0,0,0.3)', padding: 14, borderRadius: 10, marginBottom: 12 }}>
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Round Bet ID</div>
                            <div style={{ color: '#f8fafc', fontFamily: 'monospace', fontSize: 13 }}>{selectedHash.id}</div>
                        </div>

                        <div className="hash-data-card" style={{ background: 'rgba(0,0,0,0.3)', padding: 14, borderRadius: 10, marginBottom: 12 }}>
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Cryptographic Bet Hash</div>
                            <Text copyable={{ text: selectedHash.hash || selectedHash.id }} style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                                {selectedHash.hash || 'sha256_verifiable_' + selectedHash.id}
                            </Text>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 13 }}>
                            <span style={{ color: '#94a3b8' }}>Game: <strong style={{ color: '#f8fafc' }}>{selectedHash.gameName}</strong></span>
                            <span style={{ color: '#94a3b8' }}>Status: <Tag color={selectedHash.won ? 'success' : 'default'} style={{ margin: 0 }}>{selectedHash.won ? 'Won' : 'Bust'}</Tag></span>
                        </div>
                    </div>
                )}
            </Modal>
        </section>
    )
}
