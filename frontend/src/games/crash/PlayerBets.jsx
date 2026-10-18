import { useState, useMemo, useEffect, useRef } from 'react'
import { Typography } from 'antd'
import { TrophyOutlined, HistoryOutlined, TeamOutlined } from '@ant-design/icons'
import { useWallet } from '../../context/WalletContext'
import casinoAudio from '../../utils/casinoAudio'

const { Text } = Typography

// Diverse avatars for players matching high-roller casino aesthetic
const AVATAR_EMOJIS = ['😎', '🧔', '🦊', '🐼', '🐯', '🦁', '🚀', '👑', '💎', '🎩', '⚡', '🔥', '🎲', '🪙', '🦅']

// Realistic player username handles (Indian & Global)
const BOT_NAMES_POOL = [
    'aarav_99', 'rohit_kumar', 'vikram_singh', 'priya_p', 'rahul_sh',
    'amit_verma', 'deepak_raj', 'neha_r', 'sachin_g', 'raj_malhotra',
    'ananya_s', 'kabir_x', 'arjun_v', 'karan_m', 'sunil_ydv',
    'manish_p', 'alex_rider', 'johnny_d', 'lucky_strike', 'crypto_whale',
    'aviator_pro', 'sky_ace', 'tiger_k', 'royal_bengal', 'speedy_r',
    'vicky_roy', 'pooja_m', 'sanjay_t', 'ankit_sh', 'dev_pandey',
    'harsh_v', 'ritesh_k', 'ashish_b', 'varun_d', 'kartik_s',
    'meera_j', 'rohan_m', 'shivam_t', 'prateek_g', 'nikhil_r'
]

// Weighted realistic consumer stake amounts (₹20 to ₹1,000)
const REALISTIC_STAKES = [
    20, 25, 50, 50, 100, 100, 150, 200, 200, 250, 300, 400, 500, 500, 800, 1000
]

function generateRandomBots(count = 28) {
    const shuffledNames = [...BOT_NAMES_POOL].sort(() => 0.5 - Math.random())
    const bots = []

    for (let i = 0; i < Math.min(count, shuffledNames.length); i++) {
        const username = shuffledNames[i]
        const rawStake = REALISTIC_STAKES[Math.floor(Math.random() * REALISTIC_STAKES.length)]
        const betAmount = rawStake

        // Weighted target multiplier distribution
        const r = Math.random()
        let targetMultiplier
        if (r < 0.40) {
            // Early safe cashouts (1.12x - 1.45x)
            targetMultiplier = parseFloat((1.12 + Math.random() * 0.33).toFixed(2))
        } else if (r < 0.75) {
            // Mid steady cashouts (1.46x - 2.10x)
            targetMultiplier = parseFloat((1.46 + Math.random() * 0.64).toFixed(2))
        } else if (r < 0.92) {
            // Higher cashouts (2.11x - 3.80x)
            targetMultiplier = parseFloat((2.11 + Math.random() * 1.69).toFixed(2))
        } else {
            // Top flyers (3.81x - 6.50x)
            targetMultiplier = parseFloat((3.81 + Math.random() * 2.69).toFixed(2))
        }

        bots.push({
            id: `bot_${Date.now()}_${i}`,
            username,
            betAmount,
            targetMultiplier,
            cashedOut: false,
            multiplier: null,
            payout: 0,
            avatarEmoji: AVATAR_EMOJIS[i % AVATAR_EMOJIS.length]
        })
    }

    // Sort bots descending by bet amount
    return bots.sort((a, b) => b.betAmount - a.betAmount)
}

