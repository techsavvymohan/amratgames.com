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
    const [balance, setBalance] = useState(() => getStoredBalance(getStoredCurrency()))
    const [totalDeposited, setTotalDeposited] = useState(0)
    const balanceRef = useRef(balance)
    const currencyRef = useRef(currency)
    const [transactions, setTransactions] = useState([])

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
        }
    }, [user, currency])

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

    const showToast = useCallback((type, title, description, duration = 3000) => {
        const id = ++toastIdRef.current
        setToasts(prev => [...prev, { id, type, title, description }])
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
    }, [setStoredBalance])

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

    // Record game round with backend (authenticated or guest)
    const recordGameRound = useCallback(async ({ game, gameName, betAmount, multiplier = 0, won = false }) => {
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
                    won
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

        let newBal = balanceRef.current + amt

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
                    if (data.balances?.[currencyRef.current] !== undefined) {
                        newBal = setStoredBalance(data.balances[currencyRef.current])
                    } else {
                        newBal = setStoredBalance(balanceRef.current + amt)
                    }
                    if (typeof data.totalDeposited === 'number') {
                        setTotalDeposited(data.totalDeposited)
                    }
                }
            } catch {
                newBal = setStoredBalance(balanceRef.current + amt)
                setTotalDeposited(prev => prev + amt)
            }
        } else {
            newBal = setStoredBalance(balanceRef.current + amt)
            setTotalDeposited(prev => prev + amt)
        }

        setTransactions(txs => [{
            id: Date.now(),
            type: 'deposit',
            currency: currencyRef.current,
            symbol: CURRENCIES[currencyRef.current].symbol,
            amount: amt,
            balance: newBal,
            utrNumber,
            timestamp: new Date(),
        }, ...txs].slice(0, 100))

        showToast('success', 'Deposit Submitted', `+${currencySymbol}${amt.toLocaleString('en-IN')} added to wallet`)
        return { success: true, balance: newBal }
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
            const data = await res.json()
            if (!res.ok || !data.success) {
                const err = data.error || 'Failed to submit withdrawal request'
                showToast('error', 'Withdrawal Rejected', err)
                throw new Error(err)
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
            timestamp: new Date(),
        }, ...txs].slice(0, 100))

        showToast('success', 'Withdrawal Requested', `Withdrawal for ${currencySymbol}${amt.toLocaleString('en-IN')} has been submitted!`)
        return { success: true, balance: newBal }
    }, [totalDeposited, token, setStoredBalance, currencySymbol, showToast])

    const notifyWin = useCallback((amount, mult) => {
        const multText = mult ? ` (${Number(mult).toFixed(2)}x)` : ''
        showToast('success', 'You Won!', `+${currencySymbol}${Number(amount || 0).toFixed(2)}${multText}`)
    }, [showToast, currencySymbol])

    const notifyLoss = useCallback((amount) => {
        showToast('error', 'Round Over', `-${currencySymbol}${Number(amount || 0).toFixed(2)}`)
    }, [showToast, currencySymbol])

    const value = {
        balance,
        currency,
        currencySymbol,
        currencyConfig,
        depositPresets: currencyConfig.presets,
        setCurrency,
        transactions,
        placeBet,
        addWinnings,
        deposit,
        withdraw,
        totalDeposited,
        minDepositRequired: 300,
        canWithdraw: totalDeposited >= 300,
        updateBalance,
        recordGameRound,
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
