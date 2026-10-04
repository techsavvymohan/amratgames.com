import { createContext, useContext, useState, useCallback, useRef } from 'react'

const WalletContext = createContext(null)

export const CURRENCIES = {
    INR: {
        id: 'INR',
        symbol: '₹',
        name: 'Indian Rupee',
        flag: '🇮🇳',
        initial: 10000.00,
        presets: [500, 1000, 2500, 5000, 10000],
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
        initial: 1000.00,
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
        initial: 1000.00,
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
        initial: 500.00,
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
            return isNaN(parsed) ? (CURRENCIES[currencyId]?.initial || 10000.00) : parsed
        }
    } catch (e) { /* ignore */ }
    return CURRENCIES[currencyId]?.initial || 10000.00
}

export function WalletProvider({ children }) {
    const [currency, setCurrencyState] = useState(getStoredCurrency)
    const [balance, setBalance] = useState(() => getStoredBalance(getStoredCurrency()))
    const balanceRef = useRef(balance)
    const currencyRef = useRef(currency)
    const [transactions, setTransactions] = useState([])

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

        // Load balance for that currency
        const curBal = getStoredBalance(newCurr)
        balanceRef.current = curBal
        setBalance(curBal)
    }, [])

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

    // Deposit funds
    const deposit = useCallback((amount) => {
        const amt = parseFloat(amount)
        if (isNaN(amt) || amt <= 0) return

        const newBal = setStoredBalance(balanceRef.current + amt)
        setTransactions(txs => [{
            id: Date.now(),
            type: 'deposit',
            currency: currencyRef.current,
            symbol: CURRENCIES[currencyRef.current].symbol,
            amount: amt,
            balance: newBal,
            timestamp: new Date(),
        }, ...txs].slice(0, 100))
    }, [setStoredBalance])

    // Reset balance to initial
    const resetBalance = useCallback(() => {
        const initial = CURRENCIES[currencyRef.current]?.initial || 10000.00
        updateBalance(initial)
        setTransactions(txs => [{
            id: Date.now(),
            type: 'reset',
            currency: currencyRef.current,
            symbol: CURRENCIES[currencyRef.current].symbol,
            amount: initial,
            balance: initial,
            timestamp: new Date(),
        }, ...txs].slice(0, 100))
    }, [updateBalance])

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
        resetBalance,
        updateBalance,
        toasts,
        showToast,
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
