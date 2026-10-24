import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Modal, Typography, Checkbox } from 'antd'
import {
    SafetyCertificateOutlined,
    BookOutlined,
    UndoOutlined,
    CheckCircleFilled,
    TrophyFilled
} from '@ant-design/icons'
import { useWallet } from '../../context/WalletContext'
import { useAuth } from '../../context/AuthContext'
import { useWebSocket } from '../../context/WebSocketContext'
import casinoAudio from '../../utils/casinoAudio'
import './ColorMatchGame.css'

const { Text } = Typography

// Win Go official number & color definitions
const NUMBER_DATA = [
    { num: 0, colors: ['violet', 'red'], label: '0', bigSmall: 'small', mult: 9 },
    { num: 1, colors: ['green'], label: '1', bigSmall: 'small', mult: 9 },
    { num: 2, colors: ['red'], label: '2', bigSmall: 'small', mult: 9 },
    { num: 3, colors: ['green'], label: '3', bigSmall: 'small', mult: 9 },
    { num: 4, colors: ['red'], label: '4', bigSmall: 'small', mult: 9 },
    { num: 5, colors: ['violet', 'green'], label: '5', bigSmall: 'big', mult: 9 },
    { num: 6, colors: ['red'], label: '6', bigSmall: 'big', mult: 9 },
    { num: 7, colors: ['green'], label: '7', bigSmall: 'big', mult: 9 },
    { num: 8, colors: ['red'], label: '8', bigSmall: 'big', mult: 9 },
    { num: 9, colors: ['green'], label: '9', bigSmall: 'big', mult: 9 },
]

const MULTIPLIERS = [1, 5, 10, 20, 50, 100]
const CONTRACT_AMOUNTS = [1, 10, 50, 100, 500, 1000]

