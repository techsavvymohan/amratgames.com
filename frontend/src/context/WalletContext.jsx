import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from './AuthContext'

const WalletContext = createContext(null)

export const CURRENCIES = {
    INR: {
        id: 'INR',
        symbol: '₹',
        name: 'Indian Rupee',
        flag: '🇮🇳',
        initial: 100.00, // ₹100 Free Welcome Bonus for every new player
        presets: [300, 500, 1000, 2500, 5000],
        minBet: 10,
        maxBet: 100000,
        step: 50,
        paymentMethods: 'UPI · NetBanking · IMPS · Paytm · GPay',
    },
    BTC: {
        id: 'BTC',
        symbol: '₿',
        name: 'Bitcoin Crypto',
        flag: '₿',
        initial: 0.00,
        presets: [100, 500, 1000, 5000],
        minBet: 1,
        maxBet: 10000,
        step: 10,
        paymentMethods: 'BTC Lightning · Layer 1 Network',
    },
    USDT: {
        id: 'USDT',
        symbol: '₮',
        name: 'USDT Tether',
        flag: '₮',
        initial: 0.00,
        presets: [100, 500, 1000, 5000],
        minBet: 1,
        maxBet: 10000,
        step: 10,
        paymentMethods: 'TRC20 · ERC20 · Polygon',
    },
    AMRAT: {
        id: 'AMRAT',
        symbol: '👑',
        name: 'Amrat Royal Token ($AMRAT)',
        flag: '👑',
        initial: 0.00,
        presets: [100, 250, 500, 1000, 2500],
        minBet: 10,
        maxBet: 50000,
        step: 50,
        paymentMethods: 'Royal Staking · Loyalty Airdrops · VIP Yield',
    }
}

const STORAGE_KEY_BALANCE = 'amrat_wallet_balance'
const STORAGE_KEY_CURRENCY = 'amrat_currency'

function getStoredCurrency() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_CURRENCY)
        if (stored && CURRENCIES[stored]) return stored
    } catch (e) { /* ignore */ }
    return 'INR' // Default to INR for Indian target audience
}

function getStoredBalance(currencyId) {
    try {
        const stored = localStorage.getItem(`${STORAGE_KEY_BALANCE}_${currencyId}`)
        if (stored !== null) {
            const parsed = parseFloat(stored)
            if (isNaN(parsed) || parsed >= 50000) {
                // Wipe legacy demo balances
                const clean = CURRENCIES[currencyId]?.initial ?? 100.00
                localStorage.setItem(`${STORAGE_KEY_BALANCE}_${currencyId}`, clean.toString())
                return clean
            }
            return parsed
        }
    } catch (e) { /* ignore */ }
    return CURRENCIES[currencyId]?.initial ?? 100.00
}

