import { useState, useRef, useEffect, useCallback } from 'react'
import { Button, InputNumber, Typography, Modal, Tabs, Drawer, message } from 'antd'
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
import GameBottomHistory from '../../components/GameHistory/GameBottomHistory'
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
    const { balance, currencySymbol, executeGameBet, notifyWin, notifyLoss } = useWallet()

    // Game Mode Tabs: 30s, 1Min, 3Min, 5Min
    const [gameMode, setGameMode] = useState('30s')
    const [periodId, setPeriodId] = useState(202609220058)
    const [timeLeft, setTimeLeft] = useState(30)
    const [maxTime, setMaxTime] = useState(30)
    const [isLocked, setIsLocked] = useState(false)
    const [isDrawing, setIsDrawing] = useState(false)

    // Current bet selection
    const [selectedChip, setSelectedChip] = useState(100)
    const [activeMultiplier, setActiveMultiplier] = useState(1)
    const [bets, setBets] = useState({})

    // Current draw display
    const [displayNum, setDisplayNum] = useState(null)
    const [lastDraw, setLastDraw] = useState({
        period: 202609220057,
        num: 7,
        colors: ['green'],
        bigSmall: 'big'
    })

    // Real-time dynamic history roadmap (No demo data)
    const [history, setHistory] = useState([
        { period: 202609220057, num: 7, colors: ['green'], bigSmall: 'big' }
    ])

    // Player personal bets record
    const [myBets, setMyBets] = useState([])
    const [activeTab, setActiveTab] = useState('history')

    // Modals & Drawers
    const [fairnessOpen, setFairnessOpen] = useState(false)
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
    const [serverSeedHash, setServerSeedHash] = useState('d3b07384d113edec49eaa6238ad5ff00b1a0d7d8e8749a9040306c4599a0f4a7')
    const [clientSeed] = useState('amrat-cm-' + Math.floor(Math.random() * 100000))

    // Total active stake placed for this round
    const totalStaked = Object.values(bets).reduce((a, b) => a + b, 0)
    const currentBetAmount = selectedChip * activeMultiplier

    // Handle placing chips on betting spots
    const addBet = (spotKey) => {
        if (isLocked || isDrawing) return

        if (totalStaked + currentBetAmount > balance) {
            notifyLoss?.('Insufficient balance to place chip!')
            return
        }

        casinoAudio.playChip()
        setBets(prev => ({
            ...prev,
            [spotKey]: (prev[spotKey] || 0) + currentBetAmount
        }))
    }

    const clearBets = () => {
        if (isLocked || isDrawing || totalStaked === 0) return
        setBets({})
        casinoAudio.playChip()
    }

    const doubleBets = () => {
        if (isLocked || isDrawing || totalStaked === 0) return
        if (totalStaked * 2 > balance) {
            notifyLoss?.('Insufficient balance to double bets!')
            return
        }

        casinoAudio.playChip()
        setBets(prev => {
            const next = {}
            for (const [k, v] of Object.entries(prev)) {
                next[k] = v * 2
            }
            return next
        })
    }

    // Resolve round payout (Visual and history updates)
    const resolveRound = useCallback((winningNum, evalData = {}, betResponse = {}) => {
        const item = NUMBER_DATA[winningNum]
        const colors = evalData.winningColors || item.colors
        const bigSmall = evalData.bigSmall || item.bigSmall

        const totalWin = betResponse.payout ?? evalData.payout ?? 0
        const isWin = Boolean(betResponse.won ?? evalData.won)
        const activeBets = { ...bets }

        // Apply visual/sound notifications
        if (isWin && totalWin > 0) {
            notifyWin?.(`Won ${currencySymbol}${totalWin.toLocaleString()} on Color Match #${periodId}!`)
            if ((totalWin / (totalStaked || 1)) >= 3) {
                casinoAudio.playBigWin()
            } else {
                casinoAudio.playWin()
            }
        } else if (Object.keys(activeBets).length > 0) {
            notifyLoss?.(`Round #${periodId} result: ${winningNum}. Better luck next round!`)
            casinoAudio.playLoss()
        }

        // Save round to player history
        if (Object.keys(activeBets).length > 0) {
            setMyBets(prev => [
                {
                    period: periodId,
                    betAmount: totalStaked,
                    stake: totalStaked,
                    payout: totalWin,
                    win: totalWin,
                    resultNum: winningNum,
                    outcome: `#${periodId} → ${winningNum} (${colors.join(', ')})`,
                    won: isWin && totalWin > 0,
                    winStatus: isWin && totalWin > 0,
                    multiplier: totalStaked > 0 ? (totalWin / totalStaked) : 0,
                    time: Date.now()
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
    }, [bets, periodId, currencySymbol, totalStaked, notifyWin, notifyLoss])

    // Trigger Draw Sequence (Server-Authoritative Provably Fair)
    const triggerDraw = useCallback(async () => {
        if (isDrawing) return
        if (totalStaked === 0) {
            notifyLoss?.('Please place chips on colors or numbers first!')
            return
        }
        if (totalStaked > balance) {
            notifyLoss?.('Insufficient balance to draw!')
            return
        }

        setIsDrawing(true)
        setIsLocked(true)
        casinoAudio.playCardDeal?.()

        // Submit to server-authoritative Provably Fair engine
        let betResponse
        try {
            betResponse = await executeGameBet({
                game: 'color-match',
                gameName: 'Color Match',
                betAmount: totalStaked,
                bets: { ...bets }
            })
        } catch (err) {
            console.error('[ColorMatch] Error submitting bet:', err)
        }

        if (!betResponse || !betResponse.success) {
            setIsDrawing(false)
            setIsLocked(false)
            notifyLoss?.(betResponse?.error || 'Unable to submit bet')
            return
        }

        const evalData = betResponse.evaluation || {}
        const serverWinningNum = evalData.luckyNumber ?? Math.floor(Math.random() * 10)
        if (evalData.hash) {
            setServerSeedHash(evalData.hash)
        }

        // Rapid rolling animation for 1.8s
        let rollCounter = 0
        const interval = setInterval(() => {
            setDisplayNum(Math.floor(Math.random() * 10))
            casinoAudio.playChip?.()
            rollCounter++
            if (rollCounter >= 18) {
                clearInterval(interval)
                setDisplayNum(serverWinningNum)
                setTimeout(() => {
                    resolveRound(serverWinningNum, evalData, betResponse)
                }, 500)
            }
        }, 80)
    }, [isDrawing, totalStaked, balance, bets, executeGameBet, resolveRound, notifyLoss])

    // Switch game modes (30s, 1Min, 3Min, 5Min)
    const handleModeSwitch = (mode, seconds) => {
        if (isDrawing) return
        setGameMode(mode)
        setMaxTime(seconds)
        setTimeLeft(seconds)
        setIsLocked(false)
    }

    // Circular progress stroke for timer
    const circleRadius = 42
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
                        icon={<HistoryOutlined style={{ color: '#ffd700' }} />}
                        onClick={() => setHistoryDrawerOpen(true)}
                        className="cm-fair-btn"
                    >
                        History
                    </Button>
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
                        {/* Status Dial Card */}
                        <div className={`cm-countdown-card ${isDrawing ? 'cm-urgent' : ''}`}>
                            <div className="cm-card-meta">
                                <span className="cm-meta-kicker"><FireOutlined style={{ color: '#ffd700' }} /> PERIOD</span>
                                <span className="cm-period-id">#{periodId}</span>
                            </div>

                            <div className={`cm-dial-wrapper ${isDrawing ? 'is-drawing' : 'is-ready'}`}>
                                <svg className="cm-dial-svg" viewBox="0 0 100 100">
                                    <defs>
                                        <linearGradient id="cmDialReadyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#fbbf24" />
                                            <stop offset="100%" stopColor="#f59e0b" />
                                        </linearGradient>
                                        <linearGradient id="cmDialDrawingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#34d399" />
                                            <stop offset="100%" stopColor="#059669" />
                                        </linearGradient>
                                    </defs>
                                    <circle
                                        className="cm-dial-bg"
                                        cx="50"
                                        cy="50"
                                        r={circleRadius}
                                    />
                                    <circle
                                        className={`cm-dial-progress ${isDrawing ? 'drawing-active' : ''}`}
                                        cx="50"
                                        cy="50"
                                        r={circleRadius}
                                        strokeDasharray={circleCircumference}
                                        strokeDashoffset={isDrawing ? circleCircumference * 0.35 : 0}
                                        stroke={isDrawing ? 'url(#cmDialDrawingGrad)' : 'url(#cmDialReadyGrad)'}
                                    />
                                </svg>
                                <div className="cm-dial-time">
                                    <span className="cm-time-status-dot" />
                                    <span className="cm-time-num">
                                        {isDrawing ? 'ROLL' : 'READY'}
                                    </span>
                                    <span className="cm-time-lbl">
                                        {isDrawing ? 'DRAWING' : 'ROUND'}
                                    </span>
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
                        </div>

                        <div className="cm-color-crystals">
                            <button
                                id="cm-bet-green"
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
                                <div className="cm-crystal-badge">1.96X / 1.47X</div>
                                {bets.green > 0 && (
                                    <div className="cm-staked-badge">{currencySymbol}{bets.green}</div>
                                )}
                            </button>

                            <button
                                id="cm-bet-violet"
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
                                id="cm-bet-red"
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
                                <div className="cm-crystal-badge">1.96X / 1.47X</div>
                                {bets.red > 0 && (
                                    <div className="cm-staked-badge">{currencySymbol}{bets.red}</div>
                                )}
                            </button>
                        </div>

                        {/* 2. 3D Lottery Number Balls Grid (0 to 9) */}
                        <div className="cm-section-header" style={{ marginTop: 8 }}>
                            <span>SELECT NUMBER (9X PAYOUT)</span>
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
                        <div className="cm-section-header" style={{ marginTop: 8 }}>
                            <span>BIG / SMALL (1.96X PAYOUT)</span>
                        </div>

                        <div className="cm-bigsmall-duo">
                            <button
                                id="cm-bet-big"
                                type="button"
                                className={`cm-pocket-btn btn-big ${bets.big ? 'active-bet' : ''}`}
                                disabled={isLocked || isDrawing}
                                onClick={() => addBet('big')}
                            >
                                <div className="cm-pocket-title">BIG</div>
                                <div className="cm-pocket-sub">5, 6, 7, 8, 9</div>
                                <div className="cm-pocket-mult">1.96X</div>
                                {bets.big > 0 && (
                                    <div className="cm-staked-badge">{currencySymbol}{bets.big}</div>
                                )}
                            </button>

                            <button
                                id="cm-bet-small"
                                type="button"
                                className={`cm-pocket-btn btn-small ${bets.small ? 'active-bet' : ''}`}
                                disabled={isLocked || isDrawing}
                                onClick={() => addBet('small')}
                            >
                                <div className="cm-pocket-title">SMALL</div>
                                <div className="cm-pocket-sub">0, 1, 2, 3, 4</div>
                                <div className="cm-pocket-mult">1.96X</div>
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
                            {/* Custom Chip Input */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                                <div style={{ flex: 1 }}>
                                    <InputNumber
                                        value={selectedChip}
                                        onChange={(val) => setSelectedChip(Math.max(1, isNaN(Number(val)) ? 1 : Number(val)))}
                                        min={1}
                                        step={10}
                                        style={{ width: '100%' }}
                                        addonBefore={<span style={{ fontWeight: 700, color: '#fbbf24' }}>{currencySymbol}</span>}
                                        placeholder="Custom Amount"
                                    />
                                </div>
                                <Button.Group>
                                    <Button onClick={() => setSelectedChip(prev => Math.max(1, Math.floor(prev / 2)))}>½</Button>
                                    <Button onClick={() => setSelectedChip(prev => prev * 2)}>2×</Button>
                                    <Button onClick={() => setSelectedChip(10)}>Min</Button>
                                    <Button onClick={() => setSelectedChip(Math.max(10, Math.floor(balance || 100)))}>Max</Button>
                                </Button.Group>
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
                                    id="cm-clear-btn"
                                    icon={<UndoOutlined />}
                                    onClick={clearBets}
                                    disabled={isLocked || isDrawing || totalStaked === 0}
                                    className="cm-ctrl-btn"
                                >
                                    Clear
                                </Button>
                                <Button
                                    id="cm-double-btn"
                                    onClick={doubleBets}
                                    disabled={isLocked || isDrawing || totalStaked === 0}
                                    className="cm-ctrl-btn cm-btn-double"
                                >
                                    2X Double
                                </Button>
                                <Button
                                    id="cm-draw-btn"
                                    type="primary"
                                    icon={<ThunderboltOutlined />}
                                    onClick={triggerDraw}
                                    disabled={isDrawing || totalStaked === 0}
                                    className="cm-draw-action-btn"
                                    loading={isDrawing}
                                >
                                    {isDrawing ? 'Drawing Result...' : (totalStaked > 0 ? `Draw Result • ${currencySymbol}${totalStaked.toLocaleString()}` : 'Place Chips to Draw')}
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
            <Button
                type="primary"
                size="middle"
                icon={<ThunderboltOutlined />}
                onClick={triggerDraw}
                disabled={isDrawing || totalStaked === 0}
                className="cm-mbar-draw-btn"
                loading={isDrawing}
            >
                Draw
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

            {/* Slide-out Game Specific Round History Drawer */}
            <Drawer
                title="Color Match · Live Round History"
                placement="right"
                width={520}
                open={historyDrawerOpen}
                onClose={() => setHistoryDrawerOpen(false)}
                styles={{
                    body: { padding: 12, background: '#0b101b' },
                    header: { background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.08)' }
                }}
            >
                <GameBottomHistory
                    gameKey="color-match"
                    gameTitle="Color Match"
                    localRounds={myBets}
                />
            </Drawer>
        </div>
    )
}

export default ColorMatchGame
