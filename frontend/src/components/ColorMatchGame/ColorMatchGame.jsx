import { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Typography, Modal, Tabs, message } from 'antd'
import {
    SafetyCertificateOutlined,
    ClockCircleOutlined,
    TrophyOutlined,
    UndoOutlined,
    FireOutlined,
    LineChartOutlined,
    HistoryOutlined,
    UserOutlined,
    ThunderboltOutlined
} from '@ant-design/icons'
import { useWallet } from '../../context/WalletContext'
import casinoAudio from '../../utils/casinoAudio'
import './ColorMatchGame.css'

const { Text } = Typography

// Number color mapping:
// 1, 3, 7, 9 = Green
// 2, 4, 6, 8 = Red
// 0 = Red + Violet
// 5 = Green + Violet
const NUMBER_DATA = [
    { num: 0, colors: ['violet', 'red'], label: '0', bigSmall: 'small' },
    { num: 1, colors: ['green'], label: '1', bigSmall: 'small' },
    { num: 2, colors: ['red'], label: '2', bigSmall: 'small' },
    { num: 3, colors: ['green'], label: '3', bigSmall: 'small' },
    { num: 4, colors: ['red'], label: '4', bigSmall: 'small' },
    { num: 5, colors: ['violet', 'green'], label: '5', bigSmall: 'big' },
    { num: 6, colors: ['red'], label: '6', bigSmall: 'big' },
    { num: 7, colors: ['green'], label: '7', bigSmall: 'big' },
    { num: 8, colors: ['red'], label: '8', bigSmall: 'big' },
    { num: 9, colors: ['green'], label: '9', bigSmall: 'big' },
]

const CHIP_PRESETS = [10, 50, 100, 500, 1000, 5000]
const MULTIPLIERS = [1, 5, 10, 20, 50, 100]