export function WalletProvider({ children }) {
    const authContext = useAuth()
    const user = authContext?.user
    const token = authContext?.token

    const [currency, setCurrencyState] = useState(getStoredCurrency)
    const [balance, setBalance] = useState(() => {
        if (!user) return 0.00
        return getStoredBalance(getStoredCurrency())
    })
    const [totalDeposited, setTotalDeposited] = useState(0)
    const [totalWagered, setTotalWagered] = useState(0)
    const [requiredTurnover, setRequiredTurnover] = useState(0)
    const [remainingTurnover, setRemainingTurnover] = useState(0)
    const balanceRef = useRef(balance)
    const currencyRef = useRef(currency)
    const [transactions, setTransactions] = useState([])
    const [userWithdrawals, setUserWithdrawals] = useState([])

    // Fetch user's submitted withdrawal requests
    const refreshWithdrawals = useCallback(async () => {
        if (!token) return
        try {
            const res = await fetch('/api/wallet/withdrawals', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success && Array.isArray(data.withdrawals)) {
                setUserWithdrawals(data.withdrawals)
            }
        } catch {
            // non-fatal
        }
    }, [token])

    // Fetch user's transaction history from server
    const refreshTransactions = useCallback(async () => {
        if (!token) return
        try {
            const res = await fetch('/api/wallet/transactions', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success && Array.isArray(data.transactions)) {
                setTransactions(data.transactions)
            }
        } catch {
            // non-fatal
        }
    }, [token])

    // Fetch live balance and AML turnover rollover status
    const refreshBalance = useCallback(async () => {
        if (!token) return
        try {
            const res = await fetch('/api/wallet/balance', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) {
                if (data.balances?.[currencyRef.current] !== undefined) {
                    const rounded = parseFloat(data.balances[currencyRef.current].toFixed(2))
                    balanceRef.current = rounded
                    setBalance(rounded)
                    try {
                        localStorage.setItem(`${STORAGE_KEY_BALANCE}_${currencyRef.current}`, rounded.toString())
                    } catch { /* ignore */ }
                }
                if (typeof data.totalDeposited === 'number') {
                    setTotalDeposited(data.totalDeposited)
                }
                if (typeof data.totalWagered === 'number') {
                    setTotalWagered(data.totalWagered)
                }
                if (typeof data.requiredTurnover === 'number') {
                    setRequiredTurnover(data.requiredTurnover)
                }
                if (typeof data.remainingTurnover === 'number') {
                    setRemainingTurnover(data.remainingTurnover)
                }
            }
        } catch {
            // non-fatal
        }
    }, [token])

    // Synchronize balance and deposit stats from authenticated user record
    useEffect(() => {
        if (user && user.balances) {
            const userBal = user.balances[currencyRef.current]
            if (userBal !== undefined && typeof userBal === 'number') {
                let rounded = parseFloat(userBal.toFixed(2))
                if (rounded >= 50000) rounded = 100.00
                balanceRef.current = rounded
                setBalance(rounded)
                try {
                    localStorage.setItem(`${STORAGE_KEY_BALANCE}_${currencyRef.current}`, rounded.toString())
                } catch { /* ignore */ }
            }
            if (typeof user.totalDeposited === 'number') {
                setTotalDeposited(user.totalDeposited)
            }
            if (typeof user.totalWagered === 'number') {
                setTotalWagered(user.totalWagered)
                setRequiredTurnover(user.totalDeposited || 0)
                setRemainingTurnover(Math.max(0, (user.totalDeposited || 0) - user.totalWagered))
            }
        } else if (!user) {
            balanceRef.current = 0.00
            setBalance(0.00)
            setTransactions([])
        }
        if (token) {
            refreshBalance()
            refreshWithdrawals()
            refreshTransactions()
        }
    }, [user, currency, token, refreshBalance, refreshWithdrawals, refreshTransactions])

    // Toast system
    const [toasts, setToasts] = useState([])
    const toastIdRef = useRef(0)

    const currencyConfig = CURRENCIES[currency] || CURRENCIES.INR
    const currencySymbol = currencyConfig.symbol

    const setCurrency = useCallback((newCurr) => {
        if (!CURRENCIES[newCurr]) return
        currencyRef.current = newCurr
        setCurrencyState(newCurr)
        try { localStorage.setItem(STORAGE_KEY_CURRENCY, newCurr) } catch (e) { /* ignore */ }

        // Load balance for that currency (prefer user balance if logged in)
        let curBal = getStoredBalance(newCurr)
        if (user && user.balances && user.balances[newCurr] !== undefined) {
            let uBal = parseFloat(user.balances[newCurr].toFixed(2))
            if (uBal >= 50000) uBal = 100.00
            curBal = uBal
        }
        balanceRef.current = curBal
        setBalance(curBal)
    }, [user])

    const showToast = useCallback((type, title, description, duration = 1800) => {
        const id = ++toastIdRef.current
        setToasts(prev => {
            // Keep at most 1 active toast so notifications never stack into a wall
            const trimmed = prev.slice(-1)
            return [...trimmed, { id, type, title, description }]
        })
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, duration)
    }, [])

    const setStoredBalance = useCallback((nextBalance) => {
        const rounded = parseFloat(nextBalance.toFixed(2))
        balanceRef.current = rounded
        setBalance(rounded)
        try {
            localStorage.setItem(`${STORAGE_KEY_BALANCE}_${currencyRef.current}`, rounded.toString())
        } catch (e) { /* ignore */ }
        return rounded
    }, [])

    // Update balance and persist to localStorage
    const updateBalance = useCallback((newBalance) => {
        setStoredBalance(newBalance)
    }, [setStoredBalance])

    // Place a bet (deduct from balance)
    const placeBet = useCallback((amount) => {
        if (!user) {
            authContext?.openAuthModal?.('register')
            return false
        }
        const amt = parseFloat(amount)
        if (isNaN(amt) || amt <= 0 || amt > balanceRef.current) return false

        const newBal = setStoredBalance(balanceRef.current - amt)
        setTransactions(txs => [{
            id: Date.now(),
            type: 'bet',
            currency: currencyRef.current,
            symbol: CURRENCIES[currencyRef.current].symbol,
            amount: -amt,
            balance: newBal,
            timestamp: new Date(),
        }, ...txs].slice(0, 100))

        return true
    }, [user, authContext, setStoredBalance])

    // Add winnings to balance
    const addWinnings = useCallback((amount) => {
        const amt = parseFloat(amount)
        if (isNaN(amt) || amt <= 0) return

        const newBal = setStoredBalance(balanceRef.current + amt)
        setTransactions(txs => [{
            id: Date.now(),
            type: 'win',
            currency: currencyRef.current,
            symbol: CURRENCIES[currencyRef.current].symbol,
            amount: amt,
            balance: newBal,
            timestamp: new Date(),
        }, ...txs].slice(0, 100))
    }, [setStoredBalance])

    // Record game round with backend (authenticated only)
    const recordGameRound = useCallback(async ({ game, gameName, betAmount, multiplier = 0, won = false, ...extra }) => {
        if (!user) {
            authContext?.openAuthModal?.('register')
            return null
        }
        try {
            const headers = { 'Content-Type': 'application/json' }
            if (token) {
                headers.Authorization = `Bearer ${token}`
            }
            const res = await fetch('/api/games/bet', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    game,
                    gameName,
                    currency: currencyRef.current,
                    betAmount,
                    multiplier,
                    won,
                    ...extra
                })
            })
            const data = await res.json()
            if (data.success && data.balances) {
                const updatedBal = data.balances[currencyRef.current]
                if (typeof updatedBal === 'number') {
                    setStoredBalance(updatedBal)
                }
            }
            return data
        } catch {
            return null
        }
    }, [user, authContext, token, setStoredBalance])

    // Execute server-authoritative bet (single-round games: Limbo, Plinko, Dragon Tiger, Color Match, Coin Toss)
    const executeGameBet = useCallback(async (betPayload) => {
        if (!user) {
            authContext?.openAuthModal?.('register')
            return { success: false, code: 'AUTH_REQUIRED', error: 'Please create an account or sign in to play' }
        }
        try {
            const headers = { 'Content-Type': 'application/json' }
            if (token) {
                headers.Authorization = `Bearer ${token}`
            }
            const res = await fetch('/api/games/bet', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    currency: currencyRef.current,
                    ...betPayload
                })
            })
            const data = await res.json()
            if (data.success) {
                if (data.balances) {
                    const updatedBal = data.balances[currencyRef.current]
                    if (typeof updatedBal === 'number') {
                        setStoredBalance(updatedBal)
                    }
                } else {
                    const parsedBet = parseFloat(betPayload.betAmount) || 0
                    const payout = parseFloat(data.payout ?? data.evaluation?.payout) || 0
                    setStoredBalance(Math.max(0, balanceRef.current - parsedBet + payout))
                }
            }
            return data
        } catch (err) {
            return { success: false, error: err.message }
        }
    }, [user, authContext, token, setStoredBalance])

    // Server-Authoritative Mines Lifecycle Methods
    const startMinesRound = useCallback(async ({ betAmount, minesCount }) => {
        if (!user) {
            authContext?.openAuthModal?.('register')
            return { success: false, code: 'AUTH_REQUIRED', error: 'Please create an account or sign in to play' }
        }
        try {
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch('/api/games/mines/start', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    betAmount,
                    minesCount,
                    currency: currencyRef.current
                })
            })
            const data = await res.json()
            if (data.success) {
                if (data.balances) {
                    const updatedBal = data.balances[currencyRef.current]
                    if (typeof updatedBal === 'number') setStoredBalance(updatedBal)
                } else {
                    const parsedBet = parseFloat(betAmount) || 0
                    setStoredBalance(Math.max(0, balanceRef.current - parsedBet))
                }
            }
            return data
        } catch (err) {
            return { success: false, error: err.message }
        }
    }, [user, authContext, token, setStoredBalance])

    const revealMinesTile = useCallback(async ({ roundId, tileIndex }) => {
        try {
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch('/api/games/mines/reveal', {
                method: 'POST',
                headers,
                body: JSON.stringify({ roundId, tileIndex })
            })
            const data = await res.json()
            if (data.success) {
                if (data.balances) {
                    const updatedBal = data.balances[currencyRef.current]
                    if (typeof updatedBal === 'number') setStoredBalance(updatedBal)
                } else if (data.autoWin && data.payout > 0) {
                    const payout = parseFloat(data.payout) || 0
                    setStoredBalance(balanceRef.current + payout)
                }
            }
            return data
        } catch (err) {
            return { success: false, error: err.message }
        }
    }, [token, setStoredBalance])

    const cashoutMinesRound = useCallback(async ({ roundId }) => {
        try {
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch('/api/games/mines/cashout', {
                method: 'POST',
                headers,
                body: JSON.stringify({ roundId })
            })
            const data = await res.json()
            if (data.success) {
                if (data.balances) {
                    const updatedBal = data.balances[currencyRef.current]
                    if (typeof updatedBal === 'number') setStoredBalance(updatedBal)
                } else {
                    const payout = parseFloat(data.payout) || 0
                    setStoredBalance(balanceRef.current + payout)
                }
            }
            return data
        } catch (err) {
            return { success: false, error: err.message }
        }
    }, [token, setStoredBalance])

    const getActiveMinesRound = useCallback(async () => {
        try {
            const headers = {}
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch('/api/games/mines/active', { headers })
            const data = await res.json()
            return data.activeRound || null
        } catch {
            return null
        }
    }, [token])

    // Server-Authoritative Crash Lifecycle Methods
    const startCrashRound = useCallback(async ({ betAmount, autoCashout }) => {
        if (!user) {
            authContext?.openAuthModal?.('register')
            return { success: false, code: 'AUTH_REQUIRED', error: 'Please create an account or sign in to play' }
        }
        try {
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch('/api/games/crash/start', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    betAmount,
                    autoCashout,
                    currency: currencyRef.current
                })
            })
            const data = await res.json()
            if (data.success) {
                if (data.balances) {
                    const updatedBal = data.balances[currencyRef.current]
                    if (typeof updatedBal === 'number') setStoredBalance(updatedBal)
                } else {
                    const parsedBet = parseFloat(betAmount) || 0
                    setStoredBalance(Math.max(0, balanceRef.current - parsedBet))
                }
            }
            return data
        } catch (err) {
            return { success: false, error: err.message }
        }
    }, [user, authContext, token, setStoredBalance])

    const cashoutCrashRound = useCallback(async ({ roundId, multiplier }) => {
        try {
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch('/api/games/crash/cashout', {
                method: 'POST',
                headers,
                body: JSON.stringify({ roundId, multiplier })
            })
            const data = await res.json()
            if (data.success) {
                if (data.balances) {
                    const updatedBal = data.balances[currencyRef.current]
                    if (typeof updatedBal === 'number') setStoredBalance(updatedBal)
                } else if (data.won && data.payout > 0) {
                    const payout = parseFloat(data.payout) || 0
                    setStoredBalance(balanceRef.current + payout)
                }
            }
            return data
        } catch (err) {
            return { success: false, error: err.message }
        }
    }, [token, setStoredBalance])

    const bustCrashRound = useCallback(async ({ roundId }) => {
        try {
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch('/api/games/crash/bust', {
                method: 'POST',
                headers,
                body: JSON.stringify({ roundId })
            })
            const data = await res.json()
            if (data.success && data.balances) {
                const updatedBal = data.balances[currencyRef.current]
                if (typeof updatedBal === 'number') setStoredBalance(updatedBal)
            }
            return data
        } catch (err) {
            return { success: false, error: err.message }
        }
    }, [token, setStoredBalance])

    const getActiveCrashRound = useCallback(async () => {
        try {
            const headers = {}
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch('/api/games/crash/active', { headers })
            const data = await res.json()
            return data.activeRound || null
        } catch {
            return null
        }
    }, [token])

    // Server-Authoritative Dino Runner Lifecycle Methods
    const startDinoRound = useCallback(async ({ betAmount, difficulty = 'medium' }) => {
        if (!user) {
            authContext?.openAuthModal?.('register')
            return { success: false, code: 'AUTH_REQUIRED', error: 'Please create an account or sign in to play Dino Run' }
        }
        try {
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch('/api/games/dino/start', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    betAmount,
                    difficulty,
                    currency: currencyRef.current
                })
            })
            const data = await res.json()
            if (data.success && data.balances) {
                const updatedBal = data.balances[currencyRef.current]
                if (typeof updatedBal === 'number') setStoredBalance(updatedBal)
            }
            return data
        } catch (err) {
            return { success: false, error: err.message }
        }
    }, [user, authContext, token, setStoredBalance])

    const jumpDinoRound = useCallback(async ({ roundId }) => {
        try {
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch('/api/games/dino/jump', {
                method: 'POST',
                headers,
                body: JSON.stringify({ roundId })
            })
            const data = await res.json()
            if (data.success && data.balances) {
                const updatedBal = data.balances[currencyRef.current]
                if (typeof updatedBal === 'number') setStoredBalance(updatedBal)
            }
            return data
        } catch (err) {
            return { success: false, error: err.message }
        }
    }, [token, setStoredBalance])

    const cashoutDinoRound = useCallback(async ({ roundId }) => {
        try {
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch('/api/games/dino/cashout', {
                method: 'POST',
                headers,
                body: JSON.stringify({ roundId })
            })
            const data = await res.json()
            if (data.success && data.balances) {
                const updatedBal = data.balances[currencyRef.current]
                if (typeof updatedBal === 'number') setStoredBalance(updatedBal)
            }
            return data
        } catch (err) {
            return { success: false, error: err.message }
        }
    }, [token, setStoredBalance])

    const bustDinoRound = useCallback(async ({ roundId }) => {
        try {
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch('/api/games/dino/bust', {
                method: 'POST',
                headers,
                body: JSON.stringify({ roundId })
            })
            const data = await res.json()
            if (data.success && data.balances) {
                const updatedBal = data.balances[currencyRef.current]
                if (typeof updatedBal === 'number') setStoredBalance(updatedBal)
            }
            return data
        } catch (err) {
            return { success: false, error: err.message }
        }
    }, [token, setStoredBalance])

    const getActiveDinoRound = useCallback(async () => {
        try {
            const headers = {}
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch('/api/games/dino/active', { headers })
            const data = await res.json()
            return data.activeRound || null
        } catch {
            return null
        }
    }, [token])

    // Multiplayer Synchronized Crash Room Methods
    const placeRoomCrashBet = useCallback(async ({ betAmount, autoCashout }) => {
        if (!user) {
            authContext?.openAuthModal?.('register')
            return { success: false, code: 'AUTH_REQUIRED', error: 'Please create an account or sign in to play' }
        }
        try {
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch('/api/games/crash/room/bet', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    betAmount,
                    autoCashout,
                    currency: currencyRef.current
                })
            })
            const data = await res.json()
            if (data.success && data.balances) {
                const updatedBal = data.balances[currencyRef.current]
                if (typeof updatedBal === 'number') setStoredBalance(updatedBal)
            }
            return data
        } catch (err) {
            return { success: false, error: err.message }
        }
    }, [user, authContext, token, setStoredBalance])

    const cashoutRoomCrash = useCallback(async () => {
        try {
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch('/api/games/crash/room/cashout', {
                method: 'POST',
                headers,
                body: JSON.stringify({})
            })
            const data = await res.json()
            if (data.success && data.balances) {
                const updatedBal = data.balances[currencyRef.current]
                if (typeof updatedBal === 'number') setStoredBalance(updatedBal)
            }
            return data
        } catch (err) {
            return { success: false, error: err.message }
        }
    }, [token, setStoredBalance])

    const getRoomCrashState = useCallback(async () => {
        try {
            const res = await fetch('/api/games/crash/room/state')
            const data = await res.json()
            return data.room || null
        } catch {
            return null
        }
    }, [])

    // VIP Loyalty Engine Methods
    const getVipStatus = useCallback(async () => {
        try {
            if (!token) return null
            const res = await fetch('/api/vip/status', {
                headers: { Authorization: `Bearer ${token}` }
            })
            return await res.json()
        } catch {
            return null
        }
    }, [token])

    const claimVipRakeback = useCallback(async () => {
        try {
            if (!token) return { success: false, error: 'Sign in required' }
            const res = await fetch('/api/vip/claim-rakeback', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success && typeof data.newBalance === 'number') {
                setStoredBalance(data.newBalance)
            }
            return data
        } catch (err) {
            return { success: false, error: err.message }
        }
    }, [token, setStoredBalance])

    // Affiliate Referral Flywheel Methods
    const getAffiliateStats = useCallback(async () => {
        try {
            if (!token) return null
            const res = await fetch('/api/affiliate/stats', {
                headers: { Authorization: `Bearer ${token}` }
            })
            return await res.json()
        } catch {
            return null
        }
    }, [token])

    const claimAffiliateCommission = useCallback(async () => {
        try {
            if (!token) return { success: false, error: 'Sign in required' }
            const res = await fetch('/api/affiliate/claim', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success && typeof data.newBalance === 'number') {
                setStoredBalance(data.newBalance)
            }
            return data
        } catch (err) {
            return { success: false, error: err.message }
        }
    }, [token, setStoredBalance])

    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
    const [walletModalTab, setWalletModalTab] = useState('deposit')

    const openWalletModal = useCallback((tab = 'deposit') => {
        setWalletModalTab(tab)
        setIsWalletModalOpen(true)
    }, [])

    const closeWalletModal = useCallback(() => {
        setIsWalletModalOpen(false)
    }, [])

    // Deposit funds (Supports custom INR amount, UPI, and 12-digit UTR)
    const deposit = useCallback(async (amount, options = {}) => {
        const amt = parseFloat(amount)
        if (isNaN(amt) || amt <= 0) return

        const method = typeof options === 'string' ? options : (options.method || 'UPI')
        const utrNumber = typeof options === 'object' && options.utrNumber ? options.utrNumber : ''

        if (token) {
            try {
                const res = await fetch('/api/wallet/deposit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        currency: currencyRef.current,
                        amount: amt,
                        paymentMethod: method,
                        utrNumber
                    })
                })
                const data = await res.json()
                if (data.success) {
                    if (data.status === 'pending') {
                        // Deposit is queued for cashier verification
                        setTransactions(txs => [{
                            id: data.depositId || Date.now(),
                            type: 'deposit',
                            status: 'pending',
                            currency: currencyRef.current,
                            symbol: CURRENCIES[currencyRef.current].symbol,
                            amount: amt,
                            balance: balanceRef.current,
                            note: utrNumber ? `Deposit (UTR: ${utrNumber}) [Pending Review]` : 'Deposit [Pending Review]',
                            timestamp: new Date()
                        }, ...txs].slice(0, 100))
                        return data
                    }
                    if (data.balances?.[currencyRef.current] !== undefined) {
                        setStoredBalance(data.balances[currencyRef.current])
                    }
                    if (typeof data.totalDeposited === 'number') {
                        setTotalDeposited(data.totalDeposited)
                    }
                    return data
                } else {
                    throw new Error(data.error || 'Failed to submit deposit request')
                }
            } catch (err) {
                console.error('[WALLET] Deposit error:', err)
                throw err
            }
        } else {
            // Guest practice balance refill
            const newBal = setStoredBalance(balanceRef.current + amt)
            setTransactions(txs => [{
                id: Date.now(),
                type: 'deposit',
                currency: currencyRef.current,
                symbol: CURRENCIES[currencyRef.current].symbol,
                amount: amt,
                balance: newBal,
                note: 'Virtual Practice Refill',
                timestamp: new Date()
            }, ...txs].slice(0, 100))
            showToast('success', 'Practice Balance Refilled', `+${currencySymbol}${amt.toLocaleString('en-IN')} added to practice wallet`)
            return { success: true, balance: newBal }
        }
    }, [setStoredBalance, token, currencySymbol, showToast])

    // Withdraw funds (Enforces ₹300 minimum deposit condition)
    const withdraw = useCallback(async (amount, payoutDestination, options = {}) => {
        const amt = parseFloat(amount)
        if (isNaN(amt) || amt <= 0) {
            showToast('error', 'Invalid Amount', 'Please enter a valid amount to withdraw')
            throw new Error('Please enter a valid withdrawal amount')
        }

        if (totalDeposited < 300) {
            const needed = 300 - totalDeposited
            const msg = `Minimum deposit of ₹300 required before requesting withdrawal. You have deposited ₹${totalDeposited}. Please deposit ₹${needed} more to activate withdrawals.`
            showToast('error', 'Deposit Required', msg)
            throw new Error(msg)
        }

        if (amt > balanceRef.current) {
            showToast('error', 'Insufficient Balance', `Your current balance is ${currencySymbol}${balanceRef.current.toFixed(2)}`)
            throw new Error('Insufficient wallet balance')
        }

        let newBal = balanceRef.current - amt
        let data = null

        if (token) {
            const res = await fetch('/api/wallet/withdraw', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    currency: currencyRef.current,
                    amount: amt,
                    payoutDestination: payoutDestination || 'Registered UPI / Bank',
                    payoutMethod: options.payoutMethod || 'UPI',
                    bankDetails: options.bankDetails || null
                })
            })
            data = await res.json()
            if (!res.ok || !data.success) {
                const err = data.error || 'Failed to submit withdrawal request'
                showToast('error', 'Withdrawal Rejected', err)
                throw new Error(err)
            }
            if (data.withdrawal) {
                setUserWithdrawals(prev => [data.withdrawal, ...prev.filter(w => w.id !== data.withdrawal.id)])
            }
            if (data.balances?.[currencyRef.current] !== undefined) {
                newBal = setStoredBalance(data.balances[currencyRef.current])
            } else {
                newBal = setStoredBalance(balanceRef.current - amt)
            }
        } else {
            newBal = setStoredBalance(balanceRef.current - amt)
        }

        setTransactions(txs => [{
            id: Date.now(),
            type: 'withdrawal',
            currency: currencyRef.current,
            symbol: CURRENCIES[currencyRef.current].symbol,
            amount: -amt,
            balance: newBal,
            payoutDestination,
            status: 'pending',
            timestamp: new Date(),
        }, ...txs].slice(0, 100))

        showToast('success', 'Withdrawal Requested', `Withdrawal for ${currencySymbol}${amt.toLocaleString('en-IN')} has been submitted!`)
        return { success: true, balance: newBal, withdrawal: data?.withdrawal }
    }, [totalDeposited, token, setStoredBalance, currencySymbol, showToast])

    const notifyWin = useCallback((amount, mult) => {
        const multText = mult ? ` (${Number(mult).toFixed(2)}x)` : ''
        showToast('win', 'Won', `+${currencySymbol}${Number(amount || 0).toFixed(2)}${multText}`, 2000)
    }, [showToast, currencySymbol])

    const notifyLoss = useCallback((amount) => {
        showToast('loss', 'Loss', `-${currencySymbol}${Number(amount || 0).toFixed(2)}`, 1400)
    }, [showToast, currencySymbol])

    const value = {
        balance,
        currency,
        currencySymbol,
        currencyConfig,
        depositPresets: currencyConfig.presets,
        setCurrency,
        transactions,
        withdrawals: userWithdrawals,
        refreshWithdrawals,
        refreshTransactions,
        placeBet,
        addWinnings,
        deposit,
        withdraw,
        totalDeposited,
        totalWagered,
        requiredTurnover,
        remainingTurnover,
        minDepositRequired: 300,
        canWithdraw: totalDeposited >= 300 && totalWagered >= totalDeposited,
        refreshBalance,
        updateBalance,
        recordGameRound,
        executeGameBet,
        startMinesRound,
        revealMinesTile,
        cashoutMinesRound,
        getActiveMinesRound,
        startCrashRound,
        cashoutCrashRound,
        bustCrashRound,
        getActiveCrashRound,
        startDinoRound,
        jumpDinoRound,
        cashoutDinoRound,
        bustDinoRound,
        getActiveDinoRound,
        placeRoomCrashBet,
        cashoutRoomCrash,
        getRoomCrashState,
        getVipStatus,
        claimVipRakeback,
        getAffiliateStats,
        claimAffiliateCommission,
        notifyWin,
        notifyLoss,
        toasts,
        showToast,
        isWalletModalOpen,
        walletModalTab,
        openWalletModal,
        closeWalletModal,
    }

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    )
}

export function useWallet() {
    const context = useContext(WalletContext)
    if (!context) {
        throw new Error('useWallet must be used within a WalletProvider')
    }
    return context
}

export default WalletContext
