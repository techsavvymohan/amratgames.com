import { useState, useEffect, useMemo } from 'react'
import { QRCode } from 'antd'
import { useWallet } from '../../context/WalletContext'
import { useAuth } from '../../context/AuthContext'
import { useWebSocket } from '../../context/WebSocketContext'
import { paymentBridge } from '../../services/PaymentBridge'
import { getOptimizedImageUrl } from '../../utils/cloudinary'
import { launchUpiApp } from '../../utils/upiIntent'
import './WalletModal.css'

export const OFFICIAL_UPI_ID = 'shanviientrrprisee@ybl'
export const OFFICIAL_PAYEE_NAME = 'Shanvii Enterprise'
export const QR_IMAGE_PATH = getOptimizedImageUrl('/images/upi-qr.png', { width: 600 })

export const UPI_APPS = [
    {
        id: 'phonepe',
        name: 'PhonePe',
        icon: getOptimizedImageUrl('/images/upi-apps/phonepe.png'),
        badge: 'Recommended',
        color: '#5f259f',
        packageName: 'com.phonepe.app',
        customScheme: (vpa, name, amt, ref) => `phonepe://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}&am=${encodeURIComponent(amt)}&cu=INR&tn=${encodeURIComponent(ref)}`
    },
    {
        id: 'gpay',
        name: 'Google Pay',
        icon: getOptimizedImageUrl('/images/upi-apps/gpay.png'),
        badge: 'Fast',
        color: '#4285f4',
        packageName: 'com.google.android.apps.nbu.paisa.user',
        customScheme: (vpa, name, amt, ref) => `tez://upi/pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}&am=${encodeURIComponent(amt)}&cu=INR&tn=${encodeURIComponent(ref)}`
    },
    {
        id: 'paytm',
        name: 'Paytm',
        icon: getOptimizedImageUrl('/images/upi-apps/paytm.png'),
        badge: 'Popular',
        color: '#00baf2',
        packageName: 'net.one97.paytm',
        customScheme: (vpa, name, amt, ref) => `paytmmp://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}&am=${encodeURIComponent(amt)}&cu=INR&tn=${encodeURIComponent(ref)}`
    },
    {
        id: 'bhim',
        name: 'BHIM UPI',
        icon: getOptimizedImageUrl('/images/upi-apps/bhim.png'),
        badge: 'NPCI',
        color: '#0087ff',
        packageName: 'in.org.npci.upiapp',
        customScheme: (vpa, name, amt, ref) => `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}&am=${encodeURIComponent(amt)}&cu=INR&tn=${encodeURIComponent(ref)}`
    },
    {
        id: 'cred',
        name: 'CRED UPI',
        icon: getOptimizedImageUrl('/images/upi-apps/cred.png'),
        badge: 'Cashback',
        color: '#121212',
        packageName: 'com.dreamplug.androidapp',
        customScheme: (vpa, name, amt, ref) => `cred://upi/pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}&am=${encodeURIComponent(amt)}&cu=INR&tn=${encodeURIComponent(ref)}`
    },
    {
        id: 'other',
        name: 'Other UPI',
        icon: getOptimizedImageUrl('/images/upi-apps/upi.svg'),
        badge: 'Any App',
        color: '#10b981',
        packageName: '',
        customScheme: (vpa, name, amt, ref) => `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}&am=${encodeURIComponent(amt)}&cu=INR&tn=${encodeURIComponent(ref)}`
    }
]

