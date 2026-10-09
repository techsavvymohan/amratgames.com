import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Typography, Modal, Tooltip } from 'antd'
import {
    ThunderboltOutlined,
    SafetyCertificateOutlined,
    HistoryOutlined,
    TrophyOutlined,
    SoundOutlined,
    ReloadOutlined,
    InfoCircleOutlined
} from '@ant-design/icons'
import { useWallet } from '../../context/WalletContext'
import casinoAudio from '../../utils/casinoAudio'
import ProvablyFairVerifierModal from '../../components/ProvablyFair/ProvablyFairVerifierModal'
import './CoinTossGame.css'

const { Text } = Typography

const MULTIPLIER = 1.98 // 99% RTP / 1% House Edge
const MIN_BET = 10
const MAX_BET = 100000
const PRESET_AMOUNTS = [10, 50, 100, 500, 1000]

export default function CoinTossGame() {
    const { balance, currencySymbol, executeGameBet } = useWallet()

    // Betting selections
    const [choice, setChoice] = useState('heads') // 'heads' | 'tails'
    const [betAmount, setBetAmount] = useState(100)
    const [isFlipping, setIsFlipping] = useState(false)

    // Animation & Outcome states
    const [coinTransform, setCoinTransform] = useState('rotateY(0deg)')
    const [coinSide, setCoinSide] = useState('heads') // current visible side
    const [lastResult, setLastResult] = useState(null) // { won: bool, outcome: 'heads'|'tails', payout: number }
    const [streakCount, setStreakCount] = useState(0)

    // History and stats
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
        if (isFlipping) return
        casinoAudio.playChip()
        setBetAmount((prev) => {
            const next = Math.max(MIN_BET, Math.min(MAX_BET, Math.floor((prev || 0) + delta)))
            return next
        })
    }

    const multiplyBet = (factor) => {
        if (isFlipping) return
        casinoAudio.playChip()
        setBetAmount((prev) => {
            const base = prev || MIN_BET
            const next = Math.max(MIN_BET, Math.min(MAX_BET, Math.floor(base * factor)))
            return next
        })
    }

    const setExactBet = (amt) => {
        if (isFlipping) return
        casinoAudio.playChip()
        setBetAmount(amt)
    }

    const setMaxBet = () => {
        if (isFlipping) return
        casinoAudio.playChip()
        const maxAffordable = Math.min(MAX_BET, Math.floor(balance || MIN_BET))
        setBetAmount(Math.max(MIN_BET, maxAffordable))
    }

    // Toggle mute
    const handleToggleMute = () => {
        const next = casinoAudio.toggleMute()
        setIsMuted(next)
    }

    // Execute Coin Toss Flip
    const handleFlip = useCallback(async () => {
        if (isFlipping) return
        const currentBet = Math.floor(parseFloat(betAmount) || 0)
        if (currentBet < MIN_BET) return
        if (currentBet > balance) {
            casinoAudio.playLoss()
            return
        }

        setIsFlipping(true)
        setLastResult(null)
        casinoAudio.playBet()

        // Flip launch sound
        let tickTimer = setInterval(() => {
            casinoAudio.playTick()
        }, 110)

        // Random spin revolutions for 3D physics (5 full turns = 1800deg)
        const baseTurns = 1800 + Math.floor(Math.random() * 2) * 360
        // Initial spinning animation in CSS
        setCoinTransform(`rotateY(${baseTurns}deg) scale(1.15)`)

        let res = null
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

        // Wait for realistic coin toss arc (1.1s total spin duration)
        setTimeout(() => {
            clearInterval(tickTimer)

            if (!res || !res.success) {
                setIsFlipping(false)
                setCoinTransform('rotateY(0deg)')
                return
            }

            const outcome = res.evaluation?.outcome || (res.won ? choice : (choice === 'heads' ? 'tails' : 'heads'))
            const won = Boolean(res.won)
            const payout = res.payout || (won ? parseFloat((currentBet * MULTIPLIER).toFixed(2)) : 0)

            // Calculate landing angle: Heads = 0deg or 360deg, Tails = 180deg
            const finalDegrees = outcome === 'heads' ? 2160 : 2340
            setCoinTransform(`rotateY(${finalDegrees}deg) scale(1)`)
            setCoinSide(outcome)

            setLastResult({
                won,
                outcome,
                payout,
                betAmount: currentBet,
                choice
            })

            // Update streaks
            if (won) {
                setStreakCount((prev) => prev + 1)
                casinoAudio.playWin()
                if (payout >= currentBet * 5) {
                    casinoAudio.playBigWin()
                }
            } else {
                setStreakCount(0)
                casinoAudio.playLoss()
            }

            // Record in history
            const record = {
                id: Date.now() + Math.random(),
                outcome,
                choice,
                won,
                payout,
                betAmount: currentBet,
                timestamp: new Date(),
                serverSeedHash: res.evaluation?.serverSeedHash || provablyFairSeed.serverSeedHash,
                serverSeed: res.evaluation?.serverSeed || '',
                clientSeed: res.evaluation?.clientSeed || provablyFairSeed.clientSeed,
                nonce: res.evaluation?.nonce || provablyFairSeed.nonce
            }

            setHistory((prev) => [record, ...prev.slice(0, 19)])
            setIsFlipping(false)

            // Update Provably Fair nonce
            setProvablyFairSeed((prev) => ({
                ...prev,
                nonce: prev.nonce + 1
            }))
        }, 1150)
    }, [isFlipping, betAmount, balance, executeGameBet, choice, provablyFairSeed])

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

    return (
        <div className="coin-toss-wrapper">
            {/* Top Game Bar */}
            <header className="coin-toss-header">
                <div className="header-meta">
                    <span className="badge-rtp">🪙 99% RTP</span>
                    <span className="badge-mult">1.98X MULTIPLIER</span>
                    <span className="badge-provable">
                        <SafetyCertificateOutlined /> Provably Fair
                    </span>
                </div>

                <div className="header-actions">
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
                <div className="coin-stage-card">
                    {/* Live Flip Streak Ribbon */}
                    <div className="history-ribbon">
                        <span className="history-label">RECENT:</span>
                        <div className="history-pills">
                            {history.length === 0 ? (
                                <span className="history-empty">Make your first flip below!</span>
                            ) : (
                                history.slice(0, 10).map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={`history-pill ${item.outcome} ${item.won ? 'is-win' : 'is-loss'}`}
                                        onClick={() => openVerifierForRound(item)}
                                        title={`Flip: ${item.outcome.toUpperCase()} (${item.won ? 'WON' : 'LOST'}). Click to verify.`}
                                    >
                                        {item.outcome === 'heads' ? 'H' : 'T'}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Central 3D Coin Animation Stage */}
                    <div className="coin-viewport">
                        <div
                            className={`coin-3d-object ${isFlipping ? 'is-flipping' : ''}`}
                            style={{ transform: coinTransform }}
                            aria-label={`3D Coin facing ${coinSide}`}
                        >
                            {/* Heads Face */}
                            <div className="coin-face coin-face-heads">
                                <div className="coin-ring">
                                    <div className="coin-crest">
                                        <div className="crown-icon">👑</div>
                                        <div className="coin-label">HEADS</div>
                                        <div className="coin-sublabel">1.98X</div>
                                    </div>
                                </div>
                            </div>

                            {/* Tails Face */}
                            <div className="coin-face coin-face-tails">
                                <div className="coin-ring">
                                    <div className="coin-crest">
                                        <div className="star-icon">⭐</div>
                                        <div className="coin-label">TAILS</div>
                                        <div className="coin-sublabel">1.98X</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Coin Shadow that reacts to height */}
                        <div className={`coin-shadow ${isFlipping ? 'shadow-floating' : ''}`} />

                        {/* Result Splash Badge */}
                        {lastResult && !isFlipping && (
                            <div className={`result-splash-badge ${lastResult.won ? 'won' : 'lost'}`}>
                                <div className="splash-icon">
                                    {lastResult.won ? '🎉' : '💀'}
                                </div>
                                <div className="splash-info">
                                    <div className="splash-title">
                                        {lastResult.won
                                            ? `YOU WON ${currencySymbol}${lastResult.payout.toLocaleString('en-IN')}`
                                            : `COIN LANDED ON ${lastResult.outcome.toUpperCase()}`}
                                    </div>
                                    <div className="splash-subtitle">
                                        {lastResult.won
                                            ? `Multiplier 1.98x • Net Profit +${currencySymbol}${(lastResult.payout - lastResult.betAmount).toLocaleString('en-IN')}`
                                            : `Better luck next toss!`}
                                    </div>
                                </div>
                            </div>
                        )}
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
                    {/* Choose Heads or Tails */}
                    <div className="control-group">
                        <label className="control-title">
                            <span>1. SELECT YOUR PREDICTION</span>
                            <span className="payout-pill">WIN 1.98X</span>
                        </label>
                        <div className="side-selector-grid">
                            <button
                                type="button"
                                className={`side-card side-heads ${choice === 'heads' ? 'selected' : ''}`}
                                onClick={() => {
                                    if (!isFlipping) {
                                        casinoAudio.playChip()
                                        setChoice('heads')
                                    }
                                }}
                                disabled={isFlipping}
                            >
                                <div className="side-card-icon">👑</div>
                                <div className="side-card-info">
                                    <span className="side-card-name">HEADS</span>
                                    <span className="side-card-mult">1.98x Payout</span>
                                </div>
                                {choice === 'heads' && <span className="selection-checkmark">✓</span>}
                            </button>

                            <button
                                type="button"
                                className={`side-card side-tails ${choice === 'tails' ? 'selected' : ''}`}
                                onClick={() => {
                                    if (!isFlipping) {
                                        casinoAudio.playChip()
                                        setChoice('tails')
                                    }
                                }}
                                disabled={isFlipping}
                            >
                                <div className="side-card-icon">⭐</div>
                                <div className="side-card-info">
                                    <span className="side-card-name">TAILS</span>
                                    <span className="side-card-mult">1.98x Payout</span>
                                </div>
                                {choice === 'tails' && <span className="selection-checkmark">✓</span>}
                            </button>
                        </div>
                    </div>

                    {/* Bet Amount Input & Presets */}
                    <div className="control-group">
                        <div className="control-title-row">
                            <label className="control-title" htmlFor="coin-bet-amount">
                                2. BET AMOUNT
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
                                disabled={isFlipping}
                            />
                            <div className="bet-math-buttons">
                                <button
                                    type="button"
                                    className="math-btn"
                                    onClick={() => multiplyBet(0.5)}
                                    disabled={isFlipping}
                                >
                                    ½
                                </button>
                                <button
                                    type="button"
                                    className="math-btn"
                                    onClick={() => multiplyBet(2)}
                                    disabled={isFlipping}
                                >
                                    2X
                                </button>
                                <button
                                    type="button"
                                    className="math-btn max-btn"
                                    onClick={setMaxBet}
                                    disabled={isFlipping}
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
                                    disabled={isFlipping}
                                >
                                    +{currencySymbol}{amt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Return & Profit Preview */}
                    <div className="payout-summary-card">
                        <div className="payout-summary-item">
                            <span className="summary-lbl">Potential Win:</span>
                            <span className="summary-val win-val">
                                {currencySymbol}{potentialPayout.toLocaleString('en-IN')}
                            </span>
                        </div>
                        <div className="payout-summary-divider" />
                        <div className="payout-summary-item">
                            <span className="summary-lbl">Net Profit:</span>
                            <span className="summary-val profit-val">
                                +{currencySymbol}{potentialProfit.toLocaleString('en-IN')}
                            </span>
                        </div>
                    </div>

                    {/* Primary Flip Action Button */}
                    <button
                        type="button"
                        className={`flip-submit-btn ${isFlipping ? 'is-animating' : ''}`}
                        onClick={handleFlip}
                        disabled={isFlipping || betAmount > balance || betAmount < MIN_BET}
                    >
                        {isFlipping ? (
                            <span className="btn-flipping-label">
                                <span className="flipping-spinner" /> FLIPPING COIN...
                            </span>
                        ) : betAmount > balance ? (
                            <span>INSUFFICIENT BALANCE</span>
                        ) : (
                            <span>
                                FLIP {choice.toUpperCase()} ({currencySymbol}{betAmount.toLocaleString('en-IN')})
                            </span>
                        )}
                    </button>

                    {/* Streak Info */}
                    {streakCount > 1 && (
                        <div className="streak-banner">
                            <TrophyOutlined className="streak-icon" />
                            <span>
                                <strong>{streakCount} FLIP WIN STREAK!</strong> Double up luck!
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Provably Fair Verifier Modal */}
            <ProvablyFairVerifierModal
                isOpen={verifierOpen}
                onClose={() => setVerifierOpen(false)}
                initialData={verifierData}
            />
        </div>
    )
}
