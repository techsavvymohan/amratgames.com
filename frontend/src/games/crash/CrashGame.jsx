import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
    Modal,
    Typography,
    message,
    Tooltip
} from 'antd'
import {
    ExpandOutlined,
    SafetyCertificateOutlined,
    SoundOutlined,
    FullscreenExitOutlined,
    TrophyOutlined,
    FireOutlined,
    StarOutlined,
    CloseOutlined,
    ReloadOutlined,
    TeamOutlined,
    UserOutlined,
    PlusOutlined,
    BarChartOutlined
} from '@ant-design/icons'
import BettingPanel from './BettingPanel'
import GameChart from './GameChart'
import GameHistory from './GameHistory'
import PlayerBets from './PlayerBets'
import ProvablyFairVerifierModal from '../../components/ProvablyFair/ProvablyFairVerifierModal'
import GameBottomHistory from '../../components/GameHistory/GameBottomHistory'
import casinoAudio from '../../utils/casinoAudio'
import { useWallet } from '../../context/WalletContext'
import { useAuth } from '../../context/AuthContext'
import { useWebSocket } from '../../context/WebSocketContext'
import './CrashGame.css'

const { Text } = Typography

// Game phases
const PHASE = {
    IDLE: 'idle',
    WAITING: 'waiting',
    RUNNING: 'running',
    CRASHED: 'crashed'
}

export const CRASH_GROWTH_RATE = 0.16