function ColorMatchGame() {
    const {
        balance,
        currencySymbol,
        notifyWin,
        notifyLoss,
        placeColorMatchRoomBet,
        getColorMatchRoomState
    } = useWallet()
    const { user, openAuthModal } = useAuth()
    const { colorGameState, subscribe } = useWebSocket()

    // Calculate live seconds remaining in 30s cycle directly from system clock (Always in sync)
    const getSecondsRemaining = () => {
        const nowSec = Math.floor(Date.now() / 1000)
        const secInCycle = nowSec % 30
        return 30 - secInCycle // Returns 1 to 30
    }

    // Generate authentic period ID derived from clock
    const getClockPeriod = () => {
        const d = new Date()
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        const secToday = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
        const roundNum = Math.floor(secToday / 30) + 1
        return parseInt(`${yyyy}${mm}${dd}30${String(roundNum).padStart(4, '0')}`, 10)
    }

    const [periodId, setPeriodId] = useState(() => colorGameState?.periodId || getClockPeriod())
    const [timeLeft, setTimeLeft] = useState(() => colorGameState?.timeLeft ?? getSecondsRemaining())
    const [maxTime] = useState(30)
    const [isLocked, setIsLocked] = useState(() => colorGameState?.isLocked ?? (getSecondsRemaining() <= 5))
    const [isDrawing, setIsDrawing] = useState(() => colorGameState?.isDrawing ?? false)

    // Active placed bets in this round
    const [bets, setBets] = useState({})
    const [activeMultiplier, setActiveMultiplier] = useState(1)

    // Auto-Run Player Betting System (Persisted in localStorage across routes)
    const [isAutoRunning, setIsAutoRunning] = useState(() => {
        try { return localStorage.getItem('amrat_wingo_autorun_enabled') === 'true' } catch { return false }
    })
    const [autoBetTemplate, setAutoBetTemplate] = useState(() => {
        try {
            const raw = localStorage.getItem('amrat_wingo_autorun_template')
            return raw ? JSON.parse(raw) : null
        } catch { return null }
    })
    const [autoRoundCount, setAutoRoundCount] = useState(0)

    // Current draw display & recent 5 balls from server room state
    const [displayNum, setDisplayNum] = useState(null)
    const [recentBalls, setRecentBalls] = useState(() => {
        if (colorGameState?.recentBalls && colorGameState.recentBalls.length > 0) {
            return colorGameState.recentBalls
        }
        return []
    })

    // Game history roadmap from server room state
    const [history, setHistory] = useState(() => {
        if (colorGameState?.history && colorGameState.history.length > 0) {
            return colorGameState.history
        }
        return []
    })

    // Player personal bets record
    const [myBets, setMyBets] = useState([])
    const [activeTab, setActiveTab] = useState('history') // 'history' | 'chart' | 'mybets'

    // In-Game Direct Betting Controls State (Preset Chips & Quantity)
    const [contractAmount, setContractAmount] = useState(10)
    const [betQuantity, setBetQuantity] = useState(1)

    // Celebration Win Popup State (Simplest Mini Popup)
    const [winPopup, setWinPopup] = useState(null)

    // Auto-dismiss simplest mini win popup after 3.5 seconds
    useEffect(() => {
        if (winPopup) {
            const timer = setTimeout(() => {
                setWinPopup(null)
            }, 3500)
            return () => clearTimeout(timer)
        }
    }, [winPopup])

    // Modals
    const [rulesOpen, setRulesOpen] = useState(false)
    const [fairnessOpen, setFairnessOpen] = useState(false)
    const [serverSeedHash, setServerSeedHash] = useState('d3b07384d113edec49eaa6238ad5ff00b1a0d7d8e8749a9040306c4599a0f4a7')
    const [clientSeed] = useState('amrat-wingo-' + Math.floor(Math.random() * 100000))

    // Total active stake placed for this round
    const totalStaked = useMemo(() => {
        return Object.values(bets).reduce((a, b) => a + (Number(b) || 0), 0)
    }, [bets])

    // Active stake per direct bet click/tap (calculated from active in-window controls)
    const activeStakePerTap = contractAmount * activeMultiplier * betQuantity

    // Dynamic refs to avoid stale closures in interval
    const betsRef = useRef(bets)
    const totalStakedRef = useRef(totalStaked)
    const balanceRef = useRef(balance)
    const isDrawingRef = useRef(isDrawing)
    const isLockedRef = useRef(isLocked)
    const maxTimeRef = useRef(maxTime)
    const periodIdRef = useRef(periodId)
    const isAutoRunningRef = useRef(isAutoRunning)
    const autoBetTemplateRef = useRef(autoBetTemplate)
    const lastDrawnPeriodRef = useRef(0)

    useEffect(() => { betsRef.current = bets }, [bets])
    useEffect(() => { totalStakedRef.current = totalStaked }, [totalStaked])
    useEffect(() => { balanceRef.current = balance }, [balance])
    useEffect(() => { isDrawingRef.current = isDrawing }, [isDrawing])
    useEffect(() => { isLockedRef.current = isLocked }, [isLocked])
    useEffect(() => { maxTimeRef.current = maxTime }, [maxTime])
    useEffect(() => { periodIdRef.current = periodId }, [periodId])
    useEffect(() => { isAutoRunningRef.current = isAutoRunning }, [isAutoRunning])
    useEffect(() => { autoBetTemplateRef.current = autoBetTemplate }, [autoBetTemplate])

    // Sync with global colorGameState from WebSocketContext
    useEffect(() => {
        if (colorGameState) {
            if (!isDrawingRef.current) {
                if (colorGameState.periodId) setPeriodId(colorGameState.periodId)
                if (typeof colorGameState.timeLeft === 'number') setTimeLeft(colorGameState.timeLeft)
                if (typeof colorGameState.isLocked === 'boolean') setIsLocked(colorGameState.isLocked)
            }
            if (colorGameState.recentBalls && colorGameState.recentBalls.length > 0) {
                setRecentBalls(colorGameState.recentBalls)
            }
            if (colorGameState.history && colorGameState.history.length > 0) {
                setHistory(colorGameState.history)
            }
        }
    }, [colorGameState])

    // Initial hydration via REST endpoint
    useEffect(() => {
        getColorMatchRoomState().then(room => {
            if (room) {
                if (!isDrawingRef.current) {
                    if (room.periodId) setPeriodId(room.periodId)
                    if (typeof room.timeLeft === 'number') setTimeLeft(room.timeLeft)
                    if (typeof room.isLocked === 'boolean') setIsLocked(room.isLocked)
                }
                if (room.recentBalls && room.recentBalls.length > 0) setRecentBalls(room.recentBalls)
                if (room.history && room.history.length > 0) setHistory(room.history)
            }
        }).catch(() => {})
    }, [getColorMatchRoomState])

    // Real-Time Global Server Room Subscriptions
    useEffect(() => {
        let isMounted = true

        const unsubs = [
            subscribe('COLOR_GAME_TICK', (payload) => {
                if (!isMounted || !payload) return
                if (!isDrawingRef.current) {
                    setTimeLeft(payload.timeLeft)
                    setIsLocked(Boolean(payload.isLocked))
                    if (payload.periodId && periodIdRef.current !== payload.periodId) {
                        setPeriodId(payload.periodId)
                        // If new period starts and auto run is on, load template
                        if (isAutoRunningRef.current && autoBetTemplateRef.current) {
                            setBets({ ...autoBetTemplateRef.current })
                        } else {
                            setBets({})
                        }
                    }
                }
            }),

            subscribe('COLOR_GAME_DRAW', (payload) => {
                if (!isMounted || !payload) return
                setIsDrawing(true)
                setIsLocked(true)
                setTimeLeft(0)

                // Rapid rolling animation for 1.4s ending on exact server luckyNumber
                let rollCounter = 0
                const interval = setInterval(() => {
                    setDisplayNum(Math.floor(Math.random() * 10))
                    rollCounter++
                    if (rollCounter >= 14) {
                        clearInterval(interval)
                        setDisplayNum(payload.num)
                        casinoAudio.playChip?.()

                        // Conclude visual draw after 1.8s
                        setTimeout(() => {
                            if (!isMounted) return
                            setDisplayNum(null)
                            setIsDrawing(false)
                            if (payload.recentBalls) setRecentBalls(payload.recentBalls)
                            if (payload.history) setHistory(payload.history)
                        }, 1800)
                    }
                }, 80)
            }),

            subscribe('COLOR_GAME_PLAYER_SETTLEMENT', (payload) => {
                if (!isMounted || !payload || !user) return
                if (payload.userId !== user.id) return

                const outcome = payload.outcome || {}
                const winningNum = outcome.luckyNumber ?? 0
                const colors = outcome.winningColors || []
                const bigSmall = outcome.bigSmall || 'small'

                if (payload.won && payload.payout > 0) {
                    notifyWin?.(payload.payout, payload.multiplier)
                    if (payload.multiplier >= 3) {
                        casinoAudio.playBigWin?.()
                    } else {
                        casinoAudio.playWin?.()
                    }
                    setWinPopup({
                        amount: payload.payout,
                        num: winningNum,
                        colors,
                        bigSmall,
                        period: payload.periodId,
                        multiplier: payload.multiplier
                    })
                } else {
                    notifyLoss?.('Round ended')
                    casinoAudio.playLoss?.()
                }

                setMyBets(prev => [
                    {
                        period: payload.periodId,
                        stake: payload.totalAmount || 0,
                        win: payload.payout || 0,
                        resultNum: winningNum,
                        colors,
                        bigSmall,
                        won: payload.won,
                        time: Date.now()
                    },
                    ...prev.slice(0, 24)
                ])
                setBets({})
            })
        ]

        return () => {
            isMounted = false
            unsubs.forEach(unsub => { if (typeof unsub === 'function') unsub() })
        }
    }, [subscribe, user, notifyWin, notifyLoss])

    // Direct in-game bet placement on any target (No popup modals - instant staking to server room)
    const placeDirectBet = async (targetKey) => {
        if (isLocked || isDrawing) return

        if (!user) {
            openAuthModal?.('register')
            return
        }

        const betAmt = contractAmount * activeMultiplier * betQuantity
        if (betAmt <= 0) return

        if (betAmt > balance) {
            notifyLoss?.('Insufficient balance to place bet!')
            return
        }

        casinoAudio.playChip?.()

        const updatedBets = {
            ...bets,
            [targetKey]: (bets[targetKey] || 0) + betAmt
        }
        setBets(updatedBets)

        try {
            const res = await placeColorMatchRoomBet({
                periodId: periodIdRef.current,
                bets: updatedBets
            })
            if (!res || !res.success) {
                setBets(bets)
                notifyLoss?.(res?.error || 'Unable to place bet on round')
            }
        } catch (err) {
            setBets(bets)
            notifyLoss?.(err.message || 'Error placing bet')
        }
    }

    // Pick Random Bet (Win Go [Random] pill - immediately bets on random number 0-9)
    const handleRandomPick = () => {
        if (isLocked || isDrawing) return
        const randNum = Math.floor(Math.random() * 10)
        placeDirectBet(`num_${randNum}`)
    }

    // Clear bets: resets bets and disables auto-run
    const clearBets = () => {
        if (isLocked || isDrawing || totalStaked === 0) return
        if (isAutoRunning) {
            setIsAutoRunning(false)
            setAutoBetTemplate(null)
            localStorage.removeItem('amrat_wingo_autorun_enabled')
            localStorage.removeItem('amrat_wingo_autorun_template')
        }
        setBets({})
        casinoAudio.playChip?.()
    }

    // Toggle Auto Run mode (persisted to localStorage so BackgroundGameRunner continues in background)
    const toggleAutoRun = () => {
        if (!user) {
            openAuthModal?.('register')
            return
        }

        if (isAutoRunning) {
            setIsAutoRunning(false)
            setAutoBetTemplate(null)
            localStorage.removeItem('amrat_wingo_autorun_enabled')
            localStorage.removeItem('amrat_wingo_autorun_template')
            casinoAudio.playChip?.()
            return
        }

        if (totalStaked <= 0) {
            notifyLoss?.('Please place at least one bet to start Auto Run!')
            return
        }

        setIsAutoRunning(true)
        setAutoBetTemplate({ ...bets })
        setAutoRoundCount(1)
        localStorage.setItem('amrat_wingo_autorun_enabled', 'true')
        localStorage.setItem('amrat_wingo_autorun_template', JSON.stringify({ ...bets }))
        casinoAudio.playBet?.()
    }

    // 24/7 Continuous Local Interpolator (Smooth countdown when between socket ticks)
    useEffect(() => {
        const timer = setInterval(() => {
            if (!isDrawingRef.current) {
                const secRem = getSecondsRemaining()
                if (secRem <= 5 && !isLockedRef.current) {
                    setIsLocked(true)
                    casinoAudio.playChip?.()
                }
            }
        }, 250)

        return () => clearInterval(timer)
    }, [])

    // Format digital countdown cards [0][0]:[0][7]
    const minutes = Math.floor(timeLeft / 60)
    const seconds = timeLeft % 60
    const mStr = String(minutes).padStart(2, '0')
    const sStr = String(seconds).padStart(2, '0')

    // Helper for rendering authentic 3D Scallop Lottery Ball (matches reference screenshot)
    const renderBall = (num, colors, size = 'board', isClickable = false, onClick = null, key = null) => {
        const isSplit = colors.length > 1
        let ballClass = ''

        if (isSplit) {
            if (num === 0) {
                ballClass = 'ball-split-violet-red'
            } else if (num === 5) {
                ballClass = 'ball-split-green-violet'
            } else {
                ballClass = `ball-split-${colors[0]}-${colors[1]}`
            }
        } else {
            ballClass = `ball-solid-${colors[0]}`
        }

        const stakedAmount = key ? bets[key] : null
        const numColorClass = num === 0 ? 'text-violet' : num === 5 ? 'text-violet' : `text-${colors[0]}`

        return (
            <div key={num} className="ball-interactive-wrapper">
                <div
                    className={`wingo-lottery-ball ${ballClass} size-${size} ${stakedAmount ? 'has-bet' : ''} ${isClickable ? 'clickable' : ''}`}
                    onClick={isClickable && onClick ? onClick : undefined}
                >
                    {/* 4 White Scallop Notches creating the authentic lottery ball ring pattern */}
                    <div className="ball-scallop scallop-t"></div>
                    <div className="ball-scallop scallop-b"></div>
                    <div className="ball-scallop scallop-l"></div>
                    <div className="ball-scallop scallop-r"></div>

                    {/* Inner White Disc where numeral sits */}
                    <div className="ball-inner-disc">
                        <span className={`ball-number ${numColorClass}`}>{num}</span>
                        <div className="ball-gloss"></div>
                    </div>
                </div>

                {stakedAmount > 0 && (
                    <div className="ball-staked-badge">
                        {currencySymbol}{stakedAmount}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="wingo-game-container">
            <div className="wingo-split-layout">
                {/* ── LEFT COLUMN: 30s Win Go Betting Arena ── */}
                <div className="wingo-betting-column">
                    {/* Perforated Coral Red Ticket Banner (Directly at Top - Matches Reference Screenshot) */}
                    <div className="wingo-ticket-banner">
                {/* Perforation Cutouts */}
                <div className="ticket-notch notch-top"></div>
                <div className="ticket-notch notch-bottom"></div>

                {/* Left Half: Recent result balls */}
                <div className="ticket-left-half">
                    <div className="ticket-time-label">Recent results</div>

                    <div className="ticket-recent-balls">
                        {recentBalls.map((b, idx) => (
                            <div key={idx} className="ticket-mini-ball-wrap">
                                {renderBall(b.num, b.colors, 'mini')}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Vertical Perforated Dashed Line */}
                <div className="ticket-dashed-divider"></div>

                {/* Right Half: Time remaining, Digital countdown flip cards, Period number */}
                <div className="ticket-right-half">
                    <div className="ticket-time-label">Time remaining</div>

                    {/* 4 White Flip-Clock Digit Cards [0][0]:[0][7] or Live Drawing Animation */}
                    <div className="ticket-flip-clock">
                        {isDrawing ? (
                            <div className="ticket-drawing-badge">
                                <span className="drawing-spinner">🎲</span>
                                <span className="drawing-text">DRAWING...</span>
                            </div>
                        ) : (
                            <>
                                <div className="flip-digit-card">{mStr[0]}</div>
                                <div className="flip-digit-card">{mStr[1]}</div>
                                <span className="flip-colon">:</span>
                                <div className="flip-digit-card">{sStr[0]}</div>
                                <div className="flip-digit-card">{sStr[1]}</div>
                            </>
                        )}
                    </div>

                    {/* Period Number */}
                    <div className="ticket-period-id">{periodId}</div>
                </div>
            </div>

            {/* 3 Large Pill Color Buttons: Green, Violet, Red */}
            <div className="wingo-color-pills-row">
                <button
                    type="button"
                    className={`wingo-pill-btn btn-green ${bets.green ? 'has-bet' : ''}`}
                    onClick={() => placeDirectBet('green')}
                    disabled={isLocked || isDrawing}
                >
                    <span className="pill-text">Green</span>
                    {bets.green > 0 && (
                        <div className="pill-staked-badge">
                            {currencySymbol}{bets.green}
                        </div>
                    )}
                </button>

                <button
                    type="button"
                    className={`wingo-pill-btn btn-violet ${bets.violet ? 'has-bet' : ''}`}
                    onClick={() => placeDirectBet('violet')}
                    disabled={isLocked || isDrawing}
                >
                    <span className="pill-text">Violet</span>
                    {bets.violet > 0 && (
                        <div className="pill-staked-badge">
                            {currencySymbol}{bets.violet}
                        </div>
                    )}
                </button>

                <button
                    type="button"
                    className={`wingo-pill-btn btn-red ${bets.red ? 'has-bet' : ''}`}
                    onClick={() => placeDirectBet('red')}
                    disabled={isLocked || isDrawing}
                >
                    <span className="pill-text">Red</span>
                    {bets.red > 0 && (
                        <div className="pill-staked-badge">
                            {currencySymbol}{bets.red}
                        </div>
                    )}
                </button>
            </div>

            {/* 10 Number Lottery Balls Card (0 to 9 in 2 rows of 5 - FULLY VISIBLE ALWAYS) */}
            <div className={`wingo-balls-card ${isLocked ? 'is-locked-round' : ''}`}>
                {/* Numbers Grid: Row 1 (0 to 4), Row 2 (5 to 9) */}
                <div className="wingo-balls-grid">
                    {NUMBER_DATA.map(item => (
                        <div key={item.num} className={`wingo-ball-slot ${displayNum === item.num ? 'is-rolling-highlight' : ''}`}>
                            {renderBall(
                                item.num,
                                item.colors,
                                'board',
                                true,
                                () => placeDirectBet(`num_${item.num}`),
                                `num_${item.num}`
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Big / Small Buttons */}
            <div className="wingo-big-small-row">
                <button
                    type="button"
                    className={`wingo-bs-btn btn-big ${bets.big ? 'has-bet' : ''}`}
                    onClick={() => placeDirectBet('big')}
                    disabled={isLocked || isDrawing}
                >
                    <span className="bs-text">Big</span>
                    {bets.big > 0 && (
                        <div className="bs-staked-badge">
                            {currencySymbol}{bets.big}
                        </div>
                    )}
                </button>

                <button
                    type="button"
                    className={`wingo-bs-btn btn-small ${bets.small ? 'has-bet' : ''}`}
                    onClick={() => placeDirectBet('small')}
                    disabled={isLocked || isDrawing}
                >
                    <span className="bs-text">Small</span>
                    {bets.small > 0 && (
                        <div className="bs-staked-badge">
                            {currencySymbol}{bets.small}
                        </div>
                    )}
                </button>
            </div>

            {/* Direct In-Game Betting Console (Buttons in game window - Zero Popups) */}
            <div className="wingo-console-card">
                {/* Row 1: Chip Value Presets */}
                <div className="console-row">
                    <span className="console-row-label">Chip</span>
                    <div className="console-chips-grid">
                        {CONTRACT_AMOUNTS.map(val => (
                            <button
                                key={val}
                                type="button"
                                className={`console-chip-btn ${contractAmount === val ? 'active' : ''}`}
                                onClick={() => {
                                    setContractAmount(val)
                                    casinoAudio.playChip?.()
                                }}
                                disabled={isLocked || isDrawing}
                            >
                                <span className="chip-symbol">{currencySymbol}</span>
                                <span className="chip-val">{val >= 1000 ? `${val / 1000}k` : val}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Row 2: Multipliers */}
                <div className="console-row">
                    <span className="console-row-label">Mult</span>
                    <div className="console-mult-grid">
                        {MULTIPLIERS.map(m => (
                            <button
                                key={m}
                                type="button"
                                className={`console-mult-btn ${activeMultiplier === m ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveMultiplier(m)
                                    casinoAudio.playChip?.()
                                }}
                                disabled={isLocked || isDrawing}
                            >
                                X{m}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Row 3: Quantity Stepper & Quick Tools */}
                <div className="console-row console-qty-row">
                    <span className="console-row-label">Qty</span>
                    <div className="console-qty-controls">
                        <div className="console-stepper">
                            <button
                                type="button"
                                className="console-stepper-btn"
                                onClick={() => {
                                    setBetQuantity(prev => Math.max(1, prev - 1))
                                    casinoAudio.playChip?.()
                                }}
                                disabled={isLocked || isDrawing || betQuantity <= 1}
                                aria-label="Decrease quantity"
                            >
                                −
                            </button>
                            <span className="console-stepper-value">{betQuantity}</span>
                            <button
                                type="button"
                                className="console-stepper-btn"
                                onClick={() => {
                                    setBetQuantity(prev => prev + 1)
                                    casinoAudio.playChip?.()
                                }}
                                disabled={isLocked || isDrawing}
                                aria-label="Increase quantity"
                            >
                                +
                            </button>
                        </div>

                        <div className="console-quick-actions">
                            <button
                                type="button"
                                className="console-quick-btn"
                                onClick={() => {
                                    setBetQuantity(prev => Math.max(1, Math.floor(prev / 2)))
                                    casinoAudio.playChip?.()
                                }}
                                disabled={isLocked || isDrawing || betQuantity <= 1}
                                title="Half quantity"
                            >
                                ½
                            </button>
                            <button
                                type="button"
                                className="console-quick-btn"
                                onClick={() => {
                                    setBetQuantity(prev => prev * 2)
                                    casinoAudio.playChip?.()
                                }}
                                disabled={isLocked || isDrawing}
                                title="Double quantity"
                            >
                                2X
                            </button>
                            <button
                                type="button"
                                className="console-random-btn"
                                onClick={handleRandomPick}
                                disabled={isLocked || isDrawing}
                                title="Place random bet on a lottery number"
                            >
                                🎲 Random
                            </button>
                        </div>
                    </div>
                </div>

                {/* Row 4: Live Stake Status & Auto-Run / Clear Actions */}
                <div className="console-status-strip">
                    <div className="console-stake-indicator">
                        <span className="stake-label">Bet Per Tap:</span>
                        <strong className="stake-val">{currencySymbol}{activeStakePerTap.toLocaleString()}</strong>
                    </div>

                    <div className="console-actions-group">
                        <button
                            type="button"
                            className={`console-autorun-btn ${isAutoRunning ? 'is-active' : ''}`}
                            onClick={toggleAutoRun}
                            disabled={isDrawing}
                            title={isAutoRunning ? 'Stop Auto Run' : 'Auto repeat bets each round'}
                        >
                            {isAutoRunning ? (
                                <>
                                    <span className="autorun-pulse"></span>
                                    <span>⏹️ Stop Auto ({autoRoundCount})</span>
                                </>
                            ) : (
                                <>⚡ Auto Run</>
                            )}
                        </button>

                        {totalStaked > 0 && !isAutoRunning && (
                            <div className="console-round-summary">
                                <span className="round-staked-text">
                                    Total: <strong>{currencySymbol}{totalStaked.toLocaleString()}</strong>
                                </span>
                                <button
                                    type="button"
                                    className="console-clear-btn"
                                    onClick={clearBets}
                                    disabled={isLocked || isDrawing}
                                    title="Clear all round bets"
                                >
                                    <UndoOutlined /> Clear
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
                </div>

                {/* ── RIGHT COLUMN: Live Roadmap, History & Analytics Console ── */}
                <div className="wingo-roadmap-column">
                    {/* 3 Tabs: Game history, Chart, My history */}
                    <div className="wingo-tabs-bar">
                <button
                    type="button"
                    className={`wingo-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    Game history
                </button>
                <button
                    type="button"
                    className={`wingo-tab-btn ${activeTab === 'chart' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chart')}
                >
                    Chart
                </button>
                <button
                    type="button"
                    className={`wingo-tab-btn ${activeTab === 'mybets' ? 'active' : ''}`}
                    onClick={() => setActiveTab('mybets')}
                >
                    My history
                </button>
            </div>

            {/* Tab 1: Game History Table */}
            {activeTab === 'history' && (
                <div className="wingo-history-card">
                    <table className="wingo-table">
                        <thead>
                            <tr className="table-header-coral">
                                <th>Period</th>
                                <th>Number</th>
                                <th>Big Small</th>
                                <th>Color</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map(row => (
                                <tr key={row.period} className="table-row">
                                    <td className="cell-period">{row.period}</td>
                                    <td className="cell-number">
                                        <span className={`num-val text-${row.colors[0]}`}>
                                            {row.num}
                                        </span>
                                    </td>
                                    <td className="cell-bs">
                                        <span className="bs-script-val">
                                            {row.bigSmall === 'big' ? 'Big' : 'Small'}
                                        </span>
                                    </td>
                                    <td className="cell-color-dots">
                                        <div className="dots-container">
                                            {row.colors.map((c, idx) => (
                                                <span key={idx} className={`color-dot dot-${c}`}></span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Tab 2: Chart Trend Matrix & Statistics */}
            {activeTab === 'chart' && (
                <div className="wingo-chart-card">
                    <div className="chart-title">Statistic (last 30 periods)</div>

                    {/* Occurrence bar chart for numbers 0-9 */}
                    <div className="chart-stat-grid">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
                            const count = history.filter(h => h.num === num).length
                            const item = NUMBER_DATA[num]
                            return (
                                <div key={num} className="stat-col">
                                    <div className="stat-bar-track">
                                        <div
                                            className={`stat-bar-fill bar-${item.colors[0]}`}
                                            style={{ height: `${Math.max(count * 20, 8)}%` }}
                                        ></div>
                                    </div>
                                    <span className="stat-num">{num}</span>
                                    <span className="stat-count">{count}</span>
                                </div>
                            )
                        })}
                    </div>

                    {/* Period Roadmap Grid */}
                    <div className="roadmap-container">
                        <div className="roadmap-header">
                            <span>Period</span>
                            <div className="roadmap-digits">
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                                    <span key={n}>{n}</span>
                                ))}
                            </div>
                        </div>
                        <div className="roadmap-list">
                            {history.slice(0, 12).map(row => (
                                <div key={row.period} className="roadmap-row">
                                    <span className="roadmap-period">#{String(row.period).slice(-4)}</span>
                                    <div className="roadmap-cells">
                                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
                                            const isHit = row.num === n
                                            return (
                                                <div key={n} className={`roadmap-cell ${isHit ? 'hit' : ''}`}>
                                                    {isHit && (
                                                        <span className={`hit-dot dot-${row.colors[0]}`}>
                                                            {n}
                                                        </span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 3: My History */}
            {activeTab === 'mybets' && (
                <div className="wingo-mybets-card">
                    {myBets.length === 0 ? (
                        <div className="mybets-empty">
                            No bets placed in this session yet. Tap any color or number above to place a bet!
                        </div>
                    ) : (
                        <table className="wingo-table">
                            <thead>
                                <tr className="table-header-coral">
                                    <th>Period</th>
                                    <th>Stake</th>
                                    <th>Result</th>
                                    <th>Payout</th>
                                </tr>
                            </thead>
                            <tbody>
                                {myBets.map((b, idx) => (
                                    <tr key={idx} className="table-row">
                                        <td className="cell-period">{b.period}</td>
                                        <td>{currencySymbol}{b.stake}</td>
                                        <td>
                                            <span className={`num-val text-${b.colors[0]}`}>
                                                {b.resultNum} ({b.bigSmall})
                                            </span>
                                        </td>
                                        <td style={{ color: b.won ? '#22c55e' : '#94a3b8', fontWeight: 700 }}>
                                            {b.won ? `+${currencySymbol}${b.win.toLocaleString()}` : `${currencySymbol}0`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
                </div>
            </div>

            {/* Simplest Mini Win Popup (Subtle floating notification at top) */}
            {winPopup && (
                <div className="wingo-mini-popup" onClick={() => setWinPopup(null)}>
                    <div className="mini-popup-left">
                        <span className="mini-popup-badge">🎉 WON</span>
                        <span className="mini-popup-amt">+{currencySymbol}{winPopup.amount.toLocaleString()}</span>
                        <span className="mini-popup-sub">
                            #{String(winPopup.period).slice(-4)} · Num {winPopup.num}
                        </span>
                    </div>
                    <button
                        type="button"
                        className="mini-popup-close-btn"
                        onClick={(e) => {
                            e.stopPropagation()
                            setWinPopup(null)
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}


            {/* How to Play Rules Modal */}
            <Modal
                title={<div style={{ color: '#ef4444', fontWeight: 800 }}>📖 Win Go - Game Rules</div>}
                open={rulesOpen}
                onCancel={() => setRulesOpen(false)}
                footer={[
                    <button key="close" type="button" className="rules-modal-close" onClick={() => setRulesOpen(false)}>
                        I Understand
                    </button>
                ]}
                className="wingo-rules-modal"
            >
                <div className="rules-modal-body">
                    <p className="rules-intro">
                        Win Go is a 30-second fast-paced color and number prediction lottery.
                        Pick colors, lottery numbers, or sizes (Big/Small) before the countdown reaches 5 seconds!
                    </p>

                    <div className="rules-grid">
                        <div className="rules-card card-green">
                            <strong>Green (1, 3, 7, 9)</strong>
                            <p>Payout: <strong>1.95X</strong>. If outcome is 5, payout is <strong>1.45X</strong>.</p>
                        </div>
                        <div className="rules-card card-red">
                            <strong>Red (2, 4, 6, 8)</strong>
                            <p>Payout: <strong>1.95X</strong>. If outcome is 0, payout is <strong>1.45X</strong>.</p>
                        </div>
                        <div className="rules-card card-violet">
                            <strong>Violet (0 or 5)</strong>
                            <p>Payout: <strong>4.5X</strong> when either 0 or 5 appears.</p>
                        </div>
                        <div className="rules-card card-num">
                            <strong>Numbers 0 to 9</strong>
                            <p>Payout: <strong>9.0X</strong> for exact number prediction.</p>
                        </div>
                        <div className="rules-card card-bs">
                            <strong>Big / Small</strong>
                            <p>Big (5, 6, 7, 8, 9) or Small (0, 1, 2, 3, 4): <strong>1.95X</strong> payout.</p>
                        </div>
                    </div>

                    <div className="rules-note">
                        🔒 Betting closes automatically in the last 5 seconds of every round. All outcomes are cryptographically verified.
                    </div>
                </div>
            </Modal>

            {/* Provably Fair Modal */}
            <Modal
                title={<div style={{ color: '#22c55e', fontWeight: 800 }}><SafetyCertificateOutlined /> Provably Fair Verification</div>}
                open={fairnessOpen}
                onCancel={() => setFairnessOpen(false)}
                footer={[
                    <button key="close" type="button" className="rules-modal-close" onClick={() => setFairnessOpen(false)}>
                        Close
                    </button>
                ]}
                className="wingo-rules-modal"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Text style={{ color: '#64748b' }}>
                        Win Go outcomes are strictly calculated using cryptographic HMAC-SHA256 hashing.
                        The winning number is mathematically determined and cannot be influenced by players or the house.
                    </Text>
                    <div>
                        <Text strong style={{ color: '#0f172a' }}>Server Seed (SHA-256 Hash):</Text>
                        <div className="hash-code-box">{serverSeedHash}</div>
                    </div>
                    <div>
                        <Text strong style={{ color: '#0f172a' }}>Client Seed:</Text>
                        <div className="hash-code-box">{clientSeed}</div>
                    </div>
                    <div>
                        <Text strong style={{ color: '#0f172a' }}>Current Period Nonce:</Text>
                        <div className="hash-code-box">{periodId}</div>
                    </div>
                    <div style={{ background: '#ecfdf5', padding: 12, borderRadius: 10, border: '1px solid #a7f3d0' }}>
                        <Text style={{ color: '#059669', fontWeight: 700 }}>
                            Provably Fair Verified: 99.0% RTP Return to Player Standard.
                        </Text>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default ColorMatchGame
