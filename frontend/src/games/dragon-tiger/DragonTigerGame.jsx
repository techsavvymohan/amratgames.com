import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Modal, Drawer, Statistic, Row, Col, Typography, Input } from 'antd'
import {
    SafetyCertificateOutlined,
    SoundOutlined,
    HistoryOutlined,
    MenuOutlined,
    UndoOutlined,
    InfoCircleOutlined
} from '@ant-design/icons'
import { useWallet } from '../../context/WalletContext'
import casinoAudio from '../../utils/casinoAudio'
import GameBottomHistory from '../../components/GameHistory/GameBottomHistory'
import './DragonTigerGame.css'

const { Text } = Typography

const SUITS = ['♠', '♥', '♦', '♣']
const SUIT_COLORS = { '♠': '#0f172a', '♥': '#dc2626', '♦': '#dc2626', '♣': '#0f172a' }
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

// Chip color theme map matching real casino chips
const CHIP_THEMES = {
    10: { bg: '#2563eb', border: '#60a5fa', text: '#fff' },
    50: { bg: '#d97706', border: '#fbbf24', text: '#fff' },
    100: { bg: '#059669', border: '#34d399', text: '#fff' },
    500: { bg: '#7c3aed', border: '#a78bfa', text: '#fff' },
    1000: { bg: '#b45309', border: '#fcd34d', text: '#fff' },
    5000: { bg: '#be123c', border: '#fda4af', text: '#fff' },
}

