import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
    SettingOutlined,
    SafetyCertificateOutlined,
    SoundOutlined,
    CheckCircleOutlined,
    HistoryOutlined,
    HeartOutlined,
    HeartFilled,
    LineChartOutlined,
    ThunderboltOutlined,
    RedoOutlined
} from '@ant-design/icons'
import { Modal, Tooltip, Typography, Tag } from 'antd'
import Chart from 'chart.js/auto'

const { Title, Text, Paragraph } = Typography
import casinoAudio from '../../utils/casinoAudio'
import { useWallet } from '../../context/WalletContext'
import { useAuth } from '../../context/AuthContext'
import { CurrencyIcon } from '../../components/Header'
import { getOptimizedImageUrl } from '../../utils/cloudinary'
import ProvablyFairVerifierModal from '../../components/ProvablyFair/ProvablyFairVerifierModal'
import GameBottomHistory from '../../components/GameHistory/GameBottomHistory'
import './MinesGame.css'

// 99% RTP (1% house edge) exactly matches standard 24.75x max on 1 mine, 12,523.50x max on 4 mines
const HOUSE_EDGE = 0.99

export const calculateMultiplier = (mines, hits) => {
    if (hits <= 0) return 1.00
    let mult = 1.0
    for (let i = 0; i < hits; i++) {
        mult *= (25 - i) / (25 - mines - i)
    }
    return parseFloat((mult * HOUSE_EDGE).toFixed(2))
}

export const calculateMaxMultiplier = (mines) => {
    const gems = 25 - mines
    let mult = 1.0
    for (let i = 0; i < gems; i++) {
        mult *= (25 - i) / (25 - mines - i)
    }
    return mult * HOUSE_EDGE
}