function CrashGame() {
    const { user } = useAuth()
    const { subscribe, sendJson, isConnected, crashRoomState } = useWebSocket()
    const {
        balance,
        startCrashRound,
        cashoutCrashRound,
        bustCrashRound,
        getActiveCrashRound,
        placeRoomCrashBet,
        cashoutRoomCrash,
        cancelRoomCrashBet,
        getRoomCrashState,
        showToast,
        currencySymbol,
        currency
    } = useWallet()

    const activeRoundIdRef = useRef(null)
    const targetCrashPointRef = useRef(null)
    const [gameMode, setGameMode] = useState('arena') // 'arena' (multiplayer synchronized) | 'solo' (provably fair)
    const [roomBets, setRoomBets] = useState(() => crashRoomState?.bets || [])
    const roomRoundIdRef = useRef(crashRoomState?.roundId || null)
    const flightStartTimeRef = useRef(crashRoomState?.flightStartTime || null)
    const [phase, setPhase] = useState(() => {
        if (crashRoomState?.state === 'FLYING') return PHASE.RUNNING
        if (crashRoomState?.state === 'CRASHED') return PHASE.CRASHED
        return PHASE.WAITING
    })
    const [multiplier, setMultiplier] = useState(() => crashRoomState?.currentMultiplier || 1.00)
    const [flightStartTime, setFlightStartTime] = useState(() => crashRoomState?.flightStartTime || null)
    const [countdown, setCountdown] = useState(() => crashRoomState?.countdown || 0)
    const [elapsedTime, setElapsedTime] = useState(() => {
        if (crashRoomState?.state === 'FLYING' && crashRoomState.flightStartTime) {
            return Math.max(0, Math.min(50, (Date.now() - crashRoomState.flightStartTime) / 1000))
        }
        return 0
    })
    const [history, setHistory] = useState(() => {
        if (crashRoomState?.history && Array.isArray(crashRoomState.history)) {
            return crashRoomState.history.map(h => typeof h === 'object' ? h.crashPoint : h)
        }
        return [1.61, 7.07, 1.41, 1.25, 1.12, 3.02, 1.90, 1.05, 14.80, 2.15, 1.34, 4.20]
    })
    const [soundEnabled, setSoundEnabled] = useState(true)

    // DUAL BETTING PANELS STATE (Aviator Signature Architecture)
    const [panel1, setPanel1] = useState({
        amount: 25,
        betPlaced: false,
        cashedOut: false,
        payout: 0,
        autoCashout: null
    })

    const [panel2, setPanel2] = useState({
        amount: 25,
        betPlaced: false,
        cashedOut: false,
        payout: 0,
        autoCashout: null
    })

    const panel1Ref = useRef(panel1)
    panel1Ref.current = panel1
    const panel2Ref = useRef(panel2)
    panel2Ref.current = panel2

    const [showSecondPanel, setShowSecondPanel] = useState(true)

    // UI & Modal States
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
    const [fairnessModalOpen, setFairnessModalOpen] = useState(false)
    const [gameRecords, setGameRecords] = useState(() => {
        try {
            const raw = localStorage.getItem('amrat_crash_history')
            return raw ? JSON.parse(raw) : []
        } catch {
            return []
        }
    })

    useEffect(() => {
        if (gameRecords.length > 0) {
            try {
                localStorage.setItem('amrat_crash_history', JSON.stringify(gameRecords.slice(0, 50)))
            } catch {}
        }
    }, [gameRecords])

    const gameDisplayRef = useRef(null)
    const multiplierRef = useRef(1.00)
    const elapsedTimeRef = useRef(0)
    const [messageApi, contextHolder] = message.useMessage()

    // Provably Fair state
    const [clientSeedInput, setClientSeedInput] = useState(() =>
        localStorage.getItem('amrat_crash_client_seed') || 'amrat-player'
    )
    const [fairnessData, setFairnessData] = useState({
        serverSeedHash: 'Loading...',
        clientSeed: localStorage.getItem('amrat_crash_client_seed') || 'amrat-player',
        nonce: 1
    })

    // Fetch active server seed hash on mount
    useEffect(() => {
        fetch('/api/games/provably-fair/seed')
            .then(res => res.json())
            .then(data => {
                if (data && data.serverSeedHash) {
                    setFairnessData(prev => ({ ...prev, serverSeedHash: data.serverSeedHash }))
                }
            })
            .catch(() => {})
    }, [])

    // Fullscreen toggle
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            if (gameDisplayRef.current) {
                gameDisplayRef.current.requestFullscreen().then(() => {
                    setIsFullscreen(true)
                }).catch(() => {})
            }
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false)
            }).catch(() => {})
        }
    }, [])

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    // Synchronize Room State from server
    const syncRoomState = useCallback((room) => {
        if (!room) return
        roomRoundIdRef.current = room.roundId

        if (room.state === 'WAITING') {
            setPhase(PHASE.WAITING)
            setCountdown(room.countdown || 0)
            setMultiplier(1.00)
            setElapsedTime(0)
            multiplierRef.current = 1.00
            elapsedTimeRef.current = 0
            flightStartTimeRef.current = null
            setFlightStartTime(null)
        } else if (room.state === 'FLYING') {
            setPhase(PHASE.RUNNING)
            const currentMult = Math.min(10000.0, Math.max(1.00, room.currentMultiplier || 1.00))
            setMultiplier(currentMult)
            multiplierRef.current = currentMult
            const fStart = room.flightStartTime || (Date.now() - (Math.log(Math.max(1.0, currentMult)) / CRASH_GROWTH_RATE) * 1000)
            flightStartTimeRef.current = fStart
            setFlightStartTime(fStart)
            const elapsed = Math.max(0, Math.min(65, (Date.now() - fStart) / 1000))
            setElapsedTime(elapsed)
            elapsedTimeRef.current = elapsed
        } else if (room.state === 'CRASHED') {
            setPhase(PHASE.CRASHED)
            const bust = Math.min(10000.0, Math.max(1.00, room.crashPoint || 1.00))
            setMultiplier(bust)
            multiplierRef.current = bust
            flightStartTimeRef.current = null
            setFlightStartTime(null)
        }

        if (room.history && Array.isArray(room.history)) {
            setHistory(room.history.map(h => typeof h === 'object' ? h.crashPoint : h))
        }

        const activeBetsData = room.activeBets || room.bets
        if (activeBetsData) {
            const bets = Array.isArray(activeBetsData) ? activeBetsData : Object.values(activeBetsData)
            setRoomBets(bets)

            if (user) {
                const myBet1 = bets.find(b => b.userId === user.id && (!b.panelId || b.panelId === 1))
                if (myBet1) {
                    setPanel1(prev => ({
                        ...prev,
                        betPlaced: !myBet1.cashedOut,
                        cashedOut: Boolean(myBet1.cashedOut),
                        payout: myBet1.payout || 0,
                        amount: myBet1.betAmount || prev.amount
                    }))
                }
                const myBet2 = bets.find(b => b.userId === user.id && b.panelId === 2)
                if (myBet2) {
                    setPanel2(prev => ({
                        ...prev,
                        betPlaced: !myBet2.cashedOut,
                        cashedOut: Boolean(myBet2.cashedOut),
                        payout: myBet2.payout || 0,
                        amount: myBet2.betAmount || prev.amount
                    }))
                }
            }
        }
    }, [user])

    // Visibility Change & Tab Wake-up: Re-sync state immediately when returning from lock screen / background tab
    useEffect(() => {
        const handleWakeUp = () => {
            if (document.visibilityState === 'visible') {
                if (gameMode === 'arena') {
                    sendJson({ type: 'GET_CRASH_ROOM_STATE' })
                    getRoomCrashState().then(room => {
                        if (room) syncRoomState(room)
                    }).catch(() => {})
                }
            }
        }

        document.addEventListener('visibilitychange', handleWakeUp)
        window.addEventListener('focus', handleWakeUp)
        return () => {
            document.removeEventListener('visibilitychange', handleWakeUp)
            window.removeEventListener('focus', handleWakeUp)
        }
    }, [gameMode, sendJson, getRoomCrashState, syncRoomState])

    // Re-sync on WebSocket reconnect
    useEffect(() => {
        if (isConnected && gameMode === 'arena') {
            sendJson({ type: 'GET_CRASH_ROOM_STATE' })
            getRoomCrashState().then(room => {
                if (room) syncRoomState(room)
            }).catch(() => {})
        }
    }, [isConnected, gameMode, sendJson, getRoomCrashState, syncRoomState])

    // Live continuous sync with global room state
    useEffect(() => {
        if (crashRoomState && gameMode === 'arena') {
            syncRoomState(crashRoomState)
        }
    }, [crashRoomState, gameMode, syncRoomState])

    // Real-Time Multiplayer Room & Solo Mode WebSocket Connection
    useEffect(() => {
        let isMounted = true

        if (gameMode === 'arena') {
            // Request initial room state via WebSocket & HTTP
            sendJson({ type: 'GET_CRASH_ROOM_STATE' })
            getRoomCrashState().then(room => {
                if (room && isMounted) {
                    syncRoomState(room)
                }
            }).catch(() => {})
        }

        const unsubs = [
            subscribe('CRASH_ROOM_STATE', (payload) => {
                if (!isMounted || !payload) return
                syncRoomState(payload)
            }),
            subscribe('CRASH_ROOM_TICK', (payload) => {
                if (!isMounted || !payload) return
                if (payload.state === 'WAITING') {
                    setPhase(PHASE.WAITING)
                    setCountdown(payload.countdown || 0)
                    setMultiplier(1.00)
                    setElapsedTime(0)
                    multiplierRef.current = 1.00
                    elapsedTimeRef.current = 0
                    flightStartTimeRef.current = null
                    setFlightStartTime(null)
                    roomRoundIdRef.current = payload.roundId
                    // Reset cashed out state when countdown restarts
                    setPanel1(p => ({ ...p, cashedOut: false, payout: 0 }))
                    setPanel2(p => ({ ...p, cashedOut: false, payout: 0 }))
                } else if (payload.state === 'FLYING') {
                    setPhase(PHASE.RUNNING)
                    const sMult = Math.min(10000.0, Math.max(1.00, payload.multiplier || 1.00))
                    setMultiplier(sMult)
                    multiplierRef.current = sMult

                    const serverStart = payload.flightStartTime
                    if (serverStart) {
                        flightStartTimeRef.current = serverStart
                        setFlightStartTime(serverStart)
                    } else if (!flightStartTimeRef.current || roomRoundIdRef.current !== payload.roundId) {
                        roomRoundIdRef.current = payload.roundId
                        const initialSecs = (sMult > 1.02)
                            ? (Math.log(sMult) / CRASH_GROWTH_RATE) * 1000
                            : 0
                        const fStart = Date.now() - initialSecs
                        flightStartTimeRef.current = fStart
                        setFlightStartTime(fStart)
                    }
                    const fStart = flightStartTimeRef.current || Date.now()
                    const elapsed = Math.max(0, Math.min(65, (Date.now() - fStart) / 1000))
                    setElapsedTime(elapsed)
                    elapsedTimeRef.current = elapsed
                }
            }),
            subscribe('CRASH_ROOM_BUST', (payload) => {
                if (!isMounted || !payload) return
                setPhase(PHASE.CRASHED)
                const bustPoint = Math.min(10000.0, Math.max(1.00, payload.crashPoint || 1.00))
                setMultiplier(bustPoint)
                multiplierRef.current = bustPoint
                flightStartTimeRef.current = null
                setFlightStartTime(null)
                roomRoundIdRef.current = payload.roundId
                if (payload.history && Array.isArray(payload.history)) {
                    setHistory(payload.history.map(h => typeof h === 'object' ? h.crashPoint : h))
                } else {
                    setHistory(prev => [bustPoint, ...prev.slice(0, 24)])
                }
                casinoAudio.playCrash?.()

                // If user had placed bets that didn't cash out, record loss
                setPanel1(p => {
                    if (p.betPlaced && !p.cashedOut) {
                        showToast('loss', `-${currencySymbol}${p.amount.toFixed(2)}`, `${bustPoint.toFixed(2)}x`, 1000)
                        setGameRecords(prev => [{
                            id: Date.now() + Math.random(),
                            multiplier: bustPoint,
                            cashedOutAt: null,
                            bet: p.amount,
                            profit: -p.amount,
                            createdAt: new Date().toISOString()
                        }, ...prev])
                    }
                    return { ...p, betPlaced: false }
                })
                setPanel2(p => {
                    if (p.betPlaced && !p.cashedOut) {
                        showToast('loss', `-${currencySymbol}${p.amount.toFixed(2)}`, `${bustPoint.toFixed(2)}x`, 1000)
                        setGameRecords(prev => [{
                            id: Date.now() + Math.random(),
                            multiplier: bustPoint,
                            cashedOutAt: null,
                            bet: p.amount,
                            profit: -p.amount,
                            createdAt: new Date().toISOString()
                        }, ...prev])
                    }
                    return { ...p, betPlaced: false }
                })
            }),
            subscribe('CRASH_ROOM_BET', (payload) => {
                if (!isMounted || !payload) return
                if (payload.bet) {
                    setRoomBets(prev => {
                        const existing = prev.filter(b => !(b.userId === payload.bet.userId && (b.panelId || 1) === (payload.bet.panelId || 1)))
                        return [...existing, payload.bet]
                    })
                }
            }),
            subscribe('CRASH_ROOM_CASHOUT', (payload) => {
                if (!isMounted || !payload) return
                setRoomBets(prev => prev.map(b => {
                    if (b.userId === payload.userId && (b.panelId || 1) === (payload.panelId || 1)) {
                        return { ...b, cashedOut: true, multiplier: payload.multiplier, payout: payload.payout }
                    }
                    return b
                }))

                if (user && payload.userId === user.id) {
                    const panelKey = payload.panelId === 2 ? 2 : 1
                    const updatePanel = (panelKey === 1 ? setPanel1 : setPanel2)
                    updatePanel(prev => ({
                        ...prev,
                        betPlaced: false,
                        cashedOut: true,
                        payout: payload.payout
                    }))
                    showToast('win', `+${currencySymbol}${payload.payout.toFixed(2)}`, `${payload.multiplier.toFixed(2)}x`, 1000)
                    casinoAudio.playCashout?.()

                    // Add record
                    const betStake = payload.betAmount || (panelKey === 1 ? panel1Ref.current.amount : panel2Ref.current.amount)
                    setGameRecords(prev => [{
                        id: Date.now(),
                        multiplier: payload.multiplier,
                        cashedOutAt: payload.multiplier,
                        bet: betStake,
                        profit: payload.payout - betStake,
                        createdAt: new Date().toISOString()
                    }, ...prev])
                }
            }),
            subscribe('CRASH_SOLO_BUST', (payload) => {
                if (!isMounted || !payload) return
                if (activeRoundIdRef.current && activeRoundIdRef.current === payload.roundId) {
                    setPhase(PHASE.CRASHED)
                    const bustPoint = Math.min(10000.0, Math.max(1.00, payload.crashPoint || 1.00))
                    setMultiplier(bustPoint)
                    multiplierRef.current = bustPoint
                    flightStartTimeRef.current = null
                    setFlightStartTime(null)
                    activeRoundIdRef.current = null
                    setHistory(prev => [bustPoint, ...prev.slice(0, 24)])
                    casinoAudio.playCrash?.()
                    setPanel1(p => {
                        if (p.betPlaced && !p.cashedOut) {
                            showToast('loss', `-${currencySymbol}${p.amount.toFixed(2)}`, `${bustPoint.toFixed(2)}x`, 1000)
                            setGameRecords(prev => [{
                                id: Date.now() + Math.random(),
                                multiplier: bustPoint,
                                cashedOutAt: null,
                                bet: p.amount,
                                profit: -p.amount,
                                createdAt: new Date().toISOString()
                            }, ...prev])
                        }
                        return { ...p, betPlaced: false }
                    })
                }
            })
        ]

        return () => {
            isMounted = false
            unsubs.forEach(unsub => {
                if (typeof unsub === 'function') unsub()
            })
        }
    }, [gameMode, syncRoomState, user, currencySymbol, getRoomCrashState, showToast, subscribe, sendJson])

    // Place Bet Handler (for Panel 1 or Panel 2)
    const handleBet = async (amount, autoCashoutTarget, panelId = 1) => {
        if (gameMode === 'arena') {
            if (phase !== PHASE.WAITING) {
                showToast('error', 'Round In Progress', 'Bets can only be placed during the countdown window!')
                return
            }
            if (amount > balance) {
                showToast('error', 'Insufficient Balance', `You need ${currencySymbol}${amount.toFixed(2)} but only have ${currencySymbol}${balance.toFixed(2)}`)
                return
            }

            const res = await placeRoomCrashBet({
                betAmount: amount,
                autoCashout: autoCashoutTarget || null,
                panelId
            })
            if (!res || !res.success) {
                const errMsg = (res?.error && res.error !== 'Internal Server Error')
                    ? res.error
                    : 'Betting is closed or countdown in progress. Please try on the next flight.'
                showToast('error', 'Bet Failed', errMsg)
                return
            }

            if (panelId === 1) {
                setPanel1(prev => ({ ...prev, amount, betPlaced: true, cashedOut: false, payout: 0, autoCashout: autoCashoutTarget }))
            } else {
                setPanel2(prev => ({ ...prev, amount, betPlaced: true, cashedOut: false, payout: 0, autoCashout: autoCashoutTarget }))
            }

            casinoAudio.playBet?.()
            showToast('bet', 'Bet Confirmed!', `${currencySymbol}${amount.toFixed(2)} locked in for flight`, 2000)
            return
        }

        // Solo Provably Fair mode
        if (phase !== PHASE.IDLE) return
        if (amount > balance) {
            showToast('error', 'Insufficient Balance', `You need ${currencySymbol}${amount.toFixed(2)} but only have ${currencySymbol}${balance.toFixed(2)}`)
            return
        }

        const res = await startCrashRound({
            betAmount: amount,
            autoCashout: autoCashoutTarget,
            clientSeed: clientSeedInput || undefined
        })
        if (!res || !res.success) {
            showToast('error', 'Launch Failed', res?.error || 'Unable to launch Aviator flight')
            return
        }

        activeRoundIdRef.current = res.roundId
        setPanel1(prev => ({ ...prev, amount, betPlaced: true, cashedOut: false, payout: 0, autoCashout: autoCashoutTarget }))
        casinoAudio.playBet?.()
        showToast('bet', 'Flight Launched!', `${currencySymbol}${amount.toFixed(2)}`, 2000)

        setMultiplier(1.00)
        setElapsedTime(0)
        multiplierRef.current = 1.00
        elapsedTimeRef.current = 0
        const launchTime = Date.now()
        setFlightStartTime(launchTime)
        setPhase(PHASE.RUNNING)
    }

    // Cancel Bet Handler before takeoff
    const handleCancel = async (panelId = 1) => {
        if (phase !== PHASE.WAITING) return
        if (gameMode === 'arena') {
            const res = await cancelRoomCrashBet({ panelId })
            if (res && res.success) {
                if (panelId === 1) {
                    setPanel1(prev => ({ ...prev, betPlaced: false }))
                } else {
                    setPanel2(prev => ({ ...prev, betPlaced: false }))
                }
                showToast('info', 'Bet Cancelled', `Returned ${currencySymbol}${res.refundedAmount || (panelId === 1 ? panel1.amount : panel2.amount)}`)
            } else {
                showToast('error', 'Cancellation Failed', res?.error || 'Could not cancel bet')
            }
            return
        }

        if (panelId === 1) {
            setPanel1(prev => ({ ...prev, betPlaced: false }))
        } else {
            setPanel2(prev => ({ ...prev, betPlaced: false }))
        }
        showToast('info', 'Bet Cancelled', 'Your stake was returned')
    }

    // Cash Out Handler (for Panel 1 or Panel 2)
    const handleCashout = async (panelId = 1) => {
        if (gameMode === 'arena') {
            if (phase !== PHASE.RUNNING) return
            const targetPanel = panelId === 1 ? panel1 : panel2
            if (!targetPanel.betPlaced || targetPanel.cashedOut) return

            const res = await cashoutRoomCrash({ panelId })
            if (res && res.success) {
                const updatePanel = panelId === 1 ? setPanel1 : setPanel2
                updatePanel(prev => ({ ...prev, betPlaced: false, cashedOut: true, payout: res.payout }))
                showToast('win', `+${currencySymbol}${res.payout.toFixed(2)}`, `${res.multiplier.toFixed(2)}x`, 1000)
                casinoAudio.playCashout?.()
            }
            return
        }

        // Solo mode cashout
        if (phase !== PHASE.RUNNING || !panel1.betPlaced || !activeRoundIdRef.current) return
        const currentM = multiplierRef.current || multiplier || 1.00
        const res = await cashoutCrashRound({ roundId: activeRoundIdRef.current, multiplier: currentM })
        if (res && res.success) {
            setPanel1(prev => ({ ...prev, betPlaced: false, cashedOut: true, payout: res.payout }))
            showToast('win', `+${currencySymbol}${res.payout.toFixed(2)}`, `${currentM.toFixed(2)}x`, 1000)
            casinoAudio.playCashout?.()

            setGameRecords(prev => [{
                id: Date.now(),
                multiplier: currentM,
                cashedOutAt: currentM,
                bet: panel1Ref.current.amount,
                profit: res.payout - panel1Ref.current.amount,
                createdAt: new Date().toISOString()
            }, ...prev])
        }
    }

    // Solo Flight Progression & Auto-Cashout Animation Loop
    useEffect(() => {
        if (gameMode !== 'solo' || phase !== PHASE.RUNNING || !flightStartTime) return

        let animFrame
        const updateSoloFlight = () => {
            const elapsed = Math.max(0, (Date.now() - flightStartTime) / 1000)
            const curMult = Math.min(10000.0, Math.max(1.00, Math.pow(Math.E, CRASH_GROWTH_RATE * elapsed)))

            setMultiplier(curMult)
            setElapsedTime(elapsed)
            multiplierRef.current = curMult
            elapsedTimeRef.current = elapsed

            // Check auto-cashout for Solo flight (Panel 1)
            const p1 = panel1Ref.current
            if (p1.betPlaced && !p1.cashedOut && p1.autoCashout && curMult >= p1.autoCashout) {
                handleCashout(1)
            }

            animFrame = requestAnimationFrame(updateSoloFlight)
        }

        animFrame = requestAnimationFrame(updateSoloFlight)
        return () => {
            if (animFrame) cancelAnimationFrame(animFrame)
        }
    }, [gameMode, phase, flightStartTime])

    // Ensure page begins at the very top so the Aviator header and arena are immediately visible
    useEffect(() => {
        if (gameDisplayRef.current) {
            gameDisplayRef.current.scrollTop = 0
        }
        window.scrollTo(0, 0)
    }, [])

    const userBetSummary = useMemo(() => {
        if (!panel1.betPlaced && !panel2.betPlaced && !panel1.cashedOut && !panel2.cashedOut) return null
        return {
            userId: user?.id,
            username: user?.username || 'You',
            betAmount: (panel1.betPlaced ? panel1.amount : 0) + (panel2.betPlaced ? panel2.amount : 0),
            multiplier: panel1.cashedOut ? (panel1.payout / panel1.amount) : (panel2.cashedOut ? (panel2.payout / panel2.amount) : null),
            cashedOut: panel1.cashedOut || panel2.cashedOut,
            payout: (panel1.payout || 0) + (panel2.payout || 0),
            isUser: true
        }
    }, [panel1, panel2, user])

    const userBetsList = useMemo(() => {
        const list = []
        if (panel1.betPlaced || panel1.cashedOut) {
            list.push({
                id: 'user-panel-1',
                userId: user?.id,
                username: user?.username || 'You',
                betAmount: panel1.amount,
                cashedOut: panel1.cashedOut,
                multiplier: panel1.cashedOut ? (panel1.payout / (panel1.amount || 1)) : null,
                payout: panel1.payout,
                isUser: true,
                avatarEmoji: '👑'
            })
        }
        if (panel2.betPlaced || panel2.cashedOut) {
            list.push({
                id: 'user-panel-2',
                userId: user?.id,
                username: user?.username || 'You',
                betAmount: panel2.amount,
                cashedOut: panel2.cashedOut,
                multiplier: panel2.cashedOut ? (panel2.payout / (panel2.amount || 1)) : null,
                payout: panel2.payout,
                isUser: true,
                avatarEmoji: '👑'
            })
        }
        return list
    }, [panel1.betPlaced, panel1.cashedOut, panel1.amount, panel1.payout, panel2.betPlaced, panel2.cashedOut, panel2.amount, panel2.payout, user])

    return (
        <div className="aviator-game-viewport" ref={gameDisplayRef}>
            {contextHolder}

            <div className="aviator-app-card">
                {/* 1. TOP HEADER: AVIATOR LOGO + LIVE BALANCE + CONTROLS */}
                <header className="aviator-header-bar">
                    <div className="aviator-header-left">
                        <span className="aviator-logo-script">Aviator</span>
                        <div className="aviator-mode-pill">
                            <button
                                type="button"
                                className={`mode-toggle-btn ${gameMode === 'arena' ? 'active' : ''}`}
                                onClick={() => {
                                    setGameMode('arena')
                                    setFlightStartTime(null)
                                    flightStartTimeRef.current = null
                                    activeRoundIdRef.current = null
                                    setPanel1(p => ({ ...p, betPlaced: false }))
                                    setPanel2(p => ({ ...p, betPlaced: false }))
                                    getRoomCrashState().then(room => {
                                        if (room) syncRoomState(room)
                                    }).catch(() => {})
                                }}
                                title="Multiplayer Synchronized Arena"
                            >
                                <TeamOutlined />
                            </button>
                            <button
                                type="button"
                                className={`mode-toggle-btn ${gameMode === 'solo' ? 'active' : ''}`}
                                onClick={() => {
                                    setGameMode('solo')
                                    setPhase(PHASE.IDLE)
                                    setMultiplier(1.00)
                                    setElapsedTime(0)
                                    multiplierRef.current = 1.00
                                    elapsedTimeRef.current = 0
                                    flightStartTimeRef.current = null
                                    setFlightStartTime(null)
                                    activeRoundIdRef.current = null
                                    setPanel1(p => ({ ...p, betPlaced: false, cashedOut: false }))
                                    setPanel2(p => ({ ...p, betPlaced: false, cashedOut: false }))
                                }}
                                title="Solo Flight"
                            >
                                <UserOutlined />
                            </button>
                        </div>
                    </div>

                    <div className="aviator-header-right">
                        {/* Live Balance Pill (Green Amount as in Screenshot) */}
                        <div className="aviator-balance-pill">
                            <span className="balance-green-val">
                                {Number(balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="balance-curr-label">{currency}</span>
                        </div>

                        {/* Audio Mute Toggle */}
                        <button
                            type="button"
                            className="header-icon-btn"
                            onClick={() => {
                                setSoundEnabled(!soundEnabled)
                                casinoAudio.playChip?.()
                            }}
                            title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
                        >
                            <SoundOutlined className={!soundEnabled ? 'muted-icon' : ''} />
                        </button>

                        {/* Provably Fair Verifier */}
                        <button
                            type="button"
                            className="header-icon-btn"
                            onClick={() => setFairnessModalOpen(true)}
                            title="Provably Fair Verification"
                        >
                            <SafetyCertificateOutlined />
                        </button>

                        {/* Fullscreen Toggle */}
                        <button
                            type="button"
                            className="header-icon-btn"
                            onClick={toggleFullscreen}
                            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? <FullscreenExitOutlined /> : <ExpandOutlined />}
                        </button>
                    </div>
                </header>

                {/* Responsive Main Layout (2-Column on Laptop/Desktop, 1-Column on Mobile) */}
                <div className="aviator-main-layout">
                    {/* Left Column on Laptop / Bottom on Mobile: Social Bets Table */}
                    <div className="aviator-bets-column">
                        <PlayerBets
                            phase={phase}
                            multiplier={multiplier}
                            userBetData={userBetsList[0] || userBetSummary}
                            userBets={userBetsList}
                            roomBets={roomBets}
                            isArena={gameMode === 'arena'}
                            userHistory={gameRecords}
                        />
                    </div>

                    {/* Right Column on Laptop / Top on Mobile: Multipliers + Flight Arena + Dual Betting Consoles */}
                    <div className="aviator-stage-column">
                        {/* 2. MULTIPLIER HISTORY RIBBON */}
                        <GameHistory history={history} />

                        {/* 3. FLIGHT CANVAS ARENA */}
                        <GameChart
                            phase={phase}
                            multiplier={multiplier}
                            elapsedTime={elapsedTime}
                            countdown={countdown}
                            flightStartTime={flightStartTime}
                            onlinePlayersCount={roomBets.length > 0 ? roomBets.length * 42 + 1350 : 1385}
                        />

                        {/* 4. DUAL INDEPENDENT BETTING PANELS (Aviator signature UX) */}
                        <div className="aviator-dual-panels-wrap">
                            {/* Panel 1 (Primary) */}
                            <BettingPanel
                                panelId={1}
                                phase={phase}
                                betPlaced={panel1.betPlaced}
                                betAmount={panel1.amount}
                                multiplier={multiplier}
                                cashedOut={panel1.cashedOut}
                                payout={panel1.payout}
                                onBet={(amt, auto) => handleBet(amt, auto, 1)}
                                onCancel={() => handleCancel(1)}
                                onCashout={() => handleCashout(1)}
                            />

                            {/* Panel 2 (Secondary, can be minimized / expanded) */}
                            {showSecondPanel ? (
                                <BettingPanel
                                    panelId={2}
                                    phase={phase}
                                    betPlaced={panel2.betPlaced}
                                    betAmount={panel2.amount}
                                    multiplier={multiplier}
                                    cashedOut={panel2.cashedOut}
                                    payout={panel2.payout}
                                    canRemove={true}
                                    onRemove={() => setShowSecondPanel(false)}
                                    onBet={(amt, auto) => handleBet(amt, auto, 2)}
                                    onCancel={() => handleCancel(2)}
                                    onCashout={() => handleCashout(2)}
                                />
                            ) : (
                                <div className="aviator-add-second-bet-bar">
                                    <button
                                        type="button"
                                        className="add-second-bet-btn"
                                        onClick={() => setShowSecondPanel(true)}
                                    >
                                        <PlusOutlined style={{ marginRight: 6 }} />
                                        Add Second Bet
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* In-Window Persistent Bet History Directly Underneath Crash Game */}
            <div className="aviator-bottom-history-section">
                <GameBottomHistory
                    gameKey="crash"
                    gameTitle="Aviator"
                    localRounds={gameRecords.map(r => ({
                        id: r.id,
                        betAmount: r.bet || r.betAmount || 25,
                        multiplier: r.multiplier || r.cashedOutAt || 1.0,
                        payout: (r.bet || r.betAmount || 25) + (r.profit || 0),
                        won: (r.profit !== undefined ? r.profit >= 0 : Boolean(r.cashedOutAt)),
                        outcome: `${(r.cashedOutAt || r.multiplier || 1.0).toFixed(2)}x ${r.profit >= 0 ? 'WIN' : 'BUST'}`,
                        createdAt: r.createdAt || r.timestamp || new Date().toISOString()
                    }))}
                />
            </div>

            {/* Provably Fair Verifier Modal */}
            <ProvablyFairVerifierModal
                isOpen={fairnessModalOpen}
                onClose={() => setFairnessModalOpen(false)}
                initialData={{
                    game: 'crash',
                    serverSeedHash: fairnessData.serverSeedHash,
                    clientSeed: clientSeedInput,
                    nonce: fairnessData.nonce
                }}
            />
        </div>
    )
}

export default CrashGame
