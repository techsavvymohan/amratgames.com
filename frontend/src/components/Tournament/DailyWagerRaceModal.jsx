import { useState, useEffect } from 'react'
import './DailyWagerRaceModal.css'

export default function DailyWagerRaceModal({ isOpen, onClose }) {
    const [raceData, setRaceData] = useState(null)
    const [secondsLeft, setSecondsLeft] = useState(0)
    const [isLoading, setIsLoading] = useState(true)

    // Fetch daily race data
    useEffect(() => {
        if (!isOpen) return

        let isMounted = true
        const fetchRace = async () => {
            try {
                const res = await fetch('/api/community/leaderboard/daily-race')
                if (res.ok) {
                    const data = await res.json()
                    if (data.success && isMounted) {
                        setRaceData(data)
                        setSecondsLeft(data.secondsRemaining || 0)
                        setIsLoading(false)
                    }
                }
            } catch (err) {
                console.error('Failed to load race data:', err)
            }
        }

        fetchRace()
        const interval = setInterval(fetchRace, 20000)

        return () => {
            isMounted = false
            clearInterval(interval)
        }
    }, [isOpen])

    // Countdown timer ticker
    useEffect(() => {
        if (secondsLeft <= 0) return
        const timer = setInterval(() => {
            setSecondsLeft((prev) => Math.max(0, prev - 1))
        }, 1000)
        return () => clearInterval(timer)
    }, [secondsLeft])

    // Format seconds into HH:MM:SS
    const formatCountdown = (totalSec) => {
        const hrs = Math.floor(totalSec / 3600)
        const mins = Math.floor((totalSec % 3600) / 60)
        const secs = totalSec % 60
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }

    // VIP tier badge colors
    const getVipBadge = (tier) => {
        switch (String(tier).toLowerCase()) {
            case 'diamond':
                return { icon: '👑', color: '#ffb703' }
            case 'platinum':
                return { icon: '💎', color: '#00b4d8' }
            case 'gold':
                return { icon: '🥇', color: '#e0a96d' }
            case 'silver':
                return { icon: '🥈', color: '#c0c0c0' }
            default:
                return { icon: '🥉', color: '#cd7f32' }
        }
    }

    if (!isOpen) return null

    const leaderboard = raceData?.leaderboard || []
    const top3 = leaderboard.slice(0, 3)
    const rest = leaderboard.slice(3)

    return (
        <div className="race-modal-overlay" onClick={onClose}>
            <div className="race-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="race-modal-header">
                    <div className="race-header-titles">
                        <span className="race-trophy-badge">🏆 ₹50,000 DAILY RACE</span>
                        <h2 className="race-title">24-Hour Turnover Sprint</h2>
                        <p className="race-subtitle">
                            Every rupee wagered across all games moves you up the rankings!
                        </p>
                    </div>
                    <button className="race-modal-close-btn" onClick={onClose} title="Close">
                        ✕
                    </button>
                </div>

                {/* Live Countdown & Prize Summary Bar */}
                <div className="race-stats-banner">
                    <div className="race-stat-box">
                        <span className="race-stat-label">Prize Pool</span>
                        <span className="race-stat-value race-prize-glow">₹50,000 INR</span>
                    </div>
                    <div className="race-stat-box">
                        <span className="race-stat-label">Time Remaining</span>
                        <span className="race-stat-value race-timer-glow">
                            ⏱️ {formatCountdown(secondsLeft)}
                        </span>
                    </div>
                    <div className="race-stat-box">
                        <span className="race-stat-label">Reset Schedule</span>
                        <span className="race-stat-value">Midnight UTC</span>
                    </div>
                </div>

                {isLoading ? (
                    <div className="race-loading">
                        <div className="race-spinner" />
                        <p>Loading real-time leaderboard...</p>
                    </div>
                ) : (
                    <div className="race-modal-body">
                        {/* Podium Top 3 */}
                        {top3.length > 0 && (
                            <div className="race-podium-section">
                                {top3.map((player, idx) => {
                                    const rankClass = idx === 0 ? 'podium-first' : idx === 1 ? 'podium-second' : 'podium-third'
                                    const crown = idx === 0 ? '👑 1ST PLACE' : idx === 1 ? '🥈 2ND PLACE' : '🥉 3RD PLACE'
                                    const vip = getVipBadge(player.vipTier)

                                    return (
                                        <div key={player.userId || idx} className={`race-podium-card ${rankClass}`}>
                                            <div className="podium-rank-tag">{crown}</div>
                                            <div className="podium-avatar">
                                                <span>{player.username.slice(0, 2).toUpperCase()}</span>
                                            </div>
                                            <div className="podium-username-line">
                                                <span className="podium-username">{player.username}</span>
                                                <span className="podium-vip" style={{ color: vip.color }}>
                                                    {vip.icon} {player.vipTier}
                                                </span>
                                            </div>
                                            <div className="podium-wager">
                                                Turnover: <strong>₹{player.wagered.toLocaleString()}</strong>
                                            </div>
                                            <div className="podium-prize">
                                                Prize: <strong>+₹{player.prizeAmount.toLocaleString()}</strong>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Ranks 4 to 10 Table */}
                        <div className="race-table-wrapper">
                            <table className="race-leaderboard-table">
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Player</th>
                                        <th>VIP Tier</th>
                                        <th>24h Turnover</th>
                                        <th>Guaranteed Prize</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rest.map((player) => {
                                        const vip = getVipBadge(player.vipTier)
                                        return (
                                            <tr key={player.userId || player.rank}>
                                                <td className="race-rank-cell">
                                                    <span className="race-rank-pill">#{player.rank}</span>
                                                </td>
                                                <td className="race-user-cell">
                                                    <strong>{player.username}</strong>
                                                </td>
                                                <td className="race-vip-cell">
                                                    <span style={{ color: vip.color }}>
                                                        {vip.icon} {player.vipTier}
                                                    </span>
                                                </td>
                                                <td className="race-wager-cell">
                                                    ₹{player.wagered.toLocaleString()}
                                                </td>
                                                <td className="race-prize-cell">
                                                    ₹{player.prizeAmount.toLocaleString()}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Rules Info Footer */}
                        <div className="race-rules-note">
                            <div className="race-rules-item">
                                <span className="rules-icon">⚡</span>
                                <div>
                                    <strong>Real-Time Aggregation</strong>
                                    <p>All bets placed in Limbo, Crash, Mines, Plinko, and Dragon Tiger automatically count.</p>
                                </div>
                            </div>
                            <div className="race-rules-item">
                                <span className="rules-icon">🎁</span>
                                <div>
                                    <strong>Instant Cash Crediting</strong>
                                    <p>Prizes are automatically paid into player wallets at 00:00 UTC with 0x wagering requirement.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