function MinesGame() {
    const { user, openAuthModal } = useAuth()
    const {
        balance,
        showToast,
        currencySymbol,
        currency,
        startMinesRound,
        revealMinesTile,
        cashoutMinesRound,
        getActiveMinesRound,
        openWalletModal
    } = useWallet()

    // Mode: 'manual' | 'auto'
    const [mode, setMode] = useState('manual')

    // Game Core State
    const [isPlaying, setIsPlaying] = useState(false)
    const [roundId, setRoundId] = useState(null)
    const [betAmount, setBetAmount] = useState(10)
    const [minesCount, setMinesCount] = useState(3)
    const [revealedTiles, setRevealedTiles] = useState([])
    const [mineLocations, setMineLocations] = useState([])
    const [gameOverState, setGameOverState] = useState(null) // 'win', 'loss', or null
    const [isHovering, setIsHovering] = useState(null)
    const [lastHitMineIndex, setLastHitMineIndex] = useState(null)

    // Auto Mode Selection State
    const [autoSelectedTiles, setAutoSelectedTiles] = useState([])
    const [lastAutoPattern, setLastAutoPattern] = useState([])
    const [autoBetCount, setAutoBetCount] = useState(10)
    const [autoInfinite, setAutoInfinite] = useState(false)
    const [autoRunning, setAutoRunning] = useState(false)
    const [onWinAction, setOnWinAction] = useState('reset') // 'reset' | 'increase'
    const [onWinIncrease, setOnWinIncrease] = useState(100)
    const [onLossAction, setOnLossAction] = useState('reset') // 'reset' | 'increase'
    const [onLossIncrease, setOnLossIncrease] = useState(100)

    // Demo Mode toggle when logged out
    const [isDemoMode, setIsDemoMode] = useState(false)
    const [demoBalance, setDemoBalance] = useState(1000)

    // UI & Social State
    const [isFavorite, setIsFavorite] = useState(() => {
        try {
            return localStorage.getItem('amrat_mines_favorited') === 'true'
        } catch {
            return false
        }
    })
    const [followersCount, setFollowersCount] = useState(197730)
    const [soundEnabled, setSoundEnabled] = useState(() => !casinoAudio.getMuted())
    const [fastMode, setFastMode] = useState(false)

    // Modals
    const [fairnessModalOpen, setFairnessModalOpen] = useState(false)
    const [verifierOpen, setVerifierOpen] = useState(false)
    const [statsDrawerOpen, setStatsDrawerOpen] = useState(false)
    const [settingsModalOpen, setSettingsModalOpen] = useState(false)
    const [historyModalOpen, setHistoryModalOpen] = useState(false)

    // Concurrency Action Locks
    const isRevealingRef = useRef(false)
    const isStartingRef = useRef(false)
    const isCashingOutRef = useRef(false)
    const autoRunningRef = useRef(false)
    const baseBetRef = useRef(10)

    // Provably Fair
    const [fairnessData, setFairnessData] = useState({
        serverSeedHash: 'Loading...',
        clientSeed: localStorage.getItem('amrat_mines_client_seed') || 'amrat-player',
        nonce: 1
    })
    const [revealedSeed, setRevealedSeed] = useState(null)
    const [clientSeedInput, setClientSeedInput] = useState(() =>
        localStorage.getItem('amrat_mines_client_seed') || 'amrat-player'
    )

    // Live Session Stats
    const [winRecords, setWinRecords] = useState([])
    const [totalProfit, setTotalProfit] = useState(0)
    const [winsCount, setWinsCount] = useState(0)
    const [lossesCount, setLossesCount] = useState(0)
    const chartCanvasRef = useRef(null)
    const chartInstanceRef = useRef(null)
    const profitHistoryRef = useRef([0])

    // Effective balance (real wallet or demo)
    const effectiveBalance = user ? balance : (isDemoMode ? demoBalance : 0)

    // Mathematical multiplier computations
    const currentMultiplier = useMemo(() => {
        return calculateMultiplier(minesCount, revealedTiles.length)
    }, [minesCount, revealedTiles.length])

    const nextMultiplier = useMemo(() => {
        return calculateMultiplier(minesCount, revealedTiles.length + 1)
    }, [minesCount, revealedTiles.length])

    const maxMultiplier = useMemo(() => {
        return calculateMaxMultiplier(minesCount)
    }, [minesCount])

    const potentialWin = useMemo(() => {
        return betAmount * currentMultiplier
    }, [betAmount, currentMultiplier])

    const nextPotentialWin = useMemo(() => {
        return betAmount * nextMultiplier
    }, [betAmount, nextMultiplier])

    // Sound player helper
    const playSound = useCallback((type, level = 1) => {
        if (!soundEnabled) return
        try {
            if (type === 'gem') casinoAudio.playGem(level)
            else if (type === 'explosion') casinoAudio.playExplosion()
            else if (type === 'cashout') casinoAudio.playCashout()
            else if (type === 'chip') casinoAudio.playChip()
            else if (type === 'bet') casinoAudio.playBet()
        } catch {}
    }, [soundEnabled])

    // Load active round & provably fair seed on initial mount
    useEffect(() => {
        fetch('/api/games/provably-fair/seed')
            .then(res => res.json())
            .then(data => {
                if (data?.serverSeedHash) {
                    setFairnessData(prev => ({ ...prev, serverSeedHash: data.serverSeedHash }))
                }
            })
            .catch(() => {})

        if (getActiveMinesRound && user) {
            getActiveMinesRound().then(active => {
                if (active) {
                    setRoundId(active.roundId)
                    setMinesCount(active.minesCount)
                    setBetAmount(active.betAmount)
                    setRevealedTiles(active.revealedIndices || [])
                    if (active.serverSeedHash) {
                        setFairnessData(prev => ({
                            ...prev,
                            serverSeedHash: active.serverSeedHash,
                            nonce: active.nonce || 1
                        }))
                    }
                    setIsPlaying(true)
                }
            })
        }
    }, [getActiveMinesRound, user])

    // Favorite button toggle
    const toggleFavorite = () => {
        const next = !isFavorite
        setIsFavorite(next)
        setFollowersCount(prev => next ? prev + 1 : prev - 1)
        try {
            localStorage.setItem('amrat_mines_favorited', next.toString())
        } catch {}
    }

    // Client seed handlers
    const handleChangeClientSeed = useCallback(() => {
        if (!clientSeedInput || !clientSeedInput.trim()) return
        const trimmed = clientSeedInput.trim()
        localStorage.setItem('amrat_mines_client_seed', trimmed)
        setFairnessData(prev => ({ ...prev, clientSeed: trimmed }))
        showToast('info', 'Client Seed Updated', `Client seed saved: ${trimmed}`)
    }, [clientSeedInput, showToast])

    const handleRotateSeed = useCallback(() => {
        const randomSeed = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12)
        setClientSeedInput(randomSeed)
        localStorage.setItem('amrat_mines_client_seed', randomSeed)
        setFairnessData(prev => ({ ...prev, clientSeed: randomSeed }))
        showToast('info', 'Client Seed Rotated', `New client seed: ${randomSeed}`)
    }, [showToast])

    // Bet amount handlers
    const handleBetAmountHalf = () => {
        if (isPlaying) return
        playSound('chip')
        setBetAmount(prev => Math.max(0.1, parseFloat((prev / 2).toFixed(2))))
    }

    const handleBetAmountDouble = () => {
        if (isPlaying) return
        playSound('chip')
        setBetAmount(prev => parseFloat((prev * 2).toFixed(2)))
    }

    // Mines count slider handler
    const handleMinesChange = (e) => {
        if (isPlaying) return
        const count = Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 1))
        playSound('chip')
        setMinesCount(count)
        // If auto mode and pre-selected tiles exceed safe gems, prune
        if (autoSelectedTiles.length > 25 - count) {
            setAutoSelectedTiles(prev => prev.slice(0, 25 - count))
        }
    }

    // Repeat & Clear buttons
    const handleRepeat = () => {
        if (isPlaying) return
        playSound('chip')
        if (lastAutoPattern.length > 0) {
            setAutoSelectedTiles([...lastAutoPattern])
        } else if (revealedTiles.length > 0) {
            setAutoSelectedTiles([...revealedTiles])
        }
    }

    const handleClear = () => {
        if (isPlaying) return
        playSound('chip')
        setAutoSelectedTiles([])
    }

    // Start New Game Round
    const startGame = async () => {
        if (!user && !isDemoMode) {
            openAuthModal?.('register')
            return
        }

        if (betAmount <= 0) {
            showToast('error', 'Invalid Bet', 'Please enter a valid bet amount')
            return
        }

        if (betAmount > effectiveBalance) {
            showToast('error', 'Insufficient Balance', `You need ${currencySymbol}${betAmount.toFixed(2)}`)
            return
        }

        if (isStartingRef.current) return
        isStartingRef.current = true

        try {
            // Save base bet for auto martingale
            baseBetRef.current = betAmount

            if (!user && isDemoMode) {
                // Free Demo Mode in-browser Provably Fair simulation
                setDemoBalance(prev => prev - betAmount)
                const mockMines = []
                while (mockMines.length < minesCount) {
                    const idx = Math.floor(Math.random() * 25)
                    if (!mockMines.includes(idx)) mockMines.push(idx)
                }
                setRoundId('demo_' + Date.now())
                setRevealedTiles([])
                setMineLocations(mockMines)
                setLastHitMineIndex(null)
                setGameOverState(null)
                setIsPlaying(true)
                playSound('bet')
                showToast('bet', `-${currencySymbol}${betAmount.toFixed(2)}`, 'Demo Bet Placed', 1000)
                return { success: true, demo: true }
            }

            const seedToSend = clientSeedInput || localStorage.getItem('amrat_mines_client_seed') || user?.id || 'amrat-player'
            const res = await startMinesRound({
                betAmount,
                minesCount,
                clientSeed: seedToSend
            })

            if (!res || !res.success) {
                showToast('error', 'Error Starting Game', res?.error || 'Failed to start game')
                return res
            }

            playSound('bet')
            setRoundId(res.roundId)
            setRevealedTiles([])
            setMineLocations([])
            setLastHitMineIndex(null)
            setGameOverState(null)
            setIsPlaying(true)
            if (res.serverSeedHash) {
                setFairnessData(prev => ({
                    ...prev,
                    serverSeedHash: res.serverSeedHash,
                    nonce: res.nonce || 1
                }))
            }
            showToast('bet', `-${currencySymbol}${betAmount.toFixed(2)}`, 'Placed', 1000)
            return res
        } finally {
            isStartingRef.current = false
        }
    }

    // Tile Click Handler
    const handleTileClick = async (index) => {
        if (!isPlaying || revealedTiles.includes(index) || isRevealingRef.current) return
        isRevealingRef.current = true

        try {
            if (!user && isDemoMode) {
                // Demo Mode Reveal
                const isMine = mineLocations.includes(index)
                if (isMine) {
                    setLastHitMineIndex(index)
                    setRevealedTiles(prev => [...prev, index])
                    setIsPlaying(false)
                    setGameOverState('loss')
                    setTotalProfit(prev => prev - betAmount)
                    setLossesCount(prev => prev + 1)
                    showToast('loss', `-${currencySymbol}${betAmount.toFixed(2)}`, 'Mine Hit!', 1200)
                    playSound('explosion')
                    setRoundId(null)
                } else {
                    const nextTiles = [...revealedTiles, index]
                    setRevealedTiles(nextTiles)
                    playSound('gem', nextTiles.length)

                    if (nextTiles.length === 25 - minesCount) {
                        // Max auto win
                        const finalMult = calculateMaxMultiplier(minesCount)
                        const profit = betAmount * finalMult - betAmount
                        setDemoBalance(prev => prev + betAmount * finalMult)
                        setIsPlaying(false)
                        setGameOverState('win')
                        setTotalProfit(prev => prev + profit)
                        setWinsCount(prev => prev + 1)
                        showToast('win', `+${currencySymbol}${profit.toFixed(2)}`, `${finalMult.toFixed(2)}× Clear!`, 1500)
                        playSound('cashout')
                        setRoundId(null)
                    }
                }
                return
            }

            const res = await revealMinesTile({ roundId, tileIndex: index })
            if (!res || !res.success) {
                showToast('error', 'Action Failed', res?.error || 'Failed to reveal tile')
                return
            }

            if (res.isMine) {
                setLastHitMineIndex(index)
                setRevealedTiles(prev => [...prev, index])
                setMineLocations(res.allMines || [])
                setIsPlaying(false)
                setGameOverState('loss')

                setTotalProfit(prev => prev - betAmount)
                setLossesCount(prev => prev + 1)
                setWinRecords(prev => [...prev, -betAmount])
                profitHistoryRef.current.push(profitHistoryRef.current[profitHistoryRef.current.length - 1] - betAmount)

                showToast('loss', `-${currencySymbol}${betAmount.toFixed(2)}`, 'Mine', 1000)
                playSound('explosion')
                if (res.serverSeed) {
                    setRevealedSeed({ serverSeed: res.serverSeed, hash: res.hash })
                }
                setRoundId(null)
            } else {
                setRevealedTiles(prev => {
                    const next = prev.includes(index) ? prev : [...prev, index]
                    playSound('gem', next.length)
                    return next
                })

                if (res.autoWin) {
                    setIsPlaying(false)
                    setGameOverState('win')
                    setMineLocations(res.allMines || [])
                    const profit = res.payout - betAmount

                    setTotalProfit(prev => prev + profit)
                    setWinsCount(prev => prev + 1)
                    setWinRecords(prev => [...prev, profit])
                    profitHistoryRef.current.push(profitHistoryRef.current[profitHistoryRef.current.length - 1] + profit)

                    showToast('win', `+${currencySymbol}${profit.toFixed(2)}`, `${res.currentMultiplier.toFixed(2)}×`, 1200)
                    playSound('cashout')
                    if (res.serverSeed) {
                        setRevealedSeed({ serverSeed: res.serverSeed, hash: res.hash })
                    }
                    setRoundId(null)
                }
            }
        } finally {
            isRevealingRef.current = false
        }
    }

    // Cashout Handler
    const cashout = async () => {
        if (isCashingOutRef.current || !isPlaying || revealedTiles.length === 0 || !roundId) return
        isCashingOutRef.current = true

        try {
            if (!user && isDemoMode) {
                const payout = potentialWin
                const profit = payout - betAmount
                setDemoBalance(prev => prev + payout)
                setIsPlaying(false)
                setGameOverState('win')
                setTotalProfit(prev => prev + profit)
                setWinsCount(prev => prev + 1)
                showToast('win', `+${currencySymbol}${profit.toFixed(2)}`, `${currentMultiplier.toFixed(2)}×`, 1200)
                playSound('cashout')
                setRoundId(null)
                return
            }

            const res = await cashoutMinesRound({ roundId })
            if (!res || !res.success) {
                showToast('error', 'Cashout Failed', res?.error || 'Failed to cash out')
                return
            }

            setIsPlaying(false)
            setGameOverState('win')
            setMineLocations(res.allMines || [])
            const profit = res.payout - betAmount

            setTotalProfit(prev => prev + profit)
            setWinsCount(prev => prev + 1)
            setWinRecords(prev => [...prev, profit])
            profitHistoryRef.current.push(profitHistoryRef.current[profitHistoryRef.current.length - 1] + profit)

            showToast('win', `+${currencySymbol}${profit.toFixed(2)}`, `${res.currentMultiplier?.toFixed(2) || currentMultiplier.toFixed(2)}×`, 1200)
            playSound('cashout')
            if (res.serverSeed) {
                setRevealedSeed({ serverSeed: res.serverSeed, hash: res.hash })
            }
            setRoundId(null)
        } finally {
            isCashingOutRef.current = false
        }
    }

    // Random Pick Handler
    const pickRandom = () => {
        playSound('chip')
        if (mode === 'auto' && !isPlaying) {
            // Select random pattern of safe tiles (e.g. 1 to 5 tiles)
            const count = Math.min(Math.floor(Math.random() * 4) + 1, 25 - minesCount)
            const available = [...Array(25).keys()]
            const picked = []
            while (picked.length < count && available.length > 0) {
                const randIndex = Math.floor(Math.random() * available.length)
                picked.push(available.splice(randIndex, 1)[0])
            }
            setAutoSelectedTiles(picked)
            return
        }

        if (!isPlaying || isRevealingRef.current) return
        const unrevealed = []
        for (let i = 0; i < 25; i++) {
            if (!revealedTiles.includes(i)) unrevealed.push(i)
        }
        if (unrevealed.length === 0) return
        const randomIndex = unrevealed[Math.floor(Math.random() * unrevealed.length)]
        handleTileClick(randomIndex)
    }

    // Toggle Auto Tile selection
    const toggleAutoTile = (index) => {
        if (isPlaying) return
        playSound('chip')
        setAutoSelectedTiles(prev => {
            if (prev.includes(index)) {
                return prev.filter(i => i !== index)
            } else {
                if (prev.length >= 25 - minesCount) {
                    showToast('info', 'Max Gems Selected', `Cannot select more than ${25 - minesCount} gems`)
                    return prev
                }
                return [...prev, index]
            }
        })
    }

    // Stop Auto Betting
    const stopAutoBet = useCallback(() => {
        autoRunningRef.current = false
        setAutoRunning(false)
        showToast('info', 'Auto Bet Stopped', 'Automated betting has been halted')
    }, [showToast])

    // Run Auto Bet Sequence
    const startAutoBet = async () => {
        if (autoSelectedTiles.length === 0) {
            showToast('error', 'Select Tiles', 'Please select at least 1 tile on the grid for auto betting')
            return
        }

        setLastAutoPattern([...autoSelectedTiles])
        autoRunningRef.current = true
        setAutoRunning(true)

        let betsLeft = autoInfinite ? Infinity : autoBetCount
        let currentBet = betAmount

        while (autoRunningRef.current && betsLeft > 0) {
            // Check balance
            if (currentBet > effectiveBalance) {
                showToast('error', 'Insufficient Balance', 'Stopping auto-bet sequence')
                break
            }

            // Start round
            const startRes = await startGame()
            if (!startRes || !startRes.success) break

            // Reveal selected tiles sequentially with optional fastMode
            let bust = false
            for (const tileIndex of autoSelectedTiles) {
                if (!autoRunningRef.current) break
                if (!fastMode) await new Promise(r => setTimeout(r, 120))
                await handleTileClick(tileIndex)
                if (!isPlaying) {
                    bust = true
                    break
                }
            }

            // If survived all selections, cash out
            if (!bust && isPlaying && revealedTiles.length > 0) {
                await cashout()
            }

            // Apply Martingale logic
            if (bust) {
                if (onLossAction === 'increase') {
                    currentBet = parseFloat((currentBet * (1 + onLossIncrease / 100)).toFixed(2))
                    setBetAmount(currentBet)
                } else {
                    currentBet = baseBetRef.current
                    setBetAmount(currentBet)
                }
            } else {
                if (onWinAction === 'increase') {
                    currentBet = parseFloat((currentBet * (1 + onWinIncrease / 100)).toFixed(2))
                    setBetAmount(currentBet)
                } else {
                    currentBet = baseBetRef.current
                    setBetAmount(currentBet)
                }
            }

            if (!autoInfinite) {
                betsLeft--
                setAutoBetCount(betsLeft)
            }

            if (!fastMode) await new Promise(r => setTimeout(r, 250))
        }

        autoRunningRef.current = false
        setAutoRunning(false)
    }

    // Keyboard shortcuts: Spacebar to Bet/Cashout
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
            if (e.code === 'Space') {
                e.preventDefault()
                if (!isPlaying) startGame()
                else if (revealedTiles.length > 0) cashout()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isPlaying, revealedTiles.length])

    // Live Stats Chart Update
    useEffect(() => {
        if (!statsDrawerOpen || !chartCanvasRef.current) return
        const profitHistory = profitHistoryRef.current.length > 0 ? profitHistoryRef.current : [0]

        if (chartInstanceRef.current) {
            chartInstanceRef.current.data.labels = Array(profitHistory.length).fill(0)
            chartInstanceRef.current.data.datasets[0].data = profitHistory
            chartInstanceRef.current.update('none')
        } else {
            chartInstanceRef.current = new Chart(chartCanvasRef.current, {
                type: 'line',
                data: {
                    labels: Array(profitHistory.length).fill(0),
                    datasets: [{
                        data: profitHistory,
                        fill: true,
                        backgroundColor: 'rgba(20, 117, 225, 0.2)',
                        borderColor: '#1475e1',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: false },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.06)' },
                            ticks: { color: '#94a3b8', font: { size: 10 } }
                        }
                    }
                }
            })
        }
    }, [statsDrawerOpen, totalProfit])

    // Render 5x5 Minefield Grid
    const renderGrid = () => {
        const tiles = []
        for (let i = 0; i < 25; i++) {
            const isRevealed = revealedTiles.includes(i)
            const isMine = mineLocations.includes(i)
            const isGameOver = !isPlaying && gameOverState
            const isAutoSelected = mode === 'auto' && autoSelectedTiles.includes(i)
            const isLastHitMine = i === lastHitMineIndex

            let tileClasses = ['amrat-mine-tile']
            let content = null

            if (isRevealed) {
                tileClasses.push('revealed')
                if (isMine) {
                    tileClasses.push('bomb-tile')
                    if (isLastHitMine) tileClasses.push('bomb-hit-direct')
                    content = (
                        <div className="tile-asset-wrap bomb-pop">
                            <img src={getOptimizedImageUrl('/images/mines/bomb.svg')} alt="Bomb" className="mine-icon-asset" />
                            {isLastHitMine && (
                                <img src={getOptimizedImageUrl('/images/mines/bomb_effect.gif')} alt="Blast" className="bomb-blast-effect" />
                            )}
                        </div>
                    )
                } else {
                    tileClasses.push('gem-tile')
                    content = (
                        <div className="tile-asset-wrap gem-pop">
                            <img src={getOptimizedImageUrl('/images/mines/diamond.svg')} alt="Gem" className="gem-icon-asset" />
                        </div>
                    )
                }
            } else if (isGameOver) {
                // Post-game: reveal remaining safe gems and mines at low opacity
                tileClasses.push('revealed', 'game-over-dimmed')
                if (isMine) {
                    content = <img src={getOptimizedImageUrl('/images/mines/bomb.svg')} alt="Bomb" className="mine-icon-asset dimmed" />
                } else {
                    content = <img src={getOptimizedImageUrl('/images/mines/diamond.svg')} alt="Gem" className="gem-icon-asset dimmed" />
                }
            } else if (isAutoSelected) {
                tileClasses.push('auto-selected')
                content = (
                    <div className="auto-target-icon">
                        <img src={getOptimizedImageUrl('/images/mines/diamond.svg')} alt="Target Gem" className="auto-target-gem" />
                    </div>
                )
            }

            if (!isPlaying || isRevealed) {
                tileClasses.push('inactive')
            }

            tiles.push(
                <button
                    key={i}
                    id={`mines-tile-${i}`}
                    className={tileClasses.join(' ')}
                    onClick={() => {
                        if (mode === 'auto' && !isPlaying) {
                            toggleAutoTile(i)
                        } else if (isPlaying && !isRevealed) {
                            handleTileClick(i)
                        }
                    }}
                    onMouseEnter={() => setIsHovering(i)}
                    onMouseLeave={() => setIsHovering(null)}
                    disabled={isRevealed || (isGameOver && !isPlaying)}
                    aria-label={`Tile ${i + 1}`}
                >
                    <div className="tile-surface">
                        {content}
                    </div>
                </button>
            )
        }
        return tiles
    }

    return (
        <div className="amrat-mines-wrapper">


            {/* Main Game Screen */}
            <div className="amrat-mines-container">
                {/* 1. MINEFIELD BOARD VIEWPORT */}
                <section className="amrat-board-viewport">
                    <div className="minefield-frame">
                        <div className={`minefield-grid ${gameOverState === 'loss' ? 'grid-shake' : ''}`}>
                            {renderGrid()}
                        </div>
                    </div>

                    {/* Sub-Grid Multiplier Status Bar (Exact match to Screenshots 1, 2, 3 & 4) */}
                    <div className="sub-grid-status-bar">
                        <button
                            type="button"
                            className="sub-bar-btn"
                            onClick={handleRepeat}
                            disabled={isPlaying}
                            title="Repeat Previous Pattern"
                        >
                            <span className="btn-icon">↺</span>
                            <span>Repeat</span>
                        </button>

                        <div className={`sub-bar-pill ${isPlaying && revealedTiles.length > 0 ? 'active-multiplier' : ''}`}>
                            {isPlaying && revealedTiles.length > 0 ? (
                                <div className="active-mult-pill-content">
                                    <span className="step-arrow-icon">→|</span>
                                    <span className="step-mult-val">{nextMultiplier.toFixed(2)}×</span>
                                </div>
                            ) : (
                                <div className="idle-mult-pill-content">
                                    <span>Max Multiplier</span>
                                    <span className="max-mult-val">
                                        {maxMultiplier >= 1000
                                            ? maxMultiplier.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            : maxMultiplier.toFixed(2)}×
                                    </span>
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            className="sub-bar-btn"
                            onClick={handleClear}
                            disabled={isPlaying}
                            title="Clear Selection"
                        >
                            <span>Clear</span>
                            <span className="btn-icon">↻</span>
                        </button>
                    </div>

                    {/* Primary Bet / Cashout Button (Placed right below sub-grid in mobile screenshot) */}
                    <div className="primary-action-container mobile-primary-btn-wrap">
                        {isPlaying ? (
                            <button
                                id="mines-cashout-btn"
                                className="amrat-primary-btn cashout-state"
                                onClick={cashout}
                                disabled={revealedTiles.length === 0}
                            >
                                <span>Cashout</span>
                                {revealedTiles.length > 0 && (
                                    <span className="cashout-profit-tag">
                                        {currencySymbol}{potentialWin.toFixed(2)}
                                    </span>
                                )}
                            </button>
                        ) : autoRunning ? (
                            <button
                                id="mines-stop-auto-btn"
                                className="amrat-primary-btn stop-auto-state"
                                onClick={stopAutoBet}
                            >
                                Stop Auto Bet
                            </button>
                        ) : (
                            <button
                                id="mines-bet-btn"
                                className="amrat-primary-btn bet-state"
                                onClick={mode === 'auto' ? startAutoBet : startGame}
                            >
                                {!user && !isDemoMode ? 'Sign In to Bet' : (mode === 'auto' ? 'Start Auto Bet' : 'Bet')}
                            </button>
                        )}
                    </div>
                </section>

                {/* 2. BETTING CONTROLS PANEL */}
                <section className="amrat-controls-panel">
                    {/* Bet Amount Row */}
                    <div className="control-form-group">
                        <div className="control-label-row">
                            <label className="control-label">Bet Amount</label>
                            <span className="fiat-reference-label">
                                ${((betAmount || 0) * (currency === 'INR' ? 0.012 : 1)).toFixed(2)}
                            </span>
                        </div>

                        <div className="amrat-input-compound">
                            <div className="input-field-wrap">
                                <input
                                    type="number"
                                    className="amrat-num-input"
                                    value={betAmount === 0 ? '' : betAmount}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value)
                                        setBetAmount(isNaN(val) ? 0 : Math.max(0, val))
                                    }}
                                    disabled={isPlaying || autoRunning}
                                    step="any"
                                    min="0"
                                    placeholder="0.00000000"
                                />
                                <div className="input-crypto-badge">
                                    <CurrencyIcon symbol={currencySymbol} currency={currency} size={18} fontSize={10} />
                                </div>
                            </div>

                            <div className="input-quick-actions">
                                <button
                                    type="button"
                                    className="quick-action-btn"
                                    onClick={handleBetAmountHalf}
                                    disabled={isPlaying || autoRunning}
                                >
                                    ½
                                </button>
                                <button
                                    type="button"
                                    className="quick-action-btn"
                                    onClick={handleBetAmountDouble}
                                    disabled={isPlaying || autoRunning}
                                >
                                    2×
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Random Pick Button (Screenshots 2 & 3) */}
                    <div className="control-form-group">
                        <button
                            type="button"
                            className="amrat-secondary-btn random-pick-btn"
                            onClick={pickRandom}
                            disabled={(!isPlaying && mode !== 'auto') || isRevealingRef.current}
                        >
                            Random Pick
                        </button>
                    </div>

                    {/* Mines & Gems Interactive Slider (Screenshots 2 & 3) */}
                    <div className="control-form-group">
                        <div className="slider-header-row">
                            <div className="slider-label-group">
                                <span className="label-title">Mines</span>
                                <span className="label-val-badge">{minesCount}</span>
                            </div>
                            <div className="slider-label-group right">
                                <span className="label-title">Gems</span>
                                <span className="label-val-badge">{25 - minesCount}</span>
                            </div>
                        </div>

                        <div className="amrat-slider-wrap">
                            <input
                                type="range"
                                min="1"
                                max="24"
                                step="1"
                                value={minesCount}
                                onChange={handleMinesChange}
                                disabled={isPlaying || autoRunning}
                                className="amrat-range-slider"
                                style={{
                                    background: `linear-gradient(to right, #1475e1 0%, #1475e1 ${((minesCount - 1) / 23) * 100}%, #0f212e ${((minesCount - 1) / 23) * 100}%, #0f212e 100%)`
                                }}
                            />
                        </div>
                    </div>

                    {/* Total Profit Display (Screenshots 2 & 3) */}
                    <div className="control-form-group">
                        <div className="control-label-row">
                            <label className="control-label">
                                Total Profit ({revealedTiles.length > 0 ? currentMultiplier.toFixed(2) : '1.00'}×)
                            </label>
                            <span className="fiat-reference-label">
                                ${((revealedTiles.length > 0 ? potentialWin - betAmount : 0) * (currency === 'INR' ? 0.012 : 1)).toFixed(2)}
                            </span>
                        </div>

                        <div className="amrat-readonly-display">
                            <input
                                type="text"
                                className="amrat-display-input"
                                value={revealedTiles.length > 0
                                    ? (potentialWin - betAmount).toFixed(8)
                                    : (0).toFixed(8)}
                                readOnly
                            />
                            <div className="display-crypto-badge">
                                <CurrencyIcon symbol={currencySymbol} currency={currency} size={18} fontSize={10} />
                            </div>
                        </div>
                    </div>

                    {/* Auto Mode Configuration (When Auto tab is active) */}
                    {mode === 'auto' && (
                        <div className="auto-mode-options-panel">
                            <div className="control-form-group">
                                <div className="control-label-row">
                                    <label className="control-label">Number of Bets</label>
                                    <span className="fiat-reference-label">{autoInfinite ? 'Infinite' : autoBetCount}</span>
                                </div>
                                <div className="amrat-input-compound">
                                    <input
                                        type="number"
                                        className="amrat-num-input"
                                        value={autoInfinite ? '∞' : autoBetCount}
                                        onChange={(e) => {
                                            setAutoInfinite(false)
                                            setAutoBetCount(Math.max(1, parseInt(e.target.value, 10) || 1))
                                        }}
                                        disabled={isPlaying || autoRunning}
                                    />
                                    <div className="input-quick-actions">
                                        <button
                                            type="button"
                                            className={`quick-action-btn ${autoBetCount === 10 && !autoInfinite ? 'active' : ''}`}
                                            onClick={() => { setAutoInfinite(false); setAutoBetCount(10) }}
                                        >
                                            10
                                        </button>
                                        <button
                                            type="button"
                                            className={`quick-action-btn ${autoBetCount === 100 && !autoInfinite ? 'active' : ''}`}
                                            onClick={() => { setAutoInfinite(false); setAutoBetCount(100) }}
                                        >
                                            100
                                        </button>
                                        <button
                                            type="button"
                                            className={`quick-action-btn ${autoInfinite ? 'active' : ''}`}
                                            onClick={() => setAutoInfinite(true)}
                                        >
                                            ∞
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Desktop Primary Bet Button (Sticky inside desktop sidebar) */}
                    <div className="desktop-primary-btn-wrap">
                        {isPlaying ? (
                            <button
                                className="amrat-primary-btn cashout-state"
                                onClick={cashout}
                                disabled={revealedTiles.length === 0}
                            >
                                <span>Cashout</span>
                                {revealedTiles.length > 0 && (
                                    <span className="cashout-profit-tag">
                                        {currencySymbol}{potentialWin.toFixed(2)}
                                    </span>
                                )}
                            </button>
                        ) : autoRunning ? (
                            <button
                                className="amrat-primary-btn stop-auto-state"
                                onClick={stopAutoBet}
                            >
                                Stop Auto Bet
                            </button>
                        ) : (
                            <button
                                className="amrat-primary-btn bet-state"
                                onClick={mode === 'auto' ? startAutoBet : startGame}
                            >
                                {!user && !isDemoMode ? 'Sign In to Bet' : (mode === 'auto' ? 'Start Auto Bet' : 'Bet')}
                            </button>
                        )}
                    </div>

                    {/* Manual | Auto Segmented Control (Screenshots 2 & 3) */}
                    <div className="mode-segmented-tabs">
                        <button
                            type="button"
                            className={`mode-tab-btn ${mode === 'manual' ? 'active' : ''}`}
                            onClick={() => { if (!isPlaying && !autoRunning) setMode('manual') }}
                        >
                            Manual
                        </button>
                        <button
                            type="button"
                            className={`mode-tab-btn ${mode === 'auto' ? 'active' : ''}`}
                            onClick={() => { if (!isPlaying && !autoRunning) setMode('auto') }}
                        >
                            Auto
                        </button>
                    </div>

                    {/* Tools & Provably Fair Row (Screenshot 3) */}
                    <div className="tools-fairness-bar">
                        <div className="left-tool-icons">
                            <Tooltip title="Audio & Game Settings">
                                <button className="tool-icon-btn" onClick={() => setSettingsModalOpen(true)}>
                                    <SettingOutlined />
                                </button>
                            </Tooltip>
                            <Tooltip title="Live Statistics">
                                <button className="tool-icon-btn" onClick={() => setStatsDrawerOpen(true)}>
                                    <LineChartOutlined />
                                </button>
                            </Tooltip>
                        </div>

                        <button className="fairness-pill-btn" onClick={() => setFairnessModalOpen(true)}>
                            <SafetyCertificateOutlined style={{ color: '#00e701' }} />
                            <span>Fairness</span>
                        </button>
                    </div>

                    {/* Originals Community Info Card (Screenshot 3) */}
                    <div className="originals-community-card">
                        <div className="card-brand-info">
                            <div className="originals-badge-square">
                                <span>Amrat</span>
                            </div>
                            <div className="originals-text-meta">
                                <div className="meta-title">Amrat Originals</div>
                                <div className="meta-followers">{(followersCount / 1000).toFixed(2)}K Followers</div>
                            </div>
                        </div>

                        <button
                            type="button"
                            className={`favorite-heart-btn ${isFavorite ? 'favorited' : ''}`}
                            onClick={toggleFavorite}
                            title="Add to Favourites"
                        >
                            {isFavorite ? <HeartFilled style={{ color: '#ef4444' }} /> : <HeartOutlined />}
                        </button>
                    </div>
                </section>
            </div>

            {/* Platform Recent Bets & Live History */}
            <GameBottomHistory gameKey="mines" />

            {/* Provably Fair Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
                        <SafetyCertificateOutlined style={{ color: '#00e701', fontSize: 18 }} />
                        <span style={{ fontWeight: 800 }}>Provably Fair Verification</span>
                    </div>
                }
                open={fairnessModalOpen}
                onCancel={() => setFairnessModalOpen(false)}
                footer={null}
                width={480}
                centered
                styles={{ content: { background: '#1a2c38', padding: '24px', borderRadius: 16 } }}
            >
                <div className="fairness-modal-body">
                    <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
                        Each round uses HMAC-SHA256 with an unalterable server seed hash and client seed to guarantee cryptographic fairness.
                    </p>

                    <div className="fairness-field-block">
                        <label className="field-caption">Active Server Seed (SHA-256 Hash)</label>
                        <div className="field-hash-box">
                            <code>{fairnessData.serverSeedHash}</code>
                        </div>
                    </div>

                    <div className="fairness-field-block">
                        <label className="field-caption">Client Seed</label>
                        <div className="field-input-row">
                            <input
                                type="text"
                                className="fairness-text-input"
                                value={clientSeedInput}
                                onChange={(e) => setClientSeedInput(e.target.value)}
                            />
                            <button className="fairness-action-btn" onClick={handleChangeClientSeed}>
                                Save
                            </button>
                            <button className="fairness-action-btn" onClick={handleRotateSeed} title="Rotate Client Seed">
                                <RedoOutlined />
                            </button>
                        </div>
                    </div>

                    <div className="fairness-field-block">
                        <label className="field-caption">Active Nonce</label>
                        <div className="field-hash-box">
                            <code>{fairnessData.nonce}</code>
                        </div>
                    </div>

                    {revealedSeed && (
                        <div className="fairness-field-block" style={{ marginTop: 14 }}>
                            <label className="field-caption" style={{ color: '#00e701' }}>Previous Round Server Seed (Revealed)</label>
                            <div className="field-hash-box">
                                <code style={{ color: '#00e701' }}>{revealedSeed.serverSeed}</code>
                            </div>
                        </div>
                    )}

                    <button
                        className="amrat-secondary-btn"
                        style={{ width: '100%', marginTop: 18 }}
                        onClick={() => {
                            setFairnessModalOpen(false)
                            setVerifierOpen(true)
                        }}
                    >
                        Open Calculation Verifier
                    </button>
                </div>
            </Modal>

            {/* Provably Fair Verifier Modal */}
            <ProvablyFairVerifierModal
                open={verifierOpen}
                onClose={() => setVerifierOpen(false)}
                initialData={{
                    game: 'mines',
                    serverSeed: revealedSeed?.serverSeed || '',
                    clientSeed: fairnessData.clientSeed,
                    nonce: fairnessData.nonce,
                    minesCount
                }}
            />

            {/* Live Stats Modal */}
            <Modal
                title={<span style={{ color: '#fff', fontWeight: 800 }}>Live Session Statistics</span>}
                open={statsDrawerOpen}
                onCancel={() => setStatsDrawerOpen(false)}
                footer={null}
                width={420}
                centered
                styles={{ content: { background: '#1a2c38', padding: '24px', borderRadius: 16 } }}
            >
                <div className="stats-modal-body">
                    <div className="stats-metric-row">
                        <div className="metric-box">
                            <span className="metric-title">Wins</span>
                            <span className="metric-value win">{winsCount}</span>
                        </div>
                        <div className="metric-box">
                            <span className="metric-title">Losses</span>
                            <span className="metric-value loss">{lossesCount}</span>
                        </div>
                        <div className="metric-box">
                            <span className="metric-title">Net Profit</span>
                            <span className={`metric-value ${totalProfit >= 0 ? 'win' : 'loss'}`}>
                                {totalProfit >= 0 ? '+' : ''}{currencySymbol}{totalProfit.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <div className="stats-chart-wrap">
                        <canvas ref={chartCanvasRef} />
                    </div>
                </div>
            </Modal>

            {/* Settings Modal */}
            <Modal
                title={<span style={{ color: '#fff', fontWeight: 800 }}>Game Settings</span>}
                open={settingsModalOpen}
                onCancel={() => setSettingsModalOpen(false)}
                footer={null}
                width={360}
                centered
                styles={{ content: { background: '#1a2c38', padding: '24px', borderRadius: 16 } }}
            >
                <div className="settings-list">
                    <div className="settings-row">
                        <span className="setting-label">Sound Effects</span>
                        <input
                            type="checkbox"
                            checked={soundEnabled}
                            onChange={(e) => {
                                const next = e.target.checked
                                setSoundEnabled(next)
                                casinoAudio.setMuted(!next)
                            }}
                        />
                    </div>
                    <div className="settings-row">
                        <span className="setting-label">Fast Animations (Turbo)</span>
                        <input
                            type="checkbox"
                            checked={fastMode}
                            onChange={(e) => setFastMode(e.target.checked)}
                        />
                    </div>
                    <div className="settings-row">
                        <span className="setting-label">Spacebar Hotkey</span>
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>Enabled (Bet / Cashout)</span>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default MinesGame
