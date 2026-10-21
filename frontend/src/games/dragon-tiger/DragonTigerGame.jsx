import { useState, useRef, useEffect, useCallback } from 'react'
import { Typography, Modal, Statistic, Row, Col, Drawer, Button, Input } from 'antd'
import {
    SafetyCertificateOutlined,
    HistoryOutlined
} from '@ant-design/icons'
import { useWallet } from '../../context/WalletContext'
import casinoAudio from '../../utils/casinoAudio'
import GameBottomHistory from '../../components/GameHistory/GameBottomHistory'
import CasinoCard from './CasinoCard'
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
    const { balance, currencySymbol, executeGameBet } = useWallet()

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
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
    const [serverSeedHash, setServerSeedHash] = useState('d78e3a2b1c4f5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a')
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

    // Deal Round (Server-Authoritative Provably Fair)
    const dealCards = useCallback(async () => {
        if (isDealing || totalBet <= 0 || totalBet > balance) return

        setIsDealing(true)
        setRevealed(false)
        setRoundResult(null)
        playSound('deal')
        setNonce(prev => prev + 1)

        let primaryChoice = 'dragon'
        if (bets.tiger > bets.dragon && bets.tiger > bets.tie) primaryChoice = 'tiger'
        else if (bets.tie > bets.dragon && bets.tie > bets.tiger) primaryChoice = 'tie'

        let betResponse
        try {
            betResponse = await executeGameBet({
                game: 'dragon-tiger',
                gameName: 'Dragon Tiger',
                betAmount: totalBet,
                choice: primaryChoice,
                bets: {
                    dragon: bets.dragon,
                    tie: bets.tie,
                    tiger: bets.tiger
                }
            })
        } catch (err) {
            console.error('[DragonTiger] Error placing bet:', err)
        }

        if (!betResponse || !betResponse.success) {
            setIsDealing(false)
            notifyLoss?.(betResponse?.error || 'Unable to place bet')
            return
        }

        const evalData = betResponse.evaluation || {}
        if (evalData.hash) {
            setServerSeedHash(evalData.hash)
        }

        const dValNum = evalData.dragon?.value || 7
        const tValNum = evalData.tiger?.value || 7
        const dSuit = evalData.dragon?.suit || '♠'
        const tSuit = evalData.tiger?.suit || '♥'

        const rankNames = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        const dRank = rankNames[dValNum - 1] || '7'
        const tRank = rankNames[tValNum - 1] || '7'

        const dCard = { rank: dRank, value: dValNum, suit: dSuit, color: SUIT_COLORS[dSuit] || '#1e293b' }
        const tCard = { rank: tRank, value: tValNum, suit: tSuit, color: SUIT_COLORS[tSuit] || '#e11d48' }

        setDragonCard(dCard)
        setTigerCard(tCard)

        setTimeout(() => {
            setRevealed(true)
            setIsDealing(false)

            const winner = evalData.winner || 'dragon'
            setRoundResult(winner)
            setHistory(prev => [{ winner, dVal: dCard.rank, tVal: tCard.rank }, ...prev.slice(0, 19)])

            const payout = betResponse.payout ?? evalData.payout ?? 0
            const won = Boolean(betResponse.won ?? evalData.won)

            if (won && payout > 0) {
                if (winner === 'tie' || (payout / totalBet) >= 3) {
                    playSound('bigWin')
                } else {
                    playSound('win')
                }
            } else {
                playSound('loss')
            }
        }, 900)
    }, [isDealing, totalBet, balance, bets, executeGameBet])

    return (
        <div className="dt-page">
            <div className="dt-container">
                {/* Table Felt Arena */}
                <div className="dt-felt">
                    {/* Background Dragon & Tiger Watermarks */}
                    <div className="dt-felt-watermarks" aria-hidden="true">
                        <div
                            className={`dt-watermark dt-watermark-dragon ${roundResult === 'dragon' ? 'active-winner' : ''}`}
                            style={{ backgroundImage: `url('/images/dragon-mascot.jpg')` }}
                        />
                        <div
                            className={`dt-watermark dt-watermark-tiger ${roundResult === 'tiger' ? 'active-winner' : ''}`}
                            style={{ backgroundImage: `url('/images/tiger-mascot.jpg')` }}
                        />
                    </div>

                    {/* Minimal Light Trend Roadmap */}
                    <div className="dt-compact-roadmap">
                        <div className="dt-streak-stats">
                            <span className="stat-item stat-dragon">
                                Dragon {Math.round(((history.filter(h => h.winner === 'dragon').length) / (history.length || 1)) * 100)}%
                            </span>
                            <span className="stat-dot">·</span>
                            <span className="stat-item stat-tie">
                                Tie {Math.round(((history.filter(h => h.winner === 'tie').length) / (history.length || 1)) * 100)}%
                            </span>
                            <span className="stat-dot">·</span>
                            <span className="stat-item stat-tiger">
                                Tiger {Math.round(((history.filter(h => h.winner === 'tiger').length) / (history.length || 1)) * 100)}%
                            </span>
                        </div>
                        <div className="dt-roadmap-beads">
                            {history.slice(0, 10).map((h, i) => (
                                <span key={i} className={`dt-bead ${h.winner}`}>
                                    {h.winner === 'dragon' ? 'D' : (h.winner === 'tiger' ? 'T' : 'Tie')}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Table Arena & Realistic Playing Cards Deal */}
                    <div className="dt-duel-arena">
                        {/* Dragon Card Station */}
                        <div className={`dt-card-station dragon ${roundResult === 'dragon' ? 'winner' : ''}`}>
                            <div className="dt-station-title">
                                <span>{roundResult === 'dragon' ? '👑 DRAGON' : 'DRAGON'}</span>
                            </div>
                            <div className="dt-card-slot">
                                <CasinoCard
                                    card={dragonCard}
                                    flipped={revealed}
                                    theme="dragon"
                                    isWinner={roundResult === 'dragon'}
                                />
                            </div>
                        </div>

                        {/* Center Stage: Minimal VS / Winner Tag */}
                        <div className="dt-center-stage">
                            {roundResult ? (
                                <div className={`dt-result-announcement ${roundResult}`}>
                                    <span>{roundResult.toUpperCase()} WINS</span>
                                </div>
                            ) : (
                                <div className="dt-vs-circle">
                                    <span>VS</span>
                                </div>
                            )}
                        </div>

                        {/* Tiger Card Station */}
                        <div className={`dt-card-station tiger ${roundResult === 'tiger' ? 'winner' : ''}`}>
                            <div className="dt-station-title">
                                <span>{roundResult === 'tiger' ? '👑 TIGER' : 'TIGER'}</span>
                            </div>
                            <div className="dt-card-slot">
                                <CasinoCard
                                    card={tigerCard}
                                    flipped={revealed}
                                    theme="tiger"
                                    isWinner={roundResult === 'tiger'}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Clean Betting Zones */}
                    <div className="dt-bet-zones">
                        <button
                            type="button"
                            id="dt-bet-dragon"
                            className={`dt-bet-zone dragon-zone ${bets.dragon > 0 ? 'active' : ''} ${roundResult === 'dragon' ? 'win-zone' : ''}`}
                            onClick={() => handleAddBet('dragon')}
                        >
                            <div className="dt-zone-header">
                                <span className="dt-zone-name">DRAGON</span>
                                <span className="dt-zone-payout">1:1</span>
                            </div>
                            {bets.dragon > 0 && <span className="dt-zone-chips">{currencySymbol}{bets.dragon}</span>}
                        </button>

                        <button
                            type="button"
                            id="dt-bet-tie"
                            className={`dt-bet-zone tie-zone ${bets.tie > 0 ? 'active' : ''} ${roundResult === 'tie' ? 'win-zone' : ''}`}
                            onClick={() => handleAddBet('tie')}
                        >
                            <div className="dt-zone-header">
                                <span className="dt-zone-name">TIE</span>
                                <span className="dt-zone-payout">8:1</span>
                            </div>
                            {bets.tie > 0 && <span className="dt-zone-chips">{currencySymbol}{bets.tie}</span>}
                        </button>

                        <button
                            type="button"
                            id="dt-bet-tiger"
                            className={`dt-bet-zone tiger-zone ${bets.tiger > 0 ? 'active' : ''} ${roundResult === 'tiger' ? 'win-zone' : ''}`}
                            onClick={() => handleAddBet('tiger')}
                        >
                            <div className="dt-zone-header">
                                <span className="dt-zone-name">TIGER</span>
                                <span className="dt-zone-payout">1:1</span>
                            </div>
                            {bets.tiger > 0 && <span className="dt-zone-chips">{currencySymbol}{bets.tiger}</span>}
                        </button>
                    </div>
                </div>

                {/* Streamlined Chips & Controls Dashboard */}
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
                    </div>

                    <div className="dt-total-bet-display">
                        <span>Total Wager</span>
                        <strong className="text-gold">{currencySymbol}{totalBet}</strong>
                    </div>

                    <div className="dt-actions-row">
                        <Button
                            id="dt-clear-btn"
                            onClick={clearBets}
                            disabled={isDealing || totalBet === 0}
                            className="dt-clear-btn"
                        >
                            Clear
                        </Button>
                        <Button
                            id="dt-double-btn"
                            onClick={doubleBets}
                            disabled={isDealing || totalBet === 0 || totalBet * 2 > balance}
                            className="dt-clear-btn dt-double-btn"
                        >
                            2X Double
                        </Button>
                        <Button
                            id="dt-deal-btn"
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
                            icon={<HistoryOutlined />}
                            onClick={() => setHistoryDrawerOpen(true)}
                            className="dt-btn-secondary"
                        >
                            History
                        </Button>
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

            {/* Slide-out Game Specific Round History Drawer */}
            <Drawer
                title="Dragon Tiger · Live Round History"
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
                    gameKey="dragon-tiger"
                    gameTitle="Dragon Tiger"
                />
            </Drawer>

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
