import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Typography, Tooltip } from 'antd'
import {
    ThunderboltOutlined,
    SafetyCertificateOutlined,
    TrophyOutlined,
    SoundOutlined,
    RocketOutlined,
    CheckCircleFilled,
    FireOutlined,
    ClockCircleFilled,
    PlayCircleOutlined,
    PauseCircleOutlined
} from '@ant-design/icons'
import { useWallet } from '../../context/WalletContext'
import casinoAudio from '../../utils/casinoAudio'
import ProvablyFairVerifierModal from '../../components/ProvablyFair/ProvablyFairVerifierModal'
import CoinParticles from './CoinParticles'
import MissedWinBanner from '../../components/MissedWinBanner/MissedWinBanner'
import GameBottomHistory from '../../components/GameHistory/GameBottomHistory'
import './CoinTossGame.css'

const MULTIPLIER = 1.98 // 99% RTP / 1% House Edge
const MIN_BET = 10
const MAX_BET = 100000
const PRESET_AMOUNTS = [10, 50, 100, 500, 1000]

const HEADS_ASSET = '/images/coin-toss/heads.jpg'
const TAILS_ASSET = '/images/coin-toss/tails.jpg'

export default function CoinTossGame() {
    const { balance, currencySymbol, executeGameBet } = useWallet()

    // Betting selections
    const [choice, setChoice] = useState('heads') // 'heads' | 'tails'
    const [betAmount, setBetAmount] = useState(100)
    const [isFlipping, setIsFlipping] = useState(false)
    const [turboMode, setTurboMode] = useState(false)

    // Non-stop Live Rounds Engine state
    const [liveRoundsActive, setLiveRoundsActive] = useState(true)
    const [roundIndex, setRoundIndex] = useState(() => Math.floor(1000 + Math.random() * 5000))
    const [roundCountdown, setRoundCountdown] = useState(4) // 4s countdown between flips
    const [userBetLocked, setUserBetLocked] = useState(false)
    const [missedWin, setMissedWin] = useState(null)

    // Interactive 3D Parallax Tilt state
    const [mouseTilt, setMouseTilt] = useState({ x: 0, y: 0 })
    const [isHoveringCoin, setIsHoveringCoin] = useState(false)

    // Animation & Outcome states
    const [coinTransform, setCoinTransform] = useState('rotateY(0deg)')
    const [coinSide, setCoinSide] = useState('heads') // current visible face
    const [lastResult, setLastResult] = useState(null)
    const [streakCount, setStreakCount] = useState(0)

    // Particle effect trigger timestamps
    const [landingTrigger, setLandingTrigger] = useState(0)
    const [winTrigger, setWinTrigger] = useState(0)

    // History and sound
    const [history, setHistory] = useState([])
    const [isMuted, setIsMuted] = useState(casinoAudio.getMuted())

    // Provably fair modal state
    const [verifierOpen, setVerifierOpen] = useState(false)
    const [verifierData, setVerifierData] = useState(null)
    const [provablyFairSeed, setProvablyFairSeed] = useState({
        serverSeedHash: 'Loading cryptographic hash...',
        clientSeed: 'amrat-player',
        nonce: 1
    })

    // Fetch initial provably fair public seed hash
    useEffect(() => {
        let mounted = true
        fetch('/api/games/provably-fair/seed')
            .then((r) => r.json())
            .then((data) => {
                if (mounted && data.serverSeedHash) {
                    setProvablyFairSeed({
                        serverSeedHash: data.serverSeedHash,
                        clientSeed: data.clientSeed || 'amrat-player',
                        nonce: data.nonce || 1
                    })
                }
            })
            .catch(() => {})
        return () => {
            mounted = false
        }
    }, [])

    // Multiplier payout calculations
    const potentialPayout = useMemo(() => {
        const amt = parseFloat(betAmount) || 0
        return parseFloat((amt * MULTIPLIER).toFixed(2))
    }, [betAmount])

    const potentialProfit = useMemo(() => {
        const amt = parseFloat(betAmount) || 0
        return parseFloat((amt * (MULTIPLIER - 1)).toFixed(2))
    }, [betAmount])

    // Quick chip adjustments
    const adjustBet = (delta) => {
        casinoAudio.playChip()
        setBetAmount((prev) => Math.max(MIN_BET, Math.min(MAX_BET, Math.floor((prev || 0) + delta))))
    }

    const multiplyBet = (factor) => {
        casinoAudio.playChip()
        setBetAmount((prev) => {
            const base = prev || MIN_BET
            return Math.max(MIN_BET, Math.min(MAX_BET, Math.floor(base * factor)))
        })
    }

    const setExactBet = (amt) => {
        casinoAudio.playChip()
        setBetAmount(amt)
    }

    const setMaxBet = () => {
        casinoAudio.playChip()
        const maxAffordable = Math.min(MAX_BET, Math.floor(balance || MIN_BET))
        setBetAmount(Math.max(MIN_BET, maxAffordable))
    }

    // Toggle mute
    const handleToggleMute = () => {
        const next = casinoAudio.toggleMute()
        setIsMuted(next)
    }

    // Interactive 3D Coin Tilt handlers
    const handleStageMouseMove = (e) => {
        if (isFlipping) return
        const rect = e.currentTarget.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width - 0.5
        const y = (e.clientY - rect.top) / rect.height - 0.5
        setMouseTilt({ x: -y * 24, y: x * 24 })
        setIsHoveringCoin(true)
    }

    const handleStageMouseLeave = () => {
        setMouseTilt({ x: 0, y: 0 })
        setIsHoveringCoin(false)
    }

    // Direct prediction pick preview
    const handleSelectChoice = (side) => {
        casinoAudio.playChip()
        setChoice(side)
        setCoinSide(side)
        if (!isFlipping) {
            setCoinTransform(side === 'heads' ? 'rotateY(0deg)' : 'rotateY(180deg)')
        }
    }

    // Lock in bet for upcoming round
    const handleLockInBet = () => {
        if (betAmount > balance) {
            casinoAudio.playLoss()
            return
        }
        casinoAudio.playBet()
        setUserBetLocked(true)
        setMissedWin(null)
    }

    // Execute Coin Toss Flip (used by both user-triggered and non-stop auto spectator loop)
    const runCoinToss = useCallback(async (isRealBet) => {
        if (isFlipping) return
        const currentBet = Math.floor(parseFloat(betAmount) || 0)

        setIsFlipping(true)
        setLastResult(null)
        setMissedWin(null)
        setMouseTilt({ x: 0, y: 0 })
        setIsHoveringCoin(false)

        // Launch audio
        if (typeof casinoAudio.playCoinFlip === 'function') {
            casinoAudio.playCoinFlip()
        } else {
            casinoAudio.playBet()
        }

        const spinDuration = turboMode ? 550 : 1150
        const tickInterval = turboMode ? 70 : 100

        let tickTimer = setInterval(() => {
            casinoAudio.playTick()
        }, tickInterval)

        const baseDeg = turboMode ? 1440 : 2520
        setCoinTransform(`rotateY(${baseDeg}deg) rotateX(360deg) scale(1.18)`)

        let res = null
        if (isRealBet) {
            try {
                if (executeGameBet) {
                    res = await executeGameBet({
                        game: 'coin-toss',
                        gameName: 'Coin Toss (Heads or Tails)',
                        betAmount: currentBet,
                        choice: choice,
                        targetMultiplier: MULTIPLIER
                    })
                }
            } catch (err) {
                console.error('[COIN-TOSS] Error placing bet:', err)
            }
        }

        setTimeout(() => {
            clearInterval(tickTimer)

            // Determine outcome: real bet result or simulated provably-fair outcome
            let outcome = Math.random() < 0.5 ? 'heads' : 'tails'
            let won = false
            let payout = 0

            if (isRealBet && res && res.success) {
                outcome = res.evaluation?.outcome || (res.won ? choice : (choice === 'heads' ? 'tails' : 'heads'))
                won = Boolean(res.won)
                payout = res.payout || (won ? parseFloat((currentBet * MULTIPLIER).toFixed(2)) : 0)
            } else {
                won = outcome === choice
                payout = won ? parseFloat((currentBet * MULTIPLIER).toFixed(2)) : 0
            }

            // Final settled landing degrees
            const finalDegrees = outcome === 'heads' ? 2880 : 3060
            setCoinTransform(`rotateY(${finalDegrees}deg) rotateX(0deg) scale(1)`)
            setCoinSide(outcome)

            // Impact clink
            if (typeof casinoAudio.playCoinLand === 'function') {
                casinoAudio.playCoinLand()
            }
            setLandingTrigger(Date.now())

            if (isRealBet) {
                setLastResult({
                    won,
                    outcome,
                    payout,
                    betAmount: currentBet,
                    choice
                })

                if (won) {
                    setStreakCount((prev) => prev + 1)
                    setWinTrigger(Date.now())
                    casinoAudio.playWin()
                    if (payout >= currentBet * 5) {
                        casinoAudio.playBigWin()
                    }
                } else {
                    setStreakCount(0)
                    casinoAudio.playLoss()
                }
                setUserBetLocked(false)
            } else {
                // SPECTATOR / MISSED WIN TRIGGER: Show visitor what they missed!
                setMissedWin({
                    visible: true,
                    outcome,
                    multiplier: 1.98,
                    amount: currentBet || 100,
                    payout: ((currentBet || 100) * MULTIPLIER).toFixed(0)
                })
            }

            // Record in history ribbon
            const record = {
                id: Date.now() + Math.random(),
                outcome,
                choice: isRealBet ? choice : outcome,
                won: isRealBet ? won : true,
                payout,
                betAmount: currentBet,
                timestamp: new Date(),
                serverSeedHash: res?.evaluation?.serverSeedHash || provablyFairSeed.serverSeedHash,
                serverSeed: res?.evaluation?.serverSeed || '',
                clientSeed: res?.evaluation?.clientSeed || provablyFairSeed.clientSeed,
                nonce: res?.evaluation?.nonce || provablyFairSeed.nonce
            }

            setHistory((prev) => [record, ...prev.slice(0, 19)])
            setIsFlipping(false)
            setRoundIndex((prev) => prev + 1)
            setRoundCountdown(4) // Reset countdown for next non-stop toss

            setProvablyFairSeed((prev) => ({
                ...prev,
                nonce: prev.nonce + 1
            }))
        }, spinDuration)
    }, [isFlipping, betAmount, executeGameBet, choice, provablyFairSeed, turboMode])

    // Immediate manual flip button
    const handleInstantFlip = () => {
        handleLockInBet()
        runCoinToss(true)
    }

    // NON-STOP LIVE ROUNDS TICKER LOOP
    useEffect(() => {
        if (!liveRoundsActive) return

        const timer = setInterval(() => {
            if (isFlipping) return

            setRoundCountdown((prev) => {
                if (prev <= 1) {
                    // Launch next round!
                    runCoinToss(userBetLocked)
                    return 4
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [liveRoundsActive, isFlipping, userBetLocked, runCoinToss])

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
            if (e.key === 'h' || e.key === 'H') {
                handleSelectChoice('heads')
            } else if (e.key === 't' || e.key === 'T') {
                handleSelectChoice('tails')
            } else if (e.key === ' ') {
                e.preventDefault()
                handleInstantFlip()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleSelectChoice])

    // History statistics
    const stats = useMemo(() => {
        if (!history.length) return { headsPct: 50, tailsPct: 50, wins: 0, losses: 0 }
        const heads = history.filter((h) => h.outcome === 'heads').length
        const tails = history.filter((h) => h.outcome === 'tails').length
        const wins = history.filter((h) => h.won).length
        const losses = history.filter((h) => !h.won).length
        return {
            headsPct: Math.round((heads / history.length) * 100),
            tailsPct: Math.round((tails / history.length) * 100),
            wins,
            losses
        }
    }, [history])

    const openVerifierForRound = (round) => {
        setVerifierData({
            game: 'coin-toss',
            serverSeed: round.serverSeed || '',
            clientSeed: round.clientSeed || 'amrat-player',
            nonce: round.nonce || 1
        })
        setVerifierOpen(true)
    }

    const activeTransform = isFlipping
        ? coinTransform
        : isHoveringCoin
        ? `perspective(1000px) rotateX(${mouseTilt.x}deg) rotateY(${mouseTilt.y + (coinSide === 'heads' ? 0 : 180)}deg)`
        : coinSide === 'heads'
        ? 'rotateY(0deg)'
        : 'rotateY(180deg)'

    return (
        <div className="coin-toss-wrapper">
            {/* Top Game Bar */}
            <header className="coin-toss-header">
                <div className="header-meta">
                    <span className="badge-live-pulse">
                        <span className="pulse-dot" /> LIVE ROUND #{roundIndex}
                    </span>
                    <span className="badge-countdown">
                        <ClockCircleFilled /> TOSS IN {roundCountdown}s
                    </span>
                    <span className="badge-rtp">🪙 99% RTP</span>
                    <span className="badge-mult">1.98X</span>
                    {turboMode && (
                        <span className="badge-turbo">
                            <RocketOutlined /> TURBO
                        </span>
                    )}
                </div>

                <div className="header-actions">
                    <button
                        type="button"
                        className={`header-action-btn ${liveRoundsActive ? 'active-auto' : ''}`}
                        onClick={() => setLiveRoundsActive((prev) => !prev)}
                        title="Toggle Non-Stop 24/7 Rounds"
                    >
                        {liveRoundsActive ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                        <span className="btn-label">{liveRoundsActive ? 'Non-Stop ON' : 'Non-Stop OFF'}</span>
                    </button>

                    <button
                        type="button"
                        className={`header-action-btn ${turboMode ? 'active-turbo' : ''}`}
                        onClick={() => setTurboMode((prev) => !prev)}
                        title={turboMode ? 'Turbo Mode' : 'Arcade Mode'}
                    >
                        <ThunderboltOutlined />
                        <span className="btn-label">{turboMode ? 'Turbo ON' : 'Turbo'}</span>
                    </button>

                    <button
                        type="button"
                        className="header-action-btn"
                        onClick={handleToggleMute}
                        aria-label="Toggle Sound"
                        title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                    >
                        <SoundOutlined className={isMuted ? 'muted' : ''} />
                    </button>

                    <button
                        type="button"
                        className="header-action-btn verifier-btn"
                        onClick={() => {
                            setVerifierData({
                                game: 'coin-toss',
                                clientSeed: provablyFairSeed.clientSeed,
                                nonce: provablyFairSeed.nonce
                            })
                            setVerifierOpen(true)
                        }}
                        title="Verify Provably Fair HMAC-SHA256"
                    >
                        <SafetyCertificateOutlined />
                        <span className="btn-label">Fairness</span>
                    </button>
                </div>
            </header>

            {/* Main Stage Grid */}
            <div className="coin-toss-arena">
                {/* 3D Coin Canvas / Flip Zone */}
                <div
                    className="coin-stage-card"
                    onMouseMove={handleStageMouseMove}
                    onMouseLeave={handleStageMouseLeave}
                >
                    {/* HTML5 Canvas Sparkles & Win Particles Overlay */}
                    <CoinParticles
                        isFlipping={isFlipping}
                        landingTrigger={landingTrigger}
                        winTrigger={winTrigger}
                    />

                    {/* Live Flip Streak Ribbon */}
                    <div className="history-ribbon">
                        <span className="history-label">RECENT:</span>
                        <div className="history-pills">
                            {history.length === 0 ? (
                                <span className="history-empty">Live rounds tossing non-stop...</span>
                            ) : (
                                history.slice(0, 10).map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={`history-pill-asset ${item.outcome} ${item.won ? 'is-win' : 'is-loss'}`}
                                        onClick={() => openVerifierForRound(item)}
                                        title={`Outcome: ${item.outcome.toUpperCase()} (${item.won ? 'WON' : 'LOST'}). Click to verify.`}
                                    >
                                        <img
                                            src={item.outcome === 'heads' ? HEADS_ASSET : TAILS_ASSET}
                                            alt={item.outcome}
                                            className="history-pill-img"
                                        />
                                        <span className="pill-letter">{item.outcome === 'heads' ? 'H' : 'T'}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Central 3D Coin Animation Stage */}
                    <div className="coin-viewport">
                        {/* Table Pedestal Shockwave Ring */}
                        <div className={`table-impact-ring ${landingTrigger ? 'trigger-impact' : ''}`} key={landingTrigger} />

                        {/* 3D Coin Object with True Physical Assets & Milled Ridges */}
                        <div
                            className={`coin-3d-object ${isFlipping ? (turboMode ? 'is-flipping-turbo' : 'is-flipping') : ''}`}
                            style={{ transform: activeTransform }}
                            aria-label={`3D Coin facing ${coinSide}`}
                        >
                            {/* Heads Face Asset */}
                            <div className="coin-face coin-face-heads">
                                <img
                                    src={HEADS_ASSET}
                                    alt="Royal Casino Heads Coin"
                                    className="coin-artwork-img"
                                />
                                <div className="coin-inner-rim-bevel" />
                                <div className={`coin-glint-sweep ${isFlipping ? 'glint-active' : ''}`} />
                            </div>

                            {/* 3D Cylindrical Edge Ridges (Milled Reeding) */}
                            <div className="coin-reeded-edge" />

                            {/* Tails Face Asset */}
                            <div className="coin-face coin-face-tails">
                                <img
                                    src={TAILS_ASSET}
                                    alt="Royal Casino Tails Coin"
                                    className="coin-artwork-img"
                                />
                                <div className="coin-inner-rim-bevel" />
                                <div className={`coin-glint-sweep ${isFlipping ? 'glint-active' : ''}`} />
                            </div>
                        </div>

                        {/* Interactive Dynamic Coin Shadow */}
                        <div
                            className={`coin-shadow ${isFlipping ? (turboMode ? 'shadow-turbo' : 'shadow-floating') : ''}`}
                        />

                        {/* Real Result Splash Badge (Only shown when user bet) */}
                        {lastResult && !isFlipping && (
                            <div className={`result-splash-badge ${lastResult.won ? 'won' : 'lost'}`}>
                                <div className="splash-icon">
                                    {lastResult.won ? '🎉' : '💀'}
                                </div>
                                <div className="splash-info">
                                    <div className="splash-title">
                                        {lastResult.won
                                            ? `YOU WON ${currencySymbol}${lastResult.payout.toLocaleString('en-IN')}!`
                                            : `COIN LANDED ON ${lastResult.outcome.toUpperCase()}`}
                                    </div>
                                    <div className="splash-subtitle">
                                        {lastResult.won
                                            ? `Multiplier 1.98x • Net Profit +${currencySymbol}${(lastResult.payout - lastResult.betAmount).toLocaleString('en-IN')}`
                                            : `Better luck next flip! Press Space to try again.`}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* MISSED OPPORTUNITY / FOMO BANNER FOR SPECTATORS / VISITORS */}
                        <MissedWinBanner
                            visible={Boolean(missedWin && missedWin.visible && !isFlipping && !lastResult)}
                            outcome={missedWin?.outcome}
                            multiplier={missedWin?.multiplier}
                            amount={missedWin?.amount}
                            payout={missedWin?.payout}
                            currencySymbol={currencySymbol}
                            countdown={roundCountdown}
                            onAction={handleLockInBet}
                        />
                    </div>

                    {/* Win Ratio Stats Bar */}
                    <div className="stats-indicator-bar">
                        <div className="stat-col">
                            <span className="stat-name">HEADS</span>
                            <span className="stat-val heads-color">{stats.headsPct}%</span>
                        </div>
                        <div className="stat-progress-bar">
                            <div
                                className="progress-heads"
                                style={{ width: `${stats.headsPct}%` }}
                            />
                            <div
                                className="progress-tails"
                                style={{ width: `${stats.tailsPct}%` }}
                            />
                        </div>
                        <div className="stat-col">
                            <span className="stat-name">TAILS</span>
                            <span className="stat-val tails-color">{stats.tailsPct}%</span>
                        </div>
                    </div>
                </div>

                {/* Betting Control Panel */}
                <div className="coin-controls-card">
                    {/* Live Next Round Queue Status */}
                    <div className={`live-queue-indicator ${userBetLocked ? 'is-locked-in' : ''}`}>
                        <div className="queue-status-text">
                            {userBetLocked ? (
                                <span>
                                    <CheckCircleFilled style={{ color: '#10b981' }} /> BET LOCKED IN FOR NEXT TOSS
                                </span>
                            ) : (
                                <span>
                                    <ClockCircleFilled /> TOSSING IN {roundCountdown}s • Place bet to participate!
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Choose Heads or Tails - Clean & Crisp */}
                    <div className="control-group">
                        <div className="control-title-row">
                            <label className="control-title">
                                Select Prediction
                            </label>
                        </div>
                        <div className="side-selector-grid">
                            {/* Heads Prediction Card */}
                            <button
                                type="button"
                                className={`side-card side-heads ${choice === 'heads' ? 'selected' : ''}`}
                                onClick={() => handleSelectChoice('heads')}
                            >
                                <div className="side-asset-avatar">
                                    <img
                                        src={HEADS_ASSET}
                                        alt="Heads Coin"
                                        className="side-asset-img"
                                    />
                                </div>
                                <div className="side-card-info">
                                    <span className="side-card-name">HEADS</span>
                                </div>
                                {choice === 'heads' && (
                                    <CheckCircleFilled className="selection-badge-icon" />
                                )}
                            </button>

                            {/* Tails Prediction Card */}
                            <button
                                type="button"
                                className={`side-card side-tails ${choice === 'tails' ? 'selected' : ''}`}
                                onClick={() => handleSelectChoice('tails')}
                            >
                                <div className="side-asset-avatar">
                                    <img
                                        src={TAILS_ASSET}
                                        alt="Tails Coin"
                                        className="side-asset-img"
                                    />
                                </div>
                                <div className="side-card-info">
                                    <span className="side-card-name">TAILS</span>
                                </div>
                                {choice === 'tails' && (
                                    <CheckCircleFilled className="selection-badge-icon" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Bet Amount Input & Presets */}
                    <div className="control-group">
                        <div className="control-title-row">
                            <label className="control-title" htmlFor="coin-bet-amount">
                                Bet Amount
                            </label>
                            <span className="balance-hint">
                                Balance: {currencySymbol}{Number(balance || 0).toLocaleString('en-IN')}
                            </span>
                        </div>

                        <div className="bet-input-box">
                            <span className="input-currency">{currencySymbol}</span>
                            <input
                                id="coin-bet-amount"
                                type="number"
                                min={MIN_BET}
                                max={MAX_BET}
                                step="10"
                                className="bet-input-field"
                                value={betAmount}
                                onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                                    setBetAmount(val)
                                }}
                            />
                            <div className="bet-math-buttons">
                                <button
                                    type="button"
                                    className="math-btn"
                                    onClick={() => multiplyBet(0.5)}
                                >
                                    ½
                                </button>
                                <button
                                    type="button"
                                    className="math-btn"
                                    onClick={() => multiplyBet(2)}
                                >
                                    2X
                                </button>
                                <button
                                    type="button"
                                    className="math-btn max-btn"
                                    onClick={setMaxBet}
                                >
                                    MAX
                                </button>
                            </div>
                        </div>

                        {/* Quick Chip Preset Pills */}
                        <div className="preset-chips-row">
                            {PRESET_AMOUNTS.map((amt) => (
                                <button
                                    key={amt}
                                    type="button"
                                    className={`preset-chip ${betAmount === amt ? 'active' : ''}`}
                                    onClick={() => setExactBet(amt)}
                                >
                                    +{currencySymbol}{amt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Return & Profit Preview with Multiplier in Bottom */}
                    <div className="payout-summary-card">
                        <div className="payout-summary-item">
                            <span className="summary-lbl">Multiplier</span>
                            <span className="summary-val mult-val">1.98×</span>
                        </div>
                        <div className="payout-summary-divider" />
                        <div className="payout-summary-item">
                            <span className="summary-lbl">Potential Win</span>
                            <span className="summary-val win-val">
                                {currencySymbol}{potentialPayout.toLocaleString('en-IN')}
                            </span>
                        </div>
                        <div className="payout-summary-divider" />
                        <div className="payout-summary-item">
                            <span className="summary-lbl">Net Profit</span>
                            <span className="summary-val profit-val">
                                +{currencySymbol}{potentialProfit.toLocaleString('en-IN')}
                            </span>
                        </div>
                    </div>

                    {/* Primary Bet / Next Toss Button */}
                    <div className="action-buttons-row">
                        <button
                            type="button"
                            className={`flip-submit-btn ${userBetLocked ? 'is-queued' : ''} ${isFlipping ? 'is-animating' : ''}`}
                            onClick={handleLockInBet}
                            disabled={betAmount > balance || betAmount < MIN_BET}
                        >
                            {isFlipping ? (
                                <span className="btn-flipping-label">
                                    <span className="flipping-spinner" /> FLIPPING COIN...
                                </span>
                            ) : userBetLocked ? (
                                <span>
                                    ✓ BET LOCKED FOR NEXT TOSS ({roundCountdown}s)
                                </span>
                            ) : betAmount > balance ? (
                                <span>INSUFFICIENT BALANCE</span>
                            ) : (
                                <span>
                                    FLIP {choice.toUpperCase()} ({currencySymbol}{betAmount.toLocaleString('en-IN')})
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Streak & Hot Multiplier Notification */}
                    {streakCount > 1 && (
                        <div className="streak-banner">
                            <FireOutlined className="streak-icon" />
                            <span>
                                <strong>{streakCount}X WIN STREAK!</strong> You are on fire!
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* In-Window Game Specific Round History (Scroll down to view) */}
            <GameBottomHistory
                gameKey="coin-toss"
                gameTitle="Coin Toss"
                localRounds={history}
            />

            {/* Provably Fair Verifier Modal */}
            <ProvablyFairVerifierModal
                isOpen={verifierOpen}
                onClose={() => setVerifierOpen(false)}
                initialData={verifierData}
            />
        </div>
    )
}