function PlayerBets({
    phase = 'waiting',
    multiplier = 1.00,
    userBetData = null,
    userBets = [],
    roomBets = [],
    isArena = true,
    userHistory = []
}) {
    const { currencySymbol, currency } = useWallet()
    const [activeTab, setActiveTab] = useState('all') // 'all' | 'previous' | 'top'

    // Dynamic simulated bots state
    const [simulatedBots, setSimulatedBots] = useState(() => generateRandomBots(32))
    const lastPhaseRef = useRef(phase)

    // Generate fresh pool of simulated bets when a new round starts
    useEffect(() => {
        if (phase === 'waiting' && lastPhaseRef.current !== 'waiting') {
            setSimulatedBots(generateRandomBots(Math.floor(26 + Math.random() * 10)))
        }
        lastPhaseRef.current = phase
    }, [phase])

    // Mask name like j***7, m***n
    const maskUsername = (name) => {
        if (!name) return 'p***r'
        if (name.length <= 2) return name[0] + '***'
        return name[0] + '***' + name[name.length - 1]
    }

    // Dynamic real-time bot cashouts as multiplier rises
    const liveBots = useMemo(() => {
        const currentM = parseFloat(multiplier) || 1.00
        const isRunning = phase === 'running' || phase === 'crashed'

        return simulatedBots.map((bot) => {
            if (isRunning && currentM >= bot.targetMultiplier) {
                const payout = parseFloat((bot.betAmount * bot.targetMultiplier).toFixed(2))
                return {
                    ...bot,
                    cashedOut: true,
                    multiplier: bot.targetMultiplier,
                    payout
                }
            }
            return bot
        })
    }, [simulatedBots, multiplier, phase])

    // Consolidated bets list: Real player pinned at top, followed by bots/room
    const allBetsList = useMemo(() => {
        let baseList = []

        if (roomBets && roomBets.length > 0) {
            baseList = [...roomBets]
        } else {
            baseList = [...liveBots]
        }

        // Gather real player bets
        const activeUserBets = []
        if (Array.isArray(userBets) && userBets.length > 0) {
            activeUserBets.push(...userBets)
        } else if (userBetData) {
            activeUserBets.push(userBetData)
        }

        // Remove duplicates and pin real player at index 0 & 1
        const nonUserList = baseList.filter(
            (b) => !b.isUser && !activeUserBets.some((u) => u.userId && u.userId === b.userId)
        )

        const formattedUserBets = activeUserBets.map((ub, idx) => ({
            ...ub,
            id: ub.id || `user-bet-${idx}`,
            isUser: true,
            username: ub.username || 'You',
            avatarEmoji: '👑'
        }))

        return [...formattedUserBets, ...nonUserList]
    }, [roomBets, liveBots, userBets, userBetData])

    // Real-time turnover & total wins dynamically calculated as bots cash out
    const stats = useMemo(() => {
        const liveWon = allBetsList
            .filter((b) => b.cashedOut && b.payout > 0)
            .reduce((sum, b) => sum + (parseFloat(b.payout) || 0), 0)

        // Realistic live total won calibrated to standard turnover (₹3,400 to ₹16,500)
        const cappedWon = Math.min(Math.max(liveWon, 3420.50), 16500.00)

        const totalBetsCount = 184
        const cashedCount = 112 + allBetsList.filter((b) => b.cashedOut).length

        return {
            totalWon: parseFloat(cappedWon.toFixed(2)),
            cashedCount,
            totalBetsCount
        }
    }, [allBetsList])

    // Persistent previous user bets (stored in localStorage)
    const persistedUserHistory = useMemo(() => {
        try {
            const raw = localStorage.getItem('amrat_crash_history')
            const parsed = raw ? JSON.parse(raw) : []
            if (Array.isArray(userHistory) && userHistory.length > 0) {
                const combined = [...userHistory]
                for (const p of parsed) {
                    if (!combined.some((c) => c.id === p.id)) {
                        combined.push(p)
                    }
                }
                return combined.slice(0, 40)
            }
            return parsed.slice(0, 40)
        } catch {
            return userHistory || []
        }
    }, [userHistory])

    // Top wins (calibrated to realistic community achievements)
    const topWinsList = useMemo(() => {
        return [
            { id: 't1', username: 'royal_ace', betAmount: 1000.00, multiplier: 8.85, payout: 8850.00 },
            { id: 't2', username: 'crypto_whale', betAmount: 500.00, multiplier: 12.40, payout: 6200.00 },
            { id: 't3', username: 'gold_striker', betAmount: 800.00, multiplier: 5.60, payout: 4480.00 },
            { id: 't4', username: 'sky_walker', betAmount: 250.00, multiplier: 15.20, payout: 3800.00 },
            { id: 't5', username: 'amrat_king', betAmount: 500.00, multiplier: 4.80, payout: 2400.00 }
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
                        const avatarEmoji = row.avatarEmoji || AVATAR_EMOJIS[idx % AVATAR_EMOJIS.length]
                        const isUserRow = Boolean(row.isUser)

                        return (
                            <div
                                key={row.id || row.userId || idx}
                                className={`aviator-table-row ${isCashed ? 'row-cashed' : ''} ${isUserRow ? 'row-user' : ''}`}
                            >
                                <div className="col-player">
                                    <span className={`player-avatar-circle ${isUserRow ? 'user-avatar' : ''}`}>
                                        {isUserRow ? '👑' : avatarEmoji}
                                    </span>
                                    <span className="player-name-text">
                                        {isUserRow ? (
                                            <span className="user-badge-tag">You</span>
                                        ) : (
                                            maskUsername(row.username || row.name)
                                        )}
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
                    persistedUserHistory.length === 0 ? (
                        <div className="aviator-empty-table">No previous bets recorded. Place a bet to see your history!</div>
                    ) : (
                        persistedUserHistory.map((rec, idx) => {
                            const isWin = (rec.profit !== undefined ? rec.profit >= 0 : Boolean(rec.cashedOutAt))
                            const betAmt = parseFloat(rec.betAmount || rec.bet || rec.amount || 25)
                            const mult = parseFloat(rec.cashedOutAt || rec.multiplier || 1.0)
                            const profitVal = rec.profit !== undefined ? rec.profit : (isWin ? (betAmt * mult - betAmt) : -betAmt)

                            return (
                                <div key={rec.id || idx} className={`aviator-table-row ${isWin ? 'row-cashed' : ''}`}>
                                    <div className="col-player">
                                        <span className="player-avatar-circle">👤</span>
                                        <span className="player-name-text">You</span>
                                    </div>
                                    <div className="col-bet">
                                        {betAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div className="col-mult">
                                        <span className={`mult-pill-badge ${isWin ? '' : 'loss'}`}>
                                            {mult.toFixed(2)}x
                                        </span>
                                    </div>
                                    <div className="col-win">
                                        <span className={isWin ? 'win-text' : 'loss-text'}>
                                            {isWin ? `+₹${Math.abs(profitVal).toFixed(2)}` : `-₹${Math.abs(profitVal).toFixed(2)}`}
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
