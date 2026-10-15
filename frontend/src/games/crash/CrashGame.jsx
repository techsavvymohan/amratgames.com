import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
    Card,
    Button,
    Space,
    Tag,
    Tooltip,
    Typography,
    message,
    Switch,
    Modal,
    Drawer,
    Statistic,
    Row,
    Col,
    Divider,
    Radio,
    Progress,
    Input
} from 'antd'
import {
    SettingOutlined,
    ExpandOutlined,
    BarChartOutlined,
    AppstoreOutlined,
    SafetyCertificateOutlined,
    SoundOutlined,
    FullscreenOutlined,
    FullscreenExitOutlined,
    TrophyOutlined,
    FireOutlined,
    ThunderboltOutlined,
    CheckCircleOutlined,
    CopyOutlined,
    SyncOutlined,
    RightOutlined,
    StarOutlined,
    LineChartOutlined,
    CloseOutlined,
    ReloadOutlined,
    TeamOutlined,
    UserOutlined
} from '@ant-design/icons'
import Chart from 'chart.js/auto'
import BettingPanel from './BettingPanel'
import MobileBetSheet from '../../components/MobileBetSheet'
import GameChart from './GameChart'
import GameHistory from './GameHistory'
import PlayerBets from './PlayerBets'
import PlayerResults from './PlayerResults'
import ProvablyFair from '../../utils/ProvablyFair'
import casinoAudio from '../../utils/casinoAudio'
import { useWallet } from '../../context/WalletContext'
import { useAuth } from '../../context/AuthContext'
import { useWebSocket } from '../../context/WebSocketContext'
import GameBottomHistory from '../../components/GameHistory/GameBottomHistory'
import './CrashGame.css'

const { Text, Title, Paragraph } = Typography

// Game phases
const PHASE = {
    IDLE: 'idle',
    WAITING: 'waiting',
    RUNNING: 'running',
    CRASHED: 'crashed'
}

export const CRASH_GROWTH_RATE = 0.06

const MOBILE_QUERY = '(max-width: 768px), (max-width: 932px) and (orientation: landscape) and (hover: none)'

