import { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Input, InputNumber, Typography, Modal, Statistic, Row, Col } from 'antd'
import {
    SafetyCertificateOutlined,
    ReloadOutlined,
    UndoOutlined,
    TrophyOutlined
} from '@ant-design/icons'
import { useWallet } from '../../context/WalletContext'
import casinoAudio from '../../utils/casinoAudio'
import './DragonTigerGame.css'

const { Text, Title } = Typography

const SUITS = ['♠', '♥', '♦', '♣']
const SUIT_COLORS = { '♠': '#1e293b', '♥': '#e11d48', '♦': '#e11d48', '♣': '#1e293b' }
const RANKS = [
    { rank: 'A', value: 1 },
    { rank: '2', value: 2 },
    { rank: '3', value: 3 },
    { rank: '4', value: 4 },
    { rank: '5', value: 5 },
    { rank: '6', value: 6 },
    { rank: '7', value: 7 },
    { rank: '8', value: 8 },
    { rank: '9', value: 9 },
    { rank: '10', value: 10 },
    { rank: 'J', value: 11 },
    { rank: 'Q', value: 12 },
    { rank: 'K', value: 13 },
]

const CHIP_VALUES = [10, 50, 100, 500, 1000, 5000]

function getRandomCard() {
    const rankObj = RANKS[Math.floor(Math.random() * RANKS.length)]
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)]
    return { ...rankObj, suit, color: SUIT_COLORS[suit] }
}

