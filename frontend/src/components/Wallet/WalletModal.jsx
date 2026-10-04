import { useState, useEffect } from 'react'
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
        canWithdraw,
        deposit,
        withdraw,
        transactions,
        showToast,
    } = useWallet()

    const [activeTab, setActiveTab] = useState('deposit')
    const [copied, setCopied] = useState(false)

    // Deposit State
    const [depositAmount, setDepositAmount] = useState('300')
    const [utrNumber, setUtrNumber] = useState('')
    const [isDepositing, setIsDepositing] = useState(false)
    const [depositSuccess, setDepositSuccess] = useState(null)

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

    // Sync tab when opened
    useEffect(() => {
        if (walletModalTab) {
            setActiveTab(walletModalTab)
        }
    }, [walletModalTab])

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
            await deposit(amt, {
                method: 'UPI',
                utrNumber: cleanUtr
            })
            setDepositSuccess({
                amount: amt,
                utr: cleanUtr
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
            await withdraw(amt, destination, {
                payoutMethod,
                bankDetails
            })
            setWithdrawSuccess({
                amount: amt,
                destination
            })
            setWithdrawAmount('')
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
                        <span>👑</span>
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
                                <div className="amrat-success-icon">✓</div>
                                <h3 style={{ margin: 0, color: '#10b981', fontSize: '1.25rem' }}>Deposit Submitted!</h3>
                                <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.5 }}>
                                    ₹{depositSuccess.amount.toLocaleString('en-IN')} has been added to your wallet.
                                    <br />
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
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
                        )
                    )}

                    {/* ══════════════════════════════════════════════════════════
                        TAB 2: WITHDRAW (ENFORCING ₹300 MIN DEPOSIT RULE)
                       ══════════════════════════════════════════════════════════ */}
                    {activeTab === 'withdraw' && (
                        withdrawSuccess ? (
                            <div className="amrat-success-card">
                                <div className="amrat-success-icon" style={{ borderColor: '#f59e0b', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.2)' }}>
                                    ✓
                                </div>
                                <h3 style={{ margin: 0, color: '#f59e0b', fontSize: '1.25rem' }}>Payout Requested!</h3>
                                <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.5 }}>
                                    Withdrawal request for ₹{withdrawSuccess.amount.toLocaleString('en-IN')} has been submitted.
                                    <br />
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                        Destination: <strong>{withdrawSuccess.destination}</strong>
                                    </span>
                                    <br />
                                    <span style={{ fontSize: '0.72rem', color: '#34d399', marginTop: '6px', display: 'inline-block' }}>
                                        Processing time: 5 to 15 minutes
                                    </span>
                                </p>
                                <button
                                    type="button"
                                    className="amrat-submit-withdraw-btn"
                                    style={{ marginTop: '12px' }}
                                    onClick={() => setWithdrawSuccess(null)}
                                >
                                    New Withdrawal
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
                        ) : !canWithdraw ? (
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
                        ) : (
                            <form onSubmit={handleWithdrawSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="amrat-unlocked-card">
                                    <span>✓</span>
                                    <span>Payouts Unlocked (Total Deposited: ₹{totalDeposited})</span>
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
                    {activeTab === 'history' && (
                        <div className="amrat-tx-list">
                            {transactions.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b', fontSize: '0.85rem' }}>
                                    No transaction activity recorded yet.
                                </div>
                            ) : (
                                transactions.slice(0, 30).map((tx) => {
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
                                                    {tx.type === 'bet' && '🎲 Game Bet'}
                                                    {tx.type === 'win' && '🏆 Game Win'}
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
            </div>
        </div>
    )
}