function CrashGame() {
    const { user } = useAuth()
    const { subscribe, sendJson } = useWebSocket()
    const {
        balance,
        startCrashRound,
        cashoutCrashRound,
        bustCrashRound,
        getActiveCrashRound,
        placeRoomCrashBet,
        cashoutRoomCrash,
        getRoomCrashState,
        showToast,
        currencySymbol,
        currency
    } = useWallet()
    const activeRoundIdRef = useRef(null)
    const [gameMode, setGameMode] = useState('arena') // 'arena' (multiplayer synchronized) | 'solo' (provably fair)
    const [roomBets, setRoomBets] = useState([])
    const roomRoundIdRef = useRef(null)
    const [phase, setPhase] = useState(PHASE.WAITING)
    const [multiplier, setMultiplier] = useState(1.00)
    const [flightStartTime, setFlightStartTime] = useState(null)
    const [countdown, setCountdown] = useState(6)
    const [crashPoint, setCrashPoint] = useState(0)
    const [elapsedTime, setElapsedTime] = useState(0)
    const [history, setHistory] = useState([])
    const [betPlaced, setBetPlaced] = useState(false)
    const [betAmount, setBetAmount] = useState(0)
    const [userBetData, setUserBetData] = useState(null)
    const [soundEnabled, setSoundEnabled] = useState(true)

    // Settings for optional features
    const [showPlayerBets, setShowPlayerBets] = useState(true)
    const [showPlayerResults, setShowPlayerResults] = useState(true)
    const [playerCashouts, setPlayerCashouts] = useState([])

    // UI States
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [statsDrawerOpen, setStatsDrawerOpen] = useState(false)
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
    const [fairnessModalOpen, setFairnessModalOpen] = useState(false)
    const [spectatorMissedWin, setSpectatorMissedWin] = useState(null)
    const [layout, setLayout] = useState('default') // 'default', 'compact', 'wide'
    const [mobileDataTab, setMobileDataTab] = useState('bets')
    const [isMobileLayout, setIsMobileLayout] = useState(() =>
        window.matchMedia(MOBILE_QUERY).matches,
    )

    useEffect(() => {
        const media = window.matchMedia(MOBILE_QUERY)
        const update = () => setIsMobileLayout(media.matches)
        media.addEventListener('change', update)
        return () => media.removeEventListener('change', update)
    }, [])

    // History and Stats logic
    const [gameRecords, setGameRecords] = useState([])
    const widgetRef = useRef(null)
    const chartCanvasRef = useRef(null)
    const chartInstanceRef = useRef(null)
    const [hoveredProfitValue, setHoveredProfitValue] = useState(null)

    // Derived Stats
    const totalProfit = useMemo(() => gameRecords.reduce((sum, r) => sum + r.profit, 0), [gameRecords])
    const winsCount = useMemo(() => gameRecords.filter(r => r.profit >= 0).length, [gameRecords])
    const lossesCount = useMemo(() => gameRecords.filter(r => r.profit < 0).length, [gameRecords])
    const maxStreak = useMemo(() => {
        let max = 0
        let current = 0
        for (const record of gameRecords) {
            if (record.profit >= 0) {
                current++
                if (current > max) max = current
            } else {
                current = 0
            }
        }
        return max
    }, [gameRecords])

    // Provably Fair state
    const fairnessRef = useRef(null)
    const [fairnessData, setFairnessData] = useState({
        serverSeedHash: 'Loading...',
        clientSeed: 'Loading...',
        nonce: 0,
    })
    const [revealedSeed, setRevealedSeed] = useState(null)
    const [clientSeedInput, setClientSeedInput] = useState('')

    // Initialize ProvablyFair
    useEffect(() => {
        const pf = new ProvablyFair()
        fairnessRef.current = pf
        pf.waitReady().then(async () => {
            const data = await pf.getFairnessData()
            setFairnessData(data)
            setClientSeedInput(data.clientSeed)
        })
    }, [])

    const startTimeRef = useRef(null)
    const animationRef = useRef(null)
    const gameDisplayRef = useRef(null)
    // Performance: use refs for high-frequency values, throttle React state updates
    const multiplierRef = useRef(1.00)
    const elapsedTimeRef = useRef(0)
    const lastStateUpdateRef = useRef(0)
    const [messageApi, contextHolder] = message.useMessage()

    // Calculate statistics
    const stats = {
        totalGames: history.length,
        avgMultiplier: (history.reduce((a, b) => a + b, 0) / history.length).toFixed(2),
        maxMultiplier: Math.max(...history).toFixed(2),
        under2x: history.filter(x => x < 2).length,
        over2x: history.filter(x => x >= 2 && x < 10).length,
        over10x: history.filter(x => x >= 10).length,
        over100x: history.filter(x => x >= 100).length
    }

    // Fullscreen toggle
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            if (gameDisplayRef.current) {
                gameDisplayRef.current.requestFullscreen().then(() => {
                    setIsFullscreen(true)
                    messageApi.success('Entered fullscreen mode')
                }).catch(err => {
                    messageApi.error('Could not enter fullscreen')
                })
            }
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false)
                messageApi.info('Exited fullscreen mode')
            })
        }
    }, [messageApi])

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    // Draggable Live Stats logic
    const handleDragStart = useCallback((e) => {
        const widget = widgetRef.current
        if (!widget) return

        const startX = e.clientX
        const startY = e.clientY
        const rect = widget.getBoundingClientRect()
        const offsetX = startX - rect.left
        const offsetY = startY - rect.top

        const handleMouseMove = (moveEvent) => {
            let newX = moveEvent.clientX - offsetX
            let newY = moveEvent.clientY - offsetY

            newX = Math.max(0, Math.min(newX, window.innerWidth - rect.width))
            newY = Math.max(0, Math.min(newY, window.innerHeight - rect.height))

            widget.style.left = `${newX}px`
            widget.style.top = `${newY}px`
            widget.style.right = 'auto'
            widget.style.bottom = 'auto'
        }

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }, [])

    // Live Stats Chart Update
    useEffect(() => {
        if (!statsDrawerOpen || !chartCanvasRef.current) return

        const WIN_COLOR = 'rgb(74, 222, 128)';
        const WIN_COLOR_FILL = 'rgba(74, 222, 128, 0.3)';
        const LOSS_COLOR = 'rgb(248, 113, 113)';
        const LOSS_COLOR_FILL = 'rgba(248, 113, 113, 0.3)';
        const X_AXIS_COLOR = '#2a3f4d';
        const POINT_HOVER_COLOR = '#fff';

        let runProfit = 0;
        const profitHistory = [0, ...gameRecords.map(r => {
            runProfit += r.profit;
            return runProfit;
        })];

        if (chartInstanceRef.current) {
            // Update existing chart
            chartInstanceRef.current.data.labels = Array(profitHistory.length).fill(0);
            chartInstanceRef.current.data.datasets[0].data = profitHistory;
            chartInstanceRef.current.update('none'); // Update without animation for smooth flow
        } else {
            // Initialize new chart
            chartInstanceRef.current = new Chart(chartCanvasRef.current, {
                type: 'line',
                data: {
                    labels: Array(profitHistory.length).fill(0),
                    datasets: [
                        {
                            label: 'Profit',
                            data: profitHistory,
                            fill: {
                                target: 'origin',
                                above: WIN_COLOR_FILL,
                                below: LOSS_COLOR_FILL,
                            },
                            cubicInterpolationMode: 'monotone',
                            segment: {
                                borderColor: (ctx) => {
                                    if (!ctx.p0 || !ctx.p1) return WIN_COLOR;
                                    const y0 = ctx.p0.parsed.y;
                                    const y1 = ctx.p1.parsed.y;
                                    if (y1 === 0) {
                                        return y0 < 0 ? LOSS_COLOR : WIN_COLOR;
                                    }
                                    return y1 < 0 ? LOSS_COLOR : WIN_COLOR;
                                },
                            },
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            pointHoverBackgroundColor: POINT_HOVER_COLOR,
                            pointHoverBorderColor: POINT_HOVER_COLOR,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animations: {
                        y: {
                            duration: 0,
                        },
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index',
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false },
                    },
                    scales: {
                        x: {
                            border: { display: false },
                            grid: { display: false },
                            ticks: { display: false },
                        },
                        y: {
                            border: { display: false },
                            grid: {
                                color: (ctx) => (ctx.tick.value === 0 ? X_AXIS_COLOR : 'transparent'),
                                lineWidth: 2,
                            },
                            ticks: { display: false },
                            grace: '1%',
                        },
                    },
                    onHover: (_, elements) => {
                        if (elements.length) {
                            const idx = elements[0].index;
                            const val = profitHistory[idx];
                            setHoveredProfitValue(val !== undefined ? val : null);
                        } else {
                            setHoveredProfitValue(null);
                        }
                    },
                },
            });
        }
    }, [statsDrawerOpen, gameRecords]);

    // Generate crash point using ProvablyFair
    const generateCrashPoint = useCallback(async () => {
        const pf = fairnessRef.current
        if (!pf) return 2.00 // Fallback
        const point = await pf.generateCrashPoint()
        // Update fairness data for UI
        const data = await pf.getFairnessData()
        setFairnessData(data)
        return point
    }, [])

    // Reset to idle ready state
    const resetToIdle = useCallback(() => {
        setPhase(PHASE.IDLE)
        setMultiplier(1.00)
        setElapsedTime(0)
        multiplierRef.current = 1.00
        elapsedTimeRef.current = 0
        startTimeRef.current = null
        setFlightStartTime(null)
        setCountdown(0)
        setBetPlaced(false)
        setUserBetData(null)
        setPlayerCashouts([])
    }, [])

    // Check and restore active crash flight on mount
    useEffect(() => {
        let mounted = true
        getActiveCrashRound().then((active) => {
            if (!mounted || !active || !active.active) return
            const elapsed = (Date.now() - active.startedAt) / 1000
            const currentMultiplier = Math.pow(Math.E, CRASH_GROWTH_RATE * elapsed)
            if (currentMultiplier < active.crashPoint) {
                // Restore active flight in progress
                activeRoundIdRef.current = active.roundId
                setCrashPoint(active.crashPoint)
                setBetAmount(active.betAmount)
                setBetPlaced(true)
                setUserBetData({
                    name: 'You',
                    amount: active.betAmount,
                    currency: {
                        symbol: currencySymbol,
                        color: currency === 'INR' ? '#f5af19' : (currency === 'BTC' ? '#f7931a' : '#26a17b'),
                        name: currency
                    },
                    active: true,
                    cashoutAt: null,
                    profit: null
                })
                startTimeRef.current = active.startedAt
                setFlightStartTime(active.startedAt)
                setPhase(PHASE.RUNNING)
            } else {
                // Flight already crashed while user was away
                bustCrashRound({ roundId: active.roundId }).catch(() => {})
            }
        }).catch(() => {})
        return () => { mounted = false }
    }, [getActiveCrashRound, bustCrashRound, currencySymbol, currency])

    // Handle crash (Server-Authoritative)
    const handleCrash = useCallback((crashMultiplier) => {
        setHistory(prev => [crashMultiplier, ...prev].slice(0, 30))
        casinoAudio.playExplosion()

        let profit = 0
        let didPlay = false

        if (userBetData) {
            didPlay = true
            if (betPlaced && activeRoundIdRef.current) {
                // User didn't cash out in time, lost bet
                profit = -userBetData.amount
                bustCrashRound({ roundId: activeRoundIdRef.current }).catch(() => {})
                activeRoundIdRef.current = null
                showToast('loss', 'You Lost!', `-${currencySymbol}${userBetData.amount.toFixed(2)} — Crashed @${crashMultiplier.toFixed(2)}×`, 4000)
            } else {
                profit = parseFloat(userBetData.profit || 0) - userBetData.amount
            }
        }

        if (didPlay) {
            setGameRecords(prev => [...prev, {
                id: Date.now(),
                multiplier: crashMultiplier,
                cashedOutAt: betPlaced ? null : (userBetData.cashoutAt ? parseFloat(userBetData.cashoutAt) : null),
                bet: userBetData.amount,
                profit
            }])
        }

        setBetPlaced(false)
        activeRoundIdRef.current = null

        // Return to IDLE state after crash explosion (2.5s)
        setTimeout(() => {
            setPhase(PHASE.IDLE)
            setMultiplier(1.00)
            setElapsedTime(0)
            multiplierRef.current = 1.00
            elapsedTimeRef.current = 0
            startTimeRef.current = null
            setFlightStartTime(null)
            setCountdown(0)
            setUserBetData(null)
            setPlayerCashouts([])
        }, 2500)
    }, [userBetData, betPlaced, showToast, bustCrashRound, currencySymbol])

    // Handle player cashout notification
    const handlePlayerCashout = useCallback((cashoutData) => {
        if (showPlayerResults) {
            setPlayerCashouts(prev => [...prev, cashoutData])
        }
    }, [showPlayerResults])

    // Synchronize Room State
    const syncRoomState = useCallback((room) => {
        if (!room) return
        roomRoundIdRef.current = room.roundId

        if (room.state === 'WAITING') {
            setPhase(PHASE.WAITING)
            setCountdown(Math.max(0, Math.ceil(room.countdown || 6)))
            setMultiplier(1.00)
            setElapsedTime(0)
            multiplierRef.current = 1.00
            elapsedTimeRef.current = 0
            startTimeRef.current = null
            setFlightStartTime(null)
        } else if (room.state === 'FLYING') {
            setPhase(PHASE.RUNNING)
            const m = room.currentMultiplier || 1.00
            setMultiplier(m)
            multiplierRef.current = m
            if (!startTimeRef.current || roomRoundIdRef.current !== room.roundId) {
                roomRoundIdRef.current = room.roundId
                const initialSecs = (m > 1.02) ? (Math.log(m) / CRASH_GROWTH_RATE) * 1000 : 0
                const fStart = Date.now() - initialSecs
                startTimeRef.current = fStart
                setFlightStartTime(fStart)
            }
            const el = Math.max(0, (Date.now() - startTimeRef.current) / 1000)
            setElapsedTime(el)
            elapsedTimeRef.current = el
        } else if (room.state === 'CRASHED') {
            setPhase(PHASE.CRASHED)
            const pt = room.crashPoint || room.currentMultiplier || 1.00
            setMultiplier(pt)
            multiplierRef.current = pt
            startTimeRef.current = null
            setFlightStartTime(null)
            roomRoundIdRef.current = room.roundId
        }

        if (Array.isArray(room.history) && room.history.length > 0) {
            setHistory(room.history.map(h => typeof h === 'object' ? h.crashPoint : h))
        }

        if (room.activeBets) {
            const bets = Array.isArray(room.activeBets) ? room.activeBets : Object.values(room.activeBets)
            setRoomBets(bets)

            if (user) {
                const myBet = bets.find(b => b.userId === user.id)
                if (myBet && !myBet.cashedOut && room.state !== 'CRASHED') {
                    setBetPlaced(true)
                    setBetAmount(myBet.betAmount)
                    setUserBetData({
                        name: myBet.username || user.username || 'You',
                        amount: myBet.betAmount,
                        currency: { symbol: currencySymbol, name: currency },
                        active: true,
                        cashoutAt: null,
                        profit: null
                    })
                }
            }
        }
    }, [user, currencySymbol, currency])

    // Real-Time Multiplayer Room WebSocket Connection via centralized WebSocketContext
    useEffect(() => {
        if (gameMode !== 'arena') return

        let isMounted = true

        // Request initial room state via WebSocket & HTTP
        sendJson({ type: 'GET_CRASH_ROOM_STATE' })
        getRoomCrashState().then(room => {
            if (room && isMounted) {
                syncRoomState(room)
            }
        })

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
                    startTimeRef.current = null
                    setFlightStartTime(null)
                    roomRoundIdRef.current = payload.roundId
                } else if (payload.state === 'FLYING') {
                    setPhase(PHASE.RUNNING)
                    setSpectatorMissedWin(null)
                    setMultiplier(payload.multiplier || 1.00)
                    multiplierRef.current = payload.multiplier || 1.00
                    if (!startTimeRef.current || roomRoundIdRef.current !== payload.roundId) {
                        roomRoundIdRef.current = payload.roundId
                        const initialSecs = (payload.multiplier && payload.multiplier > 1.02)
                            ? (Math.log(payload.multiplier) / CRASH_GROWTH_RATE) * 1000
                            : 0
                        const fStart = Date.now() - initialSecs
                        startTimeRef.current = fStart
                        setFlightStartTime(fStart)
                    }
                    const elapsed = Math.max(0, (Date.now() - startTimeRef.current) / 1000)
                    setElapsedTime(elapsed)
                    elapsedTimeRef.current = elapsed
                }
            }),
            subscribe('CRASH_ROOM_BUST', (payload) => {
                if (!isMounted || !payload) return
                setPhase(PHASE.CRASHED)
                const bustPoint = payload.crashPoint || 1.00
                setMultiplier(bustPoint)
                multiplierRef.current = bustPoint
                startTimeRef.current = null
                setFlightStartTime(null)
                roomRoundIdRef.current = payload.roundId
                if (payload.history && Array.isArray(payload.history)) {
                    setHistory(payload.history.map(h => typeof h === 'object' ? h.crashPoint : h))
                } else {
                    setHistory(prev => [bustPoint, ...prev.slice(0, 19)])
                }
                casinoAudio.playCrash?.()

                if (betPlaced) {
                    setBetPlaced(false)
                    setUserBetData(prev => prev ? { ...prev, active: false, profit: '0.00' } : null)
                    showToast('loss', 'Crashed!', `Flight busted at ${bustPoint.toFixed(2)}×`, 3000)
                } else {
                    if (bustPoint >= 1.5) {
                        setSpectatorMissedWin({
                            outcome: `${bustPoint.toFixed(2)}x`,
                            multiplier: Math.min(bustPoint, 2.0).toFixed(2),
                            amount: betAmount || 100,
                            payout: ((betAmount || 100) * Math.min(bustPoint, 2.0)).toFixed(0)
                        })
                    }
                }
                startTimeRef.current = null
            }),
            subscribe('CRASH_ROOM_BET', (payload) => {
                if (!isMounted || !payload) return
                if (payload.bet) {
                    setRoomBets(prev => {
                        const existing = prev.filter(b => b.userId !== payload.bet.userId)
                        return [...existing, payload.bet]
                    })
                }
            }),
            subscribe('CRASH_ROOM_CASHOUT', (payload) => {
                if (!isMounted || !payload) return
                setRoomBets(prev => prev.map(b => {
                    if (b.userId === payload.userId) {
                        return { ...b, cashedOut: true, multiplier: payload.multiplier, payout: payload.payout }
                    }
                    return b
                }))

                if (user && payload.userId === user.id && betPlaced) {
                    setBetPlaced(false)
                    setUserBetData(prev => prev ? {
                        ...prev,
                        active: false,
                        cashoutAt: payload.multiplier.toFixed(2),
                        profit: payload.payout.toFixed(2)
                    } : null)
                    showToast('win', 'Cashed Out!', `+${currencySymbol}${payload.payout.toFixed(2)} at ${payload.multiplier.toFixed(2)}×`, 4000)
                    casinoAudio.playCashout?.()
                }
            })
        ]

        return () => {
            isMounted = false
            unsubs.forEach(unsub => {
                if (typeof unsub === 'function') unsub()
            })
        }
    }, [gameMode, syncRoomState, betPlaced, user, currencySymbol, getRoomCrashState, showToast, subscribe, sendJson, betAmount])

    // OPTIMIZED Solo Game loop: only active when playing solo
    useEffect(() => {
        if (phase === PHASE.RUNNING && gameMode === 'solo') {
            const tick = () => {
                const now = Date.now()
                const elapsed = Math.max(0, (now - startTimeRef.current) / 1000)
                const currentMultiplier = Math.pow(Math.E, CRASH_GROWTH_RATE * elapsed)

                // Always update refs (used by Canvas directly)
                multiplierRef.current = currentMultiplier
                elapsedTimeRef.current = elapsed

                if (currentMultiplier >= crashPoint) {
                    // Crash! Update state immediately
                    setMultiplier(crashPoint)
                    setElapsedTime(elapsed)
                    setPhase(PHASE.CRASHED)
                    handleCrash(crashPoint)
                } else {
                    // Throttle React state updates to every ~50ms (20fps for UI labels, while Canvas runs 60-120fps)
                    if (now - lastStateUpdateRef.current >= 50) {
                        setMultiplier(currentMultiplier)
                        setElapsedTime(elapsed)
                        lastStateUpdateRef.current = now
                    }
                    animationRef.current = requestAnimationFrame(tick)
                }
            }
            lastStateUpdateRef.current = Date.now()
            animationRef.current = requestAnimationFrame(tick)

            return () => {
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current)
                }
            }
        }
    }, [phase, crashPoint, handleCrash, gameMode])

    // Handle user betting and starting flight (Server-Authoritative)
    const handleBet = async (amount, autoCashoutTarget) => {
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
                autoCashout: autoCashoutTarget || null
            })
            if (!res || !res.success) {
                showToast('error', 'Bet Failed', res?.error || 'Unable to place room bet')
                return
            }

            setBetAmount(amount)
            setBetPlaced(true)
            setUserBetData({
                name: user?.username || 'You',
                amount: amount,
                currency: {
                    symbol: currencySymbol,
                    color: currency === 'INR' ? '#f5af19' : (currency === 'BTC' ? '#f7931a' : '#26a17b'),
                    name: currency
                },
                active: true,
                cashoutAt: null,
                profit: null
            })
            casinoAudio.playBet()
            showToast('bet', 'Room Bet Confirmed!', `${currencySymbol}${amount.toFixed(2)} locked in for flight`, 2000)
            return
        }

        // Solo Provably Fair mode
        if (phase !== PHASE.IDLE) return

        if (amount > balance) {
            showToast('error', 'Insufficient Balance', `You need ${currencySymbol}${amount.toFixed(2)} but only have ${currencySymbol}${balance.toFixed(2)}`)
            return
        }

        const res = await startCrashRound({ betAmount: amount, autoCashout: autoCashoutTarget })
        if (!res || !res.success) {
            showToast('error', 'Launch Failed', res?.error || 'Unable to launch Crash flight')
            return
        }

        activeRoundIdRef.current = res.roundId
        setCrashPoint(res.crashPoint)
        setBetAmount(amount)
        setBetPlaced(true)
        setUserBetData({
            name: 'You',
            amount: amount,
            currency: {
                symbol: currencySymbol,
                color: currency === 'INR' ? '#f5af19' : (currency === 'BTC' ? '#f7931a' : '#26a17b'),
                name: currency
            },
            active: true,
            cashoutAt: null,
            profit: null
        })

        if (res.hash) {
            setFairnessData(prev => ({ ...prev, serverSeedHash: res.hash }))
        }

        casinoAudio.playBet()
        showToast('bet', 'Flight Launched!', `${currencySymbol}${amount.toFixed(2)}`, 2000)

        setMultiplier(1.00)
        setElapsedTime(0)
        multiplierRef.current = 1.00
        elapsedTimeRef.current = 0
        const launchTime = Date.now()
        startTimeRef.current = launchTime
        setFlightStartTime(launchTime)
        setPhase(PHASE.RUNNING)
    }

    // Handle cashout (Server-Authoritative)
    const handleCashout = async () => {
        if (gameMode === 'arena') {
            if (phase !== PHASE.RUNNING || !betPlaced) return
            const res = await cashoutRoomCrash()
            if (res && res.success) {
                setBetPlaced(false)
                const winAmount = res.payout
                const profit = winAmount - betAmount
                setUserBetData(prev => prev ? {
                    ...prev,
                    active: false,
                    cashoutAt: res.multiplier.toFixed(2),
                    profit: winAmount.toFixed(2)
                } : null)

                showToast('win', 'You Won!', `+${currencySymbol}${profit.toFixed(2)} at ${res.multiplier.toFixed(2)}×`, 4000)
                if (res.multiplier >= 3) {
                    casinoAudio.playBigWin()
                } else {
                    casinoAudio.playCashout()
                }

                setGameRecords(prev => [...prev, {
                    id: Date.now(),
                    multiplier: res.multiplier,
                    cashedOutAt: res.multiplier,
                    bet: betAmount,
                    profit
                }])
            } else {
                showToast('error', 'Cashout Rejected', res?.error || 'Flight may have already crashed')
            }
            return
        }

        // Solo Provably Fair mode
        if (phase === PHASE.RUNNING && betPlaced && activeRoundIdRef.current) {
            const currentRoundId = activeRoundIdRef.current
            const targetMult = multiplierRef.current
            const res = await cashoutCrashRound({ roundId: currentRoundId, multiplier: targetMult })

            if (res && res.success && res.won) {
                setBetPlaced(false)
                activeRoundIdRef.current = null
                const winAmount = res.payout
                const profit = winAmount - betAmount
                setUserBetData(prev => prev ? {
                    ...prev,
                    active: false,
                    cashoutAt: res.multiplier.toFixed(2),
                    profit: winAmount.toFixed(2)
                } : null)

                showToast('win', 'You Won!', `+${currencySymbol}${profit.toFixed(2)} at ${res.multiplier.toFixed(2)}×`, 4000)
                if (res.multiplier >= 3) {
                    casinoAudio.playBigWin()
                } else {
                    casinoAudio.playCashout()
                }

                setGameRecords(prev => [...prev, {
                    id: Date.now(),
                    multiplier: res.multiplier,
                    cashedOutAt: res.multiplier,
                    bet: betAmount,
                    profit
                }])
            } else if (res && !res.won) {
                // Server rejected cashout because flight crashed earlier
                handleCrash(res.crashPoint || targetMult)
            }
        }
    }

    // Copy to clipboard
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
        messageApi.success('Copied to clipboard!')
    }

    // Handle client seed change
    const handleChangeClientSeed = useCallback(async () => {
        const pf = fairnessRef.current
        if (!pf || !clientSeedInput) return
        await pf.setClientSeed(clientSeedInput)
        const data = await pf.getFairnessData()
        setFairnessData(data)
    }, [clientSeedInput])

    // Handle seed rotation (reveals current seed)
    const handleRotateSeed = useCallback(async () => {
        const pf = fairnessRef.current
        if (!pf) return
        const revealed = await pf.rotateSeed()
        setRevealedSeed(revealed)
        const data = await pf.getFairnessData()
        setFairnessData(data)
        setClientSeedInput(data.clientSeed)
    }, [])

    return (
        <div className={`crash-game layout-${layout}`}>
            {contextHolder}

            <div className="game-container">
                {/* Betting Panel + Player Bets */}
                <MobileBetSheet title="Crash bet controls" className="crash-bet-sheet">
                    <div className="crash-sidebar">
                        <BettingPanel
                            phase={phase}
                            betPlaced={betPlaced}
                            multiplier={multiplier}
                            onBet={handleBet}
                            onCashout={handleCashout}
                        />

                        {/* Player Bets List */}
                        {showPlayerBets && !isMobileLayout && (
                            <PlayerBets
                                phase={phase}
                                multiplier={multiplier}
                                onPlayerCashout={handlePlayerCashout}
                                userBetData={userBetData}
                                roomBets={roomBets}
                                isArena={gameMode === 'arena'}
                            />
                        )}

                        {/* Footer */}
                        <div className="sidebar-footer">
                            <div className="footer-buttons">
                                <button
                                    className={`footer-btn ${historyDrawerOpen ? 'active' : ''}`}
                                    onClick={() => setHistoryDrawerOpen(true)}
                                    title="Play History & Dashboard"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                                    </svg>
                                </button>
                                <button
                                    className={`footer-btn ${statsDrawerOpen ? 'active' : ''}`}
                                    onClick={() => setStatsDrawerOpen(true)}
                                    title="Live Stats"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M16 11.78l4.24-7.33 1.73 1-5.23 9.05-6.51-3.75L5.46 19H22v2H2V3h2v14.54L9.5 8z" />
                                    </svg>
                                </button>
                                <button
                                    className="footer-btn"
                                    onClick={() => setFairnessModalOpen(true)}
                                    title="Provably Fair"
                                >
                                    <SafetyCertificateOutlined style={{ fontSize: 18 }} />
                                </button>
                            </div>
                        </div>
                    </div>
                </MobileBetSheet>

                {/* Game Display */}
                <div className="game-display" ref={gameDisplayRef}>
                    {/* Mode Switcher */}
                    <div className="crash-mode-header">
                        <Radio.Group
                            value={gameMode}
                            onChange={(e) => {
                                const nextMode = e.target.value
                                setGameMode(nextMode)
                                setBetPlaced(false)
                                if (nextMode === 'solo') {
                                    setPhase(PHASE.IDLE)
                                    setMultiplier(1.00)
                                    setCountdown(0)
                                }
                            }}
                            buttonStyle="solid"
                            size="small"
                        >
                            <Radio.Button value="arena" style={{ fontWeight: 700, borderRadius: '6px 0 0 6px' }}>
                                <TeamOutlined style={{ marginRight: 6 }} />
                                Multiplayer Room
                            </Radio.Button>
                            <Radio.Button value="solo" style={{ fontWeight: 700, borderRadius: '0 6px 6px 0' }}>
                                <UserOutlined style={{ marginRight: 6 }} />
                                Solo Flight
                            </Radio.Button>
                        </Radio.Group>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: gameMode === 'arena' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                border: `1px solid ${gameMode === 'arena' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: gameMode === 'arena' ? '#4ade80' : '#60a5fa'
                            }}>
                                <span style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: gameMode === 'arena' ? '#22c55e' : '#3b82f6',
                                    boxShadow: gameMode === 'arena' ? '0 0 8px #22c55e' : '0 0 8px #3b82f6'
                                }} />
                                {gameMode === 'arena' ? 'SYNCHRONIZED ROOM' : 'PROVABLY FAIR RNG'}
                            </span>
                        </div>
                    </div>

                    <GameHistory history={history} />

                    <GameChart
                        phase={phase}
                        multiplier={multiplier}
                        elapsedTime={elapsedTime}
                        countdown={countdown}
                        flightStartTime={flightStartTime}
                    />

                    {/* Player Results (floating on chart) */}
                    {showPlayerResults && !isMobileLayout && (
                        <PlayerResults cashouts={playerCashouts} />
                    )}

                    {isMobileLayout && (
                        <section className="crash-mobile-tabs" aria-label="Crash player data">
                            <div role="tablist" aria-label="Player data">
                                {['bets', 'results'].map((tab, index, tabs) => (
                                    <button
                                        key={tab}
                                        id={`crash-${tab}-tab`}
                                        type="button"
                                        role="tab"
                                        tabIndex={mobileDataTab === tab ? 0 : -1}
                                        aria-selected={mobileDataTab === tab}
                                        aria-controls={`crash-${tab}-panel`}
                                        onClick={() => setMobileDataTab(tab)}
                                        onKeyDown={(event) => {
                                            if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
                                            event.preventDefault()
                                            const direction = event.key === 'ArrowRight' ? 1 : -1
                                            const nextTab = tabs[(index + direction + tabs.length) % tabs.length]
                                            setMobileDataTab(nextTab)
                                            document.getElementById(`crash-${nextTab}-tab`)?.focus()
                                        }}
                                    >
                                        {tab === 'bets' ? 'Bets' : 'Results'}
                                    </button>
                                ))}
                            </div>
                            <div
                                id={`crash-${mobileDataTab}-panel`}
                                role="tabpanel"
                                aria-labelledby={`crash-${mobileDataTab}-tab`}
                            >
                                {showPlayerBets && mobileDataTab === 'bets' ? (
                                    <PlayerBets
                                        phase={phase}
                                        multiplier={multiplier}
                                        onPlayerCashout={handlePlayerCashout}
                                        userBetData={userBetData}
                                        roomBets={roomBets}
                                        isArena={gameMode === 'arena'}
                                    />
                                ) : mobileDataTab === 'results' && showPlayerResults ? (
                                    <PlayerResults cashouts={playerCashouts} />
                                ) : null}
                            </div>
                        </section>
                    )}

                    {/* Bottom Controls */}
                    <div className="bottom-controls-antd">
                        <Space>
                            <Tooltip
                                title={
                                    <div>
                                        <div style={{ marginBottom: 8 }}>
                                            <Text style={{ color: '#fff' }}>Show Player Bets</Text>
                                            <Switch
                                                size="small"
                                                checked={showPlayerBets}
                                                onChange={setShowPlayerBets}
                                                style={{ marginLeft: 8 }}
                                            />
                                        </div>
                                        <div>
                                            <Text style={{ color: '#fff' }}>Show Player Results</Text>
                                            <Switch
                                                size="small"
                                                checked={showPlayerResults}
                                                onChange={setShowPlayerResults}
                                                style={{ marginLeft: 8 }}
                                            />
                                        </div>
                                    </div>
                                }
                                trigger="click"
                                placement="top"
                            >
                                <Button
                                    type="text"
                                    icon={<SettingOutlined />}
                                    className="control-btn-antd"
                                />
                            </Tooltip>

                            {/* Fullscreen Button */}
                            <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                                <Button
                                    type="text"
                                    icon={isFullscreen ? <FullscreenExitOutlined /> : <ExpandOutlined />}
                                    className="control-btn-antd"
                                    onClick={toggleFullscreen}
                                />
                            </Tooltip>



                            {/* Layout Button */}
                            <Tooltip
                                title={
                                    <Radio.Group
                                        value={layout}
                                        onChange={(e) => setLayout(e.target.value)}
                                        size="small"
                                    >
                                        <Radio.Button value="default">Default</Radio.Button>
                                        <Radio.Button value="compact">Compact</Radio.Button>
                                        <Radio.Button value="wide">Wide</Radio.Button>
                                    </Radio.Group>
                                }
                                trigger="click"
                                placement="top"
                            >
                                <Button
                                    type="text"
                                    icon={<AppstoreOutlined />}
                                    className="control-btn-antd"
                                />
                            </Tooltip>

                            {/* Sound Button */}
                            <Tooltip title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}>
                                <Button
                                    type="text"
                                    icon={<SoundOutlined />}
                                    className={`control-btn-antd ${!soundEnabled ? 'muted' : ''}`}
                                    onClick={() => setSoundEnabled(!soundEnabled)}
                                />
                            </Tooltip>
                        </Space>

                        <span className="logo" style={{ color: 'var(--primary)', fontWeight: '900', letterSpacing: '-0.02em' }}>AmratGames</span>

                        {/* History Button */}
                        <Button
                            type="text"
                            icon={<BarChartOutlined />}
                            className="fairness-btn"
                            onClick={() => setHistoryDrawerOpen(true)}
                        >
                            History
                        </Button>

                        {/* Fairness Button */}
                        <Button
                            type="text"
                            icon={<SafetyCertificateOutlined />}
                            className="fairness-btn"
                            onClick={() => setFairnessModalOpen(true)}
                        >
                            Fairness
                        </Button>
                    </div>
                </div>
            </div>


            {/* Statistics Mini Window / Profit Chart */}
            {statsDrawerOpen && (
                <div className="fixed-widget fade-in-scale" ref={widgetRef}>
                    <div className="widget-header" onMouseDown={handleDragStart}>
                        <div className="widget-title">
                            <LineChartOutlined style={{ fontSize: 20, color: '#94a3b8' }} />
                            <span>Live Stats</span>
                        </div>
                        <div className="widget-actions">
                            <Tooltip title="Reset Live Stats" placement="topRight">
                                <button className="widget-btn-icon" onMouseDown={(e) => e.stopPropagation()} onClick={() => setGameRecords([])}>
                                    <ReloadOutlined />
                                </button>
                            </Tooltip>
                            <button className="widget-btn-icon" onMouseDown={(e) => e.stopPropagation()} onClick={() => setStatsDrawerOpen(false)}>
                                <CloseOutlined />
                            </button>
                        </div>
                    </div>

                    <div className="widget-content">
                        {/* Profit Overview */}
                        <div className="profit-box">
                            <div className="profit-main">
                                <p className="label">Profit</p>
                                <p className="value" style={{ color: totalProfit >= 0 ? '#4ade80' : '#f87171' }}>
                                    {currencySymbol}{totalProfit.toFixed(2)}
                                </p>
                            </div>
                            <div className="profit-divider"></div>
                            <div className="profit-stats">
                                <div className="stat-row">
                                    <p className="label">Wins</p>
                                    <p className="value" style={{ color: '#4ade80' }}>{winsCount.toLocaleString()}</p>
                                </div>
                                <div className="stat-row">
                                    <p className="label">Losses</p>
                                    <p className="value" style={{ color: '#f87171' }}>{lossesCount.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Chart.js Container */}
                        <div className="chart-box" onMouseLeave={() => setHoveredProfitValue(null)}>
                            <p className="label">Profit History</p>
                            {hoveredProfitValue !== null && (
                                <p className="hovered-value" style={{ color: hoveredProfitValue >= 0 ? '#4ade80' : '#f87171' }}>
                                    {hoveredProfitValue >= 0 ? '' : '-'}{currencySymbol}{Math.abs(hoveredProfitValue).toFixed(2)}
                                </p>
                            )}
                            <div className="canvas-wrapper">
                                <canvas ref={chartCanvasRef}></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* History Window - sleek modern dashboard style */}
            <Modal
                title={
                    <Space className="history-window-header-title">
                        <div className="icon-wrapper"><ThunderboltOutlined /></div>
                        <span>Play History & Dashboard</span>
                    </Space>
                }
                centered
                footer={null}
                onCancel={() => setHistoryDrawerOpen(false)}
                open={historyDrawerOpen}
                width={460}
                rootClassName="crash-history-modal-portal mobile-game-modal"
                className="history-window box-modal-3d"
                closeIcon={<CloseOutlined style={{ color: '#94a3b8' }} />}
            >
                <div className="history-window-content">
                    {/* Achievements */}
                    <div className="dashboard-section">
                        <div className="section-title">Milestones</div>
                        <div className="achievements-row">
                            {(() => {
                                const achievements = [
                                    { id: 'first-drop', title: 'First Drop', unlocked: gameRecords.length > 0, icon: <StarOutlined /> },
                                    { id: 'big-win', title: 'Big Win 20×', unlocked: gameRecords.some(w => w.multiplier >= 20 && w.profit >= 0), icon: <TrophyOutlined /> },
                                    { id: 'hot-streak', title: 'Hot streak 5+', unlocked: maxStreak >= 5, icon: <FireOutlined /> },
                                ];
                                return achievements.map(a => (
                                    <div key={a.id} className={`achievement-badge ${a.unlocked ? 'unlocked' : 'locked'}`}>
                                        <div className="achievement-icon">{a.icon}</div>
                                        <div className="achievement-title">{a.title}</div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>

                    {/* Streak timeline (last 20 results) */}
                    <div className="dashboard-section">
                        <div className="section-title">Streak Timeline (Last 20)</div>
                        <div className="streak-timeline glass-panel">
                            {gameRecords.slice(-20).map((r, idx) => (
                                <div key={r.id || idx} className={`timeline-dot ${r.profit >= 0 ? 'win' : 'loss'}`} title={`Crash: ${r.multiplier.toFixed(2)}x ${r.cashedOutAt ? `• Cashed out: ${r.cashedOutAt.toFixed(2)}x` : ''}`} />
                            ))}
                        </div>
                    </div>

                    {/* History list */}
                    <div className="dashboard-section">
                        <div className="section-title">Recent Transactions</div>
                        <div className="history-list">
                            {gameRecords.length === 0 ? (
                                <div className="empty-state">No transaction history yet</div>
                            ) : (
                                gameRecords.slice().reverse().map((r) => {
                                    const isWin = r.profit >= 0;
                                    return (
                                        <div key={r.id} className="history-card glass-panel">
                                            <div className="history-card-icon">
                                                <div className="ball-color-circle medium" style={{ background: isWin ? 'linear-gradient(135deg, var(--success), #26ad58)' : 'linear-gradient(135deg, #ff4d4f, #cf1322)' }}>
                                                    {isWin ? <TrophyOutlined style={{ color: '#fff' }} /> : <CloseOutlined style={{ color: '#fff' }} />}
                                                </div>
                                            </div>
                                            <div className="history-card-info">
                                                <div className="history-card-name">{isWin ? 'Win' : 'Loss'}</div>
                                                <div className="history-card-multiplier" style={{ color: isWin ? 'var(--success)' : '#ff4d4f' }}>
                                                    {r.cashedOutAt ? r.cashedOutAt.toFixed(2) : r.multiplier.toFixed(2)}×
                                                </div>
                                            </div>
                                            <div className={`history-card-profit ${isWin ? 'profit-up' : 'profit-down'}`}>
                                                {isWin ? '+' : '-'}{currencySymbol}{Math.abs(r.profit).toFixed(2)}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Game Bottom History (Live Bets & My Bets) */}
                    <div className="dashboard-section" style={{ marginTop: 16 }}>
                        <GameBottomHistory
                            gameKey="crash"
                            gameTitle="Crash"
                            localRounds={gameRecords}
                        />
                    </div>
                </div>
            </Modal>

            {/* Fairness Modal */}
            <Modal
                title={
                    <Space>
                        <SafetyCertificateOutlined style={{ color: 'var(--primary)' }} />
                        <span>Provably Fair</span>
                    </Space>
                }
                open={fairnessModalOpen}
                onCancel={() => setFairnessModalOpen(false)}
                footer={null}
                width={480}
                rootClassName="crash-fairness-modal-portal mobile-game-modal"
                className="fairness-modal"
                centered
            >
                {/* Header Card */}
                <div className="fairness-header">
                    <Title level={5}>
                        <CheckCircleOutlined style={{ marginRight: 8 }} />
                        This game is provably fair
                    </Title>
                    <Paragraph>
                        Uses HMAC-SHA256 to generate results from server seed + client seed + nonce.
                        Rotate the seed to reveal and verify past results.
                    </Paragraph>
                </div>

                {/* Active Seed Data */}
                <div className="fairness-item">
                    <span className="fairness-label">Server Seed (Hash)</span>
                    <div className="fairness-value">
                        <Text copyable={{ text: fairnessData.serverSeedHash }} style={{ fontSize: 11, wordBreak: 'break-all' }}>
                            {fairnessData.serverSeedHash?.slice(0, 24)}...
                        </Text>
                    </div>
                </div>

                <div className="fairness-item">
                    <span className="fairness-label">Client Seed</span>
                    <div className="fairness-value" style={{ display: 'flex', gap: 6 }}>
                        <Input
                            size="small"
                            value={clientSeedInput}
                            onChange={e => setClientSeedInput(e.target.value)}
                            style={{ background: '#2f4553', border: 'none', color: '#fff', flex: 1, fontSize: 12 }}
                        />
                        <Button size="small" onClick={handleChangeClientSeed} icon={<CheckCircleOutlined />} />
                    </div>
                </div>

                <div className="fairness-item">
                    <span className="fairness-label">Nonce</span>
                    <div className="fairness-value">
                        <Text style={{
                            background: 'rgba(47, 69, 83, 0.5)',
                            padding: '4px 12px',
                            borderRadius: 6,
                            color: '#fff'
                        }}>
                            {fairnessData.nonce}
                        </Text>
                    </div>
                </div>

                <div className="fairness-item">
                    <span className="fairness-label">Last Result</span>
                    <div className="fairness-value">
                        <Tag
                            color={(history[0] || 1) < 2 ? 'error' : (history[0] || 1) < 10 ? 'success' : 'gold'}
                            style={{ margin: 0, fontSize: 14, fontWeight: 600 }}
                        >
                            {(history[0] || 1).toFixed(2)}×
                        </Tag>
                    </div>
                </div>

                <Divider style={{ borderColor: 'rgba(255,255,255,0.06)', margin: '12px 0' }} />

                {/* Revealed Seed (after rotation) */}
                {revealedSeed && (
                    <div style={{ marginBottom: 12 }}>
                        <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Previous Server Seed (Revealed)
                        </Text>
                        <div className="fairness-item" style={{ marginTop: 6 }}>
                            <span className="fairness-label">Seed</span>
                            <div className="fairness-value">
                                <Text copyable={{ text: revealedSeed.serverSeed }} style={{ fontSize: 10, wordBreak: 'break-all' }}>
                                    {revealedSeed.serverSeed.slice(0, 20)}...
                                </Text>
                            </div>
                        </div>
                        <div className="fairness-item">
                            <span className="fairness-label">Hash</span>
                            <div className="fairness-value">
                                <Text style={{ fontSize: 10, wordBreak: 'break-all', color: 'var(--primary)' }}>
                                    {revealedSeed.serverSeedHash?.slice(0, 20)}...
                                </Text>
                            </div>
                        </div>
                    </div>
                )}

                {/* Rotate Button */}
                <Button
                    type="primary"
                    block
                    className="fairness-verify-btn"
                    icon={<SyncOutlined />}
                    onClick={handleRotateSeed}
                >
                    Rotate Seed (Reveal Current)
                </Button>
            </Modal>
        </div>
    )
}

export default CrashGame