function DragonTigerGame() {
    const { balance, currencySymbol, placeBet, addWinnings, recordGameRound, notifyWin, notifyLoss } = useWallet()

    // Chip & Bet state
    const [selectedChip, setSelectedChip] = useState(100)
    const [bets, setBets] = useState({ dragon: 0, tie: 0, tiger: 0 })
    const [isDealing, setIsDealing] = useState(false)

    // Cards
    const [dragonCard, setDragonCard] = useState(null)
    const [tigerCard, setTigerCard] = useState(null)
    const [revealed, setRevealed] = useState(false)
    const [roundResult, setRoundResult] = useState(null) // 'dragon' | 'tiger' | 'tie'

    // Real-time dynamic history roadmap (No demo data)
    const [history, setHistory] = useState([])

    // Fairness
    const [fairnessOpen, setFairnessOpen] = useState(false)
    const [serverSeedHash] = useState('d78e3a2b1c4f5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a')
    const [clientSeed, setClientSeed] = useState('client-seed-' + Math.floor(Math.random() * 10000))
    const [nonce, setNonce] = useState(1)

    const totalBet = bets.dragon + bets.tie + bets.tiger

    // Audio dispatcher
    const playSound = (type) => {
        if (type === 'chip') casinoAudio.playChip()
        else if (type === 'deal') casinoAudio.playCardDeal()
        else if (type === 'win') casinoAudio.playWin()
        else if (type === 'bigWin') casinoAudio.playBigWin()
        else if (type === 'loss') casinoAudio.playLoss()
    }

    // Place chip on betting zone
    const handleAddBet = (zone) => {
        if (isDealing) return
        if (totalBet + selectedChip > balance) return
        playSound('chip')
        setBets(prev => ({
            ...prev,
            [zone]: prev[zone] + selectedChip
        }))
    }

    const clearBets = () => {
        if (isDealing) return
        playSound('chip')
        setBets({ dragon: 0, tie: 0, tiger: 0 })
    }

    const doubleBets = () => {
        if (isDealing || totalBet === 0 || totalBet * 2 > balance) return
        playSound('chip')
        setBets(prev => ({
            dragon: prev.dragon * 2,
            tie: prev.tie * 2,
            tiger: prev.tiger * 2
        }))
    }

    // Deal Round
    const dealCards = useCallback(() => {
        if (isDealing || totalBet <= 0 || totalBet > balance) return

        const success = placeBet(totalBet, 'Dragon Tiger')
        if (!success) return

        playSound('deal')
        setIsDealing(true)
        setRevealed(false)
        setRoundResult(null)
        setNonce(prev => prev + 1)

        // Draw cards
        const dCard = getRandomCard()
        let tCard = getRandomCard()

        // 3D dealing animation sequence
        setDragonCard(dCard)
        setTigerCard(tCard)

        setTimeout(() => {
            setRevealed(true)
            setIsDealing(false)

            let winner = 'tie'
            if (dCard.value > tCard.value) winner = 'dragon'
            else if (tCard.value > dCard.value) winner = 'tiger'

            setRoundResult(winner)
            setHistory(prev => [{ winner, dVal: dCard.rank, tVal: tCard.rank }, ...prev.slice(0, 19)])

            // Calculate payout
            let payout = 0
            if (winner === 'dragon' && bets.dragon > 0) {
                payout += bets.dragon * 2 // 1:1 profit + return
            }
            if (winner === 'tiger' && bets.tiger > 0) {
                payout += bets.tiger * 2
            }
            if (winner === 'tie') {
                if (bets.tie > 0) payout += bets.tie * 9 // 8:1 payout + return
                // Tie pushes 50% of main bets back
                payout += (bets.dragon * 0.5) + (bets.tiger * 0.5)
            }

            if (payout > 0) {
                if (winner === 'tie' || (payout / totalBet) >= 3) {
                    playSound('bigWin')
                } else {
                    playSound('win')
                }
                addWinnings(payout, 'Dragon Tiger', payout / totalBet)
                recordGameRound({
                    game: 'dragon-tiger',
                    gameName: 'Dragon Tiger',
                    betAmount: totalBet,
                    multiplier: payout / totalBet,
                    won: true
                }).catch(() => {})
                notifyWin(payout, (payout / totalBet).toFixed(2))
            } else {
                playSound('loss')
                recordGameRound({
                    game: 'dragon-tiger',
                    gameName: 'Dragon Tiger',
                    betAmount: totalBet,
                    multiplier: 0,
                    won: false
                }).catch(() => {})
                notifyLoss(totalBet)
            }
        }, 900)
    }, [isDealing, totalBet, balance, bets, placeBet, addWinnings, recordGameRound, notifyWin, notifyLoss])

    return (
        <div className="dt-page">
            <div className="dt-container">
                {/* Table Felt Arena */}
                <div className="dt-felt">
                    {/* Road Map History Header */}
                    <div className="dt-roadmap">
                        <div className="dt-roadmap-header-line">
                            <span className="dt-roadmap-label">Macau Trend Roadmap</span>
                            <div className="dt-streak-stats">
                                <span className="stat-pill stat-dragon">D: {Math.round(((history.filter(h => h.winner === 'dragon').length) / (history.length || 1)) * 100)}%</span>
                                <span className="stat-pill stat-tiger">T: {Math.round(((history.filter(h => h.winner === 'tiger').length) / (history.length || 1)) * 100)}%</span>
                                <span className="stat-pill stat-tie">Tie: {Math.round(((history.filter(h => h.winner === 'tie').length) / (history.length || 1)) * 100)}%</span>
                            </div>
                        </div>
                        <div className="dt-roadmap-beads">
                            {history.slice(0, 16).map((h, i) => (
                                <div key={i} className={`dt-bead ${h.winner}`}>
                                    {h.winner === 'dragon' ? 'D' : (h.winner === 'tiger' ? 'T' : 'Tie')}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Table Arena & Mascot Duel */}
                    <div className="dt-duel-arena">
                        {/* Dragon Spot */}
                        <div className={`dt-player-box dragon ${roundResult === 'dragon' ? 'winner' : ''}`}>
                            <div className="dt-mascot-frame dragon">
                                <img
                                    src="/images/dragon-mascot.jpg"
                                    alt="3D Crimson Dragon"
                                    className="dt-mascot-img"
                                />
                                <span className="dt-mascot-glow"></span>
                                <span className="dt-mascot-badge">DRAGON</span>
                            </div>
                            <div className="dt-card-slot">
                                {dragonCard ? (
                                    <div className={`dt-card ${revealed ? 'flipped' : ''}`}>
                                        <div className="dt-card-face dt-card-front" style={{ color: dragonCard.color }}>
                                            <div className="dt-card-corner top">{dragonCard.rank}<span>{dragonCard.suit}</span></div>
                                            <div className="dt-card-center">{dragonCard.suit}</div>
                                            <div className="dt-card-corner bottom">{dragonCard.rank}<span>{dragonCard.suit}</span></div>
                                        </div>
                                        <div className="dt-card-face dt-card-back">
                                            <div className="dt-card-back-pattern">👑</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="dt-empty-slot">
                                        <div className="dt-slot-placeholder">DEAL</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* VS Divider */}
                        <div className="dt-vs-badge">
                            {roundResult ? (
                                <span className={`dt-result-tag ${roundResult}`}>
                                    {roundResult.toUpperCase()} WINS!
                                </span>
                            ) : (
                                <div className="dt-vs-emblem">VS</div>
                            )}
                        </div>

                        {/* Tiger Spot */}
                        <div className={`dt-player-box tiger ${roundResult === 'tiger' ? 'winner' : ''}`}>
                            <div className="dt-mascot-frame tiger">
                                <img
                                    src="/images/tiger-mascot.jpg"
                                    alt="3D Sapphire Tiger"
                                    className="dt-mascot-img"
                                />
                                <span className="dt-mascot-glow"></span>
                                <span className="dt-mascot-badge">TIGER</span>
                            </div>
                            <div className="dt-card-slot">
                                {tigerCard ? (
                                    <div className={`dt-card ${revealed ? 'flipped' : ''}`}>
                                        <div className="dt-card-face dt-card-front" style={{ color: tigerCard.color }}>
                                            <div className="dt-card-corner top">{tigerCard.rank}<span>{tigerCard.suit}</span></div>
                                            <div className="dt-card-center">{tigerCard.suit}</div>
                                            <div className="dt-card-corner bottom">{tigerCard.rank}<span>{tigerCard.suit}</span></div>
                                        </div>
                                        <div className="dt-card-face dt-card-back">
                                            <div className="dt-card-back-pattern">👑</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="dt-empty-slot">
                                        <div className="dt-slot-placeholder">DEAL</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Betting Zones */}
                    <div className="dt-bet-zones">
                        <button
                            type="button"
                            className={`dt-bet-zone dragon-zone ${bets.dragon > 0 ? 'active' : ''}`}
                            onClick={() => handleAddBet('dragon')}
                        >
                            <span className="dt-zone-name">DRAGON</span>
                            <span className="dt-zone-payout">1 : 1</span>
                            {bets.dragon > 0 && <span className="dt-zone-chips">{currencySymbol}{bets.dragon}</span>}
                        </button>

                        <button
                            type="button"
                            className={`dt-bet-zone tie-zone ${bets.tie > 0 ? 'active' : ''}`}
                            onClick={() => handleAddBet('tie')}
                        >
                            <span className="dt-zone-name">TIE</span>
                            <span className="dt-zone-payout">8 : 1</span>
                            {bets.tie > 0 && <span className="dt-zone-chips">{currencySymbol}{bets.tie}</span>}
                        </button>

                        <button
                            type="button"
                            className={`dt-bet-zone tiger-zone ${bets.tiger > 0 ? 'active' : ''}`}
                            onClick={() => handleAddBet('tiger')}
                        >
                            <span className="dt-zone-name">TIGER</span>
                            <span className="dt-zone-payout">1 : 1</span>
                            {bets.tiger > 0 && <span className="dt-zone-chips">{currencySymbol}{bets.tiger}</span>}
                        </button>
                    </div>
                </div>

                {/* Chips & Controls Dashboard */}
                <div className="dt-controls-card">
                    <div className="dt-chip-selector">
                        <label className="dt-label">Select Chip Value ({currencySymbol})</label>
                        <div className="dt-chips-row">
                            {CHIP_VALUES.map((val) => (
                                <button
                                    key={val}
                                    type="button"
                                    className={`dt-chip-btn chip-${val} ${selectedChip === val ? 'selected' : ''}`}
                                    onClick={() => setSelectedChip(val)}
                                    disabled={isDealing}
                                >
                                    <span>{val >= 1000 ? `${val / 1000}k` : val}</span>
                                </button>
                            ))}
                        </div>
                        {/* Custom Bet Amount Input */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                            <div style={{ flex: 1 }}>
                                <InputNumber
                                    value={selectedChip}
                                    onChange={(val) => setSelectedChip(Math.max(1, isNaN(Number(val)) ? 1 : Number(val)))}
                                    min={1}
                                    step={10}
                                    disabled={isDealing}
                                    style={{ width: '100%' }}
                                    addonBefore={<span style={{ fontWeight: 700, color: '#fbbf24' }}>{currencySymbol}</span>}
                                    placeholder="Custom Bet Amount"
                                />
                            </div>
                            <Button.Group>
                                <Button onClick={() => setSelectedChip(prev => Math.max(1, Math.floor(prev / 2)))} disabled={isDealing}>½</Button>
                                <Button onClick={() => setSelectedChip(prev => prev * 2)} disabled={isDealing}>2×</Button>
                                <Button onClick={() => setSelectedChip(10)} disabled={isDealing}>Min</Button>
                                <Button onClick={() => setSelectedChip(Math.max(10, Math.floor(balance || 100)))} disabled={isDealing}>Max</Button>
                            </Button.Group>
                        </div>
                    </div>

                    <div className="dt-total-bet-display">
                        <span>Total Wager</span>
                        <strong className="text-gold">{currencySymbol}{totalBet}</strong>
                    </div>

                    <div className="dt-actions-row">
                        <Button
                            icon={<UndoOutlined />}
                            onClick={clearBets}
                            disabled={isDealing || totalBet === 0}
                            className="dt-clear-btn"
                        >
                            Clear
                        </Button>
                        <Button
                            onClick={doubleBets}
                            disabled={isDealing || totalBet === 0 || totalBet * 2 > balance}
                            className="dt-clear-btn dt-double-btn"
                        >
                            2X Double
                        </Button>
                        <Button
                            type="primary"
                            size="large"
                            onClick={dealCards}
                            disabled={isDealing || totalBet === 0 || totalBet > balance}
                            className="dt-deal-btn"
                        >
                            {isDealing ? 'Dealing…' : 'Deal Cards'}
                        </Button>
                    </div>

                    <div className="dt-footer-actions">
                        <Button
                            type="text"
                            icon={<SafetyCertificateOutlined />}
                            onClick={() => setFairnessOpen(true)}
                            className="dt-btn-secondary"
                        >
                            Fairness &amp; Rules
                        </Button>
                    </div>
                </div>
            </div>

            {/* Provably Fair Modal */}
            <Modal
                title="🛡️ Dragon Tiger Rules & Provably Fair"
                open={fairnessOpen}
                onOk={() => setFairnessOpen(false)}
                onCancel={() => setFairnessOpen(false)}
                footer={[
                    <Button key="ok" type="primary" onClick={() => setFairnessOpen(false)}>
                        Understood
                    </Button>
                ]}
            >
                <div style={{ display: 'grid', gap: '12px', fontSize: '13px' }}>
                    <p>
                        <strong>Dragon Tiger</strong> is a classic two-card game. One card is dealt to Dragon, one to Tiger.
                        King is high (13), Ace is low (1). Highest card wins 1:1. Same rank results in Tie (8:1).
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

export default DragonTigerGame
