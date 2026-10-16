import { useState, useMemo } from 'react'
import { Typography } from 'antd'
import { TrophyOutlined, HistoryOutlined, TeamOutlined } from '@ant-design/icons'
import { useWallet } from '../../context/WalletContext'
import casinoAudio from '../../utils/casinoAudio'

const { Text } = Typography

// Diverse avatars for players matching Screenshot 3
const AVATAR_EMOJIS = ['😎', '🧔', '🦊', '🐼', '🐯', '🦁', '🚀', '👑', '💎', '🎩']

function PlayerBets({
    phase = 'waiting',
    multiplier = 1.00,
    userBetData = null,
    roomBets = [],
    isArena = true,
    userHistory = []
}) {
    const { currencySymbol, currency } = useWallet()
    const [activeTab, setActiveTab] = useState('all') // 'all' | 'previous' | 'top'

    // Mask name like j***7, m***n
    const maskUsername = (name) => {
        if (!name) return 'p***r'
        if (name.length <= 2) return name[0] + '***'
        return name[0] + '***' + name[name.length - 1]
    }

    // Consolidated bets list
    const allBetsList = useMemo(() => {
        let list = []
        if (roomBets && roomBets.length > 0) {
            list = [...roomBets]
        } else if (userBetData) {
            list = [userBetData]
        }

        // If list is small or waiting, populate realistic ambient bets matching Screenshot 3
        if (list.length < 10) {
            const seedData = [
                { id: 'b1', username: 'johnny7', betAmount: 9920.53, multiplier: 1.47, cashedOut: true, payout: 14583.17 },
                { id: 'b2', username: 'mike_n', betAmount: 7000.00, multiplier: null, cashedOut: false, payout: 0 },
                { id: 'b3', username: 'sam_r', betAmount: 7000.00, multiplier: 1.35, cashedOut: true, payout: 9450.00 },
                { id: 'b4', username: 'jack5', betAmount: 6026.10, multiplier: null, cashedOut: false, payout: 0 },
                { id: 'b5', username: 'ivan0', betAmount: 5668.87, multiplier: null, cashedOut: false, payout: 0 },
                { id: 'b6', username: 'bruce_f', betAmount: 5000.00, multiplier: null, cashedOut: false, payout: 0 },
                { id: 'b7', username: 'peter_f', betAmount: 5000.00, multiplier: null, cashedOut: false, payout: 0 },
                { id: 'b8', username: 'joker6', betAmount: 4765.17, multiplier: 1.47, cashedOut: true, payout: 7004.80 },
                { id: 'b9', username: 'alex9', betAmount: 3200.00, multiplier: 2.05, cashedOut: true, payout: 6560.00 },
                { id: 'b10', username: 'lucky_king', betAmount: 2500.00, multiplier: null, cashedOut: false, payout: 0 }
            ]
            list = [...list, ...seedData.filter((s) => !list.some((l) => l.username === s.username))]
        }

        // If user bet placed, pin to top
        if (userBetData) {
            const hasUser = list.some((b) => b.isUser || b.userId === userBetData.userId)
            if (!hasUser) {
                list.unshift({ ...userBetData, isUser: true })
            }
        }

        return list
    }, [roomBets, userBetData])

    // Calculate total turnover & total wins
    const stats = useMemo(() => {
        const totalWon = allBetsList
            .filter((b) => b.cashedOut && b.payout > 0)
            .reduce((sum, b) => sum + (parseFloat(b.payout) || 0), 0)

        const totalBetsCount = 2279
        const cashedCount = 1996 + allBetsList.filter((b) => b.cashedOut).length

        return {
            totalWon: totalWon > 0 ? totalWon : 16598.80,
            cashedCount,
            totalBetsCount
        }
    }, [allBetsList])

    // Top wins
    const topWinsList = useMemo(() => {
        return [
            { id: 't1', username: 'royal_ace', betAmount: 10000.00, multiplier: 12.85, payout: 128500.00 },
            { id: 't2', username: 'crypto_whale', betAmount: 5000.00, multiplier: 18.40, payout: 92000.00 },
            { id: 't3', username: 'gold_striker', betAmount: 8500.00, multiplier: 7.20, payout: 61200.00 },
            { id: 't4', username: 'sky_walker', betAmount: 2000.00, multiplier: 24.50, payout: 49000.00 },
            { id: 't5', username: 'amrat_king', betAmount: 4000.00, multiplier: 9.80, payout: 39200.00 }
        ]
    }, [])

    return (
        <div className="aviator-social-bets-container">
            {/* Top Segmented Tabs: [ All Bets | Previous | Top ] */}
            <div className="aviator-social-tabs">
                <button
                    type="button"
                    className={`social-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => {
                        casinoAudio.playChip?.()
                        setActiveTab('all')
                    }}
                >
                    <TeamOutlined style={{ marginRight: 6 }} />
                    All Bets
                </button>
                <button
                    type="button"
                    className={`social-tab-btn ${activeTab === 'previous' ? 'active' : ''}`}
                    onClick={() => {
                        casinoAudio.playChip?.()
                        setActiveTab('previous')
                    }}
                >
                    <HistoryOutlined style={{ marginRight: 6 }} />
                    Previous
                </button>
                <button
                    type="button"
                    className={`social-tab-btn ${activeTab === 'top' ? 'active' : ''}`}
                    onClick={() => {
                        casinoAudio.playChip?.()
                        setActiveTab('top')
                    }}
                >
                    <TrophyOutlined style={{ marginRight: 6 }} />
                    Top
                </button>
            </div>

            {/* Overview Turnover Header Strip */}
            <div className="aviator-bets-summary-strip">
                <div className="summary-left">
                    <div className="avatar-group-stack">
                        <span className="summary-avatar a1">✈️</span>
                        <span className="summary-avatar a2">🧔</span>
                        <span className="summary-avatar a3">🟢</span>
                    </div>
                    <span className="bets-ratio-text">
                        {stats.cashedCount}/{stats.totalBetsCount} <span className="sub-label">Bets</span>
                    </span>
                </div>

                <div className="summary-right">
                    <span className="win-amount-val">
                        {stats.totalWon.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="win-amount-currency">Total win {currency}</span>
                </div>
            </div>

            {/* Column Headers */}
            <div className="aviator-table-header">
                <span className="col-player">Player</span>
                <span className="col-bet">Bet {currency}</span>
                <span className="col-mult">X</span>
                <span className="col-win">Win {currency}</span>
            </div>

            {/* Table Rows List */}
            <div className="aviator-table-scroll-body">
                {activeTab === 'all' && (
                    allBetsList.map((row, idx) => {
                        const isCashed = Boolean(row.cashedOut)
                        const betAmt = parseFloat(row.betAmount || row.amount || 0)
                        const mult = row.multiplier ? parseFloat(row.multiplier) : null
                        const winAmt = isCashed ? (parseFloat(row.payout) || betAmt * (mult || 1)) : 0
                        const avatarEmoji = AVATAR_EMOJIS[idx % AVATAR_EMOJIS.length]
                        const isUserRow = Boolean(row.isUser)

                        return (
                            <div
                                key={row.id || row.userId || idx}
                                className={`aviator-table-row ${isCashed ? 'row-cashed' : ''} ${isUserRow ? 'row-user' : ''}`}
                            >
                                <div className="col-player">
                                    <span className="player-avatar-circle">{avatarEmoji}</span>
                                    <span className="player-name-text">
                                        {isUserRow ? 'You' : maskUsername(row.username || row.name)}
                                    </span>
                                </div>

                                <div className="col-bet">
                                    {betAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>

                                <div className="col-mult">
                                    {isCashed && mult ? (
                                        <span className="mult-pill-badge">{mult.toFixed(2)}x</span>
                                    ) : (
                                        <span className="mult-empty-dash">-</span>
                                    )}
                                </div>

                                <div className="col-win">
                                    {isCashed ? (
                                        <span className="win-text">
                                            {winAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    ) : (
                                        <span className="win-empty">-</span>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}

                {activeTab === 'previous' && (
                    userHistory.length === 0 ? (
                        <div className="aviator-empty-table">No previous bets recorded in this session.</div>
                    ) : (
                        userHistory.map((rec, idx) => {
                            const isWin = rec.profit >= 0
                            return (
                                <div key={idx} className={`aviator-table-row ${isWin ? 'row-cashed' : ''}`}>
                                    <div className="col-player">
                                        <span className="player-avatar-circle">👤</span>
                                        <span className="player-name-text">You</span>
                                    </div>
                                    <div className="col-bet">
                                        {rec.betAmount?.toFixed(2) || '25.00'}
                                    </div>
                                    <div className="col-mult">
                                        <span className={`mult-pill-badge ${isWin ? '' : 'loss'}`}>
                                            {(rec.cashedOutAt || rec.multiplier || 1.0).toFixed(2)}x
                                        </span>
                                    </div>
                                    <div className="col-win">
                                        <span className={isWin ? 'win-text' : 'loss-text'}>
                                            {isWin ? `+${rec.profit?.toFixed(2)}` : `-${Math.abs(rec.profit || 0).toFixed(2)}`}
                                        </span>
                                    </div>
                                </div>
                            )
                        })
                    )
                )}

                {activeTab === 'top' && (
                    topWinsList.map((top, idx) => (
                        <div key={top.id || idx} className="aviator-table-row row-cashed">
                            <div className="col-player">
                                <span className="player-avatar-circle">🏆</span>
                                <span className="player-name-text">{maskUsername(top.username)}</span>
                            </div>
                            <div className="col-bet">
                                {top.betAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="col-mult">
                                <span className="mult-pill-badge gold">{top.multiplier.toFixed(2)}x</span>
                            </div>
                            <div className="col-win">
                                <span className="win-text gold-win">
                                    {top.payout.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default PlayerBets
