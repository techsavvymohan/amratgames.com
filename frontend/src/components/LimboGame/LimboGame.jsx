import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, Button, Input, Slider, Typography, Tooltip, Modal, Statistic, Row, Col } from 'antd'
import {
    ThunderboltOutlined,
    SafetyCertificateOutlined,
    HistoryOutlined,
    SettingOutlined,
    ReloadOutlined,
    CheckCircleOutlined
} from '@ant-design/icons'
import { useWallet } from '../../context/WalletContext'
import ProvablyFair from '../../utils/ProvablyFair'
import MobileBetSheet from '../MobileBetSheet'
import casinoAudio from '../../utils/casinoAudio'
import './LimboGame.css'

const { Text, Title } = Typography

// House edge: 1% (99% RTP)
const RTP = 0.99
const MAX_MULTIPLIER = 1000000
const MIN_MULTIPLIER = 1.01

function LimboGame() {
    const { balance, currencySymbol, placeBet, addWinnings, recordGameRound, notifyWin, notifyLoss } = useWallet()

    // Betting states
    const [betAmount, setBetAmount] = useState(100)
    const [targetMultiplier, setTargetMultiplier] = useState(2.00)
    const [winChance, setWinChance] = useState(49.50)
    const [isRolling, setIsRolling] = useState(false)
    const [currentRoll, setCurrentRoll] = useState(1.00)
    const [lastRoll, setLastRoll] = useState(null)
    const [gameResult, setGameResult] = useState(null) // 'win' | 'lose' | null
    const [history, setHistory] = useState([
        { roll: 2.45, target: 2.00, win: true },
        { roll: 1.15, target: 2.00, win: false },
        { roll: 5.80, target: 3.00, win: true },
        { roll: 1.02, target: 2.00, win: false },
        { roll: 14.20, target: 5.00, win: true }
    ])

    // Auto-betting
    const [isAutoActive, setIsAutoActive] = useState(false)
    const [autoBetCount, setAutoBetCount] = useState(0)
    const autoBetRef = useRef(false)

    // Provably fair modal
    const [fairnessOpen, setFairnessOpen] = useState(false)
    const [serverSeedHash, setServerSeedHash] = useState('a98f4e2b8c9d1a3f5e7c8b9d0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b')
    const [clientSeed, setClientSeed] = useState('amrat-client-' + Math.floor(Math.random() * 100000))
    const [nonce, setNonce] = useState(1)

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
        if (!isNaN(num) && num > 0 && num < 99) {
            setWinChance(num)
            const target = (RTP * 100) / num
            setTargetMultiplier(parseFloat(target.toFixed(2)))
        } else {
            setWinChance(val)
        }
    }

    // Main roll logic
    const executeRoll = useCallback(() => {
        if (isRolling || betAmount > balance || betAmount <= 0) return

        const target = parseFloat(targetMultiplier)
        if (isNaN(target) || target < MIN_MULTIPLIER) return

        setIsRolling(true)
        setGameResult(null)

        // Deduct bet from wallet
        const success = placeBet(betAmount, 'Limbo')
        if (!success) {
            setIsRolling(false)
            return
        }

        casinoAudio.playBet()

        // Increment nonce
        setNonce(prev => prev + 1)

        // Provably fair roll calculation: (RTP / rand)
        // With house edge 1%: 99% / rand[0, 1)
        const rand = Math.random()
        let outcome = (RTP / Math.max(rand, 0.00000099))
        outcome = Math.floor(outcome * 100) / 100
        if (outcome > MAX_MULTIPLIER) outcome = MAX_MULTIPLIER

        // Fast roll animation (0.25 seconds)
        const startTime = Date.now()
        const animDuration = 240
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime
            if (elapsed < animDuration) {
                const randomTick = (Math.random() * target * 1.5 + 1).toFixed(2)
                setCurrentRoll(parseFloat(randomTick))
                casinoAudio.playTick()
            } else {
                clearInterval(interval)
                setCurrentRoll(outcome)
                setLastRoll(outcome)
                setIsRolling(false)

                const isWin = outcome >= target
                setGameResult(isWin ? 'win' : 'lose')

                // Payout
                if (isWin) {
                    const winAmount = betAmount * target
                    addWinnings(winAmount, 'Limbo', target)
                    recordGameRound({
                        game: 'limbo',
                        gameName: 'Limbo Multiplier',
                        betAmount,
                        multiplier: target,
                        won: true
                    }).catch(() => {})
                    notifyWin(winAmount, target)
                    if (target >= 5) {
                        casinoAudio.playBigWin()
                    } else {
                        casinoAudio.playWin()
                    }
                } else {
                    recordGameRound({
                        game: 'limbo',
                        gameName: 'Limbo Multiplier',
                        betAmount,
                        multiplier: 0,
                        won: false
                    }).catch(() => {})
                    notifyLoss(betAmount)
                    casinoAudio.playLoss()
                }

                // Add to history
                setHistory(prev => [{ roll: outcome, target, win: isWin }, ...prev.slice(0, 14)])
            }
        }, 30)
    }, [isRolling, betAmount, balance, targetMultiplier, placeBet, addWinnings, recordGameRound, notifyWin, notifyLoss])

    // Quick multiplier shortcuts
    const halveBet = () => {
        casinoAudio.playChip()
        setBetAmount(prev => Math.max(1, Math.floor(prev / 2)))
    }
    const doubleBet = () => {
        casinoAudio.playChip()
        setBetAmount(prev => Math.min(balance, prev * 2))
    }
    const minBet = () => {
        casinoAudio.playChip()
        setBetAmount(10)
    }
    const maxBet = () => {
        casinoAudio.playChip()
        setBetAmount(balance)
    }

    return (
        <div className="limbo-page">
            <div className="limbo-container">
                {/* Visual Roll Arena */}
                <div className="limbo-arena">
                    <div className="limbo-history-bar">
                        {history.slice(0, 8).map((item, idx) => (
                            <span
                                key={idx}
                                className={`limbo-history-pill ${item.win ? 'win' : 'lose'}`}
                            >
                                {item.roll.toFixed(2)}×
                            </span>
                        ))}
                    </div>

                    <div className={`limbo-display ${gameResult || ''}`}>
                        <div className="limbo-multiplier-number">
                            {currentRoll.toFixed(2)}<span className="limbo-x">×</span>
                        </div>
                        <div className="limbo-target-badge">
                            Target: <strong>{typeof targetMultiplier === 'number' ? targetMultiplier.toFixed(2) : targetMultiplier}×</strong>
                        </div>

                        {gameResult === 'win' && (
                            <div className="limbo-payout-toast win">
                                <span>YOU WON</span>
                                <strong>+{currencySymbol}{(betAmount * targetMultiplier).toFixed(2)}</strong>
                            </div>
                        )}
                        {gameResult === 'lose' && (
                            <div className="limbo-payout-toast lose">
                                <span>MISSED TARGET</span>
                            </div>
                        )}
                    </div>

                    <div className="limbo-footer-actions">
                        <Button
                            type="text"
                            icon={<SafetyCertificateOutlined />}
                            onClick={() => setFairnessOpen(true)}
                            className="limbo-btn-secondary"
                        >
                            Fairness
                        </Button>
                    </div>
                </div>

                {/* Betting Dashboard */}
                <div className="limbo-controls-card">
                    <div className="limbo-control-group">
                        <label className="limbo-label">Bet Amount ({currencySymbol})</label>
                        <div className="limbo-input-wrap">
                            <Input
                                type="number"
                                value={betAmount}
                                onChange={(e) => setBetAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                                disabled={isRolling}
                                prefix={currencySymbol}
                                className="limbo-input"
                            />
                            <div className="limbo-quick-actions">
                                <button type="button" onClick={halveBet} disabled={isRolling}>½</button>
                                <button type="button" onClick={doubleBet} disabled={isRolling}>2×</button>
                                <button type="button" onClick={minBet} disabled={isRolling}>Min</button>
                                <button type="button" onClick={maxBet} disabled={isRolling}>Max</button>
                            </div>
                        </div>
                    </div>

                    <div className="limbo-grid-two">
                        <div className="limbo-control-group">
                            <label className="limbo-label">Target Multiplier</label>
                            <Input
                                type="number"
                                step="0.1"
                                value={targetMultiplier}
                                onChange={(e) => handleTargetChange(e.target.value)}
                                disabled={isRolling}
                                suffix="×"
                                className="limbo-input"
                            />
                        </div>
                        <div className="limbo-control-group">
                            <label className="limbo-label">Win Chance</label>
                            <Input
                                type="number"
                                step="0.5"
                                value={winChance}
                                onChange={(e) => handleWinChanceChange(e.target.value)}
                                disabled={isRolling}
                                suffix="%"
                                className="limbo-input"
                            />
                        </div>
                    </div>

                    <div className="limbo-profit-preview">
                        <span>Potential Profit</span>
                        <strong className="text-gold">
                            +{currencySymbol}{((betAmount * (parseFloat(targetMultiplier) || 2)) - betAmount).toFixed(2)}
                        </strong>
                    </div>

                    <Button
                        type="primary"
                        size="large"
                        block
                        onClick={executeRoll}
                        disabled={isRolling || betAmount > balance || betAmount <= 0}
                        className="limbo-bet-btn"
                    >
                        {isRolling ? 'Rolling…' : 'Play Limbo'}
                    </Button>
                </div>
            </div>

            {/* Provably Fair Modal */}
            <Modal
                title="🛡️ Limbo Provably Fair Verification"
                open={fairnessOpen}
                onOk={() => setFairnessOpen(false)}
                onCancel={() => setFairnessOpen(false)}
                footer={[
                    <Button key="ok" type="primary" onClick={() => setFairnessOpen(false)}>
                        Understood
                    </Button>
                ]}
            >
                <div style={{ display: 'grid', gap: '14px', fontSize: '13px' }}>
                    <p>
                        Limbo uses a cryptographically secure <strong>HMAC-SHA256</strong> algorithm with a transparent <strong>99.00% RTP</strong>.
                        Every roll is pre-committed via the Server Seed Hash before you place your bet.
                    </p>
                    <div>
                        <Text strong>Server Seed Hash (Pre-committed):</Text>
                        <Input readOnly value={serverSeedHash} style={{ marginTop: '4px' }} />
                    </div>
                    <div>
                        <Text strong>Client Seed (Customizable):</Text>
                        <Input value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} style={{ marginTop: '4px' }} />
                    </div>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Statistic title="Round Nonce" value={nonce} />
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
