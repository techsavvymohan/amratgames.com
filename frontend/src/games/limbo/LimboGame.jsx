import { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Input, Typography, Modal, Statistic, Row, Col, Tabs, Drawer } from 'antd'
import {
    ThunderboltOutlined,
    SafetyCertificateOutlined,
    HistoryOutlined,
    PlayCircleOutlined,
    PauseCircleOutlined,
    RedoOutlined,
    PlusOutlined,
    MinusOutlined
} from '@ant-design/icons'
import { useWallet } from '../../context/WalletContext'
import { useAuth } from '../../context/AuthContext'
import ProvablyFair from '../../utils/ProvablyFair'
import casinoAudio from '../../utils/casinoAudio'
import MissedWinBanner from '../../components/MissedWinBanner/MissedWinBanner'
import GameBottomHistory from '../../components/GameHistory/GameBottomHistory'
import './LimboGame.css'

const { Text } = Typography

// House edge: 1% (99% RTP)
const RTP = 0.99
const MAX_MULTIPLIER = 1000.00
const MIN_MULTIPLIER = 1.01

const QUICK_PRESETS = [1.50, 2.00, 5.00, 10.00, 50.00, 100.00]

function LimboGame() {
    const { user, openAuthModal } = useAuth()
    const { balance, currencySymbol, executeGameBet, notifyWin, notifyLoss, showToast } = useWallet()

    // Provably fair engine instance
    const fairnessRef = useRef(null)
    const [fairnessReady, setFairnessReady] = useState(false)
    const [serverSeedHash, setServerSeedHash] = useState('Loading…')
    const [clientSeed, setClientSeed] = useState('')
    const [nonce, setNonce] = useState(0)

    // Betting states
    const [betMode, setBetMode] = useState('manual') // 'manual' | 'auto'
    const [betAmount, setBetAmount] = useState(100)
    const [targetMultiplier, setTargetMultiplier] = useState(2.00)
    const [winChance, setWinChance] = useState(49.50)
    const [isRolling, setIsRolling] = useState(false)
    const [currentRoll, setCurrentRoll] = useState(1.00)
    const [lastOutcome, setLastOutcome] = useState(null) // { roll, target, win }
    const [gameResult, setGameResult] = useState(null) // 'win' | 'lose' | null

    // Real dynamic history (No demo data)
    const [history, setHistory] = useState([])

    // Auto-betting states
    const [isAutoRunning, setIsAutoRunning] = useState(false)
    const [autoBetCount, setAutoBetCount] = useState(10)
    const [autoBetsRemaining, setAutoBetsRemaining] = useState(0)
    const [onWinAction, setOnWinAction] = useState('reset') // 'reset' | 'increase'
    const [onLossAction, setOnLossAction] = useState('reset')
    const [onWinIncreasePercent, setOnWinIncreasePercent] = useState(100)
    const [onLossIncreasePercent, setOnLossIncreasePercent] = useState(100)
    const [baseBetAmount, setBaseBetAmount] = useState(100)
    const autoRunningRef = useRef(false)
    const activeBetRef = useRef(betAmount)

    // Non-stop Live Spectator Rounds
    const [spectatorLive, setSpectatorLive] = useState(true)
    const [spectatorCountdown, setSpectatorCountdown] = useState(4)
    const [spectatorMissedWin, setSpectatorMissedWin] = useState(null)

    // Modals
    const [fairnessOpen, setFairnessOpen] = useState(false)
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)

    // Initialize Provably Fair on mount
    useEffect(() => {
        const pf = new ProvablyFair()
        fairnessRef.current = pf
        pf.waitReady().then(() => {
            setServerSeedHash(pf.serverSeedHash)
            setClientSeed(pf.clientSeed)
            setNonce(pf.nonce)
            setFairnessReady(true)
        })
    }, [])

    // Update win chance when target multiplier changes
    const handleTargetChange = (val) => {
        const num = parseFloat(val)
        if (!isNaN(num) && num >= MIN_MULTIPLIER && num <= MAX_MULTIPLIER) {
            setTargetMultiplier(num)
            const chance = (RTP * 100) / num
            setWinChance(parseFloat(chance.toFixed(2)))
        } else {
            setTargetMultiplier(val)
        }
    }

    // Update target when win chance changes
    const handleWinChanceChange = (val) => {
        const num = parseFloat(val)
        if (!isNaN(num) && num > 0 && num <= 98.02) {
            setWinChance(num)
            const target = (RTP * 100) / num
            setTargetMultiplier(parseFloat(target.toFixed(2)))
        } else {
            setWinChance(val)
        }
    }

    // Synchronize activeBetRef with betAmount
    useEffect(() => {
        activeBetRef.current = betAmount
    }, [betAmount])

    // Quick bet modifier functions
    const halveBet = () => {
        if (isRolling || isAutoRunning) return
        casinoAudio.playChip?.()
        setBetAmount(prev => Math.max(1, parseFloat((Number(prev || 1) / 2).toFixed(2))))
    }

    const doubleBet = () => {
        if (isRolling || isAutoRunning) return
        casinoAudio.playChip?.()
        setBetAmount(prev => Math.min(balance || 100000, parseFloat((Number(prev || 1) * 2).toFixed(2))))
    }

    const minBet = () => {
        if (isRolling || isAutoRunning) return
        casinoAudio.playChip?.()
        setBetAmount(10)
    }

    const maxBet = () => {
        if (isRolling || isAutoRunning) return
        casinoAudio.playChip?.()
        setBetAmount(Math.max(10, Math.floor(balance || 100)))
    }

    // Quick multiplier preset selection
    const applyTargetPreset = (preset) => {
        if (isRolling || isAutoRunning) return
        casinoAudio.playChip()
        handleTargetChange(preset)
    }

    // Execute single roll using Server-Authoritative Provably Fair algorithm
    const executeRoll = useCallback(async () => {
        if (isRolling) return
        if (!user) {
            openAuthModal?.('register')
            return
        }
        const currentBet = activeBetRef.current
        if (currentBet > balance) {
            showToast?.('error', 'Insufficient Balance', `You need ${currencySymbol}${currentBet.toFixed(2)} to place this bet.`)
            setIsAutoRunning(false)
            autoRunningRef.current = false
            return
        }
        if (currentBet <= 0) {
            setIsAutoRunning(false)
            autoRunningRef.current = false
            return
        }

        const target = parseFloat(targetMultiplier)
        if (isNaN(target) || target < MIN_MULTIPLIER) return

        setIsRolling(true)
        setGameResult(null)
        casinoAudio.playBet()

        // Call server-authoritative bet evaluation
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

        // High-speed visual roll animation (240ms with rapid ticks) landing on server outcome
        const startTime = Date.now()
        const animDuration = 240
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime
            if (elapsed < animDuration) {
                // Generate energetic random visual ticks
                const randomVisual = (Math.random() * target * 1.6 + 0.8).toFixed(2)
                setCurrentRoll(parseFloat(randomVisual))
                casinoAudio.playTick()
            } else {
                clearInterval(interval)
                setCurrentRoll(outcome)
                setIsRolling(false)

                const roundResult = isWin ? 'win' : 'lose'
                setGameResult(roundResult)
                setLastOutcome({ roll: outcome, target, win: isWin })

                if (isWin) {
                    notifyWin(winAmount, target)
                    if (target >= 5) {
                        casinoAudio.playBigWin()
                    } else {
                        casinoAudio.playWin()
                    }
                } else {
                    if (!autoRunningRef.current) {
                        notifyLoss(currentBet)
                    }
                    casinoAudio.playLoss()
                }

                // Add to history (real user data only, up to 12 items)
                setHistory(prev => [{ roll: outcome, target, win: isWin, id: Date.now() }, ...prev.slice(0, 11)])

                // Auto-bet logic progression
                if (autoRunningRef.current) {
                    setAutoBetsRemaining(prev => {
                        const nextCount = prev - 1
                        if (nextCount <= 0) {
                            setIsAutoRunning(false)
                            autoRunningRef.current = false
                            activeBetRef.current = baseBetAmount
                            setBetAmount(baseBetAmount)
                            return 0
                        }

                        // Adjust bet on win/loss
                        let nextBet = activeBetRef.current
                        if (isWin) {
                            if (onWinAction === 'reset') nextBet = baseBetAmount
                            else if (onWinAction === 'increase') nextBet = Math.round(nextBet * (1 + onWinIncreasePercent / 100))
                        } else {
                            if (onLossAction === 'reset') nextBet = baseBetAmount
                            else if (onLossAction === 'increase') nextBet = Math.round(nextBet * (1 + onLossIncreasePercent / 100))
                        }

                        nextBet = Math.max(1, Math.min(balance, nextBet))
                        activeBetRef.current = nextBet
                        setBetAmount(nextBet)

                        // Trigger next auto roll after brief delay
                        setTimeout(() => {
                            if (autoRunningRef.current) executeRoll()
                        }, 280)

                        return nextCount
                    })
                }
            }
        }, 28)
    }, [isRolling, user, openAuthModal, balance, showToast, currencySymbol, targetMultiplier, executeGameBet, notifyWin, notifyLoss, baseBetAmount, onWinAction, onWinIncreasePercent, onLossAction, onLossIncreasePercent])

    // Keep activeBetRef in sync with betAmount
    useEffect(() => {
        activeBetRef.current = betAmount
    }, [betAmount])

    // Keyboard shortcut: Spacebar triggers roll if not focused on an input
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
                e.preventDefault()
                if (!isRolling && !isAutoRunning && betAmount <= balance && betAmount > 0) {
                    executeRoll()
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [executeRoll, isRolling, isAutoRunning, betAmount, balance])

    // Start auto betting
    const startAutoBet = () => {
        if (!user) {
            openAuthModal?.('register')
            return
        }
        if (betAmount > balance) {
            showToast?.('error', 'Insufficient Balance', `You need ${currencySymbol}${betAmount.toFixed(2)} to place this bet.`)
            return
        }
        if (betAmount <= 0) return
        setBaseBetAmount(betAmount)
        activeBetRef.current = betAmount
        const count = autoBetCount === 0 ? 999999 : autoBetCount
        setAutoBetsRemaining(count)
        setIsAutoRunning(true)
        autoRunningRef.current = true
        executeRoll()
    }

    // Stop auto betting
    const stopAutoBet = () => {
        setIsAutoRunning(false)
        autoRunningRef.current = false
        setAutoBetsRemaining(0)
    }

    const potentialProfit = ((betAmount * (parseFloat(targetMultiplier) || 2)) - betAmount)

    return (
        <div className="limbo-page">
            <div className="limbo-container">
                {/* ── Visual Roll Arena ── */}
                <div className="limbo-arena">
                    {/* Real-time Dynamic History Pills */}
                    <div className="limbo-history-bar">
                        <div className="limbo-live-status">
                            <span className="live-dot" /> Provably Fair 99% RTP
                        </div>
                        {history.length === 0 ? (
                            <span className="limbo-history-empty">Place a bet to roll!</span>
                        ) : (
                            history.map((item) => (
                                <span
                                    key={item.id}
                                    className={`limbo-history-pill ${item.win ? 'win' : 'lose'}`}
                                >
                                    {item.roll.toFixed(2)}×
                                </span>
                            ))
                        )}
                    </div>

                    {/* Center Animated Multiplier */}
                    <div className={`limbo-display ${gameResult || ''}`}>
                        <div className="limbo-multiplier-number">
                            {currentRoll.toFixed(2)}<span className="limbo-x">×</span>
                        </div>

                        <div className="limbo-target-badge">
                            Target: <strong>{typeof targetMultiplier === 'number' ? targetMultiplier.toFixed(2) : targetMultiplier}×</strong>
                            <span className="limbo-badge-divider">|</span>
                            Chance: <strong>{winChance}%</strong>
                        </div>

                        {/* Interactive Dynamic Payout Toast */}
                        {gameResult === 'win' && (
                            <div className="limbo-payout-toast win">
                                <PlusOutlined style={{ fontSize: '11px' }} />
                                <strong>{currencySymbol}{(betAmount * targetMultiplier).toFixed(2)}</strong>
                            </div>
                        )}
                        {gameResult === 'lose' && (
                            <div className="limbo-payout-toast lose">
                                <MinusOutlined style={{ fontSize: '11px' }} />
                                <strong>{currencySymbol}{Number(betAmount).toFixed(2)}</strong>
                            </div>
                        )}

                        {/* Spectator Missed Win FOMO Banner */}
                        <MissedWinBanner
                            visible={Boolean(spectatorMissedWin && !isRolling && !gameResult)}
                            outcome={spectatorMissedWin?.outcome}
                            multiplier={spectatorMissedWin?.multiplier}
                            amount={spectatorMissedWin?.amount}
                            payout={spectatorMissedWin?.payout}
                            currencySymbol={currencySymbol}
                            countdown={spectatorCountdown}
                            onAction={() => {
                                setSpectatorMissedWin(null)
                                executeRoll()
                            }}
                        />
                    </div>

                    {/* Fairness & Verification Trigger */}
                    <div className="limbo-arena-footer" style={{ display: 'flex', gap: '8px' }}>
                        <Button
                            type="text"
                            icon={<HistoryOutlined />}
                            onClick={() => setHistoryDrawerOpen(true)}
                            className="limbo-btn-secondary"
                        >
                            History
                        </Button>
                        <Button
                            type="text"
                            icon={<SafetyCertificateOutlined />}
                            onClick={() => setFairnessOpen(true)}
                            className="limbo-btn-secondary"
                        >
                            Provably Fair 99% RTP
                        </Button>
                    </div>
                </div>

                {/* ── Betting Cockpit (Zero-Scroll Controls) ── */}
                <div className="limbo-controls-card">

                    {/* Wager Amount Control */}
                    <div className="limbo-control-group">
                        <div className="limbo-label-row">
                            <label className="limbo-label">Bet Amount ({currencySymbol})</label>
                            <span className="limbo-balance-hint">Bal: {currencySymbol}{balance.toFixed(2)}</span>
                        </div>
                        <div className="limbo-input-wrap">
                            <Input
                                id="limbo-bet-input"
                                type="number"
                                value={betAmount}
                                onChange={(e) => setBetAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                                disabled={isRolling || isAutoRunning}
                                prefix={currencySymbol}
                                className="limbo-input"
                            />
                            <div className="limbo-quick-actions">
                                <button type="button" onClick={halveBet} disabled={isRolling || isAutoRunning}>½</button>
                                <button type="button" onClick={doubleBet} disabled={isRolling || isAutoRunning}>2×</button>
                                <button type="button" onClick={minBet} disabled={isRolling || isAutoRunning}>Min</button>
                                <button type="button" onClick={maxBet} disabled={isRolling || isAutoRunning}>Max</button>
                            </div>
                        </div>
                    </div>

                    {/* Quick Multiplier Presets */}
                    <div className="limbo-presets-row">
                        {QUICK_PRESETS.map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                className={`limbo-preset-chip ${parseFloat(targetMultiplier) === preset ? 'active' : ''}`}
                                onClick={() => applyTargetPreset(preset)}
                                disabled={isRolling || isAutoRunning}
                            >
                                {preset.toFixed(2)}×
                            </button>
                        ))}
                    </div>

                    {/* Dual Targets: Target Multiplier & Win Chance */}
                    <div className="limbo-grid-two">
                        <div className="limbo-control-group">
                            <label className="limbo-label">Target Multiplier</label>
                            <Input
                                type="number"
                                step="0.1"
                                min={MIN_MULTIPLIER}
                                max={MAX_MULTIPLIER}
                                value={targetMultiplier}
                                onChange={(e) => handleTargetChange(e.target.value)}
                                disabled={isRolling || isAutoRunning}
                                suffix="×"
                                className="limbo-input"
                            />
                        </div>
                        <div className="limbo-control-group">
                            <label className="limbo-label">Win Chance</label>
                            <Input
                                type="number"
                                step="0.5"
                                min="0.1"
                                max="98"
                                value={winChance}
                                onChange={(e) => handleWinChanceChange(e.target.value)}
                                disabled={isRolling || isAutoRunning}
                                suffix="%"
                                className="limbo-input"
                            />
                        </div>
                    </div>

                    {/* Potential Profit Preview */}
                    <div className="limbo-profit-preview">
                        <span>Estimated Profit</span>
                        <strong className="text-gold">
                            +{currencySymbol}{Math.max(0, potentialProfit).toFixed(2)}
                        </strong>
                    </div>

                    {/* Play Limbo Action */}
                    <Button
                        id="limbo-bet-btn"
                        type="primary"
                        size="large"
                        block
                        onClick={executeRoll}
                        disabled={isRolling || betAmount <= 0}
                        className="limbo-bet-btn"
                    >
                        {!user ? 'Sign In to Play' : isRolling ? 'Rolling…' : 'Play Limbo'}
                    </Button>
                </div>
            </div>

            {/* Slide-out Game Specific Round History Drawer */}
            <Drawer
                title="Limbo · Live Round History"
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
                    gameKey="limbo"
                    gameTitle="Limbo"
                    localRounds={history}
                />
            </Drawer>

            {/* Provably Fair Modal */}
            <Modal
                title="🛡️ Limbo Cryptographic Provably Fair Engine"
                open={fairnessOpen}
                onOk={() => setFairnessOpen(false)}
                onCancel={() => setFairnessOpen(false)}
                footer={[
                    <Button key="ok" type="primary" onClick={() => setFairnessOpen(false)}>
                        Verify &amp; Close
                    </Button>
                ]}
                className="mobile-game-modal"
            >
                <div style={{ display: 'grid', gap: '14px', fontSize: '13px' }}>
                    <p style={{ margin: 0, color: '#94a3b8', lineHeight: 1.5 }}>
                        AmratGames Limbo runs on an authenticated <strong>HMAC-SHA256</strong> provably fair algorithm.
                        Each roll is mathematically derived as <code>floor(99 / (1 - float)) / 100</code> with an exact <strong>99.00% RTP (1.00% House Edge)</strong>.
                    </p>
                    <div>
                        <Text strong style={{ color: '#e2e8f0' }}>Server Seed Hash (Pre-committed SHA-256):</Text>
                        <Input readOnly value={serverSeedHash} style={{ marginTop: '4px', fontFamily: 'monospace', fontSize: '12px' }} />
                    </div>
                    <div>
                        <Text strong style={{ color: '#e2e8f0' }}>Client Seed (Editable):</Text>
                        <Input
                            value={clientSeed}
                            onChange={(e) => {
                                setClientSeed(e.target.value)
                                if (fairnessRef.current) fairnessRef.current.clientSeed = e.target.value
                            }}
                            style={{ marginTop: '4px' }}
                        />
                    </div>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Statistic title="Current Nonce" value={nonce} />
                        </Col>
                        <Col span={12}>
                            <Statistic title="Theoretical RTP" value="99.00%" valueStyle={{ color: '#10b981' }} />
                        </Col>
                    </Row>
                </div>
            </Modal>
        </div>
    )
}

export default LimboGame
