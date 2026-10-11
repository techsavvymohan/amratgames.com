import { useState, useEffect, useMemo } from 'react'
import { useWallet } from '../../context/WalletContext'
import './WalletModal.css'

export const OFFICIAL_UPI_ID = 'shanviientrrprisee@ybl'
export const QR_IMAGE_PATH = '/images/upi-qr.png'

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
        showToast,
    } = useWallet()

    const [activeTab, setActiveTab] = useState('deposit')
    const [historySubTab, setHistorySubTab] = useState('withdrawals') // 'withdrawals' | 'all'
    const [copied, setCopied] = useState(false)

    // Deposit State
    const [depositAmount, setDepositAmount] = useState('300')
    const [utrNumber, setUtrNumber] = useState('')
    const [isDepositing, setIsDepositing] = useState(false)
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

    // Sync tab and refresh withdrawals when opened
    useEffect(() => {
        if (walletModalTab) {
            setActiveTab(walletModalTab)
        }
        if (isWalletModalOpen) {
            refreshWithdrawals?.()
        }
    }, [walletModalTab, isWalletModalOpen, refreshWithdrawals])

    // Fetch deterministic crypto deposit coordinates
    useEffect(() => {
        if (activeTab === 'deposit' && depositChannel === 'CRYPTO' && isWalletModalOpen) {
            let isCancelled = false
            const fetchCoords = async () => {
                setLoadingCrypto(true)
                try {
                    const token = localStorage.getItem('amrat_auth_token') || ''
                    const res = await fetch(`/api/wallet/crypto-deposit-info?currency=USDT&network=${cryptoNetwork}`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {}
                    })
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
    }, [activeTab, depositChannel, cryptoNetwork, isWalletModalOpen])

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

    // Submit Withdrawal
    const handleWithdrawSubmit = async (e) => {
        e?.preventDefault()
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
                instantPayout: Boolean(res?.instantPayout || res?.withdrawal?.status === 'approved'),
                dispatchRef: res?.dispatchRef || res?.withdrawal?.transactionRef || null,
                estimatedArrival: res?.estimatedArrival || (res?.instantPayout ? 'Instant (60s)' : '10-30 minutes')
            })
            setWithdrawAmount('')
            refreshWithdrawals?.()
        } catch (err) {
            showToast?.('error', 'Withdrawal Error', err?.message || 'Could not process payout')
        } finally {
            setIsWithdrawing(false)
        }
    }

    const PRESET_AMOUNTS = [300, 500, 1000, 2500, 5000]

    return (
        <div className="amrat-wallet-overlay" onClick={closeWalletModal}>
            <div className="amrat-wallet-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="amrat-wallet-header">
                    <div className="amrat-wallet-header-title">
                        <img src="/amrat-logo.png" alt="AmratGames" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
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

                                        {loadingCrypto ? (
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
                                    <form onSubmit={handleDepositSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        {/* UPI ID Box with One-Click Copy */}
                                        <div className="amrat-upi-box">
                                            <div className="amrat-upi-details">
                                                <span className="amrat-upi-lbl">Official Deposit UPI ID (INR)</span>
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

                                        {/* QR Code Card */}
                                        <div className="amrat-qr-container">
                                            <img
                                                src={QR_IMAGE_PATH}
                                                alt="PhonePe UPI QR Code"
                                                className="amrat-qr-img"
                                            />
                                            <span className="amrat-qr-caption">
                                                <span>📲</span>
                                                <span>Scan with PhonePe / GPay / Paytm / BHIM</span>
                                            </span>
                                        </div>

                                        {/* Step 1: Amount Selection */}
                                        <div className="amrat-field-group">
                                            <label className="amrat-field-lbl">
                                                <span>1. Deposit Amount (INR ₹)</span>
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
                                                    placeholder="Enter custom amount"
                                                    value={depositAmount}
                                                    min="100"
                                                    step="1"
                                                    onChange={(e) => setDepositAmount(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Step 2: 12-Digit UTR Input */}
                                        <div className="amrat-field-group">
                                            <label className="amrat-field-lbl">
                                                <span>2. Enter 12-Digit UPI Ref / UTR No.</span>
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
                                                After paying via PhonePe or any UPI app, copy the 12-digit UTR/Ref number from your payment receipt and enter it above.
                                            </span>
                                        </div>

                                        {/* Submit Button */}
                                        <button
                                            type="submit"
                                            className="amrat-submit-deposit-btn"
                                            disabled={isDepositing || !depositAmount || parseFloat(depositAmount) <= 0}
                                        >
                                            {isDepositing
                                                ? 'Verifying & Adding Funds…'
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
                            <div className="amrat-success-card">
                                <div className="amrat-success-icon" style={{ borderColor: withdrawSuccess.instantPayout ? '#10b981' : '#f59e0b', color: withdrawSuccess.instantPayout ? '#10b981' : '#f59e0b', background: withdrawSuccess.instantPayout ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)' }}>
                                    {withdrawSuccess.instantPayout ? '⚡' : '⏳'}
                                </div>
                                <h3 style={{ margin: 0, color: withdrawSuccess.instantPayout ? '#10b981' : '#f59e0b', fontSize: '1.25rem' }}>
                                    {withdrawSuccess.instantPayout ? 'Instant Settlement Dispatched!' : 'Withdrawal Request Submitted!'}
                                </h3>
                                <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.5 }}>
                                    {withdrawSuccess.instantPayout ? (
                                        <>₹{withdrawSuccess.amount.toLocaleString('en-IN')} approved automatically via high-speed settlement rails.</>
                                    ) : (
                                        <>Your request for ₹{withdrawSuccess.amount.toLocaleString('en-IN')} has been sent to our cashier team.</>
                                    )}
                                    <br />
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                        Destination: <strong>{withdrawSuccess.destination}</strong>
                                    </span>
                                    {withdrawSuccess.dispatchRef && (
                                        <>
                                            <br />
                                            <span style={{ fontSize: '0.75rem', color: '#34d399', fontFamily: 'monospace' }}>
                                                Settlement Ref: <strong>{withdrawSuccess.dispatchRef}</strong>
                                            </span>
                                        </>
                                    )}
                                    <br />
                                    <span style={{ fontSize: '0.74rem', color: withdrawSuccess.instantPayout ? '#34d399' : '#fbbf24', marginTop: '6px', display: 'inline-block' }}>
                                        Status: <strong>{withdrawSuccess.instantPayout ? 'Auto-Approved (Sub-60s Transfer)' : 'Priority Cashier Queue (' + (withdrawSuccess.estimatedArrival || '10 to 20 mins') + ')'}</strong>
                                    </span>
                                </p>
                                <button
                                    type="button"
                                    className="amrat-submit-withdraw-btn"
                                    style={{ marginTop: '12px' }}
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

                                <div className="amrat-settlement-tier-badge">
                                    <span>⚡</span>
                                    <span>Instant Settlement Active: Requests under ₹10,000 are auto-approved &amp; disbursed in 60s.</span>
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
                                                                    ⏳ Pending Review
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