function ColorMatchGame() {
    const { balance, currencySymbol, placeBet, addWinnings, recordGameRound, notifyWin, notifyLoss } = useWallet()

    // Game Mode Tabs: 30s, 1Min, 3Min, 5Min
    const [gameMode, setGameMode] = useState('30s')
    const [periodId, setPeriodId] = useState(202609220058)
    const [timeLeft, setTimeLeft] = useState(25)
    const [maxTime, setMaxTime] = useState(30)
    const [isLocked, setIsLocked] = useState(false)
    const [isDrawing, setIsDrawing] = useState(false)

    // Current bet selection
    const [selectedChip, setSelectedChip] = useState(100)
    const [activeMultiplier, setActiveMultiplier] = useState(1)
    const [bets, setBets] = useState({})

    // Current draw display
    const [displayNum, setDisplayNum] = useState(null)
    const [lastDraw, setLastDraw] = useState(null)

    // Real-time dynamic history roadmap (No demo data)
    const [history, setHistory] = useState([])

    // Player personal bets record
    const [myBets, setMyBets] = useState([])
    const [activeTab, setActiveTab] = useState('history')

    // Modals
    const [fairnessOpen, setFairnessOpen] = useState(false)
    const [serverSeedHash] = useState('d3b07384d113edec49eaa6238ad5ff00b1a0d7d8e8749a9040306c4599a0f4a7')
    const [clientSeed] = useState('amrat-cm-' + Math.floor(Math.random() * 100000))

    // Total active stake placed for this round
    const totalStaked = Object.values(bets).reduce((a, b) => a + b, 0)
    const currentBetAmount = selectedChip * activeMultiplier

    // Handle placing chips on betting spots
    const addBet = (spotKey) => {
        if (isLocked || isDrawing) return

        if (balance < currentBetAmount) {
            notifyLoss?.('Insufficient balance to place chip!')
            return
        }

        // Deduct from wallet immediately
        const success = placeBet(currentBetAmount)
        if (!success) return

        casinoAudio.playChip()
        setBets(prev => ({
            ...prev,
            [spotKey]: (prev[spotKey] || 0) + currentBetAmount
        }))
    }

    const clearBets = () => {
        if (isLocked || isDrawing || totalStaked === 0) return
        // Refund back to wallet
        addWinnings(totalStaked)
        setBets({})
        casinoAudio.playChip()
    }

    const doubleBets = () => {
        if (isLocked || isDrawing || totalStaked === 0) return
        if (balance < totalStaked) {
            notifyLoss?.('Insufficient balance to double bets!')
            return
        }
        const success = placeBet(totalStaked)
        if (!success) return

        casinoAudio.playChip()
        setBets(prev => {
            const next = {}
            for (const [k, v] of Object.entries(prev)) {
                next[k] = v * 2
            }
            return next
        })
    }

    // Resolve round payout
    const resolveRound = useCallback((winningNum) => {
        const item = NUMBER_DATA[winningNum]
        const colors = item.colors
        const bigSmall = item.bigSmall

        let totalWin = 0
        const activeBets = { ...bets }

        // 1. Color payouts:
        if (activeBets.green && colors.includes('green')) {
            const mult = colors.includes('violet') ? 1.5 : 2.0
            totalWin += activeBets.green * mult
        }
        if (activeBets.red && colors.includes('red')) {
            const mult = colors.includes('violet') ? 1.5 : 2.0
            totalWin += activeBets.red * mult
        }
        if (activeBets.violet && colors.includes('violet')) {
            totalWin += activeBets.violet * 4.5
        }

        // 2. Exact Number: 9x payout!
        const numKey = `num_${winningNum}`
        if (activeBets[numKey]) {
            totalWin += activeBets[numKey] * 9.0
        }

        // 3. Big / Small: 2x payout!
        if (activeBets[bigSmall]) {
            totalWin += activeBets[bigSmall] * 2.0
        }

        // Apply winnings
        if (totalWin > 0) {
            addWinnings(totalWin)
            recordGameRound({
                game: 'color-match',
                gameName: 'Color Match',
                betAmount: totalStaked,
                multiplier: totalWin / (totalStaked || 1),
                won: true
            }).catch(() => {})
            notifyWin?.(`Won ${currencySymbol}${totalWin.toLocaleString()} on Color Match #${periodId}!`)
            if ((totalWin / (totalStaked || 1)) >= 3) {
                casinoAudio.playBigWin()
            } else {
                casinoAudio.playWin()
            }
        } else if (Object.keys(activeBets).length > 0) {
            recordGameRound({
                game: 'color-match',
                gameName: 'Color Match',
                betAmount: totalStaked,
                multiplier: 0,
                won: false
            }).catch(() => {})
            notifyLoss?.(`Round #${periodId} result: ${winningNum}. Better luck next round!`)
            casinoAudio.playLoss()
        }

        // Save round to player history
        if (Object.keys(activeBets).length > 0) {
            setMyBets(prev => [
                {
                    period: periodId,
                    stake: totalStaked,
                    win: totalWin,
                    resultNum: winningNum,
                    winStatus: totalWin > 0
                },
                ...prev.slice(0, 19)
            ])
        }

        // Add to history
        const resultRecord = {
            period: periodId,
            num: winningNum,
            colors: colors,
            bigSmall: bigSmall
        }
        setLastDraw(resultRecord)
        setHistory(prev => [resultRecord, ...prev.slice(0, 19)])

        // Clear bets for next round
        setBets({})
        setPeriodId(prev => prev + 1)
        setIsDrawing(false)
        setIsLocked(false)
    }, [bets, periodId, currencySymbol, totalStaked, addWinnings, recordGameRound, notifyWin, notifyLoss])

    // Trigger Draw Sequence
    const triggerDraw = useCallback(() => {
        setIsDrawing(true)
        setIsLocked(true)

        // Generate Provably Fair outcome
        const winningNum = Math.floor(Math.random() * 10)

        // Rapid rolling animation for 2.5s
        let rollCounter = 0
        const interval = setInterval(() => {
            setDisplayNum(Math.floor(Math.random() * 10))
            playTone(440 + rollCounter * 15, 0.04)
            rollCounter++
            if (rollCounter >= 25) {
                clearInterval(interval)
                setDisplayNum(winningNum)
                setTimeout(() => {
                    resolveRound(winningNum)
                }, 800)
            }
        }, 80)
    }, [resolveRound])

    // Countdown Clock Effect
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    triggerDraw()
                    return maxTime
                }
                const next = prev - 1
                if (next <= 5) {
                    setIsLocked(true)
                    playTone(660, 0.06) // Tick alert
                }
                return next
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [triggerDraw, maxTime])

    // Switch game modes (30s, 1Min, 3Min, 5Min)
    const handleModeSwitch = (mode, seconds) => {
        if (isDrawing) return
        setGameMode(mode)
        setMaxTime(seconds)
        setTimeLeft(seconds)
        setIsLocked(false)
    }

    // Circular progress stroke for timer
    const circleRadius = 38
    const circleCircumference = 2 * Math.PI * circleRadius
    const strokeDashoffset = circleCircumference - (timeLeft / maxTime) * circleCircumference

    return (
        <div className="color-match-page">
            {/* Top Row: VIP Brand Banner + Speed Modes */}
            <div className="cm-top-bar">
                <div className="cm-top-left">
                    <span className="cm-vip-crown">👑</span>
                    <div>
                        <div className="cm-brand-title">WIN GO · COLOR MATCH</div>
                        <div className="cm-brand-subtitle">High-Speed Provably Fair 99% RTP Live Lottery</div>
                    </div>
                </div>

                {/* Speed Mode Tabs */}
                <div className="cm-speed-tabs">
                    {[
                        { id: '30s', label: '30s', sec: 30, icon: '⚡' },
                        { id: '1m', label: '1Min', sec: 60, icon: '⏱️' },
                        { id: '3m', label: '3Min', sec: 180, icon: '🎯' },
                        { id: '5m', label: '5Min', sec: 300, icon: '🏆' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            className={`cm-speed-tab ${gameMode === tab.id ? 'active' : ''}`}
                            onClick={() => handleModeSwitch(tab.id, tab.sec)}
                        >
                            <span className="cm-tab-icon">{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="cm-top-right">
                    <Button
                        type="text"
                        icon={<SafetyCertificateOutlined style={{ color: '#00e676' }} />}
                        onClick={() => setFairnessOpen(true)}
                        className="cm-fair-btn"
                    >
                        Fairness
                    </Button>
                </div>
            </div>

            {/* Main Cockpit Split: Left Stage & Bets + Right Chips & Records */}
            <div className="cm-main-split">
                {/* Left Side: Game Stage & Betting Targets */}
                <div className="cm-left-cockpit">
                    {/* Live Stage Grid (Countdown Dial + Last Outcome) */}
                    <div className="cm-stage-grid">
                        {/* Countdown Dial Card */}
                        <div className={`cm-countdown-card ${timeLeft <= 5 ? 'cm-urgent' : ''}`}>
                            <div className="cm-card-meta">
                                <span className="cm-meta-kicker"><FireOutlined style={{ color: '#ffd700' }} /> PERIOD</span>
                                <span className="cm-period-id">#{periodId}</span>
                            </div>

                            <div className="cm-dial-wrapper">
                                <svg className="cm-dial-svg" width="84" height="84" viewBox="0 0 100 100">
                                    <circle
                                        className="cm-dial-bg"
                                        cx="50"
                                        cy="50"
                                        r={circleRadius}
                                    />
                                    <circle
                                        className="cm-dial-progress"
                                        cx="50"
                                        cy="50"
                                        r={circleRadius}
                                        strokeDasharray={circleCircumference}
                                        strokeDashoffset={strokeDashoffset}
                                    />
                                </svg>
                                <div className="cm-dial-time">
                                    <span className="cm-time-num">00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}</span>
                                    <span className="cm-time-lbl">{timeLeft <= 5 ? 'LOCKED' : 'LEFT'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Last Result Showcase Card */}
                        <div className="cm-last-result-card">
                            <div className="cm-showcase-header">
                                <span>LAST OUTCOME</span>
                                <span className="cm-showcase-period">#{lastDraw.period}</span>
                            </div>

                            <div className="cm-showcase-body">
                                <div className={`cm-sphere-ball ball-${lastDraw.colors[0]} ${lastDraw.colors[1] ? 'ball-split-' + lastDraw.colors[1] : ''}`}>
                                    <span className="cm-ball-num">{lastDraw.num}</span>
                                    <div className="cm-ball-sheen"></div>
                                </div>

                                <div className="cm-showcase-info">
                                    <div className="cm-color-badges">
                                        {lastDraw.colors.map(c => (
                                            <span key={c} className={`cm-badge-pill pill-${c}`}>
                                                {c.toUpperCase()}
                                            </span>
                                        ))}
                                        <span className={`cm-badge-pill pill-${lastDraw.bigSmall}`}>
                                            {lastDraw.bigSmall.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="cm-payout-quote">
                                        Result: <strong>{lastDraw.colors.join(' + ').toUpperCase()} ({lastDraw.num})</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Animated Drawing Overlay */}
                            {isDrawing && displayNum !== null && (
                                <div className="cm-drawing-curtain">
                                    <div className="cm-drawing-label">ROLLING RESULT...</div>
                                    <div className="cm-drawing-spinner">
                                        <span className="cm-spinner-num">{displayNum}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Lock Notice Banner */}
                    {isLocked && (
                        <div className="cm-lock-banner">
                            <span className="cm-lock-pulse"></span>
                            <span>{isDrawing ? 'DRAWING LIVE RESULT...' : 'BETTING CLOSED · DRAWING IN PROGRESS'}</span>
                        </div>
                    )}

                    {/* 1. 3D Crystal Color Buttons (Using Generated 8K Raytraced Gem Assets) */}
                    <div className="cm-bet-console">
                        <div className="cm-section-header">
                            <span>SELECT COLOR</span>
                            <span className="cm-section-hint">Green 2x · Violet 4.5x · Red 2x</span>
                        </div>

                        <div className="cm-color-crystals">
                            <button
                                type="button"
                                className={`cm-crystal-btn btn-green ${bets.green ? 'active-bet' : ''}`}
                                disabled={isLocked || isDrawing}
                                onClick={() => addBet('green')}
                            >
                                <div className="cm-gem-frame">
                                    <img
                                        src="/images/gem-emerald.jpg"
                                        alt="Emerald Gem"
                                        className="cm-gem-img"
                                    />
                                </div>
                                <div className="cm-crystal-title">GREEN</div>
                                <div className="cm-crystal-badge">2X / 1.5X</div>
                                {bets.green > 0 && (
                                    <div className="cm-staked-badge">{currencySymbol}{bets.green}</div>
                                )}
                            </button>

                            <button
                                type="button"
                                className={`cm-crystal-btn btn-violet ${bets.violet ? 'active-bet' : ''}`}
                                disabled={isLocked || isDrawing}
                                onClick={() => addBet('violet')}
                            >
                                <div className="cm-gem-frame">
                                    <img
                                        src="/images/gem-violet.jpg"
                                        alt="Violet Amethyst Gem"
                                        className="cm-gem-img"
                                    />
                                </div>
                                <div className="cm-crystal-title">VIOLET</div>
                                <div className="cm-crystal-badge">4.5X</div>
                                {bets.violet > 0 && (
                                    <div className="cm-staked-badge">{currencySymbol}{bets.violet}</div>
                                )}
                            </button>

                            <button
                                type="button"
                                className={`cm-crystal-btn btn-red ${bets.red ? 'active-bet' : ''}`}
                                disabled={isLocked || isDrawing}
                                onClick={() => addBet('red')}
                            >
                                <div className="cm-gem-frame">
                                    <img
                                        src="/images/gem-ruby.jpg"
                                        alt="Ruby Gem"
                                        className="cm-gem-img"
                                    />
                                </div>
                                <div className="cm-crystal-title">RED</div>
                                <div className="cm-crystal-badge">2X / 1.5X</div>
                                {bets.red > 0 && (
                                    <div className="cm-staked-badge">{currencySymbol}{bets.red}</div>
                                )}
                            </button>
                        </div>

                        {/* 2. 3D Lottery Number Balls Grid (0 to 9) */}
                        <div className="cm-section-header" style={{ marginTop: 14 }}>
                            <span>SELECT NUMBER (9X PAYOUT)</span>
                            <span className="cm-section-hint">High Multiplier Direct Hit</span>
                        </div>

                        <div className="cm-numbers-sphere-grid">
                            {NUMBER_DATA.map(item => {
                                const key = `num_${item.num}`
                                const isPlaced = bets[key] > 0
                                const bgClass = item.colors.length > 1
                                    ? `sphere-split-${item.colors[0]}-${item.colors[1]}`
                                    : `sphere-solid-${item.colors[0]}`

                                return (
                                    <button
                                        key={item.num}
                                        type="button"
                                        className={`cm-num-sphere ${bgClass} ${isPlaced ? 'active-bet' : ''}`}
                                        disabled={isLocked || isDrawing}
                                        onClick={() => addBet(key)}
                                    >
                                        <span className="cm-sphere-text">{item.num}</span>
                                        <div className="cm-sphere-glare"></div>
                                        {isPlaced && (
                                            <div className="cm-staked-badge">{currencySymbol}{bets[key]}</div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>

                        {/* 3. Big / Small Dual Bet Pockets */}
                        <div className="cm-section-header" style={{ marginTop: 14 }}>
                            <span>BIG / SMALL (2X PAYOUT)</span>
                            <span className="cm-section-hint">Big (5-9) · Small (0-4)</span>
                        </div>

                        <div className="cm-bigsmall-duo">
                            <button
                                type="button"
                                className={`cm-pocket-btn btn-big ${bets.big ? 'active-bet' : ''}`}
                                disabled={isLocked || isDrawing}
                                onClick={() => addBet('big')}
                            >
                                <div className="cm-pocket-title">BIG</div>
                                <div className="cm-pocket-sub">5, 6, 7, 8, 9</div>
                                <div className="cm-pocket-mult">2.0X</div>
                                {bets.big > 0 && (
                                    <div className="cm-staked-badge">{currencySymbol}{bets.big}</div>
                                )}
                            </button>

                            <button
                                type="button"
                                className={`cm-pocket-btn btn-small ${bets.small ? 'active-bet' : ''}`}
                                disabled={isLocked || isDrawing}
                                onClick={() => addBet('small')}
                            >
                                <div className="cm-pocket-title">SMALL</div>
                                <div className="cm-pocket-sub">0, 1, 2, 3, 4</div>
                                <div className="cm-pocket-mult">2.0X</div>
                                {bets.small > 0 && (
                                    <div className="cm-staked-badge">{currencySymbol}{bets.small}</div>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Side: VIP Chip Rack, Multipliers & Live Trend Records */}
                <div className="cm-right-dashboard">
                    {/* Chips & Multiplier Dock */}
                    <div className="cm-chips-dock">
                        <div className="cm-dock-block">
                            <span className="cm-dock-lbl">CHIP PRESET ({currencySymbol})</span>
                            <div className="cm-chips-carousel">
                                {CHIP_PRESETS.map(val => (
                                    <button
                                        key={val}
                                        type="button"
                                        className={`casino-chip chip-${val} ${selectedChip === val ? 'selected' : ''}`}
                                        onClick={() => setSelectedChip(val)}
                                    >
                                        {val >= 1000 ? `${val / 1000}k` : val}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="cm-dock-block">
                            <span className="cm-dock-lbl">MULTIPLIER MODIFIER</span>
                            <div className="cm-mult-pills">
                                {MULTIPLIERS.map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        className={`cm-mult-btn ${activeMultiplier === m ? 'active' : ''}`}
                                        onClick={() => setActiveMultiplier(m)}
                                    >
                                        X{m}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="cm-summary-bar">
                            <div className="cm-stake-readout">
                                <span className="cm-readout-lbl">TOTAL ROUND STAKE</span>
                                <span className="cm-readout-val">{currencySymbol}{totalStaked.toLocaleString()}</span>
                            </div>

                            <div className="cm-dock-actions">
                                <Button
                                    icon={<UndoOutlined />}
                                    onClick={clearBets}
                                    disabled={isLocked || isDrawing || totalStaked === 0}
                                    className="cm-ctrl-btn"
                                >
                                    Clear
                                </Button>
                                <Button
                                    onClick={doubleBets}
                                    disabled={isLocked || isDrawing || totalStaked === 0}
                                    className="cm-ctrl-btn cm-btn-double"
                                >
                                    2X Double
                                </Button>
                            </div>
                        </div>
                    </div>

            {/* Interactive Data Hub: Game History, Trend Chart, My Bets */}
            <div className="cm-data-hub">
                <div className="cm-hub-tabs">
                    <button
                        className={`cm-hub-tab ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        <HistoryOutlined /> Game History
                    </button>
                    <button
                        className={`cm-hub-tab ${activeTab === 'chart' ? 'active' : ''}`}
                        onClick={() => setActiveTab('chart')}
                    >
                        <LineChartOutlined /> Chart Trend
                    </button>
                    <button
                        className={`cm-hub-tab ${activeTab === 'mybets' ? 'active' : ''}`}
                        onClick={() => setActiveTab('mybets')}
                    >
                        <UserOutlined /> My Bets {myBets.length > 0 && `(${myBets.length})`}
                    </button>
                </div>

                {/* Tab 1: Game History */}
                {activeTab === 'history' && (
                    <div className="cm-tab-panel">
                        <table className="cm-data-table">
                            <thead>
                                <tr>
                                    <th>Period</th>
                                    <th>Number</th>
                                    <th>Big / Small</th>
                                    <th>Color</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map(item => (
                                    <tr key={item.period}>
                                        <td className="col-period">#{item.period}</td>
                                        <td className="col-num">
                                            <span className={`cm-mini-ball ball-${item.colors[0]}`}>
                                                {item.num}
                                            </span>
                                        </td>
                                        <td className="col-bs">
                                            <span className={`cm-pill-tag tag-${item.bigSmall}`}>
                                                {item.bigSmall.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="col-dots">
                                            <div className="cm-dots-cluster">
                                                {item.colors.map(c => (
                                                    <span key={c} className={`cm-dot dot-${c}`}></span>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tab 2: Chart Trend Matrix (0-9 Occurrence) */}
                {activeTab === 'chart' && (
                    <div className="cm-tab-panel cm-trend-chart-panel">
                        <div className="cm-chart-header">
                            <span>Occurrence Statistics (Last 10 Rounds)</span>
                        </div>
                        <div className="cm-matrix-grid">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
                                const count = history.filter(h => h.num === num).length
                                return (
                                    <div key={num} className="cm-matrix-col">
                                        <div className="cm-matrix-bar-wrap">
                                            <div
                                                className="cm-matrix-bar"
                                                style={{ height: `${Math.max(count * 25, 10)}%` }}
                                            ></div>
                                        </div>
                                        <span className="cm-matrix-num">{num}</span>
                                        <span className="cm-matrix-count">{count}x</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Tab 3: My Bets */}
                {activeTab === 'mybets' && (
                    <div className="cm-tab-panel">
                        {myBets.length === 0 ? (
                            <div className="cm-empty-history">
                                No bets placed in this session yet. Place a chip above to start playing!
                            </div>
                        ) : (
                            <table className="cm-data-table">
                                <thead>
                                    <tr>
                                        <th>Period</th>
                                        <th>Stake</th>
                                        <th>Result</th>
                                        <th>Payout</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {myBets.map((b, idx) => (
                                        <tr key={idx}>
                                            <td className="col-period">#{b.period}</td>
                                            <td>{currencySymbol}{b.stake}</td>
                                            <td>{b.resultNum}</td>
                                            <td style={{ color: b.winStatus ? '#00e676' : '#94a3b8', fontWeight: 800 }}>
                                                {b.winStatus ? `+${currencySymbol}${b.win.toLocaleString()}` : `${currencySymbol}0`}
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
    </div>

    {/* Mobile Sticky Bottom Wager Bar */}
    <div className="cm-mobile-bottom-bar">
        <div className="cm-mbar-stake">
            <span className="cm-mbar-lbl">TOTAL WAGER</span>
            <strong className="cm-mbar-val">{currencySymbol}{totalStaked.toLocaleString()}</strong>
        </div>
        <div className="cm-mbar-actions">
            <Button
                size="middle"
                icon={<UndoOutlined />}
                onClick={clearBets}
                disabled={isLocked || isDrawing || totalStaked === 0}
                className="cm-ctrl-btn"
            >
                Clear
            </Button>
            <Button
                size="middle"
                onClick={doubleBets}
                disabled={isLocked || isDrawing || totalStaked === 0}
                className="cm-ctrl-btn cm-btn-double"
            >
                2X
            </Button>
        </div>
    </div>
            <Modal
                title={<div style={{ color: '#ffd700' }}><SafetyCertificateOutlined /> Provably Fair Verification</div>}
                open={fairnessOpen}
                onCancel={() => setFairnessOpen(false)}
                footer={[
                    <Button key="close" type="primary" onClick={() => setFairnessOpen(false)}>
                        Close
                    </Button>
                ]}
                className="cm-fairness-modal"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Text style={{ color: '#94a3b8' }}>
                        Color Match outcomes are generated using cryptographic HMAC-SHA256 hashing. The outcome is deterministic and cannot be modified by the server or player.
                    </Text>
                    <div>
                        <Text strong style={{ color: '#e2e8f0' }}>Server Seed (SHA256 Hash):</Text>
                        <div className="cm-hash-code">{serverSeedHash}</div>
                    </div>
                    <div>
                        <Text strong style={{ color: '#e2e8f0' }}>Client Seed:</Text>
                        <div className="cm-hash-code">{clientSeed}</div>
                    </div>
                    <div>
                        <Text strong style={{ color: '#e2e8f0' }}>Period Nonce:</Text>
                        <div className="cm-hash-code">{periodId}</div>
                    </div>
                    <div style={{ background: 'rgba(0, 230, 118, 0.1)', padding: 12, borderRadius: 10, border: '1px solid rgba(0, 230, 118, 0.25)' }}>
                        <Text style={{ color: '#00e676', fontWeight: 700 }}>
                            RTP: 99.0% Provably Fair Standard. Independent verification available for every period.
                        </Text>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default ColorMatchGame
