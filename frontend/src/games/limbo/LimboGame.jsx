import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
    SettingOutlined,
    SafetyCertificateOutlined,
    SoundOutlined,
    HistoryOutlined,
    HeartOutlined,
    HeartFilled,
    LineChartOutlined,
    ThunderboltOutlined,
    RedoOutlined,
    CheckCircleOutlined
} from '@ant-design/icons'
import { Modal, Tooltip, Typography, Tag } from 'antd'
import Chart from 'chart.js/auto'
import { useWallet } from '../../context/WalletContext'
import { useAuth } from '../../context/AuthContext'
import { CurrencyIcon } from '../../components/Header'
import casinoAudio from '../../utils/casinoAudio'
import ProvablyFairVerifierModal from '../../components/ProvablyFair/ProvablyFairVerifierModal'
import GameBottomHistory from '../../components/GameHistory/GameBottomHistory'
import './LimboGame.css'

const { Title, Text, Paragraph } = Typography

// 99.00% RTP (1.00% House Edge) matches exact 49.50000000% on 2.00x and 0.19800000% on 500.00x
const RTP = 0.99
const MIN_MULTIPLIER = 1.01
const MAX_MULTIPLIER = 1000000.00

function LimboGame() {
    const { user, openAuthModal } = useAuth()
    const {
        balance,
        showToast,
        currencySymbol,
        currency,
        executeGameBet,
        creditGamePayout,
        notifyWin,
        notifyLoss,
        openWalletModal
    } = useWallet()

    // Betting mode: 'manual' | 'auto'
    const [mode, setMode] = useState('manual')

    // Game Core State
    const [betAmount, setBetAmount] = useState(10)
    const [targetMultiplier, setTargetMultiplier] = useState(2.00)
    const [targetInputStr, setTargetInputStr] = useState('2.00')
    const [winChanceStr, setWinChanceStr] = useState('49.50000000')

    const [isRolling, setIsRolling] = useState(false)
    const [currentRoll, setCurrentRoll] = useState(1.00)
    const [gameResult, setGameResult] = useState(null) // 'win' | 'loss' | null
    const [hasPlayed, setHasPlayed] = useState(false)

    // Real dynamic history pills (up to 8 items, newest on right)
    const [history, setHistory] = useState([
        { id: 1, roll: 1.21, win: false },
        { id: 2, roll: 1.51, win: false },
        { id: 3, roll: 1.90, win: false }
    ])

    // Auto-betting states
    const [isAutoRunning, setIsAutoRunning] = useState(false)
    const [autoBetCount, setAutoBetCount] = useState(10)
    const [autoInfinite, setAutoInfinite] = useState(false)
    const [autoBetsRemaining, setAutoBetsRemaining] = useState(0)
    const [showAutobetToast, setShowAutobetToast] = useState(false)
    const [advancedAuto, setAdvancedAuto] = useState(false)
    const [onWinAction, setOnWinAction] = useState('reset') // 'reset' | 'increase'
    const [onWinIncreasePercent, setOnWinIncreasePercent] = useState(100)
    const [onLossAction, setOnLossAction] = useState('reset') // 'reset' | 'increase'
    const [onLossIncreasePercent, setOnLossIncreasePercent] = useState(100)
    const [stopOnProfit, setStopOnProfit] = useState('')
    const [stopOnLoss, setStopOnLoss] = useState('')
    const autoStartingProfitRef = useRef(0)
    const autoProfitAccRef = useRef(0)
    const autoRunningRef = useRef(false)
    const activeBetRef = useRef(betAmount)
    const baseBetRef = useRef(betAmount)

    // Demo Mode toggle for visitors
    const [isDemoMode, setIsDemoMode] = useState(false)
    const [demoBalance, setDemoBalance] = useState(1000)

    // Secondary UI & Social states
    const [isFavorite, setIsFavorite] = useState(() => {
        try {
            return localStorage.getItem('amrat_limbo_favorited') === 'true'
        } catch {
            return false
        }
    })
    const [followersCount, setFollowersCount] = useState(197730)
    const [soundEnabled, setSoundEnabled] = useState(() => !casinoAudio.getMuted())
    const [turboMode, setTurboMode] = useState(false)
    const [hotkeysEnabled, setHotkeysEnabled] = useState(true)

    // Modals
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [fairnessOpen, setFairnessOpen] = useState(false)
    const [liveStatsOpen, setLiveStatsOpen] = useState(false)
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)

    // Live Stats state
    const [stats, setStats] = useState({
        bets: 0,
        wins: 0,
        losses: 0,
        wagered: 0,
        profit: 0
    })
    const chartRef = useRef(null)
    const chartInstanceRef = useRef(null)
    const statsHistoryRef = useRef([0])

    const effectiveBalance = isDemoMode ? demoBalance : (balance || 0)

    // Calculate Win Chance from Target Multiplier (99 / target)
    const computeWinChance = useCallback((target) => {
        const t = parseFloat(target)
        if (isNaN(t) || t <= 0) return '0.00000000'
        const chance = (RTP * 100) / t
        return chance.toFixed(8)
    }, [])

    // Calculate Target Multiplier from Win Chance (99 / chance)
    const computeTargetFromChance = useCallback((chance) => {
        const c = parseFloat(chance)
        if (isNaN(c) || c <= 0) return '2.00'
        const target = (RTP * 100) / c
        return Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, target)).toFixed(2)
    }, [])

    // Update target input and recalculate win chance
    const handleTargetChange = (e) => {
        const val = e.target.value
        setTargetInputStr(val)
        const num = parseFloat(val)
        if (!isNaN(num) && num >= MIN_MULTIPLIER && num <= MAX_MULTIPLIER) {
            setTargetMultiplier(num)
            setWinChanceStr(computeWinChance(num))
        }
    }

    const handleTargetBlur = () => {
        let num = parseFloat(targetInputStr)
        if (isNaN(num) || num < MIN_MULTIPLIER) num = MIN_MULTIPLIER
        if (num > MAX_MULTIPLIER) num = MAX_MULTIPLIER
        setTargetMultiplier(num)
        setTargetInputStr(num.toFixed(2))
        setWinChanceStr(computeWinChance(num))
    }

    // Update win chance input and recalculate target multiplier
    const handleWinChanceChange = (e) => {
        const val = e.target.value
        setWinChanceStr(val)
        const num = parseFloat(val)
        if (!isNaN(num) && num > 0 && num <= 98.02) {
            const target = computeTargetFromChance(num)
            setTargetMultiplier(parseFloat(target))
            setTargetInputStr(target)
        }
    }

    const handleWinChanceBlur = () => {
        let num = parseFloat(winChanceStr)
        if (isNaN(num) || num <= 0) num = 49.5
        if (num > 98.02) num = 98.02
        setWinChanceStr(num.toFixed(8))
        const target = computeTargetFromChance(num)
        setTargetMultiplier(parseFloat(target))
        setTargetInputStr(target)
    }

    // Quick Bet Modifiers (½, 2×)
    const handleHalfBet = () => {
        if (isRolling || isAutoRunning) return
        casinoAudio.playChip?.()
        setBetAmount(prev => Math.max(0.00000001, parseFloat((Number(prev || 1) / 2).toFixed(8))))
    }

    const handleDoubleBet = () => {
        if (isRolling || isAutoRunning) return
        casinoAudio.playChip?.()
        setBetAmount(prev => {
            const doubled = Number(prev || 1) * 2
            return parseFloat(Math.min(effectiveBalance || 1000000, doubled).toFixed(8))
        })
    }

    // Synchronize activeBetRef
    useEffect(() => {
        activeBetRef.current = betAmount
    }, [betAmount])

    // Toggle Favorite button
    const toggleFavorite = () => {
        setIsFavorite(prev => {
            const next = !prev
            try {
                localStorage.setItem('amrat_limbo_favorited', String(next))
            } catch {}
            setFollowersCount(c => next ? c + 1 : c - 1)
            return next
        })
    }

    // Sound toggle
    const toggleSound = () => {
        const isNowMuted = casinoAudio.toggleMute()
        setSoundEnabled(!isNowMuted)
    }

    // Potential profit preview on win
    const potentialProfit = useMemo(() => {
        const bet = parseFloat(betAmount) || 0
        const mult = parseFloat(targetMultiplier) || 2
        return Math.max(0, (bet * mult) - bet)
    }, [betAmount, targetMultiplier])

    // Execute single roll
    const executeRoll = useCallback(async () => {
        if (isRolling) return

        if (!user && !isDemoMode) {
            openAuthModal?.('register')
            return
        }

        const currentBet = activeBetRef.current
        if (currentBet > effectiveBalance) {
            showToast?.('error', 'Insufficient Balance', `You need ${currencySymbol}${currentBet.toFixed(2)} to place this bet.`)
            setIsAutoRunning(false)
            autoRunningRef.current = false
            return
        }
        if (currentBet <= 0) {
            showToast?.('warning', 'Invalid Bet', 'Please enter a positive bet amount.')
            setIsAutoRunning(false)
            autoRunningRef.current = false
            return
        }

        const target = parseFloat(targetMultiplier)
        if (isNaN(target) || target < MIN_MULTIPLIER) return

        setIsRolling(true)
        casinoAudio.playBet()

        // Handle Demo Mode locally if active
        if (isDemoMode) {
            setDemoBalance(b => Math.max(0, b - currentBet))
            // 99% RTP Provably Fair client-side simulation
            const floatVal = Math.random()
            let demoRoll = 1.00
            if (floatVal >= 0.01) {
                demoRoll = Math.floor((99.0 / (1 - floatVal))) / 100
            }
            demoRoll = Math.max(1.00, Math.min(demoRoll, 1000000.0))
            const isWin = demoRoll >= target
            const payout = isWin ? currentBet * target : 0

            finalizeRollOutcome({
                roll: demoRoll,
                won: isWin,
                payout,
                betAmount: currentBet,
                target
            })
            return
        }

        // Call Server-Authoritative Provably Fair Bet Evaluation
        let betResponse
        try {
            if (executeGameBet) {
                betResponse = await executeGameBet({
                    game: 'limbo',
                    gameName: 'Limbo Multiplier',
                    betAmount: currentBet,
                    targetMultiplier: target
                })
            }
        } catch (err) {
            console.error('[Limbo] Error placing bet:', err)
        }

        if (!betResponse || !betResponse.success) {
            setIsRolling(false)
            setIsAutoRunning(false)
            autoRunningRef.current = false
            showToast?.('error', 'Bet Failed', betResponse?.error || 'Failed to place bet')
            return
        }

        const outcome = betResponse.evaluation?.roll || 1.00
        const isWin = Boolean(betResponse.won)
        const winAmount = betResponse.payout || 0

        finalizeRollOutcome({
            roll: outcome,
            won: isWin,
            payout: winAmount,
            betAmount: currentBet,
            target,
            applyPayout: betResponse.applyPayout
        })
    }, [isRolling, user, isDemoMode, effectiveBalance, targetMultiplier, executeGameBet, showToast, currencySymbol])

    // Finalize outcome with optional fast tick animation
    const finalizeRollOutcome = useCallback((data) => {
        const { roll, won, payout, betAmount: wagered, target, applyPayout } = data

        const onFinished = () => {
            setCurrentRoll(roll)
            setIsRolling(false)
            setHasPlayed(true)
            const resultTag = won ? 'win' : 'loss'
            setGameResult(resultTag)

            if (won) {
                if (applyPayout) {
                    applyPayout()
                } else if (isDemoMode) {
                    setDemoBalance(b => b + payout)
                } else if (payout > 0) {
                    creditGamePayout?.(payout)
                }
                notifyWin?.(payout, target)
                if (target >= 5) {
                    casinoAudio.playBigWin()
                } else {
                    casinoAudio.playWin()
                }
            } else {
                if (!autoRunningRef.current) {
                    notifyLoss?.(wagered)
                }
                casinoAudio.playLoss()
            }

            // Append to real round history pills (newest at right)
            setHistory(prev => [...prev.slice(-7), { id: Date.now(), roll, win: won }])

            // Update live stats
            const profitDelta = won ? (payout - wagered) : -wagered
            setStats(prev => ({
                bets: prev.bets + 1,
                wins: prev.wins + (won ? 1 : 0),
                losses: prev.losses + (won ? 0 : 1),
                wagered: prev.wagered + wagered,
                profit: prev.profit + profitDelta
            }))
            statsHistoryRef.current.push((statsHistoryRef.current[statsHistoryRef.current.length - 1] || 0) + profitDelta)

            // Auto-bet progression
            if (autoRunningRef.current) {
                autoProfitAccRef.current += profitDelta

                // Check stop on profit / stop on loss
                const stopP = parseFloat(stopOnProfit)
                const stopL = parseFloat(stopOnLoss)
                if (!isNaN(stopP) && stopP > 0 && autoProfitAccRef.current >= stopP) {
                    stopAutoBet()
                    showToast?.('success', 'Stop on Profit Reached', `Autobet stopped at +${currencySymbol}${autoProfitAccRef.current.toFixed(2)}`)
                    return
                }
                if (!isNaN(stopL) && stopL > 0 && autoProfitAccRef.current <= -stopL) {
                    stopAutoBet()
                    showToast?.('warning', 'Stop on Loss Reached', `Autobet stopped at ${currencySymbol}${autoProfitAccRef.current.toFixed(2)}`)
                    return
                }

                setAutoBetsRemaining(prev => {
                    if (!autoInfinite && prev <= 1) {
                        stopAutoBet()
                        return 0
                    }

                    // Adjust bet on win/loss
                    let nextBet = activeBetRef.current
                    if (won) {
                        if (onWinAction === 'reset') nextBet = baseBetRef.current
                        else if (onWinAction === 'increase') nextBet = parseFloat((nextBet * (1 + onWinIncreasePercent / 100)).toFixed(8))
                    } else {
                        if (onLossAction === 'reset') nextBet = baseBetRef.current
                        else if (onLossAction === 'increase') nextBet = parseFloat((nextBet * (1 + onLossIncreasePercent / 100)).toFixed(8))
                    }

                    nextBet = Math.max(0.00000001, Math.min(effectiveBalance, nextBet))
                    activeBetRef.current = nextBet
                    setBetAmount(nextBet)

                    // Trigger next auto roll
                    setTimeout(() => {
                        if (autoRunningRef.current) executeRoll()
                    }, turboMode ? 100 : 260)

                    return autoInfinite ? prev : prev - 1
                })
            }
        }

        if (turboMode) {
            onFinished()
        } else {
            // Rapid visual number rolling animation (240ms)
            const startTime = Date.now()
            const duration = 240
            const interval = setInterval(() => {
                const elapsed = Date.now() - startTime
                if (elapsed < duration) {
                    const rnd = (Math.random() * target * 1.5 + 0.8).toFixed(2)
                    setCurrentRoll(parseFloat(rnd))
                    casinoAudio.playTick()
                } else {
                    clearInterval(interval)
                    onFinished()
                }
            }, 30)
        }
    }, [turboMode, isDemoMode, creditGamePayout, notifyWin, notifyLoss, stopOnProfit, stopOnLoss, showToast, currencySymbol, autoInfinite, onWinAction, onWinIncreasePercent, onLossAction, onLossIncreasePercent, effectiveBalance, executeRoll])

    // Start auto betting
    const startAutoBet = () => {
        if (!user && !isDemoMode) {
            openAuthModal?.('register')
            return
        }
        if (betAmount > effectiveBalance) {
            showToast?.('error', 'Insufficient Balance', `You need ${currencySymbol}${betAmount.toFixed(2)} to start autobet.`)
            return
        }
        if (betAmount <= 0) return

        baseBetRef.current = betAmount
        activeBetRef.current = betAmount
        autoProfitAccRef.current = 0
        autoStartingProfitRef.current = 0

        const count = autoInfinite ? 999999 : (parseInt(autoBetCount, 10) || 10)
        setAutoBetsRemaining(count)
        setIsAutoRunning(true)
        autoRunningRef.current = true
        setShowAutobetToast(true)

        executeRoll()
    }

    // Stop auto betting
    const stopAutoBet = () => {
        setIsAutoRunning(false)
        autoRunningRef.current = false
        setAutoBetsRemaining(0)
        setShowAutobetToast(false)
        if (baseBetRef.current) {
            setBetAmount(baseBetRef.current)
            activeBetRef.current = baseBetRef.current
        }
    }

    // Hotkey: Spacebar to roll
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!hotkeysEnabled) return
            if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
                e.preventDefault()
                if (!isRolling && !isAutoRunning) {
                    executeRoll()
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [hotkeysEnabled, isRolling, isAutoRunning, executeRoll])

    // Live Stats Chart initialize
    useEffect(() => {
        if (!liveStatsOpen || !chartRef.current) return
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy()
        }

        const ctx = chartRef.current.getContext('2d')
        chartInstanceRef.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels: statsHistoryRef.current.map((_, i) => i === 0 ? 'Start' : `#${i}`),
                datasets: [{
                    label: 'Net Profit',
                    data: statsHistoryRef.current,
                    borderColor: stats.profit >= 0 ? '#00e701' : '#ed4263',
                    backgroundColor: stats.profit >= 0 ? 'rgba(0, 231, 1, 0.1)' : 'rgba(237, 66, 99, 0.1)',
                    fill: true,
                    tension: 0.3,
                    borderWidth: 2,
                    pointRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } },
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } }
                }
            }
        })

        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy()
                chartInstanceRef.current = null
            }
        }
    }, [liveStatsOpen, stats.profit])

    // Multiplier number dynamic color class
    const multiplierColorClass = useMemo(() => {
        if (!hasPlayed && !isRolling) return 'color-idle'
        if (isRolling) return 'color-rolling'
        if (gameResult === 'win') return 'color-win'
        return 'color-loss'
    }, [hasPlayed, isRolling, gameResult])

    return (
        <div className="amrat-limbo-wrapper">


            {/* Main Game Screen */}
            <div className="amrat-limbo-container">
                {/* 1. ARENA VIEWPORT (Exact match to Screenshots 1, 2, 3 & 4) */}
                <section className="amrat-limbo-arena">
                    {/* Top Status Bar: Autobet Toast on left, Multiplier History Pills on right */}
                    <div className="arena-top-bar">
                        <div className="top-bar-left">
                            {showAutobetToast && isAutoRunning && (
                                <div className="autobet-started-toast animate-slide-in">
                                    <span className="toast-icon">🔄</span>
                                    <span className="toast-text">Autobet Started</span>
                                    <button
                                        type="button"
                                        className="toast-close-btn"
                                        onClick={() => setShowAutobetToast(false)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="top-bar-history">
                            {history.map((item) => (
                                <span
                                    key={item.id}
                                    className={`history-multiplier-pill ${item.win ? 'win' : 'lose'}`}
                                >
                                    {item.roll.toFixed(2)}×
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Huge Center Multiplier Number (Screenshots 1: 1.21x red, 2: 1.00x white, 3: 1.90x red, 4: 35.54x red) */}
                    <div className="arena-center-stage">
                        <div className={`giant-multiplier-display ${multiplierColorClass}`}>
                            <span className="multiplier-num">
                                {currentRoll.toFixed(2)}
                            </span>
                            <span className="multiplier-x">×</span>
                        </div>
                    </div>

                    {/* Dual Targets Card (Target Multiplier & Win Chance) directly in Arena */}
                    <div className="arena-targets-card">
                        <div className="target-input-col">
                            <label className="target-field-label">Target Multiplier</label>
                            <div className="target-compound-box">
                                <input
                                    id="limbo-target-input"
                                    type="number"
                                    step="0.01"
                                    min={MIN_MULTIPLIER}
                                    max={MAX_MULTIPLIER}
                                    value={targetInputStr}
                                    onChange={handleTargetChange}
                                    onBlur={handleTargetBlur}
                                    disabled={isRolling || isAutoRunning}
                                    className="compound-text-input"
                                />
                                <span className="compound-suffix-sign">✕</span>
                            </div>
                        </div>

                        <div className="target-input-col">
                            <label className="target-field-label">Win Chance</label>
                            <div className="target-compound-box">
                                <input
                                    id="limbo-win-chance-input"
                                    type="number"
                                    step="0.00000001"
                                    min="0.000099"
                                    max="98.02"
                                    value={winChanceStr}
                                    onChange={handleWinChanceChange}
                                    onBlur={handleWinChanceBlur}
                                    disabled={isRolling || isAutoRunning}
                                    className="compound-text-input"
                                />
                                <span className="compound-suffix-sign">%</span>
                            </div>
                        </div>
                    </div>

                    {/* Primary Action Button (Right under the targets card) */}
                    <div className="arena-primary-btn-wrap">
                        {isAutoRunning ? (
                            <button
                                id="limbo-stop-autobet-btn"
                                type="button"
                                className="amrat-primary-btn stop-autobet-state"
                                onClick={stopAutoBet}
                            >
                                <span>Stop Autobet</span>
                                <span className="btn-sub-icon">🃏</span>
                            </button>
                        ) : (
                            <button
                                id="limbo-bet-btn"
                                type="button"
                                className="amrat-primary-btn bet-state"
                                onClick={executeRoll}
                                disabled={isRolling || betAmount <= 0}
                            >
                                <span>{!user && !isDemoMode ? 'Sign In to Bet' : isRolling ? 'Rolling…' : 'Bet'}</span>
                            </button>
                        )}
                    </div>
                </section>

                {/* 2. COCKPIT CONTROLS PANEL (Exact match to Screenshots 1, 2, 3 & 4) */}
                <section className="amrat-limbo-controls">
                    {/* Wager Amount Compound Row */}
                    <div className="control-field-group">
                        <div className="field-label-row">
                            <label className="field-title">Bet Amount</label>
                            <span className="field-fiat-badge">
                                ${(parseFloat(betAmount) || 0).toFixed(2)}
                            </span>
                        </div>
                        <div className="amrat-input-compound">
                            <input
                                id="limbo-bet-amount-input"
                                type="number"
                                step="any"
                                min="0"
                                value={betAmount}
                                onChange={(e) => setBetAmount(e.target.value)}
                                disabled={isRolling || isAutoRunning}
                                className="amrat-num-input"
                                placeholder="0.00000000"
                            />
                            <span className="input-currency-badge">
                                <CurrencyIcon symbol={currencySymbol} currency={currency} size={16} fontSize={9} />
                            </span>
                            <div className="input-divider" />
                            <button
                                type="button"
                                className="compound-action-btn"
                                onClick={handleHalfBet}
                                disabled={isRolling || isAutoRunning}
                            >
                                ½
                            </button>
                            <div className="input-divider" />
                            <button
                                type="button"
                                className="compound-action-btn"
                                onClick={handleDoubleBet}
                                disabled={isRolling || isAutoRunning}
                            >
                                2×
                            </button>
                        </div>
                    </div>

                    {/* Manual Mode: Profit on Win Display */}
                    {mode === 'manual' && (
                        <div className="control-field-group">
                            <div className="field-label-row">
                                <label className="field-title">Profit on Win</label>
                                <span className="field-fiat-badge">
                                    ${potentialProfit.toFixed(2)}
                                </span>
                            </div>
                            <div className="amrat-readonly-display">
                                <input
                                    type="text"
                                    readOnly
                                    value={potentialProfit.toFixed(8)}
                                    className="amrat-display-input"
                                />
                                <span className="input-currency-badge">
                                    <CurrencyIcon symbol={currencySymbol} currency={currency} size={16} fontSize={9} />
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Auto Mode: Number of Bets & Advanced Controls */}
                    {mode === 'auto' && (
                        <>
                            <div className="control-field-group">
                                <div className="field-label-row">
                                    <label className="field-title">Number of Bets</label>
                                    <button
                                        type="button"
                                        className={`infinite-badge-btn ${autoInfinite ? 'active' : ''}`}
                                        onClick={() => setAutoInfinite(prev => !prev)}
                                        disabled={isAutoRunning}
                                    >
                                        {autoInfinite ? '∞ Infinite' : 'Set ∞'}
                                    </button>
                                </div>
                                <div className="amrat-input-compound">
                                    <input
                                        type="number"
                                        min="1"
                                        value={autoInfinite ? '0' : autoBetCount}
                                        onChange={(e) => setAutoBetCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                        disabled={isAutoRunning || autoInfinite}
                                        className="amrat-num-input"
                                        placeholder={autoInfinite ? '∞' : '10'}
                                    />
                                    {isAutoRunning && !autoInfinite && (
                                        <span className="auto-remaining-pill">
                                            {autoBetsRemaining} left
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="advanced-toggle-row">
                                <span className="advanced-title">Advanced</span>
                                <label className="switch-toggle">
                                    <input
                                        type="checkbox"
                                        checked={advancedAuto}
                                        onChange={(e) => setAdvancedAuto(e.target.checked)}
                                        disabled={isAutoRunning}
                                    />
                                    <span className="slider-round" />
                                </label>
                            </div>

                            {advancedAuto && (
                                <div className="advanced-auto-panel">
                                    <div className="martingale-row">
                                        <label className="martingale-label">On Win</label>
                                        <div className="martingale-actions">
                                            <button
                                                type="button"
                                                className={`action-pill ${onWinAction === 'reset' ? 'active' : ''}`}
                                                onClick={() => setOnWinAction('reset')}
                                                disabled={isAutoRunning}
                                            >
                                                Reset
                                            </button>
                                            <button
                                                type="button"
                                                className={`action-pill ${onWinAction === 'increase' ? 'active' : ''}`}
                                                onClick={() => setOnWinAction('increase')}
                                                disabled={isAutoRunning}
                                            >
                                                Increase by:
                                            </button>
                                            <div className="percent-input-wrap">
                                                <input
                                                    type="number"
                                                    value={onWinIncreasePercent}
                                                    onChange={(e) => setOnWinIncreasePercent(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                                    disabled={isAutoRunning || onWinAction !== 'increase'}
                                                    className="percent-input"
                                                />
                                                <span className="percent-symbol">%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="martingale-row">
                                        <label className="martingale-label">On Loss</label>
                                        <div className="martingale-actions">
                                            <button
                                                type="button"
                                                className={`action-pill ${onLossAction === 'reset' ? 'active' : ''}`}
                                                onClick={() => setOnLossAction('reset')}
                                                disabled={isAutoRunning}
                                            >
                                                Reset
                                            </button>
                                            <button
                                                type="button"
                                                className={`action-pill ${onLossAction === 'increase' ? 'active' : ''}`}
                                                onClick={() => setOnLossAction('increase')}
                                                disabled={isAutoRunning}
                                            >
                                                Increase by:
                                            </button>
                                            <div className="percent-input-wrap">
                                                <input
                                                    type="number"
                                                    value={onLossIncreasePercent}
                                                    onChange={(e) => setOnLossIncreasePercent(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                                    disabled={isAutoRunning || onLossAction !== 'increase'}
                                                    className="percent-input"
                                                />
                                                <span className="percent-symbol">%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="stop-thresholds-grid">
                                        <div className="threshold-col">
                                            <label className="threshold-label">Stop on Profit</label>
                                            <input
                                                type="number"
                                                step="any"
                                                placeholder="0.00"
                                                value={stopOnProfit}
                                                onChange={(e) => setStopOnProfit(e.target.value)}
                                                disabled={isAutoRunning}
                                                className="threshold-input"
                                            />
                                        </div>
                                        <div className="threshold-col">
                                            <label className="threshold-label">Stop on Loss</label>
                                            <input
                                                type="number"
                                                step="any"
                                                placeholder="0.00"
                                                value={stopOnLoss}
                                                onChange={(e) => setStopOnLoss(e.target.value)}
                                                disabled={isAutoRunning}
                                                className="threshold-input"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!isAutoRunning && (
                                <button
                                    type="button"
                                    className="amrat-primary-btn bet-state auto-launch-btn"
                                    onClick={startAutoBet}
                                >
                                    Start Autobet
                                </button>
                            )}
                        </>
                    )}

                    {/* Segmented Mode Switcher (Capsule at bottom of controls panel) */}
                    <div className="amrat-mode-switcher-wrap">
                        <div className="capsule-mode-switcher">
                            <button
                                type="button"
                                className={`capsule-tab ${mode === 'manual' ? 'active' : ''}`}
                                onClick={() => {
                                    if (isAutoRunning) return
                                    setMode('manual')
                                }}
                                disabled={isAutoRunning}
                            >
                                Manual
                            </button>
                            <button
                                type="button"
                                className={`capsule-tab ${mode === 'auto' ? 'active' : ''}`}
                                onClick={() => {
                                    if (isRolling) return
                                    setMode('auto')
                                }}
                                disabled={isRolling}
                            >
                                Auto
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            {/* Secondary Tools Footer Row (Settings, Live Stats, Fairness) */}
            <div className="amrat-tools-row">
                <div className="tools-left-group">
                    <button
                        type="button"
                        className="tool-btn"
                        onClick={() => setSettingsOpen(true)}
                        title="Game Settings"
                    >
                        <SettingOutlined />
                    </button>
                    <button
                        type="button"
                        className="tool-btn"
                        onClick={() => setLiveStatsOpen(true)}
                        title="Live Statistics"
                    >
                        <LineChartOutlined />
                    </button>
                    <button
                        type="button"
                        className="tool-btn"
                        onClick={() => setHistoryDrawerOpen(true)}
                        title="Round History"
                    >
                        <HistoryOutlined />
                    </button>
                </div>

                <div className="tools-right-group">
                    <button
                        type="button"
                        className="fairness-pill-btn"
                        onClick={() => setFairnessOpen(true)}
                    >
                        <span className="fairness-check-icon">✓</span>
                        <span>Fairness</span>
                    </button>
                </div>
            </div>

            {/* Originals Community Card (Amrat Originals Community Card) */}
            <div className="amrat-originals-card">
                <div className="card-brand-col">
                    <div className="originals-logo-badge">
                        <span className="badge-logo-text">Amrat</span>
                    </div>
                    <div className="originals-info">
                        <h4 className="originals-title">Amrat Originals</h4>
                        <span className="originals-followers">
                            {(followersCount / 1000).toFixed(2)}K Followers
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    className={`card-heart-btn ${isFavorite ? 'favorited' : ''}`}
                    onClick={toggleFavorite}
                    title={isFavorite ? 'Remove from Favourites' : 'Add to Favourites'}
                >
                    {isFavorite ? <HeartFilled style={{ color: '#ed4263' }} /> : <HeartOutlined />}
                </button>
            </div>

            {/* Settings Modal */}
            <Modal
                title="Limbo Settings"
                open={settingsOpen}
                onOk={() => setSettingsOpen(false)}
                onCancel={() => setSettingsOpen(false)}
                footer={null}
                className="amrat-modal dark-glass"
            >
                <div className="modal-settings-content">
                    <div className="setting-item-row">
                        <div className="setting-meta">
                            <span className="setting-label">Sound Effects</span>
                            <span className="setting-desc">High-fidelity audio feedback on ticks, wins, and losses</span>
                        </div>
                        <label className="switch-toggle">
                            <input
                                type="checkbox"
                                checked={soundEnabled}
                                onChange={toggleSound}
                            />
                            <span className="slider-round" />
                        </label>
                    </div>

                    <div className="setting-item-row">
                        <div className="setting-meta">
                            <span className="setting-label">Turbo Roll</span>
                            <span className="setting-desc">Instant outcomes with zero visual rolling delay</span>
                        </div>
                        <label className="switch-toggle">
                            <input
                                type="checkbox"
                                checked={turboMode}
                                onChange={(e) => setTurboMode(e.target.checked)}
                            />
                            <span className="slider-round" />
                        </label>
                    </div>

                    <div className="setting-item-row">
                        <div className="setting-meta">
                            <span className="setting-label">Keyboard Shortcuts</span>
                            <span className="setting-desc">Press [Space] to roll instantly</span>
                        </div>
                        <label className="switch-toggle">
                            <input
                                type="checkbox"
                                checked={hotkeysEnabled}
                                onChange={(e) => setHotkeysEnabled(e.target.checked)}
                            />
                            <span className="slider-round" />
                        </label>
                    </div>
                </div>
            </Modal>

            {/* Live Stats Modal */}
            <Modal
                title="Limbo · Live Session Statistics"
                open={liveStatsOpen}
                onCancel={() => setLiveStatsOpen(false)}
                footer={null}
                className="amrat-modal dark-glass stats-modal"
                width={560}
            >
                <div className="stats-modal-body">
                    <div className="stats-grid">
                        <div className="stat-card">
                            <span className="stat-label">Total Bets</span>
                            <strong className="stat-val">{stats.bets}</strong>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">Wins / Losses</span>
                            <strong className="stat-val text-green">{stats.wins} <span className="text-muted">/</span> <span className="text-red">{stats.losses}</span></strong>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">Win Rate</span>
                            <strong className="stat-val">{stats.bets > 0 ? ((stats.wins / stats.bets) * 100).toFixed(1) : 0}%</strong>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">Net Profit</span>
                            <strong className={`stat-val ${stats.profit >= 0 ? 'text-green' : 'text-red'}`}>
                                {stats.profit >= 0 ? '+' : ''}{currencySymbol}{stats.profit.toFixed(2)}
                            </strong>
                        </div>
                    </div>

                    <div className="stats-chart-wrapper">
                        <canvas ref={chartRef} height="160" />
                    </div>

                    <div className="stats-actions">
                        <button
                            type="button"
                            className="amrat-secondary-btn reset-stats-btn"
                            onClick={() => {
                                setStats({ bets: 0, wins: 0, losses: 0, wagered: 0, profit: 0 })
                                statsHistoryRef.current = [0]
                            }}
                        >
                            Reset Live Statistics
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Slide-out Game History Drawer */}
            <Modal
                title="Limbo · Round History"
                open={historyDrawerOpen}
                onCancel={() => setHistoryDrawerOpen(false)}
                footer={null}
                width={540}
                className="amrat-modal dark-glass"
            >
                <GameBottomHistory
                    gameKey="limbo"
                    gameTitle="Limbo"
                    localRounds={history}
                />
            </Modal>

            {/* Provably Fair Verifier Modal */}
            <ProvablyFairVerifierModal
                isOpen={fairnessOpen}
                onClose={() => setFairnessOpen(false)}
                initialData={{
                    game: 'limbo',
                    targetMultiplier
                }}
            />
        </div>
    )
}

export default LimboGame
