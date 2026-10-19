import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
    TrophyOutlined,
    ThunderboltOutlined,
    SafetyCertificateOutlined,
    CheckCircleFilled,
    CloseCircleOutlined,
    FireOutlined,
    ReloadOutlined,
    UserOutlined,
    TeamOutlined
} from '@ant-design/icons'
import { useAuth } from '../../context/AuthContext'
import { useWallet } from '../../context/WalletContext'
import { useWebSocket } from '../../context/WebSocketContext'
import casinoAudio from '../../utils/casinoAudio'
import { getOptimizedImageUrl } from '../../utils/cloudinary'
import './PvPDuelsArena.css'

const HEADS_ASSET = getOptimizedImageUrl('/images/coin-toss/heads.jpg', { width: 300 })
const TAILS_ASSET = getOptimizedImageUrl('/images/coin-toss/tails.jpg', { width: 300 })

export default function PvPDuelsArena() {
    const { user, token, openAuthModal } = useAuth()
    const { balance, currencySymbol, refreshBalance, showToast } = useWallet()
    const { subscribe, isConnected } = useWebSocket()

    // Creation State
    const [choice, setChoice] = useState('heads')
    const [stake, setStake] = useState(100)
    const [isCreating, setIsCreating] = useState(false)
    const [isJoiningId, setIsJoiningId] = useState(null)
    const [isCancellingId, setIsCancellingId] = useState(null)

    // Lobby State
    const [openDuels, setOpenDuels] = useState([])
    const [recentDuels, setRecentDuels] = useState([])
    const [stats, setStats] = useState({
        totalPvpVolume: 0,
        totalRakeCollected: 0,
        totalDuelsResolved: 0,
        openDuelsCount: 0,
        houseRakeRate: 0.03
    })
    const [activeTab, setActiveTab] = useState('open') // 'open' | 'history'
    const [mobileTab, setMobileTab] = useState('open') // 'open' | 'create'
    const [loadingLobby, setLoadingLobby] = useState(false)

    // Battle Modal & Provably Fair reveal
    const [battleModal, setBattleModal] = useState(null) // { duel, spinning: bool, outcome: string, won: bool }
    const [showSeeds, setShowSeeds] = useState(false)

    // Stake multipliers
    const multiplyStake = (factor) => {
        casinoAudio.playChip()
        setStake((prev) => {
            const base = prev || 10
            return Math.max(10, Math.min(50000, Math.floor(base * factor)))
        })
    }

    const setMaxStake = () => {
        casinoAudio.playChip()
        const maxAffordable = Math.min(50000, Math.floor(balance || 10))
        setStake(Math.max(10, maxAffordable))
    }

    // Potential pot math
    const parsedStake = parseFloat(stake) || 0
    const totalPot = parseFloat((parsedStake * 2).toFixed(2))
    const rakeAmount = parseFloat((totalPot * 0.03).toFixed(2))
    const potentialWinnerPayout = parseFloat((totalPot - rakeAmount).toFixed(2))

    // Fetch live duels and platform statistics
    const fetchDuelsAndStats = useCallback(async () => {
        setLoadingLobby(true)
        try {
            const [duelsRes, statsRes] = await Promise.all([
                fetch('/api/pvp/duels'),
                fetch('/api/pvp/stats')
            ])

            if (duelsRes.ok) {
                const data = await duelsRes.json()
                if (data.duels) {
                    setOpenDuels(data.duels.filter((d) => d.status === 'open'))
                    setRecentDuels(data.duels.filter((d) => d.status === 'resolved'))
                }
            }

            if (statsRes.ok) {
                const sData = await statsRes.json()
                if (sData.stats) {
                    setStats(sData.stats)
                }
            }
        } catch (err) {
            console.error('[PVP ARENA] Error loading duels:', err)
        } finally {
            setLoadingLobby(false)
        }
    }, [])

    useEffect(() => {
        fetchDuelsAndStats()
    }, [fetchDuelsAndStats])

    // Trigger duel resolution animation
    const triggerDuelBattle = useCallback(
        (resolvedDuel) => {
            const isUserCreator = user && resolvedDuel.creatorId === user.id
            const isUserOpponent = user && resolvedDuel.opponentId === user.id
            const isUserParticipant = isUserCreator || isUserOpponent
            const userWon = isUserParticipant && resolvedDuel.winnerId === user.id

            setBattleModal({
                duel: resolvedDuel,
                spinning: true,
                outcome: resolvedDuel.outcome,
                isParticipant: isUserParticipant,
                won: userWon
            })
            setShowSeeds(false)

            if (typeof casinoAudio.playCoinFlip === 'function') {
                casinoAudio.playCoinFlip()
            } else {
                casinoAudio.playBet()
            }

            // Spin animation for 1.8 seconds before reveal
            setTimeout(() => {
                setBattleModal((prev) => (prev ? { ...prev, spinning: false } : null))
                if (typeof casinoAudio.playCoinLand === 'function') {
                    casinoAudio.playCoinLand()
                }

                if (isUserParticipant) {
                    if (userWon) {
                        casinoAudio.playWin()
                    } else {
                        casinoAudio.playLoss()
                    }
                    if (refreshBalance) refreshBalance()
                }
            }, 1800)
        },
        [user, refreshBalance]
    )

    // WebSocket real-time event listeners
    useEffect(() => {
        const unsubCreated = subscribe('PVP_DUEL_CREATED', (newDuel) => {
            setOpenDuels((prev) => {
                if (prev.some((d) => d.id === newDuel.id)) return prev
                return [newDuel, ...prev]
            })
            setStats((s) => ({ ...s, openDuelsCount: s.openDuelsCount + 1 }))
            casinoAudio.playTick()
        })

        const unsubResolved = subscribe('PVP_DUEL_RESOLVED', (resolvedDuel) => {
            setOpenDuels((prev) => prev.filter((d) => d.id !== resolvedDuel.id))
            setRecentDuels((prev) => [resolvedDuel, ...prev.slice(0, 29)])
            setStats((s) => ({
                ...s,
                totalDuelsResolved: (s.totalDuelsResolved || 0) + 1,
                totalPvpVolume: parseFloat(((s.totalPvpVolume || 0) + resolvedDuel.totalPot).toFixed(2)),
                totalRakeCollected: parseFloat(((s.totalRakeCollected || 0) + (resolvedDuel.houseRakeAmount || 0)).toFixed(2)),
                openDuelsCount: Math.max(0, (s.openDuelsCount || 1) - 1)
            }))

            // If current logged-in user is involved, show battle overlay
            if (user && (resolvedDuel.creatorId === user.id || resolvedDuel.opponentId === user.id)) {
                triggerDuelBattle(resolvedDuel)
            }
        })

        const unsubCancelled = subscribe('PVP_DUEL_CANCELLED', ({ duelId }) => {
            setOpenDuels((prev) => prev.filter((d) => d.id !== duelId))
            setStats((s) => ({ ...s, openDuelsCount: Math.max(0, (s.openDuelsCount || 1) - 1) }))
        })

        return () => {
            if (unsubCreated) unsubCreated()
            if (unsubResolved) unsubResolved()
            if (unsubCancelled) unsubCancelled()
        }
    }, [subscribe, user, triggerDuelBattle])

    // Create Duel
    const handleCreateDuel = async () => {
        if (!user) {
            if (openAuthModal) openAuthModal('login')
            return
        }
        if (parsedStake < 10) {
            showToast('warning', 'Minimum Stake', 'Minimum stake is ₹10')
            return
        }
        if (parsedStake > balance) {
            showToast('error', 'Insufficient Funds', 'Deposit funds to create duel')
            return
        }

        setIsCreating(true)
        casinoAudio.playChip()

        try {
            const res = await fetch('/api/pvp/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    stakeAmount: parsedStake,
                    creatorChoice: choice,
                    clientSeed: `player-${Date.now()}`
                })
            })

            const data = await res.json()
            if (!res.ok || !data.success) {
                showToast('error', 'Duel Creation Failed', data.error || 'Failed to create challenge')
                casinoAudio.playLoss()
            } else {
                showToast(
                    'success',
                    '⚔️ Duel Challenge Live',
                    `₹${parsedStake.toLocaleString('en-IN')} on ${choice.toUpperCase()} broadcasted to players!`
                )
                setMobileTab('open')
                if (refreshBalance) refreshBalance()
            }
        } catch (err) {
            showToast('error', 'Network Error', err.message)
        } finally {
            setIsCreating(false)
        }
    }

    // Join Duel
    const handleJoinDuel = async (duel) => {
        if (!user) {
            if (openAuthModal) openAuthModal('login')
            return
        }
        if (duel.stake > balance) {
            showToast('error', 'Insufficient Balance', `You need ₹${duel.stake.toLocaleString('en-IN')} to accept this challenge`)
            return
        }

        setIsJoiningId(duel.id)
        casinoAudio.playChip()

        try {
            const res = await fetch('/api/pvp/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    duelId: duel.id,
                    clientSeed: `challenger-${Date.now()}`
                })
            })

            const data = await res.json()
            if (!res.ok || !data.success) {
                showToast('error', 'Cannot Accept Duel', data.error || 'Challenge is no longer available')
                casinoAudio.playLoss()
            } else {
                // Battle modal will trigger immediately via resolution state or response
                if (data.duel) {
                    triggerDuelBattle(data.duel)
                }
            }
        } catch (err) {
            showToast('error', 'Network Error', err.message)
        } finally {
            setIsJoiningId(null)
        }
    }

    // Cancel Duel
    const handleCancelDuel = async (duel) => {
        if (!user || duel.creatorId !== user.id) return

        setIsCancellingId(duel.id)
        try {
            const res = await fetch('/api/pvp/cancel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ duelId: duel.id })
            })

            const data = await res.json()
            if (!res.ok || !data.success) {
                showToast('error', 'Cancel Failed', data.error || 'Unable to cancel challenge')
            } else {
                showToast('info', 'Duel Cancelled', `₹${duel.stake.toLocaleString('en-IN')} refunded to your balance`)
                setOpenDuels((prev) => prev.filter((d) => d.id !== duel.id))
                if (refreshBalance) refreshBalance()
            }
        } catch (err) {
            showToast('error', 'Network Error', err.message)
        } finally {
            setIsCancellingId(null)
        }
    }

    return (
        <div className="pvp-arena-container">
            {/* Top Hero Banner & Platform Volume */}
            <div className="pvp-hero-banner">
                <div className="pvp-hero-title-row">
                    <div className="pvp-hero-title">
                        <span>⚔️ 1v1 PvP Arena</span>
                        <span className="badge">P2P Arcade</span>
                        <span className="badge badge-rake">3% Rake</span>
                    </div>

                    <div className="pvp-stats-row">
                        <div className="pvp-stat-pill">
                            <span>Open:</span>
                            <strong className="accent-gold">{openDuels.length}</strong>
                        </div>
                        <div className="pvp-stat-pill">
                            <span>Resolved:</span>
                            <strong>{stats.totalDuelsResolved.toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="pvp-stat-pill">
                            <span>Volume:</span>
                            <strong className="accent-green">
                                {currencySymbol}{Number(stats.totalPvpVolume || 0).toLocaleString('en-IN')}
                            </strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Tab Switcher */}
            <div className="pvp-mobile-nav">
                <button
                    type="button"
                    className={`pvp-mobile-nav-btn ${mobileTab === 'open' ? 'active' : ''}`}
                    onClick={() => {
                        casinoAudio.playChip()
                        setMobileTab('open')
                    }}
                >
                    <span>⚔️ Open Duels ({openDuels.length})</span>
                </button>
                <button
                    type="button"
                    className={`pvp-mobile-nav-btn ${mobileTab === 'create' ? 'active' : ''}`}
                    onClick={() => {
                        casinoAudio.playChip()
                        setMobileTab('create')
                    }}
                >
                    <span>➕ Create Duel</span>
                </button>
            </div>

            {/* Arena Main Grid */}
            <div className="pvp-arena-grid">
                {/* Left Card: Create Duel Challenge */}
                <div className={`pvp-card pvp-create-card ${mobileTab === 'create' ? 'mobile-visible' : 'mobile-hidden'}`}>
                    <div className="pvp-card-header">
                        <div className="pvp-card-title">
                            <FireOutlined style={{ color: '#fbbf24' }} />
                            <span>Create Challenge</span>
                        </div>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Provably Fair 50/50</span>
                    </div>

                    {/* Choose Side */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Your Prediction</span>
                        <div className="pvp-side-selector">
                            <button
                                type="button"
                                className={`pvp-side-btn heads ${choice === 'heads' ? 'active' : ''}`}
                                onClick={() => {
                                    casinoAudio.playChip()
                                    setChoice('heads')
                                }}
                            >
                                <span className="pvp-side-icon">🪙</span>
                                <span>HEADS</span>
                            </button>
                            <button
                                type="button"
                                className={`pvp-side-btn tails ${choice === 'tails' ? 'active' : ''}`}
                                onClick={() => {
                                    casinoAudio.playChip()
                                    setChoice('tails')
                                }}
                            >
                                <span className="pvp-side-icon">🦅</span>
                                <span>TAILS</span>
                            </button>
                        </div>
                    </div>

                    {/* Stake Amount */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Stake Amount</span>
                            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                Bal: {currencySymbol}{Number(balance || 0).toLocaleString('en-IN')}
                            </span>
                        </div>

                        <div className="bet-input-box">
                            <span className="input-currency">{currencySymbol}</span>
                            <input
                                type="number"
                                min={10}
                                max={50000}
                                step="10"
                                className="bet-input-field"
                                value={stake}
                                onChange={(e) => setStake(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            />
                            <div className="bet-math-buttons">
                                <button
                                    type="button"
                                    className="math-btn"
                                    onClick={() => multiplyStake(0.5)}
                                >
                                    ½
                                </button>
                                <button
                                    type="button"
                                    className="math-btn"
                                    onClick={() => multiplyStake(2)}
                                >
                                    2X
                                </button>
                                <button
                                    type="button"
                                    className="math-btn max-btn"
                                    onClick={setMaxStake}
                                >
                                    MAX
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Pot Math Breakdown */}
                    <div className="pvp-pot-preview">
                        <div className="pvp-pot-row">
                            <span>Total Pot (2x Stake):</span>
                            <strong>{currencySymbol}{totalPot.toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="pvp-pot-row winner-row">
                            <span>Winner Takes (3% Rake):</span>
                            <strong className="accent-green">{currencySymbol}{potentialWinnerPayout.toLocaleString('en-IN')}</strong>
                        </div>
                    </div>

                    {/* Create Button */}
                    <button
                        type="button"
                        className="pvp-create-btn"
                        onClick={handleCreateDuel}
                        disabled={isCreating || parsedStake > balance || parsedStake < 10}
                    >
                        {isCreating ? (
                            <span>BROADCASTING CHALLENGE...</span>
                        ) : parsedStake > balance ? (
                            <span>INSUFFICIENT BALANCE</span>
                        ) : (
                            <span>⚔️ CREATE {currencySymbol}{parsedStake.toLocaleString('en-IN')} DUEL</span>
                        )}
                    </button>
                </div>

                {/* Right Card: Live Open Challenges & Battled History */}
                <div className={`pvp-card pvp-lobby-card ${mobileTab === 'open' ? 'mobile-visible' : 'mobile-hidden'}`}>
                    <div className="pvp-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button
                                type="button"
                                style={{
                                    background: activeTab === 'open' ? 'rgba(245, 175, 25, 0.15)' : 'transparent',
                                    border: activeTab === 'open' ? '1px solid #f5af19' : '1px solid transparent',
                                    color: activeTab === 'open' ? '#fbbf24' : '#94a3b8',
                                    borderRadius: 6,
                                    padding: '5px 12px',
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setActiveTab('open')}
                            >
                                Open Challenges ({openDuels.length})
                            </button>
                            <button
                                type="button"
                                style={{
                                    background: activeTab === 'history' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                    border: activeTab === 'history' ? '1px solid #3b82f6' : '1px solid transparent',
                                    color: activeTab === 'history' ? '#60a5fa' : '#94a3b8',
                                    borderRadius: 6,
                                    padding: '5px 12px',
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setActiveTab('history')}
                            >
                                Recent Battles ({recentDuels.length})
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={fetchDuelsAndStats}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                            title="Refresh Arena"
                        >
                            <ReloadOutlined spin={loadingLobby} />
                        </button>
                    </div>

                    {/* Open Challenges List */}
                    {activeTab === 'open' && (
                        <div className="pvp-lobby-list">
                            {openDuels.length === 0 ? (
                                <div className="pvp-empty-lobby">
                                    <TeamOutlined style={{ fontSize: '2.4rem', opacity: 0.3 }} />
                                    <span>No active challenges waiting. Create one now to start the battle!</span>
                                    <button
                                        type="button"
                                        className="pvp-create-shortcut-btn"
                                        onClick={() => setMobileTab('create')}
                                    >
                                        ➕ Create Challenge
                                    </button>
                                </div>
                            ) : (
                                openDuels.map((duel) => {
                                    const isSelf = user && duel.creatorId === user.id
                                    return (
                                        <div key={duel.id} className="pvp-challenge-card">
                                            <div className="pvp-challenge-meta">
                                                <div className="pvp-challenge-avatar">
                                                    <UserOutlined />
                                                </div>
                                                <div className="pvp-challenge-user-info">
                                                    <span className="pvp-challenge-username">
                                                        {duel.creatorUsername} {isSelf && '(You)'}
                                                    </span>
                                                    <span
                                                        className={`pvp-challenge-choice-badge ${duel.creatorChoice}`}
                                                    >
                                                        {duel.creatorChoice === 'heads' ? '🪙 HEADS' : '🦅 TAILS'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                                <div className="pvp-challenge-pot-info">
                                                    <span className="pvp-challenge-stake">
                                                        {currencySymbol}{duel.stake.toLocaleString('en-IN')}
                                                    </span>
                                                    <span className="pvp-challenge-winner-pot">
                                                        Win: {currencySymbol}{duel.winnerPayout.toLocaleString('en-IN')}
                                                    </span>
                                                </div>

                                                {isSelf ? (
                                                    <button
                                                        type="button"
                                                        className="pvp-cancel-btn"
                                                        onClick={() => handleCancelDuel(duel)}
                                                        disabled={isCancellingId === duel.id}
                                                    >
                                                        {isCancellingId === duel.id ? 'Refunding...' : 'Cancel'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="pvp-fight-btn"
                                                        onClick={() => handleJoinDuel(duel)}
                                                        disabled={isJoiningId === duel.id}
                                                    >
                                                        {isJoiningId === duel.id ? (
                                                            'Fighting...'
                                                        ) : (
                                                            `⚔️ Accept (${duel.creatorChoice === 'heads' ? 'TAILS' : 'HEADS'})`
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {/* Recent Resolved Battles List */}
                    {activeTab === 'history' && (
                        <div className="pvp-lobby-list">
                            {recentDuels.length === 0 ? (
                                <div className="pvp-empty-lobby">
                                    <span>No resolved duels yet.</span>
                                </div>
                            ) : (
                                recentDuels.map((duel) => (
                                    <div
                                        key={duel.id}
                                        className="pvp-challenge-card"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => {
                                            setBattleModal({
                                                duel,
                                                spinning: false,
                                                outcome: duel.outcome,
                                                isParticipant: user && (duel.creatorId === user.id || duel.opponentId === user.id),
                                                won: user && duel.winnerId === user.id
                                            })
                                        }}
                                    >
                                        <div className="pvp-challenge-meta">
                                            <div
                                                className="pvp-challenge-avatar"
                                                style={{ borderColor: '#34d399', background: 'rgba(52, 211, 153, 0.1)' }}
                                            >
                                                👑
                                            </div>
                                            <div className="pvp-challenge-user-info">
                                                <span className="pvp-challenge-username" style={{ color: '#34d399' }}>
                                                    {duel.winnerUsername} won
                                                </span>
                                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                    vs {duel.loserUsername} ({duel.outcome?.toUpperCase()})
                                                </span>
                                            </div>
                                        </div>

                                        <div className="pvp-challenge-pot-info">
                                            <span className="pvp-challenge-stake" style={{ color: '#34d399' }}>
                                                +{currencySymbol}{duel.winnerPayout.toLocaleString('en-IN')}
                                            </span>
                                            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                                Pot: {currencySymbol}{duel.totalPot.toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 3D Battle Overlay Modal */}
            {battleModal && (
                <div className="pvp-battle-overlay" onClick={() => !battleModal.spinning && setBattleModal(null)}>
                    <div className="pvp-battle-modal" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>
                                ⚔️ 1v1 PvP Duel Resolution
                            </span>
                            {!battleModal.spinning && (
                                <button
                                    type="button"
                                    onClick={() => setBattleModal(null)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#64748b',
                                        fontSize: '1.2rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Versus Row */}
                        <div className="pvp-battle-versus-row">
                            <div className="pvp-combatant">
                                <div
                                    className={`pvp-combatant-avatar ${
                                        !battleModal.spinning && battleModal.duel.winnerId === battleModal.duel.creatorId
                                            ? 'winner'
                                            : ''
                                    }`}
                                >
                                    <UserOutlined />
                                </div>
                                <strong style={{ fontSize: '0.85rem', color: '#fff' }}>
                                    {battleModal.duel.creatorUsername}
                                </strong>
                                <span className={`pvp-challenge-choice-badge ${battleModal.duel.creatorChoice}`}>
                                    {battleModal.duel.creatorChoice?.toUpperCase()}
                                </span>
                            </div>

                            <div className="pvp-vs-badge">VS</div>

                            <div className="pvp-combatant">
                                <div
                                    className={`pvp-combatant-avatar ${
                                        !battleModal.spinning && battleModal.duel.winnerId === battleModal.duel.opponentId
                                            ? 'winner'
                                            : ''
                                    }`}
                                >
                                    <UserOutlined />
                                </div>
                                <strong style={{ fontSize: '0.85rem', color: '#fff' }}>
                                    {battleModal.duel.opponentUsername}
                                </strong>
                                <span className={`pvp-challenge-choice-badge ${battleModal.duel.opponentChoice}`}>
                                    {battleModal.duel.opponentChoice?.toUpperCase()}
                                </span>
                            </div>
                        </div>

                        {/* 3D Spinning Coin Animation */}
                        <div className="pvp-battle-coin-stage">
                            <div className={`pvp-battle-coin ${battleModal.spinning ? 'spinning' : ''}`}>
                                {!battleModal.spinning && (
                                    <span>{battleModal.outcome === 'heads' ? '🪙' : '🦅'}</span>
                                )}
                            </div>
                        </div>

                        {/* Outcome & Celebration */}
                        {!battleModal.spinning && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                                <div
                                    style={{
                                        fontSize: '1.25rem',
                                        fontWeight: 900,
                                        color: battleModal.isParticipant
                                            ? battleModal.won
                                                ? '#34d399'
                                                : '#f87171'
                                            : '#fbbf24'
                                    }}
                                >
                                    {battleModal.isParticipant
                                        ? battleModal.won
                                            ? `🎉 VICTORY! YOU WON ${currencySymbol}${battleModal.duel.winnerPayout.toLocaleString('en-IN')}!`
                                            : `💀 DEFEATED! Better luck next duel.`
                                        : `👑 ${battleModal.duel.winnerUsername} WON ${currencySymbol}${battleModal.duel.winnerPayout.toLocaleString('en-IN')}!`}
                                </div>
                                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                                    Coin landed on <strong>{battleModal.outcome?.toUpperCase()}</strong> • Total Pot:{' '}
                                    {currencySymbol}{battleModal.duel.totalPot.toLocaleString('en-IN')} (3% Platform Rake)
                                </span>

                                {/* Provably Fair Seed Verification Toggle */}
                                <button
                                    type="button"
                                    onClick={() => setShowSeeds((s) => !s)}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: 6,
                                        color: '#94a3b8',
                                        padding: '4px 10px',
                                        fontSize: '0.74rem',
                                        cursor: 'pointer',
                                        marginTop: 8
                                    }}
                                >
                                    <SafetyCertificateOutlined />{' '}
                                    {showSeeds ? 'Hide Cryptographic Verification' : 'Verify Provably Fair HMAC-SHA256'}
                                </button>

                                {showSeeds && battleModal.duel.provablyFair && (
                                    <div
                                        style={{
                                            background: '#090e17',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            borderRadius: 8,
                                            padding: 10,
                                            width: '100%',
                                            fontSize: '0.68rem',
                                            color: '#94a3b8',
                                            textAlign: 'left',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 4,
                                            marginTop: 6,
                                            wordBreak: 'break-all'
                                        }}
                                    >
                                        <div>
                                            <strong style={{ color: '#fff' }}>Revealed Server Seed:</strong>{' '}
                                            {battleModal.duel.provablyFair.serverSeed || 'Revealed post-battle'}
                                        </div>
                                        <div>
                                            <strong style={{ color: '#fff' }}>Server Seed SHA256 Hash:</strong>{' '}
                                            {battleModal.duel.provablyFair.serverSeedHash}
                                        </div>
                                        <div>
                                            <strong style={{ color: '#fff' }}>Client Seed:</strong>{' '}
                                            {battleModal.duel.provablyFair.clientSeed}
                                        </div>
                                        <div>
                                            <strong style={{ color: '#fff' }}>HMAC Outcome Roll:</strong>{' '}
                                            {battleModal.duel.provablyFair.floatVal !== null
                                                ? `${battleModal.duel.provablyFair.floatVal?.toFixed(6)} (< 0.50 = Heads)`
                                                : 'Resolved'}
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    className="pvp-create-btn"
                                    style={{ width: '100%', marginTop: 12, padding: 10 }}
                                    onClick={() => setBattleModal(null)}
                                >
                                    CONTINUE ARENA
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