export default function WalletModal() {
    const {
        isWalletModalOpen,
        walletModalTab,
        closeWalletModal,
        openWalletModal,
        balance,
        totalDeposited,
        totalWagered,
        requiredTurnover,
        remainingTurnover,
        canWithdraw,
        deposit,
        withdraw,
        transactions,
        withdrawals = [],
        refreshWithdrawals,
        refreshBalance,
        refreshTransactions,
        showToast,
    } = useWallet()

    const { user, token: authToken, openAuthModal } = useAuth() || {}
    const { subscribe } = useWebSocket() || {}
    const effectiveToken = authToken || (typeof window !== 'undefined' ? localStorage.getItem('amrat_auth_token') : '') || ''

    const [activeTab, setActiveTab] = useState('deposit')
    const [historySubTab, setHistorySubTab] = useState('withdrawals') // 'withdrawals' | 'all'
    const [copied, setCopied] = useState(false)

    // Deposit State
    const [depositAmount, setDepositAmount] = useState('100')
    const [utrNumber, setUtrNumber] = useState('')
    const [isDepositing, setIsDepositing] = useState(false)
    const [isInstantPaying, setIsInstantPaying] = useState(false)
    const [loadingApp, setLoadingApp] = useState(null)
    const [depositSuccess, setDepositSuccess] = useState(null)
    const [depositChannel, setDepositChannel] = useState('UPI') // 'UPI' | 'CRYPTO'
    const [cryptoNetwork, setCryptoNetwork] = useState('TRC20') // 'TRC20' | 'TON'
    const [cryptoCoords, setCryptoCoords] = useState(null)
    const [loadingCrypto, setLoadingCrypto] = useState(false)
    const [cryptoCopied, setCryptoCopied] = useState(false)
    const [tagCopied, setTagCopied] = useState(false)

    // Withdraw State
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [payoutMethod, setPayoutMethod] = useState('UPI') // 'UPI' | 'BANK'
    const [upiDestination, setUpiDestination] = useState('')
    const [accountHolder, setAccountHolder] = useState('')
    const [accountNumber, setAccountNumber] = useState('')
    const [confirmAccount, setConfirmAccount] = useState('')
    const [ifscCode, setIfscCode] = useState('')
    const [isWithdrawing, setIsWithdrawing] = useState(false)
    const [withdrawSuccess, setWithdrawSuccess] = useState(null)

    // Filter out game bets and wins so Cashier Ledger only shows wallet movements (deposits, withdrawals, refunds)
    const cashierTransactions = useMemo(() => {
        return (transactions || []).filter((tx) => tx.type !== 'bet' && tx.type !== 'win')
    }, [transactions])

    // Dynamic universal UPI URI for QR code & 1-tap payment (updates in real time with depositAmount)
    const dynamicUpiUri = useMemo(() => {
        const amt = parseFloat(depositAmount)
        const amtStr = (!isNaN(amt) && amt >= 100) ? amt.toFixed(2) : '100.00'
        return `upi://pay?pa=${encodeURIComponent(OFFICIAL_UPI_ID)}&pn=${encodeURIComponent(OFFICIAL_PAYEE_NAME)}&am=${encodeURIComponent(amtStr)}&cu=INR&tn=${encodeURIComponent('Deposit AmratGames')}`
    }, [depositAmount])

    // Real-time listener on shared WebSocket for deposit auto-crediting and withdrawals
    useEffect(() => {
        if (!subscribe) return

        const unsubDeposit = subscribe('DEPOSIT_STATUS_UPDATED', (payload) => {
            if (payload && (!payload.userId || payload.userId === user?.id)) {
                refreshBalance?.()
                refreshTransactions?.()
                if (payload.status === 'completed') {
                    showToast?.('success', 'Deposit Confirmed!', `₹${parseFloat(payload.amount || 0).toLocaleString('en-IN')} has been credited to your balance!`)
                    setDepositSuccess({
                        amount: payload.amount,
                        utr: payload.utrNumber || 'Auto-Verified',
                        isPending: false
                    })
                }
            }
        })

        const unsubWithdrawal = subscribe('WITHDRAWAL_STATUS_UPDATED', (payload) => {
            if (payload && (!payload.userId || payload.userId === user?.id)) {
                refreshBalance?.()
                refreshWithdrawals?.()
                refreshTransactions?.()
            }
        })

        return () => {
            unsubDeposit?.()
            unsubWithdrawal?.()
        }
    }, [subscribe, user?.id, refreshBalance, refreshWithdrawals, refreshTransactions, showToast])

    // Sync tab and refresh withdrawals when opened
    useEffect(() => {
        if (walletModalTab) {
            setActiveTab(walletModalTab)
        }
        if (isWalletModalOpen) {
            refreshWithdrawals?.()
            refreshBalance?.()
        }
    }, [walletModalTab, isWalletModalOpen, refreshWithdrawals, refreshBalance])

    // Fetch deterministic crypto deposit coordinates
    useEffect(() => {
        if (activeTab === 'deposit' && depositChannel === 'CRYPTO' && isWalletModalOpen) {
            const token = effectiveToken
            if (!token) {
                setLoadingCrypto(false)
                setCryptoCoords(null)
                return
            }
            let isCancelled = false
            const fetchCoords = async () => {
                setLoadingCrypto(true)
                try {
                    const res = await fetch(`/api/wallet/crypto-deposit-info?currency=USDT&network=${cryptoNetwork}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                    if (res.status === 401) {
                        return
                    }
                    const data = await res.json()
                    if (!isCancelled && data.success) {
                        setCryptoCoords(data)
                    }
                } catch (err) {
                    console.error('[CRYPTO COORDS ERROR]', err)
                } finally {
                    if (!isCancelled) setLoadingCrypto(false)
                }
            }
            fetchCoords()
            return () => { isCancelled = true }
        }
    }, [activeTab, depositChannel, cryptoNetwork, isWalletModalOpen, effectiveToken])

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isWalletModalOpen) {
                closeWalletModal()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isWalletModalOpen, closeWalletModal])

    if (!isWalletModalOpen) return null

    // Copy UPI ID to clipboard
    const handleCopyUpi = async () => {
        try {
            await navigator.clipboard.writeText(OFFICIAL_UPI_ID)
            setCopied(true)
            showToast?.('success', 'UPI Copied', `${OFFICIAL_UPI_ID} copied to clipboard!`)
            setTimeout(() => setCopied(false), 2500)
        } catch {
            showToast?.('info', 'UPI ID', OFFICIAL_UPI_ID)
        }
    }

    // ⚡ 1-Click Instant UPI App Redirection (PhonePe, GPay, Paytm, BHIM, CRED)
    // Guarantees that whatever amount is entered is automatically pre-filled in the redirected UPI app!
    const handleAppPay = (app) => {
        const amt = parseFloat(depositAmount)
        if (isNaN(amt) || amt < 100) {
            showToast?.('error', 'Minimum Deposit', 'Minimum deposit is ₹100 for instant payment')
            return
        }
        if (!effectiveToken) {
            showToast?.('error', 'Login Required', 'Please log in to initiate deposit')
            closeWalletModal()
            openAuthModal?.('login')
            return
        }

        try {
            setLoadingApp(app.id)
            const amtStr = amt.toFixed(2)
            const orderRef = `DEP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`
            const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
            const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
            const isMobile = isAndroid || isIOS

            // Standard NPCI UPI URI with exact amount pre-filled
            const note = `Deposit ${orderRef}`
            const upiQuery = `pa=${encodeURIComponent(OFFICIAL_UPI_ID)}&pn=${encodeURIComponent(OFFICIAL_PAYEE_NAME)}&am=${encodeURIComponent(amtStr)}&cu=INR&tn=${encodeURIComponent(note)}&tr=${encodeURIComponent(orderRef)}`

            let primaryUri = ''
            let fallbackUri = ''

            if (isAndroid && app.packageName) {
                // Direct Android package-targeted intent with pre-filled amount
                primaryUri = `intent://pay?${upiQuery}#Intent;scheme=upi;package=${app.packageName};end`
                fallbackUri = app.customScheme ? app.customScheme(OFFICIAL_UPI_ID, OFFICIAL_PAYEE_NAME, amtStr, orderRef) : `upi://pay?${upiQuery}`
            } else if (app.customScheme) {
                primaryUri = app.customScheme(OFFICIAL_UPI_ID, OFFICIAL_PAYEE_NAME, amtStr, orderRef)
                fallbackUri = `upi://pay?${upiQuery}`
            } else {
                primaryUri = `upi://pay?${upiQuery}`
                fallbackUri = primaryUri
            }

            showToast?.('info', `Opening ${app.name}`, `Launching ${app.name} with ₹${amtStr} pre-filled…`)

            // 1. Immediately launch inside user-gesture context so mobile browsers don't block intent or drop amount
            let launched = launchUpiApp(primaryUri)
            if (!launched && fallbackUri && fallbackUri !== primaryUri) {
                launchUpiApp(fallbackUri)
            }

            // 2. Also copy UPI ID to clipboard as courteous backup
            try {
                navigator.clipboard.writeText(OFFICIAL_UPI_ID)
            } catch {}

            // 3. Initiate backend session in background for authoritative ledger tracking
            paymentBridge.requestSession(amt, effectiveToken, 'youpi').catch((sessionErr) => {
                console.warn('[SESSION BACKGROUND ERROR]', sessionErr)
            })
        } catch (err) {
            console.error('[HANDLE APP PAY ERROR]', err)
            showToast?.('error', 'Checkout Error', err?.message || 'Failed to initialize payment')
        } finally {
            setTimeout(() => setLoadingApp(null), 1500)
        }
    }

    const handleCopyCrypto = async (addr) => {
        try {
            await navigator.clipboard.writeText(addr)
            setCryptoCopied(true)
            showToast?.('success', 'Address Copied', 'USDT Deposit Address copied to clipboard!')
            setTimeout(() => setCryptoCopied(false), 2500)
        } catch {
            showToast?.('info', 'Address', addr)
        }
    }

    const handleCopyTag = async (tag) => {
        try {
            await navigator.clipboard.writeText(tag)
            setTagCopied(true)
            showToast?.('success', 'Memo Tag Copied', `Memo Tag ${tag} copied!`)
            setTimeout(() => setTagCopied(false), 2500)
        } catch {
            showToast?.('info', 'Memo Tag', tag)
        }
    }

    // Submit Deposit
    const handleDepositSubmit = async (e) => {
        e?.preventDefault()
        if (!effectiveToken) {
            showToast?.('error', 'Login Required', 'Please log in or register before submitting a deposit')
            closeWalletModal()
            openAuthModal?.('login')
            return
        }
        const amt = parseFloat(depositAmount)
        if (isNaN(amt) || amt < 100) {
            showToast?.('error', 'Invalid Amount', 'Minimum deposit is ₹100')
            return
        }

        const cleanUtr = utrNumber.trim()
        if (!cleanUtr || cleanUtr.length < 6) {
            showToast?.('error', 'UTR Required', 'Please enter your 12-digit UPI Ref / UTR number from your receipt')
            return
        }

        try {
            setIsDepositing(true)
            const res = await deposit(amt, {
                method: 'UPI',
                utrNumber: cleanUtr
            })
            setDepositSuccess({
                amount: amt,
                utr: cleanUtr,
                isPending: res?.status === 'pending'
            })
            setUtrNumber('')
        } catch (err) {
            showToast?.('error', 'Deposit Failed', err?.message || 'Please verify UTR number and retry')
        } finally {
            setIsDepositing(false)
        }
    }

    // ⚡ Instant Automated UPI Payment via Sovereign Gateway
    // Guarantees that whatever amount is entered is automatically pre-filled in the redirected UPI app!
    const handleInstantPay = () => {
        const amt = parseFloat(depositAmount)
        if (isNaN(amt) || amt < 100) {
            showToast?.('error', 'Minimum Deposit', 'Minimum deposit is ₹100 for instant payment')
            return
        }
        if (!effectiveToken) {
            showToast?.('error', 'Login Required', 'Please log in to initiate instant deposit')
            closeWalletModal()
            openAuthModal?.('login')
            return
        }

        try {
            setIsInstantPaying(true)
            const amtStr = amt.toFixed(2)
            const orderRef = `DEP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`
            const note = `Deposit ${orderRef}`
            const universalUpiUri = `upi://pay?pa=${encodeURIComponent(OFFICIAL_UPI_ID)}&pn=${encodeURIComponent(OFFICIAL_PAYEE_NAME)}&am=${encodeURIComponent(amtStr)}&cu=INR&tn=${encodeURIComponent(note)}&tr=${encodeURIComponent(orderRef)}`

            showToast?.('info', 'Opening UPI Payment', `Launching payment with ₹${amtStr} pre-filled…`)

            // 1. Immediately launch universal UPI intent on mobile so native app chooser opens with amount prefilled
            launchUpiApp(universalUpiUri)

            // 2. Also copy UPI ID to clipboard as courteous backup
            try {
                navigator.clipboard.writeText(OFFICIAL_UPI_ID)
            } catch {}

            // 3. Initiate backend session in background
            paymentBridge.requestSession(amt, effectiveToken, 'youpi').catch((sessionErr) => {
                console.warn('[SESSION BACKGROUND ERROR]', sessionErr)
            })
        } catch (err) {
            showToast?.('warning', 'Instant Gateway Offline', 'Please scan the QR code above or pay via UPI ID and submit your 12-digit UTR.')
        } finally {
            setTimeout(() => setIsInstantPaying(false), 1500)
        }
    }

    // Submit Withdrawal
    const handleWithdrawSubmit = async (e) => {
        e?.preventDefault()
        if (!effectiveToken) {
            showToast?.('error', 'Login Required', 'Please log in to withdraw funds')
            closeWalletModal()
            openAuthModal?.('login')
            return
        }
        const amt = parseFloat(withdrawAmount)
        if (isNaN(amt) || amt <= 0) {
            showToast?.('error', 'Invalid Amount', 'Please enter a valid withdrawal amount')
            return
        }
        if (amt > balance) {
            showToast?.('error', 'Insufficient Funds', `Maximum withdrawable balance is ₹${balance.toFixed(2)}`)
            return
        }
        if (amt < 100) {
            showToast?.('error', 'Minimum ₹100', 'Minimum withdrawal amount is ₹100')
            return
        }

        let destination = ''
        let bankDetails = null

        if (payoutMethod === 'UPI') {
            if (!upiDestination.trim() || !upiDestination.includes('@')) {
                showToast?.('error', 'Invalid UPI ID', 'Please enter a valid UPI ID (e.g. mobile@ybl)')
                return
            }
            destination = upiDestination.trim()
        } else {
            if (!accountHolder.trim() || !accountNumber.trim() || !ifscCode.trim()) {
                showToast?.('error', 'Incomplete Bank Details', 'Please fill in all bank account fields')
                return
            }
            if (accountNumber.trim() !== confirmAccount.trim()) {
                showToast?.('error', 'Mismatch', 'Account numbers do not match')
                return
            }
            destination = `${accountHolder.trim()} - A/C ${accountNumber.trim()}`
            bankDetails = {
                holder: accountHolder.trim(),
                accountNumber: accountNumber.trim(),
                ifsc: ifscCode.trim().toUpperCase()
            }
        }

        try {
            setIsWithdrawing(true)
            const res = await withdraw(amt, destination, {
                payoutMethod,
                bankDetails
            })
            setWithdrawSuccess({
                amount: amt,
                destination,
                id: res?.withdrawal?.id || null,
                status: res?.status || res?.withdrawal?.status || 'pending',
                instantPayout: false,
                dispatchRef: res?.dispatchRef || res?.withdrawal?.transactionRef || null,
                estimatedArrival: '5-10 minutes'
            })
            setWithdrawAmount('')
            refreshWithdrawals?.()
        } catch (err) {
            showToast?.('error', 'Withdrawal Error', err?.message || 'Could not process payout')
        } finally {
            setIsWithdrawing(false)
        }
    }

    const PRESET_AMOUNTS = [100, 300, 500, 1000, 2500, 5000]

    return (
        <div className="amrat-wallet-overlay" onClick={closeWalletModal}>
            <div className="amrat-wallet-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="amrat-wallet-header">
                    <div className="amrat-wallet-header-title">
                        <img src={getOptimizedImageUrl('/amrat-logo.png', { width: 64 })} alt="AmratGames" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
                        <span>Wallet &amp; Cashier</span>
                    </div>
                    <button
                        type="button"
                        className="amrat-wallet-close"
                        onClick={closeWalletModal}
                        aria-label="Close wallet"
                    >
                        ✕
                    </button>
                </div>

                {/* Active Balance Banner */}
                <div className="amrat-wallet-balance-card">
                    <div className="amrat-wallet-balance-info">
                        <span className="amrat-wallet-balance-lbl">Available Balance</span>
                        <div className="amrat-wallet-balance-val">
                            <span>₹</span>
                            {balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                    <span className="amrat-wallet-badge">
                        🇮🇳 INR Only
                    </span>
                </div>

                {/* Navigation Tabs */}
                <div className="amrat-wallet-tabs">
                    <button
                        type="button"
                        className={`amrat-wallet-tab-btn tab-deposit ${activeTab === 'deposit' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('deposit'); setDepositSuccess(null); }}
                    >
                        <span>💰</span>
                        <span>Deposit INR</span>
                    </button>
                    <button
                        type="button"
                        className={`amrat-wallet-tab-btn tab-withdraw ${activeTab === 'withdraw' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('withdraw'); setWithdrawSuccess(null); }}
                    >
                        <span>🏧</span>
                        <span>Withdraw</span>
                    </button>
                    <button
                        type="button"
                        className={`amrat-wallet-tab-btn tab-history ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        <span>📜</span>
                        <span>History</span>
                    </button>
                </div>

                {/* Body Content */}
                <div className="amrat-wallet-body">
                    {/* ══════════════════════════════════════════════════════════
                        TAB 1: DEPOSIT (INR VIA UPI & PHONEPE QR)
                       ══════════════════════════════════════════════════════════ */}
                    {activeTab === 'deposit' && (
                        depositSuccess ? (
                            <div className="amrat-success-card">
                                <div className="amrat-success-icon" style={{ background: depositSuccess.isPending ? 'rgba(245, 158, 11, 0.2)' : undefined, color: depositSuccess.isPending ? '#fbbf24' : undefined }}>
                                    {depositSuccess.isPending ? '⏳' : '✓'}
                                </div>
                                <h3 style={{ margin: 0, color: depositSuccess.isPending ? '#fbbf24' : '#10b981', fontSize: '1.25rem' }}>
                                    {depositSuccess.isPending ? 'Deposit Submitted for Verification!' : 'Deposit Confirmed!'}
                                </h3>
                                <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.5 }}>
                                    {depositSuccess.isPending ? (
                                        <>
                                            Payment receipt submitted for ₹{depositSuccess.amount.toLocaleString('en-IN')}. Funds will be credited to your balance as soon as our cashier verifies the bank transfer.
                                        </>
                                    ) : (
                                        <>
                                            ₹{depositSuccess.amount.toLocaleString('en-IN')} has been added to your wallet.
                                        </>
                                    )}
                                    <br />
                                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                        UTR Reference: <strong>{depositSuccess.utr}</strong>
                                    </span>
                                </p>
                                <button
                                    type="button"
                                    className="amrat-submit-deposit-btn"
                                    style={{ marginTop: '12px' }}
                                    onClick={() => setDepositSuccess(null)}
                                >
                                    Deposit Again
                                </button>
                                <button
                                    type="button"
                                    className="amrat-preset-btn"
                                    style={{ width: '100%', padding: '10px' }}
                                    onClick={closeWalletModal}
                                >
                                    Done &amp; Return to Game
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {/* Channel Selector: UPI vs Crypto */}
                                <div className="amrat-channel-switcher">
                                    <button
                                        type="button"
                                        className={`amrat-channel-btn ${depositChannel === 'UPI' ? 'active' : ''}`}
                                        onClick={() => setDepositChannel('UPI')}
                                    >
                                        <span>🇮🇳</span>
                                        <span>UPI Instant (INR)</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`amrat-channel-btn ${depositChannel === 'CRYPTO' ? 'active' : ''}`}
                                        onClick={() => setDepositChannel('CRYPTO')}
                                    >
                                        <span>🌐</span>
                                        <span>USDT Crypto (TRC-20)</span>
                                    </button>
                                </div>

                                {depositChannel === 'CRYPTO' ? (
                                    <div className="amrat-crypto-card">
                                        <div style={{
                                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
                                            border: '1px solid rgba(16, 185, 129, 0.4)',
                                            borderRadius: '8px',
                                            padding: '10px 14px',
                                            marginBottom: '14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px'
                                        }}>
                                            <span style={{ fontSize: '1.3rem' }}>🎁</span>
                                            <div>
                                                <div style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>
                                                    +3% Extra Balance Bonus on All Crypto Deposits!
                                                </div>
                                                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                                    Deposit with USDT or Bitcoin to automatically receive +3% free extra credit directly into your wallet.
                                                </div>
                                            </div>
                                        </div>

                                        <div className="amrat-crypto-header">
                                            <span className="amrat-crypto-badge">
                                                <span>⚡</span>
                                                <span>Zero Freeze Risk · Direct Ingress</span>
                                            </span>
                                            <div className="amrat-crypto-network-toggle">
                                                <button
                                                    type="button"
                                                    className={`amrat-crypto-net-btn ${cryptoNetwork === 'TRC20' ? 'active' : ''}`}
                                                    onClick={() => setCryptoNetwork('TRC20')}
                                                >
                                                    TRC-20
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`amrat-crypto-net-btn ${cryptoNetwork === 'TON' ? 'active' : ''}`}
                                                    onClick={() => setCryptoNetwork('TON')}
                                                >
                                                    TON
                                                </button>
                                            </div>
                                        </div>

                                        {!effectiveToken ? (
                                            <div style={{ textAlign: 'center', padding: '24px 16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                                <div style={{ fontSize: '1.75rem', marginBottom: '8px' }}>🔐</div>
                                                <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.95rem', marginBottom: '6px' }}>
                                                    Login Required
                                                </div>
                                                <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '14px', lineHeight: 1.4 }}>
                                                    Please log in or register to view your personal USDT deposit address.
                                                </p>
                                                <button
                                                    type="button"
                                                    className="amrat-submit-deposit-btn"
                                                    style={{ maxWidth: '220px', margin: '0 auto' }}
                                                    onClick={() => {
                                                        closeWalletModal()
                                                        openAuthModal?.('login')
                                                    }}
                                                >
                                                    Login / Register
                                                </button>
                                            </div>
                                        ) : loadingCrypto ? (
                                            <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                                                Generating secure deterministic deposit address...
                                            </div>
                                        ) : cryptoCoords ? (
                                            <>
                                                {/* Deposit Vault Address */}
                                                <div className="amrat-crypto-address-box">
                                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        {cryptoCoords.currency} ({cryptoCoords.network}) Deposit Vault Address
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                                        <span className="amrat-crypto-address-val">{cryptoCoords.address}</span>
                                                        <button
                                                            type="button"
                                                            className={`amrat-copy-btn ${cryptoCopied ? 'copied' : ''}`}
                                                            style={{ flexShrink: 0, padding: '6px 10px', fontSize: '0.72rem' }}
                                                            onClick={() => handleCopyCrypto(cryptoCoords.address)}
                                                        >
                                                            {cryptoCopied ? '✓' : '📋 Copy'}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Memo Tag */}
                                                <div className="amrat-crypto-memo-box">
                                                    <div>
                                                        <div style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: 800 }}>
                                                            ⚠️ REQUIRED MEMO / REFERENCE TAG:
                                                        </div>
                                                        <div className="amrat-crypto-memo-val">
                                                            {cryptoCoords.memoTag}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className={`amrat-copy-btn ${tagCopied ? 'copied' : ''}`}
                                                        style={{ flexShrink: 0, padding: '6px 10px', fontSize: '0.72rem' }}
                                                        onClick={() => handleCopyTag(cryptoCoords.memoTag)}
                                                    >
                                                        {tagCopied ? '✓' : '📋 Copy Tag'}
                                                    </button>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#cbd5e1' }}>
                                                    <span>Peg Rate: <strong>1 USDT = ₹{cryptoCoords.rateInr} INR</strong></span>
                                                    <span>Min Deposit: <strong>{cryptoCoords.minDeposit} USDT</strong></span>
                                                </div>

                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px', lineHeight: 1.4 }}>
                                                    ℹ️ Transfers from Binance, Bybit, Trust Wallet or Telegram Wallet are confirmed automatically. Funds credit instantly to your INR balance within 60 seconds.
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                ) : (
                                    <form onSubmit={handleDepositSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {/* Step 1: Amount Selection */}
                                        <div className="amrat-field-group">
                                            <label className="amrat-field-lbl">
                                                <span>1. Select Deposit Amount (INR ₹)</span>
                                                <span className="accent">Min ₹100</span>
                                            </label>
                                            <div className="amrat-presets-grid">
                                                {PRESET_AMOUNTS.map((amt) => (
                                                    <button
                                                        key={amt}
                                                        type="button"
                                                        className={`amrat-preset-btn ${parseFloat(depositAmount) === amt ? 'active' : ''}`}
                                                        onClick={() => setDepositAmount(String(amt))}
                                                    >
                                                        ₹{amt.toLocaleString('en-IN')}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="amrat-input-wrap" style={{ marginTop: '6px' }}>
                                                <span className="amrat-input-prefix">₹</span>
                                                <input
                                                    type="number"
                                                    className="amrat-field-input has-prefix"
                                                    placeholder="Enter amount (min ₹100)"
                                                    value={depositAmount}
                                                    min="100"
                                                    step="1"
                                                    onChange={(e) => setDepositAmount(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            {depositAmount !== '' && parseFloat(depositAmount) < 100 && (
                                                <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '5px', fontWeight: '600' }}>
                                                    ⚠️ Minimum deposit is ₹100.
                                                </div>
                                            )}
                                        </div>

                                        {/* Step 2: Instant 1-Click UPI App Redirection */}
                                        <div className="amrat-field-group">
                                            <label className="amrat-field-lbl">
                                                <span>2. Tap App to Pay (Instant Auto-Credit)</span>
                                                <span className="accent">⚡ 1-Click Redirect</span>
                                            </label>

                                            <div className="amrat-upi-apps-grid">
                                                {UPI_APPS.map((app) => (
                                                    <button
                                                        key={app.id}
                                                        type="button"
                                                        className={`amrat-upi-app-btn app-${app.id} ${loadingApp === app.id ? 'loading' : ''}`}
                                                        onClick={() => handleAppPay(app)}
                                                        disabled={loadingApp !== null || isInstantPaying || !depositAmount || parseFloat(depositAmount) < 100}
                                                        title={`Pay ₹${depositAmount || '0'} via ${app.name}`}
                                                    >
                                                        <div className="amrat-upi-app-icon-wrap">
                                                            <img
                                                                src={app.icon}
                                                                alt={app.name}
                                                                className="amrat-upi-app-icon"
                                                            />
                                                        </div>
                                                        <div className="amrat-upi-app-meta">
                                                            <span className="amrat-upi-app-name">{app.name}</span>
                                                            <span className="amrat-upi-app-sub">
                                                                {loadingApp === app.id ? 'Opening…' : (app.badge || 'Instant')}
                                                            </span>
                                                        </div>
                                                        <span className="amrat-upi-app-arrow">➔</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* ⚡ Instant Pay Action Button */}
                                        <button
                                            type="button"
                                            className="amrat-instant-pay-btn"
                                            onClick={handleInstantPay}
                                            disabled={isInstantPaying || loadingApp !== null || !depositAmount || parseFloat(depositAmount) < 100}
                                        >
                                            <span>{isInstantPaying ? '⏳ Connecting UPI Gateway…' : (!depositAmount || parseFloat(depositAmount) < 100) ? 'Minimum Deposit is ₹100' : '⚡ Pay Instantly via UPI (Auto-Credit)'}</span>
                                        </button>

                                        {/* UPI ID Bar with One-Click Copy */}
                                        <div className="amrat-upi-box">
                                            <div className="amrat-upi-details">
                                                <span className="amrat-upi-lbl">Official Deposit UPI ID</span>
                                                <span className="amrat-upi-val">{OFFICIAL_UPI_ID}</span>
                                            </div>
                                            <button
                                                type="button"
                                                className={`amrat-copy-btn ${copied ? 'copied' : ''}`}
                                                onClick={handleCopyUpi}
                                            >
                                                {copied ? '✓ Copied' : '📋 Copy UPI'}
                                            </button>
                                        </div>

                                        {/* Dynamic Live QR Code (Auto-fills exact deposit amount when scanned with PhonePe, GPay, Paytm) */}
                                        <div className="amrat-dynamic-qr-card">
                                            <div className="amrat-qr-wrap">
                                                <QRCode
                                                    value={dynamicUpiUri}
                                                    size={104}
                                                    bgColor="#ffffff"
                                                    color="#0b0f19"
                                                    bordered={false}
                                                />
                                            </div>
                                            <div className="amrat-qr-info">
                                                <div className="amrat-qr-badge">⚡ Auto-Filled QR</div>
                                                <div className="amrat-qr-amount">
                                                    ₹{parseFloat(depositAmount && parseFloat(depositAmount) >= 100 ? depositAmount : 100).toLocaleString('en-IN')}
                                                </div>
                                                <p className="amrat-qr-desc">
                                                    Scan with <strong>GPay, PhonePe or Paytm</strong>. That exact amount will be <strong>filled automatically</strong>.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Seamless Visual Divider to Manual Fallback */}
                                        <div className="amrat-deposit-divider">
                                            <span>OR PAY MANUALLY VIA UPI ID &amp; ENTER UTR</span>
                                        </div>

                                        {/* Step 3: 12-Digit UTR Input */}
                                        <div className="amrat-field-group">
                                            <label className="amrat-field-lbl">
                                                <span>3. Enter 12-Digit UPI Ref / UTR No.</span>
                                                <span className="accent">{utrNumber.length}/12</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="amrat-field-input"
                                                placeholder="e.g. 429381928374 (From UPI receipt)"
                                                maxLength={12}
                                                value={utrNumber}
                                                onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, ''))}
                                                required
                                            />
                                            <span className="amrat-field-hint">
                                                After paying via PhonePe, Paytm, GPay or any UPI app, copy the 12-digit UTR/Ref number from your payment receipt and enter it above.
                                            </span>
                                        </div>

                                        {/* Submit Button */}
                                        <button
                                            type="submit"
                                            className="amrat-submit-deposit-btn"
                                            disabled={isDepositing || !depositAmount || parseFloat(depositAmount) < 100}
                                        >
                                            {isDepositing
                                                ? 'Verifying & Adding Funds…'
                                                : (!depositAmount || parseFloat(depositAmount) < 100)
                                                    ? 'Minimum Deposit is ₹100'
                                                    : `Submit Deposit of ₹${Number(depositAmount || 0).toLocaleString('en-IN')}`}
                                        </button>
                                    </form>
                                )}
                            </div>
                        )
                    )}

                    {/* ══════════════════════════════════════════════════════════
                        TAB 2: WITHDRAW (ENFORCING ₹300 MIN DEPOSIT RULE)
                       ══════════════════════════════════════════════════════════ */}
                    {activeTab === 'withdraw' && (
                        withdrawSuccess ? (
                            <div className="amrat-success-card" style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}>
                                <div className="amrat-success-icon" style={{ borderColor: '#f59e0b', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)' }}>
                                    ⏳
                                </div>
                                <h3 style={{ margin: 0, color: '#f59e0b', fontSize: '1.25rem' }}>
                                    Withdrawal Request Placed
                                </h3>
                                <p style={{ margin: 0, color: '#f1f5f9', fontSize: '0.92rem', lineHeight: 1.6, fontWeight: 500 }}>
                                    Your withdrawal request of <strong style={{ color: '#fbbf24' }}>₹{withdrawSuccess.amount.toLocaleString('en-IN')}</strong> has been placed. Please wait <strong>5–10 minutes</strong> for verification.
                                </p>
                                <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px dashed rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '12px 14px', fontSize: '0.8rem', color: '#cbd5e1', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#94a3b8' }}>Payout Destination:</span>
                                        <strong style={{ color: '#f8fafc' }}>{withdrawSuccess.destination}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#94a3b8' }}>Verification Status:</span>
                                        <strong style={{ color: '#fbbf24' }}>Under Security Verification (5–10 Minutes)</strong>
                                    </div>
                                    {withdrawSuccess.id && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                                            <span style={{ color: '#64748b' }}>Request Ticket:</span>
                                            <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>#{withdrawSuccess.id.slice(-8).toUpperCase()}</span>
                                        </div>
                                    )}
                                    <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '6px', lineHeight: 1.4 }}>
                                        🔒 All profit earnings and gameplay sessions undergo security audit before funds are released to your bank/UPI.
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="amrat-submit-withdraw-btn"
                                    style={{ marginTop: '8px' }}
                                    onClick={() => {
                                        setWithdrawSuccess(null)
                                        setActiveTab('history')
                                        setHistorySubTab('withdrawals')
                                    }}
                                >
                                    Track Payout Status
                                </button>
                                <button
                                    type="button"
                                    className="amrat-preset-btn"
                                    style={{ width: '100%', padding: '10px' }}
                                    onClick={closeWalletModal}
                                >
                                    Back to Play
                                </button>
                            </div>
                        ) : (totalDeposited || 0) < 300 ? (
                            <div className="amrat-lock-card">
                                <div className="amrat-lock-title">
                                    <span>🔒</span>
                                    <span>Minimum ₹300 Deposit Required</span>
                                </div>
                                <div className="amrat-lock-desc">
                                    To unlock instant withdrawals and verify your payout destination, players must make a cumulative deposit of at least <strong>₹300</strong>.
                                </div>
                                <div className="amrat-progress-track">
                                    <div
                                        className="amrat-progress-fill"
                                        style={{ width: `${Math.min(100, ((totalDeposited || 0) / 300) * 100)}%` }}
                                    />
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Deposited: <strong>₹{totalDeposited || 0}</strong></span>
                                    <span>Goal: <strong>₹300</strong></span>
                                </div>
                                <button
                                    type="button"
                                    className="amrat-submit-deposit-btn"
                                    style={{ marginTop: '6px' }}
                                    onClick={() => {
                                        setActiveTab('deposit')
                                        setDepositAmount(String(Math.max(100, 300 - (totalDeposited || 0))))
                                    }}
                                >
                                    Deposit ₹{Math.max(100, 300 - (totalDeposited || 0))} Now to Unlock
                                </button>
                            </div>
                        ) : (totalWagered || 0) < (totalDeposited || 0) ? (
                            <div className="amrat-lock-card">
                                <div className="amrat-lock-title">
                                    <span>⚖️</span>
                                    <span>AML 1.0x Wagering Rollover Required</span>
                                </div>
                                <div className="amrat-lock-desc">
                                    Anti-Money Laundering (AML) Compliance: Deposited funds must achieve at least 1.0x wagering turnover before submitting withdrawal requests.
                                </div>
                                <div className="amrat-progress-track">
                                    <div
                                        className="amrat-progress-fill"
                                        style={{ width: `${Math.min(100, (((totalWagered || 0) / (totalDeposited || 1)) * 100))}%`, background: 'linear-gradient(90deg, #f59e0b, #10b981)' }}
                                    />
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Wagered: <strong>₹{(totalWagered || 0).toLocaleString('en-IN')}</strong></span>
                                    <span>Required: <strong>₹{(totalDeposited || 0).toLocaleString('en-IN')}</strong></span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#eab308', marginTop: '2px', textAlign: 'center' }}>
                                    Remaining turnover needed: <strong>₹{Math.max(0, (totalDeposited || 0) - (totalWagered || 0)).toLocaleString('en-IN')}</strong>
                                </div>
                                <button
                                    type="button"
                                    className="amrat-submit-deposit-btn"
                                    style={{ marginTop: '8px', background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                                    onClick={closeWalletModal}
                                >
                                    Play Games to Complete Rollover
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleWithdrawSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="amrat-unlocked-card">
                                    <span>✓</span>
                                    <span>Payouts Unlocked (Deposited: ₹{totalDeposited} · Rollover: 100% Completed)</span>
                                </div>

                                {/* Amount Input */}
                                <div className="amrat-field-group">
                                    <label className="amrat-field-lbl">
                                        <span>Withdraw Amount (INR ₹)</span>
                                        <span className="accent">Max: ₹{balance.toFixed(2)}</span>
                                    </label>
                                    <div className="amrat-input-wrap">
                                        <span className="amrat-input-prefix">₹</span>
                                        <input
                                            type="number"
                                            className="amrat-field-input has-prefix"
                                            placeholder="Enter amount"
                                            value={withdrawAmount}
                                            min="100"
                                            max={balance}
                                            step="1"
                                            onChange={(e) => setWithdrawAmount(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="amrat-presets-grid" style={{ marginTop: '4px' }}>
                                        <button
                                            type="button"
                                            className="amrat-preset-btn"
                                            onClick={() => setWithdrawAmount('100')}
                                        >
                                            Min ₹100
                                        </button>
                                        <button
                                            type="button"
                                            className="amrat-preset-btn"
                                            onClick={() => setWithdrawAmount(String(Math.floor(balance * 0.25)))}
                                        >
                                            25%
                                        </button>
                                        <button
                                            type="button"
                                            className="amrat-preset-btn"
                                            onClick={() => setWithdrawAmount(String(Math.floor(balance * 0.5)))}
                                        >
                                            50%
                                        </button>
                                        <button
                                            type="button"
                                            className="amrat-preset-btn"
                                            onClick={() => setWithdrawAmount(String(Math.floor(balance * 0.75)))}
                                        >
                                            75%
                                        </button>
                                        <button
                                            type="button"
                                            className="amrat-preset-btn"
                                            onClick={() => setWithdrawAmount(String(Math.floor(balance)))}
                                        >
                                            100% (Max)
                                        </button>
                                    </div>
                                </div>

                                {/* Payout Method Toggle */}
                                <div className="amrat-field-group">
                                    <label className="amrat-field-lbl">Payout Method</label>
                                    <div className="amrat-payout-toggle">
                                        <button
                                            type="button"
                                            className={`amrat-payout-toggle-btn ${payoutMethod === 'UPI' ? 'active' : ''}`}
                                            onClick={() => setPayoutMethod('UPI')}
                                        >
                                            📱 UPI ID
                                        </button>
                                        <button
                                            type="button"
                                            className={`amrat-payout-toggle-btn ${payoutMethod === 'BANK' ? 'active' : ''}`}
                                            onClick={() => setPayoutMethod('BANK')}
                                        >
                                            🏦 Bank Transfer (IMPS)
                                        </button>
                                    </div>
                                </div>

                                {/* Destination Fields */}
                                {payoutMethod === 'UPI' ? (
                                    <div className="amrat-field-group">
                                        <label className="amrat-field-lbl">Your UPI ID (e.g. mobile@ybl / name@oksbi)</label>
                                        <input
                                            type="text"
                                            className="amrat-field-input"
                                            placeholder="Enter your UPI ID"
                                            value={upiDestination}
                                            onChange={(e) => setUpiDestination(e.target.value)}
                                            required
                                        />
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div className="amrat-field-group">
                                            <label className="amrat-field-lbl">Account Holder Name</label>
                                            <input
                                                type="text"
                                                className="amrat-field-input"
                                                placeholder="As per bank passbook"
                                                value={accountHolder}
                                                onChange={(e) => setAccountHolder(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="amrat-field-group">
                                            <label className="amrat-field-lbl">Bank Account Number</label>
                                            <input
                                                type="text"
                                                className="amrat-field-input"
                                                placeholder="Enter A/C Number"
                                                value={accountNumber}
                                                onChange={(e) => setAccountNumber(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="amrat-field-group">
                                            <label className="amrat-field-lbl">Re-enter Account Number</label>
                                            <input
                                                type="text"
                                                className="amrat-field-input"
                                                placeholder="Confirm A/C Number"
                                                value={confirmAccount}
                                                onChange={(e) => setConfirmAccount(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="amrat-field-group">
                                            <label className="amrat-field-lbl">IFSC Code</label>
                                            <input
                                                type="text"
                                                className="amrat-field-input"
                                                placeholder="e.g. SBIN0001234"
                                                value={ifscCode}
                                                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                                                required
                                            />
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="amrat-submit-withdraw-btn"
                                    disabled={isWithdrawing || balance < 100 || !withdrawAmount || parseFloat(withdrawAmount) > balance}
                                >
                                    {isWithdrawing
                                        ? 'Processing Payout…'
                                        : `Request Withdrawal of ₹${Number(withdrawAmount || 0).toLocaleString('en-IN')}`}
                                </button>
                            </form>
                        )
                    )}

                    {/* ══════════════════════════════════════════════════════════
                        TAB 3: TRANSACTION HISTORY
                       ══════════════════════════════════════════════════════════ */}
                    {/* ══════════════════════════════════════════════════════════
                        TAB 3: TRANSACTION & WITHDRAWAL HISTORY
                       ══════════════════════════════════════════════════════════ */}
                    {activeTab === 'history' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* History Sub-Tabs */}
                            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px' }}>
                                <button
                                    type="button"
                                    className={`amrat-preset-btn ${historySubTab === 'withdrawals' ? 'active' : ''}`}
                                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700 }}
                                    onClick={() => setHistorySubTab('withdrawals')}
                                >
                                    🏧 Payout Requests ({withdrawals.length})
                                </button>
                                <button
                                    type="button"
                                    className={`amrat-preset-btn ${historySubTab === 'all' ? 'active' : ''}`}
                                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700 }}
                                    onClick={() => setHistorySubTab('all')}
                                >
                                    📜 Cashier Ledger ({cashierTransactions.length})
                                </button>
                            </div>

                            {historySubTab === 'withdrawals' ? (
                                withdrawals.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '36px 10px', color: '#64748b', fontSize: '0.85rem' }}>
                                        <div style={{ fontSize: '28px', marginBottom: '6px' }}>📭</div>
                                        <div>No withdrawal requests submitted yet.</div>
                                        <div style={{ fontSize: '0.75rem', marginTop: '4px', color: '#475569' }}>
                                            When you request a payout, its status will be tracked here.
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
                                        {withdrawals.map((w) => {
                                            const isPending = w.status === 'pending'
                                            const isApproved = w.status === 'approved'
                                            const isRejected = w.status === 'rejected'
                                            const timeStr = new Date(w.createdAt || 0).toLocaleString('en-IN', {
                                                day: 'numeric',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })
                                            const shortId = w.id ? (w.id.length > 8 ? w.id.slice(-6).toUpperCase() : w.id) : ''

                                            return (
                                                <div
                                                    key={w.id}
                                                    style={{
                                                        background: 'rgba(255, 255, 255, 0.03)',
                                                        border: `1px solid ${
                                                            isPending ? 'rgba(245, 158, 11, 0.35)' :
                                                            isApproved ? 'rgba(16, 185, 129, 0.3)' :
                                                            'rgba(239, 68, 68, 0.3)'
                                                        }`,
                                                        borderRadius: '10px',
                                                        padding: '12px 14px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '8px'
                                                    }}
                                                >
                                                    {/* Row 1: Left has Type & Status Badge, Right has bold Amount */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9' }}>
                                                                🏧 Withdrawal {shortId ? `(#${shortId})` : ''}
                                                            </span>
                                                            {isPending && (
                                                                <span style={{
                                                                    fontSize: '0.68rem',
                                                                    fontWeight: 700,
                                                                    color: '#f59e0b',
                                                                    background: 'rgba(245, 158, 11, 0.15)',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '12px',
                                                                    border: '1px solid rgba(245, 158, 11, 0.3)'
                                                                }}>
                                                                    ⏳ Verification (5–10m)
                                                                </span>
                                                            )}
                                                            {isApproved && (
                                                                <span style={{
                                                                    fontSize: '0.68rem',
                                                                    fontWeight: 700,
                                                                    color: '#10b981',
                                                                    background: 'rgba(16, 185, 129, 0.15)',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '12px',
                                                                    border: '1px solid rgba(16, 185, 129, 0.3)'
                                                                }}>
                                                                    ✓ Transferred
                                                                </span>
                                                            )}
                                                            {isRejected && (
                                                                <span style={{
                                                                    fontSize: '0.68rem',
                                                                    fontWeight: 700,
                                                                    color: '#ef4444',
                                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '12px',
                                                                    border: '1px solid rgba(239, 68, 68, 0.3)'
                                                                }}>
                                                                    ✕ Rejected
                                                                </span>
                                                            )}
                                                        </div>
                                                        <strong style={{
                                                            fontSize: '1rem',
                                                            color: isPending ? '#fbbf24' : isApproved ? '#34d399' : '#94a3b8'
                                                        }}>
                                                            ₹{Number(w.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </strong>
                                                    </div>

                                                    {/* Row 2: Destination */}
                                                    <div style={{ fontSize: '0.78rem', color: '#cbd5e1', wordBreak: 'break-all' }}>
                                                        <span style={{ color: '#94a3b8' }}>To: </span>
                                                        <strong>{w.payoutDestination}</strong>
                                                    </div>

                                                    {/* Row 3: Meta & Timestamp */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748b' }}>
                                                        <span>{timeStr}</span>
                                                        {isApproved && w.transactionRef && (
                                                            <span style={{ color: '#34d399', fontFamily: 'monospace' }}>
                                                                Ref: {w.transactionRef}
                                                            </span>
                                                        )}
                                                        {isRejected && w.rejectionReason && (
                                                            <span style={{ color: '#f87171' }}>
                                                                Reason: {w.rejectionReason}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isPending && (
                                                        <div style={{ fontSize: '0.72rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.08)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                                            Wait for 5–10 minutes for verification
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            ) : (
                                /* Cashier Ledger (Deposits, Withdrawals, Refunds Only - Game Bets are displayed in individual game history) */
                                <div className="amrat-tx-list">
                                    {cashierTransactions.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b', fontSize: '0.85rem' }}>
                                            No deposit or withdrawal ledger records yet.
                                        </div>
                                    ) : (
                                        cashierTransactions.slice(0, 30).map((tx) => {
                                            const isPos = tx.amount >= 0
                                            const timeStr = tx.timestamp instanceof Date
                                                ? tx.timestamp.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
                                                : new Date(tx.timestamp || 0).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })

                                            return (
                                                <div key={tx.id} className="amrat-tx-card">
                                                    <div className="amrat-tx-meta">
                                                        <span className="amrat-tx-type">
                                                            {tx.type === 'deposit' && '💰 Deposit'}
                                                            {tx.type === 'withdrawal' && '🏧 Withdrawal'}
                                                            {tx.type === 'refund' && '↩️ Refund'}
                                                            {tx.status === 'pending' && ' ⏳ (Pending)'}
                                                            {tx.utrNumber ? ` (UTR: ${tx.utrNumber})` : ''}
                                                        </span>
                                                        <span className="amrat-tx-time">{timeStr}</span>
                                                    </div>
                                                    <span className={`amrat-tx-amount ${isPos ? 'positive' : 'negative'}`}>
                                                        {isPos ? '+' : ''}₹{Math.abs(tx.amount).toFixed(2)}
                                                    </span>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