export default function DragonTigerGame() {
    const { balance, currencySymbol, executeGameBet, notifyWin, notifyLoss, refreshBalance } = useWallet()

    // Chip & Bet state
    const [selectedChip, setSelectedChip] = useState(50)
    const [bets, setBets] = useState({ dragon: 0, tiger: 0, tie: 0, suitedTie: 0 })
    const [betHistory, setBetHistory] = useState([]) // For Undo support: array of { zone, amount }
    const [isDealing, setIsDealing] = useState(false)

    // Dealing Animation Stages
    const [dragonCard, setDragonCard] = useState(null)
    const [tigerCard, setTigerCard] = useState(null)
    const [dragonFlipped, setDragonFlipped] = useState(false)
    const [tigerFlipped, setTigerFlipped] = useState(false)
    const [roundResult, setRoundResult] = useState(null) // 'dragon' | 'tiger' | 'tie' | 'suitedTie'
    const [predictedWinner, setPredictedWinner] = useState(null) // 'dragon' | 'tiger' for predictor pill

    // Roadmap History (Bead Plate)
    const [history, setHistory] = useState(() => {
        try {
            const raw = localStorage.getItem('amrat_dt_bead_history')
            return raw ? JSON.parse(raw) : [
                { winner: 'tiger', dVal: '6', tVal: 'Q', dSuit: '♦', tSuit: '♠' }
            ]
        } catch {
            return [{ winner: 'tiger', dVal: '6', tVal: 'Q', dSuit: '♦', tSuit: '♠' }]
        }
    })

    const [localRoundsHistory, setLocalRoundsHistory] = useState(() => {
        try {
            const raw = localStorage.getItem('amrat_dragontiger_history')
            return raw ? JSON.parse(raw) : []
        } catch {
            return []
        }
    })

    // UI Modals & Settings
    const [menuDrawerOpen, setMenuDrawerOpen] = useState(false)
    const [fairnessOpen, setFairnessOpen] = useState(false)
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
    const [soundMuted, setSoundMuted] = useState(false)

    // Provably Fair parameters
    const [serverSeedHash, setServerSeedHash] = useState('d78e3a2b1c4f5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a')
    const [clientSeed, setClientSeed] = useState('client-seed-' + Math.floor(Math.random() * 10000))
    const [nonce, setNonce] = useState(1)

    const totalBet = bets.dragon + bets.tiger + bets.tie + bets.suitedTie

    // Sound dispatcher
    const playSound = (type) => {
        if (soundMuted) return
        if (type === 'chip') casinoAudio.playChip?.()
        else if (type === 'deal') casinoAudio.playCardDeal?.()
        else if (type === 'win') casinoAudio.playWin?.()
        else if (type === 'bigWin') casinoAudio.playBigWin?.()
        else if (type === 'loss') casinoAudio.playLoss?.()
    }

    // Add Chip to Zone
    const handleAddBet = (zone) => {
        if (isDealing) return
        if (totalBet + selectedChip > (balance || 0)) return

        playSound('chip')
        setBets(prev => ({
            ...prev,
            [zone]: prev[zone] + selectedChip
        }))
        setBetHistory(prev => [...prev, { zone, amount: selectedChip }])
    }

    // Undo Last Placed Chip
    const handleUndo = () => {
        if (isDealing || betHistory.length === 0) return
        playSound('chip')
        const lastAction = betHistory[betHistory.length - 1]
        setBetHistory(prev => prev.slice(0, -1))
        setBets(prev => ({
            ...prev,
            [lastAction.zone]: Math.max(0, prev[lastAction.zone] - lastAction.amount)
        }))
    }

    // Double Bets
    const handleDouble = () => {
        if (isDealing || totalBet === 0 || totalBet * 2 > (balance || 0)) return
        playSound('chip')
        setBets(prev => ({
            dragon: prev.dragon * 2,
            tiger: prev.tiger * 2,
            tie: prev.tie * 2,
            suitedTie: prev.suitedTie * 2
        }))
        setBetHistory(prev => prev.map(item => ({ ...item, amount: item.amount * 2 })))
    }

    // Clear Bets
    const handleClear = () => {
        if (isDealing || totalBet === 0) return
        playSound('chip')
        setBets({ dragon: 0, tiger: 0, tie: 0, suitedTie: 0 })
        setBetHistory([])
    }

    // Deal Round (Server Authoritative)
    const dealCards = useCallback(async () => {
        if (isDealing || totalBet <= 0 || totalBet > (balance || 0)) return

        setIsDealing(true)
        setRoundResult(null)
        setDragonFlipped(false)
        setTigerFlipped(false)
        setPredictedWinner(null)
        playSound('deal')
        setNonce(prev => prev + 1)

        let primaryChoice = 'dragon'
        if (bets.tiger > bets.dragon && bets.tiger > bets.tie && bets.tiger > bets.suitedTie) {
            primaryChoice = 'tiger'
        } else if (bets.tie > bets.dragon && bets.tie > bets.tiger && bets.tie > bets.suitedTie) {
            primaryChoice = 'tie'
        } else if (bets.suitedTie > bets.dragon && bets.suitedTie > bets.tiger && bets.suitedTie > bets.tie) {
            primaryChoice = 'suitedTie'
        }

        let betResponse
        try {
            betResponse = await executeGameBet({
                game: 'dragon-tiger',
                gameName: 'Dragon Tiger',
                betAmount: totalBet,
                choice: primaryChoice,
                deferBalanceUpdate: true,
                bets: {
                    dragon: bets.dragon,
                    tiger: bets.tiger,
                    tie: bets.tie,
                    suitedTie: bets.suitedTie
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

        const dValNum = evalData.dragon?.value || 6
        const tValNum = evalData.tiger?.value || 12
        const dSuit = evalData.dragon?.suit || '♦'
        const tSuit = evalData.tiger?.suit || '♠'

        const rankNames = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        const dRank = rankNames[dValNum - 1] || '6'
        const tRank = rankNames[tValNum - 1] || 'Q'

        const dCard = { rank: dRank, value: dValNum, suit: dSuit, color: SUIT_COLORS[dSuit] || '#dc2626' }
        const tCard = { rank: tRank, value: tValNum, suit: tSuit, color: SUIT_COLORS[tSuit] || '#0f172a' }

        setDragonCard(dCard)
        setTigerCard(tCard)

        // Stage 1: Reveal Dragon Card
        setTimeout(() => {
            setDragonFlipped(true)
            playSound('deal')
        }, 500)

        // Stage 2: Reveal Tiger Card
        setTimeout(() => {
            setTigerFlipped(true)
            playSound('deal')
        }, 1100)

        // Stage 3: Settle Round
        setTimeout(() => {
            if (typeof betResponse.commitBalance === 'function') {
                betResponse.commitBalance()
            }

            let winner = evalData.winner || 'dragon'
            const isSuited = (dValNum === tValNum && dSuit === tSuit)
            if (winner === 'tie' && isSuited) {
                winner = 'suitedTie'
            }

            setRoundResult(winner)
            setIsDealing(false)

            const payout = betResponse.payout ?? evalData.payout ?? 0
            const won = Boolean(betResponse.won ?? evalData.won)

            // Update Bead Plate Road Map
            const newHistoryItem = { winner, dVal: dCard.rank, tVal: tCard.rank, dSuit: dCard.suit, tSuit: tCard.suit }
            setHistory(prev => {
                const next = [newHistoryItem, ...prev.slice(0, 95)]
                try { localStorage.setItem('amrat_dt_bead_history', JSON.stringify(next)) } catch {}
                return next
            })

            // Record Persistent Round History
            const newRoundRecord = {
                id: `dt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                game: 'dragon-tiger',
                gameName: 'Dragon vs Tiger',
                choice: primaryChoice,
                outcome: winner,
                betAmount: totalBet,
                multiplier: totalBet > 0 ? parseFloat((payout / totalBet).toFixed(2)) : 0,
                payout,
                won,
                createdAt: new Date().toISOString()
            }

            setLocalRoundsHistory(prev => {
                const next = [newRoundRecord, ...prev.slice(0, 49)]
                try { localStorage.setItem('amrat_dragontiger_history', JSON.stringify(next)) } catch {}
                return next
            })

            if (won && payout > 0) {
                if (winner === 'tie' || winner === 'suitedTie' || (payout / totalBet) >= 3) {
                    playSound('bigWin')
                } else {
                    playSound('win')
                }
                notifyWin(payout, (payout / totalBet).toFixed(2))
            } else {
                playSound('loss')
                notifyLoss(totalBet)
            }

            if (refreshBalance) refreshBalance()
        }, 1800)
    }, [isDealing, totalBet, balance, bets, executeGameBet, notifyWin, notifyLoss, refreshBalance])

    // Road Statistics
    const totalRounds = history.length || 1
    const dragonCount = history.filter(h => h.winner === 'dragon').length
    const tigerCount = history.filter(h => h.winner === 'tiger').length
    const tieCount = history.filter(h => h.winner === 'tie' || h.winner === 'suitedTie').length

    const dragonPct = Math.round((dragonCount / totalRounds) * 100)
    const tigerPct = Math.round((tigerCount / totalRounds) * 100)
    const tiePct = Math.round((tieCount / totalRounds) * 100)

    // Bead Plate Matrix Grid (6 rows x 18 cols = 108 slots)
    const beadMatrix = useMemo(() => {
        const rows = 6
        const cols = 18
        const matrix = Array.from({ length: rows }, () => Array(cols).fill(null))

        // History beads fill column by column from top to bottom (traditional live casino bead plate)
        const reversedHistory = [...history].reverse()
        reversedHistory.forEach((item, idx) => {
            const col = Math.floor(idx / rows)
            const row = idx % rows
            if (col < cols) {
                matrix[row][col] = item
            }
        })
        return matrix
    }, [history])

    return (
        <div className="dt-table-root">
            <div className="dt-table-container">
                {/* ══════════════════════════════════════════════════════════
                    1. TOP BETTING STAGE (EVOLUTION-STYLE DRAGON TIGER TABLE)
                   ══════════════════════════════════════════════════════════ */}
                <div className="dt-stage-board">
                    {/* DRAGON WING (LEFT) */}
                    <div
                        id="dt-zone-dragon"
                        className={`dt-stage-wing dt-wing-dragon ${bets.dragon > 0 ? 'has-bet' : ''} ${roundResult === 'dragon' ? 'is-winner' : ''}`}
                        onClick={() => handleAddBet('dragon')}
                    >
                        {/* Dragon Watermark */}
                        <div className="dt-wing-watermark dragon-watermark"></div>

                        {/* Top Stats Row */}
                        <div className="dt-wing-top-row">
                            <div className="dt-percentage-bubble">{dragonPct}%</div>
                            <div className="dt-wing-pool-info">
                                <div className="pool-amount">{currencySymbol}{bets.dragon}</div>
                                <div className="pool-players">👤 {bets.dragon > 0 ? 1 : 0}</div>
                            </div>
                        </div>

                        {/* Dealt Card Area */}
                        <div className="dt-dealt-card-slot dragon-slot">
                            {dragonCard ? (
                                <div className={`dt-casino-card ${dragonFlipped ? 'flipped' : ''}`}>
                                    <div className="dt-card-inner">
                                        <div className="dt-card-front" style={{ color: dragonCard.color }}>
                                            <div className="card-idx top">{dragonCard.rank}<span>{dragonCard.suit}</span></div>
                                            <div className="card-center-suit">{dragonCard.suit}</div>
                                            <div className="card-idx bottom">{dragonCard.rank}<span>{dragonCard.suit}</span></div>
                                        </div>
                                        <div className="dt-card-back"></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="dt-card-placeholder"></div>
                            )}
                        </div>

                        {/* Bottom Label & Odds */}
                        <div className="dt-wing-bottom-label">
                            <span className="odds-ratio">1:1</span>
                            <span className="wing-title">DRAGON</span>
                        </div>

                        {/* Placed Bet Chip Badge */}
                        {bets.dragon > 0 && (
                            <div className="dt-placed-chip-badge badge-dragon">
                                <span>{currencySymbol}{bets.dragon}</span>
                            </div>
                        )}
                    </div>

                    {/* OVERLAPPING CENTER DISC (TIE & SUITED TIE) */}
                    <div className={`dt-center-medallion ${(roundResult === 'tie' || roundResult === 'suitedTie') ? 'is-winner' : ''}`}>
                        {/* Top Half: TIE 11:1 */}
                        <div
                            id="dt-zone-tie"
                            className={`dt-medallion-half half-top ${bets.tie > 0 ? 'has-bet' : ''}`}
                            onClick={() => handleAddBet('tie')}
                        >
                            <span className="medallion-odds">11:1</span>
                            <span className="medallion-text">TIE</span>
                            {bets.tie > 0 && (
                                <div className="dt-placed-chip-badge badge-tie">
                                    <span>{currencySymbol}{bets.tie}</span>
                                </div>
                            )}
                        </div>

                        {/* Center Bullseye Percentage */}
                        <div className="dt-medallion-bullseye">
                            <span>{tiePct}%</span>
                        </div>

                        {/* Bottom Half: SUITED TIE 50:1 */}
                        <div
                            id="dt-zone-suited-tie"
                            className={`dt-medallion-half half-bottom ${bets.suitedTie > 0 ? 'has-bet' : ''}`}
                            onClick={() => handleAddBet('suitedTie')}
                        >
                            <span className="medallion-text">SUITED TIE</span>
                            <span className="medallion-odds">50:1</span>
                            {bets.suitedTie > 0 && (
                                <div className="dt-placed-chip-badge badge-suited-tie">
                                    <span>{currencySymbol}{bets.suitedTie}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* TIGER WING (RIGHT) */}
                    <div
                        id="dt-zone-tiger"
                        className={`dt-stage-wing dt-wing-tiger ${bets.tiger > 0 ? 'has-bet' : ''} ${roundResult === 'tiger' ? 'is-winner' : ''}`}
                        onClick={() => handleAddBet('tiger')}
                    >
                        {/* Tiger Watermark */}
                        <div className="dt-wing-watermark tiger-watermark"></div>

                        {/* Top Stats Row */}
                        <div className="dt-wing-top-row">
                            <div className="dt-wing-pool-info align-left">
                                <div className="pool-amount">{currencySymbol}{bets.tiger}</div>
                                <div className="pool-players">👤 {bets.tiger > 0 ? 1 : 0}</div>
                            </div>
                            <div className="dt-percentage-bubble">{tigerPct}%</div>
                        </div>

                        {/* Dealt Card Area */}
                        <div className="dt-dealt-card-slot tiger-slot">
                            {tigerCard ? (
                                <div className={`dt-casino-card ${tigerFlipped ? 'flipped' : ''}`}>
                                    <div className="dt-card-inner">
                                        <div className="dt-card-front" style={{ color: tigerCard.color }}>
                                            <div className="card-idx top">{tigerCard.rank}<span>{tigerCard.suit}</span></div>
                                            <div className="card-center-suit">{tigerCard.suit}</div>
                                            <div className="card-idx bottom">{tigerCard.rank}<span>{tigerCard.suit}</span></div>
                                        </div>
                                        <div className="dt-card-back"></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="dt-card-placeholder"></div>
                            )}
                        </div>

                        {/* Bottom Label & Odds */}
                        <div className="dt-wing-bottom-label align-right">
                            <span className="odds-ratio">1:1</span>
                            <span className="wing-title">TIGER</span>
                        </div>

                        {/* Placed Bet Chip Badge */}
                        {bets.tiger > 0 && (
                            <div className="dt-placed-chip-badge badge-tiger">
                                <span>{currencySymbol}{bets.tiger}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════════
                    2. ROADMAP COUNTERS & PREDICTION BAR
                   ══════════════════════════════════════════════════════════ */}
                <div className="dt-roadmap-stats-bar">
                    <div className="dt-roadmap-counts">
                        <span className="round-serial">#{history.length}</span>
                        <div className="count-pill pill-d">
                            <span className="dot dot-d">D</span>
                            <strong>{dragonCount}</strong>
                        </div>
                        <div className="count-pill pill-t">
                            <span className="dot dot-t">T</span>
                            <strong>{tigerCount}</strong>
                        </div>
                        <div className="count-pill pill-tie">
                            <span className="dot dot-tie">T</span>
                            <strong>{tieCount}</strong>
                        </div>
                    </div>

                    {/* Road Map Predictor Buttons */}
                    <div className="dt-roadmap-predictors">
                        <button
                            type="button"
                            className={`dt-predictor-btn pred-d ${predictedWinner === 'dragon' ? 'active' : ''}`}
                            onClick={() => setPredictedWinner(prev => prev === 'dragon' ? null : 'dragon')}
                        >
                            D ?
                        </button>
                        <button
                            type="button"
                            className={`dt-predictor-btn pred-t ${predictedWinner === 'tiger' ? 'active' : ''}`}
                            onClick={() => setPredictedWinner(prev => prev === 'tiger' ? null : 'tiger')}
                        >
                            T ?
                        </button>
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════════
                    3. BEAD PLATE / ROADMAP MATRIX (DOTS GRID)
                   ══════════════════════════════════════════════════════════ */}
                <div className="dt-bead-plate-board">
                    <div className="dt-bead-matrix">
                        {beadMatrix.map((rowArr, rIdx) => (
                            <div key={rIdx} className="dt-matrix-row">
                                {rowArr.map((bead, cIdx) => (
                                    <div key={cIdx} className="dt-matrix-cell">
                                        {bead ? (
                                            <div className={`dt-history-bead bead-${bead.winner}`}>
                                                <span>{bead.winner === 'dragon' ? 'D' : (bead.winner === 'tiger' ? 'T' : 'T')}</span>
                                            </div>
                                        ) : (
                                            (predictedWinner && rIdx === 0 && cIdx === Math.min(17, Math.floor(history.length / 6))) ? (
                                                <div className={`dt-history-bead bead-${predictedWinner} preview-bead`}>
                                                    <span>{predictedWinner === 'dragon' ? 'D' : 'T'}</span>
                                                </div>
                                            ) : (
                                                <div className="dt-matrix-dot"></div>
                                            )
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════════
                    4. BOTTOM ACTION TOOLBAR & CHIP CAROUSEL
                   ══════════════════════════════════════════════════════════ */}
                <div className="dt-bottom-toolbar">
                    {/* Undo Action */}
                    <button
                        type="button"
                        id="dt-undo-btn"
                        className="dt-action-icon-btn"
                        onClick={handleUndo}
                        disabled={isDealing || betHistory.length === 0}
                    >
                        <span className="icon">↶</span>
                        <span className="label">UNDO</span>
                    </button>

                    {/* Chip Selection Carousel */}
                    <div className="dt-chips-carousel">
                        {CHIP_VALUES.map((val) => {
                            const isSelected = selectedChip === val
                            const theme = CHIP_THEMES[val] || CHIP_THEMES[50]
                            return (
                                <button
                                    key={val}
                                    type="button"
                                    className={`dt-casino-chip chip-val-${val} ${isSelected ? 'selected' : ''}`}
                                    onClick={() => { setSelectedChip(val); playSound('chip'); }}
                                    disabled={isDealing}
                                    style={{
                                        '--chip-bg': theme.bg,
                                        '--chip-border': theme.border,
                                        '--chip-text': theme.text
                                    }}
                                >
                                    <span className="chip-inner-ring">
                                        <span className="chip-amount">{val >= 1000 ? `${val / 1000}k` : val}</span>
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    {/* Double Bet Action */}
                    <button
                        type="button"
                        id="dt-double-btn"
                        className="dt-action-icon-btn"
                        onClick={handleDouble}
                        disabled={isDealing || totalBet === 0 || totalBet * 2 > (balance || 0)}
                    >
                        <span className="icon">×2</span>
                        <span className="label">DOUBLE</span>
                    </button>

                    {/* Floating Menu Action */}
                    <button
                        type="button"
                        id="dt-menu-btn"
                        className="dt-floating-menu-btn"
                        onClick={() => setMenuDrawerOpen(true)}
                        aria-label="Open Game Menu"
                    >
                        <MenuOutlined />
                    </button>
                </div>

                {/* DEAL ACTION BANNER (When Bets Are Placed) */}
                {totalBet > 0 && (
                    <div className="dt-deal-overlay-bar">
                        <div className="dt-deal-summary">
                            <span>TOTAL BET</span>
                            <strong>{currencySymbol}{totalBet}</strong>
                        </div>
                        <button
                            type="button"
                            id="dt-deal-btn"
                            className="dt-primary-deal-btn"
                            onClick={dealCards}
                            disabled={isDealing}
                        >
                            {isDealing ? 'DEALING CARDS...' : 'DEAL CARDS'}
                        </button>
                        <button
                            type="button"
                            className="dt-cancel-clear-btn"
                            onClick={handleClear}
                            disabled={isDealing}
                        >
                            CLEAR
                        </button>
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════════════════════════
                5. PERSISTENT ROUND HISTORY TABLE (BENEATH BOARD)
               ══════════════════════════════════════════════════════════ */}
            <div className="dt-persistent-history-wrapper">
                <GameBottomHistory
                    gameKey="dragon-tiger"
                    gameTitle="Dragon vs Tiger"
                    localRounds={localRoundsHistory}
                />
            </div>

            {/* ══════════════════════════════════════════════════════════
                6. SIDE-OUT MENU DRAWER (FAIRNESS, RULES, SOUND)
               ══════════════════════════════════════════════════════════ */}
            <Drawer
                title="🐉 Dragon Tiger · Live Studio"
                placement="right"
                width={380}
                open={menuDrawerOpen}
                onClose={() => setMenuDrawerOpen(false)}
                styles={{
                    body: { padding: 18, background: '#090e17', color: '#f1f5f9' },
                    header: { background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.08)' }
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fbbf24', marginBottom: 6 }}>
                            👑 Live Game Rules
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6 }}>
                            • <strong>Dragon (1:1)</strong>: Highest card wins. King is 13, Ace is 1.<br />
                            • <strong>Tiger (1:1)</strong>: Highest card wins.<br />
                            • <strong>Tie (11:1)</strong>: Dragon and Tiger have the same rank.<br />
                            • <strong>Suited Tie (50:1)</strong>: Same rank AND same suit!
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => { setMenuDrawerOpen(false); setFairnessOpen(true); }}
                        className="dt-drawer-action-btn"
                    >
                        <SafetyCertificateOutlined /> Verify Provably Fair
                    </button>

                    <button
                        type="button"
                        onClick={() => { setMenuDrawerOpen(false); setHistoryDrawerOpen(true); }}
                        className="dt-drawer-action-btn"
                    >
                        <HistoryOutlined /> View Detailed Round History
                    </button>

                    <button
                        type="button"
                        onClick={() => setSoundMuted(s => !s)}
                        className="dt-drawer-action-btn"
                    >
                        <SoundOutlined /> Sound Effects: {soundMuted ? 'OFF' : 'ON'}
                    </button>
                </div>
            </Drawer>

            {/* Provably Fair Modal */}
            <Modal
                title="🛡️ Dragon Tiger Provably Fair Verification"
                open={fairnessOpen}
                onOk={() => setFairnessOpen(false)}
                onCancel={() => setFairnessOpen(false)}
                footer={null}
            >
                <div style={{ display: 'grid', gap: '12px', fontSize: '13px' }}>
                    <p>
                        Each card deal is cryptographically generated with SHA-256 HMAC using an unalterable server seed and client seed.
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

            {/* Round History Drawer */}
            <Drawer
                title="Dragon Tiger · Round History"
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
                    localRounds={localRoundsHistory}
                />
            </Drawer>
        </div>
    )
}
