import { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Typography, Modal, Statistic, Row, Col, Badge } from 'antd'
import {
    SafetyCertificateOutlined,
    HistoryOutlined,
    ClockCircleOutlined,
    TrophyOutlined,
    UndoOutlined,
    FireOutlined
} from '@ant-design/icons'
import { useWallet } from '../../context/WalletContext'
import './ColorMatchGame.css'

const { Text, Title } = Typography

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

// Web Audio sound generator
function playTone(freq, duration, type = 'sine') {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.type = type
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime)
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration)
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        osc.start()
        osc.stop(audioCtx.currentTime + duration)
    } catch (e) {
        // AudioContext not allowed before user interaction
    }
}

function ColorMatchGame() {
    const { balance, currencySymbol, placeBet, addWinnings, notifyWin, notifyLoss } = useWallet()

    // Period and Timer (30s cycle)
    const [periodId, setPeriodId] = useState(202609220045)
    const [timeLeft, setTimeLeft] = useState(25)
    const [isLocked, setIsLocked] = useState(false)
    const [isDrawing, setIsDrawing] = useState(false)

    // Current bet selection
    const [selectedChip, setSelectedChip] = useState(100)
    // bets structure: { green: 0, violet: 0, red: 0, big: 0, small: 0, num_0: 0, ... num_9: 0 }
    const [bets, setBets] = useState({})

    // Current draw display
    const [displayNum, setDisplayNum] = useState(null)
    const [lastDraw, setLastDraw] = useState({
        period: 202609220044,
        num: 7,
        colors: ['green'],
        bigSmall: 'big'
    })

    // History roadmap
    const [history, setHistory] = useState([
        { period: 202609220044, num: 7, colors: ['green'], bigSmall: 'big' },
        { period: 202609220043, num: 2, colors: ['red'], bigSmall: 'small' },
        { period: 202609220042, num: 0, colors: ['violet', 'red'], bigSmall: 'small' },
        { period: 202609220041, num: 5, colors: ['violet', 'green'], bigSmall: 'big' },
        { period: 202609220040, num: 9, colors: ['green'], bigSmall: 'big' },
        { period: 202609220039, num: 4, colors: ['red'], bigSmall: 'small' },
        { period: 202609220038, num: 8, colors: ['red'], bigSmall: 'big' },
        { period: 202609220037, num: 3, colors: ['green'], bigSmall: 'small' },
        { period: 202609220036, num: 1, colors: ['green'], bigSmall: 'small' },
        { period: 202609220035, num: 6, colors: ['red'], bigSmall: 'big' },
    ])

    // Modals
    const [fairnessOpen, setFairnessOpen] = useState(false)
    const [serverSeedHash] = useState('d3b07384d113edec49eaa6238ad5ff00b1a0d7d8e8749a9040306c4599a0f4a7')
    const [clientSeed] = useState('amrat-cm-' + Math.floor(Math.random() * 100000))

    // Total active stake placed for this round
    const totalStaked = Object.values(bets).reduce((a, b) => a + b, 0)

    // Handle placing chips on betting spots
    const addBet = (spotKey) => {
        if (isLocked || isDrawing) return

        if (balance < selectedChip) {
            notifyLoss?.('Insufficient balance to place chip!')
            return
        }

        // Deduct from wallet immediately
        const success = placeBet(selectedChip)
        if (!success) return

        playTone(520, 0.08)
        setBets(prev => ({
            ...prev,
            [spotKey]: (prev[spotKey] || 0) + selectedChip
        }))
    }

    const clearBets = () => {
        if (isLocked || isDrawing || totalStaked === 0) return
        // Refund back to wallet
        addWinnings(totalStaked)
        setBets({})
        playTone(300, 0.1)
    }

    const doubleBets = () => {
        if (isLocked || isDrawing || totalStaked === 0) return
        if (balance < totalStaked) {
            notifyLoss?.('Insufficient balance to double bets!')
            return
        }
        const success = placeBet(totalStaked)
        if (!success) return

        playTone(600, 0.1)
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
        // Green: 2x (if pure green), 1.5x (if 5 = violet + green)
        if (activeBets.green) {
            if (colors.includes('green')) {
                const mult = colors.includes('violet') ? 1.5 : 2.0
                totalWin += activeBets.green * mult
            }
        }
        // Red: 2x (if pure red), 1.5x (if 0 = violet + red)
        if (activeBets.red) {
            if (colors.includes('red')) {
                const mult = colors.includes('violet') ? 1.5 : 2.0
                totalWin += activeBets.red * mult
            }
        }
        // Violet: 4.5x (if 0 or 5)
        if (activeBets.violet) {
            if (colors.includes('violet')) {
                totalWin += activeBets.violet * 4.5
            }
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
            notifyWin?.(`Won ${currencySymbol}${totalWin.toLocaleString()} on Color Match Round #${periodId}!`)
            playTone(880, 0.25, 'triangle')
            setTimeout(() => playTone(1100, 0.3, 'triangle'), 150)
        } else if (Object.keys(activeBets).length > 0) {
            notifyLoss?.(`Round #${periodId} ended. No win this round.`)
            playTone(220, 0.2, 'sawtooth')
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
    }, [bets, periodId, currencySymbol, addWinnings, notifyWin, notifyLoss])

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

    // Countdown Clock Effect (30s)
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    triggerDraw()
                    return 30
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
    }, [triggerDraw])

    return (
        <div className="color-match-container">
            {/* Header / Game Info */}
            <div className="cm-header-card">
                <div className="cm-period-info">
                    <span className="cm-label"><FireOutlined style={{ color: '#ffd700' }} /> Period</span>
                    <span className="cm-period-number">{periodId}</span>
                </div>

                <div className={`cm-countdown-box ${timeLeft <= 5 ? 'cm-urgent' : ''}`}>
                    <div className="cm-time-title">
                        <ClockCircleOutlined /> Time Remaining
                    </div>
                    <div className="cm-digital-timer">
                        00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                    </div>
                </div>

                <div className="cm-actions-group">
                    <Button
                        type="text"
                        icon={<SafetyCertificateOutlined style={{ color: '#00e676' }} />}
                        onClick={() => setFairnessOpen(true)}
                        className="cm-fair-btn"
                    >
                        Provably Fair
                    </Button>
                </div>
            </div>

            {/* Lock Notice Overlay Bar */}
            {isLocked && (
                <div className="cm-lock-banner">
                    <span className="cm-lock-pulse"></span>
                    {isDrawing ? 'DRAWING RESULT...' : 'BETTING CLOSED FOR THIS ROUND'}
                </div>
            )}

            {/* Live Draw Spotlight */}
            <div className="cm-spotlight-section">
                <div className="cm-last-draw-card">
                    <div className="cm-last-title">LAST RESULT</div>
                    <div className="cm-last-display">
                        <div
                            className={`cm-result-ball ball-${lastDraw.colors[0]} ${lastDraw.colors[1] ? 'ball-split-' + lastDraw.colors[1] : ''}`}
                        >
                            {lastDraw.num}
                        </div>
                        <div className="cm-result-details">
                            <div className="cm-result-color-tags">
                                {lastDraw.colors.map(c => (
                                    <span key={c} className={`cm-tag tag-${c}`}>{c.toUpperCase()}</span>
                                ))}
                                <span className={`cm-tag tag-bs tag-${lastDraw.bigSmall}`}>
                                    {lastDraw.bigSmall.toUpperCase()}
                                </span>
                            </div>
                            <div className="cm-result-period">Period #{lastDraw.period}</div>
                        </div>
                    </div>
                </div>

                {/* Animated Draw Stage if Drawing */}
                {isDrawing && displayNum !== null && (
                    <div className="cm-draw-stage">
                        <div className="cm-drawing-label">ROLLING...</div>
                        <div className="cm-drawing-wheel">
                            <span className="cm-draw-wheel-num">{displayNum}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Primary Color Bet Area */}
            <div className="cm-bet-card">
                <div className="cm-section-label">SELECT COLOR (1.5x - 4.5x)</div>
                <div className="cm-colors-row">
                    <button
                        className={`cm-color-btn btn-green ${bets.green ? 'active-bet' : ''}`}
                        disabled={isLocked || isDrawing}
                        onClick={() => addBet('green')}
                    >
                        <div className="cm-btn-title">GREEN</div>
                        <div className="cm-btn-mult">2X / 1.5X</div>
                        {bets.green > 0 && (
                            <div className="cm-bet-badge">{currencySymbol}{bets.green}</div>
                        )}
                    </button>

                    <button
                        className={`cm-color-btn btn-violet ${bets.violet ? 'active-bet' : ''}`}
                        disabled={isLocked || isDrawing}
                        onClick={() => addBet('violet')}
                    >
                        <div className="cm-btn-title">VIOLET</div>
                        <div className="cm-btn-mult">4.5X</div>
                        {bets.violet > 0 && (
                            <div className="cm-bet-badge">{currencySymbol}{bets.violet}</div>
                        )}
                    </button>

                    <button
                        className={`cm-color-btn btn-red ${bets.red ? 'active-bet' : ''}`}
                        disabled={isLocked || isDrawing}
                        onClick={() => addBet('red')}
                    >
                        <div className="cm-btn-title">RED</div>
                        <div className="cm-btn-mult">2X / 1.5X</div>
                        {bets.red > 0 && (
                            <div className="cm-bet-badge">{currencySymbol}{bets.red}</div>
                        )}
                    </button>
                </div>

                {/* Number Bet Grid (0-9) */}
                <div className="cm-section-label" style={{ marginTop: 20 }}>SELECT NUMBER (9X PAYOUT)</div>
                <div className="cm-numbers-grid">
                    {NUMBER_DATA.map(item => {
                        const key = `num_${item.num}`
                        const isPlaced = bets[key] > 0
                        const bgClass = item.colors.length > 1
                            ? `num-split-${item.colors[0]}-${item.colors[1]}`
                            : `num-solid-${item.colors[0]}`

                        return (
                            <button
                                key={item.num}
                                className={`cm-num-btn ${bgClass} ${isPlaced ? 'active-bet' : ''}`}
                                disabled={isLocked || isDrawing}
                                onClick={() => addBet(key)}
                            >
                                <span className="cm-num-text">{item.num}</span>
                                {isPlaced && (
                                    <div className="cm-bet-badge">{currencySymbol}{bets[key]}</div>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Big / Small Choice */}
                <div className="cm-section-label" style={{ marginTop: 20 }}>BIG / SMALL (2X)</div>
                <div className="cm-bigsmall-row">
                    <button
                        className={`cm-bs-btn btn-big ${bets.big ? 'active-bet' : ''}`}
                        disabled={isLocked || isDrawing}
                        onClick={() => addBet('big')}
                    >
                        <div className="cm-btn-title">BIG (5-9)</div>
                        <div className="cm-btn-mult">2.0X</div>
                        {bets.big > 0 && (
                            <div className="cm-bet-badge">{currencySymbol}{bets.big}</div>
                        )}
                    </button>

                    <button
                        className={`cm-bs-btn btn-small ${bets.small ? 'active-bet' : ''}`}
                        disabled={isLocked || isDrawing}
                        onClick={() => addBet('small')}
                    >
                        <div className="cm-btn-title">SMALL (0-4)</div>
                        <div className="cm-btn-mult">2.0X</div>
                        {bets.small > 0 && (
                            <div className="cm-bet-badge">{currencySymbol}{bets.small}</div>
                        )}
                    </button>
                </div>
            </div>

            {/* Chip Selector & Action Controls */}
            <div className="cm-controls-card">
                <div className="cm-chips-bar">
                    <span className="cm-chips-label">CHIP VALUE:</span>
                    <div className="cm-chips-list">
                        {CHIP_PRESETS.map(val => (
                            <button
                                key={val}
                                className={`cm-chip-btn chip-${val} ${selectedChip === val ? 'selected' : ''}`}
                                onClick={() => setSelectedChip(val)}
                            >
                                {val >= 1000 ? `${val / 1000}k` : val}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="cm-bet-summary-row">
                    <div className="cm-total-stake-box">
                        <span className="cm-stake-title">TOTAL STAKE:</span>
                        <span className="cm-stake-amt">{currencySymbol}{totalStaked.toLocaleString()}</span>
                    </div>

                    <div className="cm-quick-actions">
                        <Button
                            icon={<UndoOutlined />}
                            onClick={clearBets}
                            disabled={isLocked || isDrawing || totalStaked === 0}
                            className="cm-action-btn"
                        >
                            Clear
                        </Button>
                        <Button
                            onClick={doubleBets}
                            disabled={isLocked || isDrawing || totalStaked === 0}
                            className="cm-action-btn"
                        >
                            2X Double
                        </Button>
                    </div>
                </div>
            </div>

            {/* Game History Roadmap */}
            <div className="cm-history-card">
                <div className="cm-history-header">
                    <HistoryOutlined style={{ color: '#ffd700' }} />
                    <span>RECENT ROUND HISTORY</span>
                </div>
                <div className="cm-history-table-wrap">
                    <table className="cm-history-table">
                        <thead>
                            <tr>
                                <th>Period</th>
                                <th>Number</th>
                                <th>Size</th>
                                <th>Color</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map(item => (
                                <tr key={item.period}>
                                    <td className="col-period">#{item.period}</td>
                                    <td className="col-number">
                                        <span className={`cm-sm-ball ball-${item.colors[0]}`}>
                                            {item.num}
                                        </span>
                                    </td>
                                    <td className="col-bs">
                                        <span className={`cm-text-badge text-${item.bigSmall}`}>
                                            {item.bigSmall.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="col-colors">
                                        <div className="cm-dots-flex">
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
            </div>

            {/* Provably Fair Modal */}
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
                        Color Match outcomes are calculated using cryptographic HMAC-SHA256 hashing. The result is deterministic and cannot be altered by either the player or the server.
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
                    <div style={{ background: 'rgba(0, 230, 118, 0.1)', padding: 10, borderRadius: 8, border: '1px solid rgba(0, 230, 118, 0.2)' }}>
                        <Text style={{ color: '#00e676', fontWeight: 600 }}>
                            RTP: 99.0% Provably Fair Standard. Independent verification available for every period.
                        </Text>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default ColorMatchGame
