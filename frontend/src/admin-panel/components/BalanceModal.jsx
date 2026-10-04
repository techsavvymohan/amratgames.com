import { useState } from 'react'

export default function BalanceModal({
    user,
    adjustCurrency,
    setAdjustCurrency,
    adjustAmount,
    setAdjustAmount,
    adjustNote,
    setAdjustNote,
    onClose,
    onSubmit
}) {
    if (!user) return null

    // Track Add (+) vs Deduct (-) mode
    const [actionType, setActionType] = useState('add') // 'add' | 'deduct'

    const currentBal = user.balances?.[adjustCurrency] ?? 0

    // Handle form submit ensuring the correct sign is passed
    const handleFormSubmit = (e) => {
        e.preventDefault()
        const rawAmt = Math.abs(parseFloat(adjustAmount))
        if (isNaN(rawAmt) || rawAmt <= 0) return

        const finalAmount = actionType === 'deduct' ? -rawAmt : rawAmt
        setAdjustAmount(finalAmount)
        onSubmit(e)
    }

    const quickAmounts = adjustCurrency === 'INR'
        ? [500, 1000, 2000, 5000, 10000, 50000]
        : adjustCurrency === 'AMRAT'
        ? [100, 500, 1000, 5000, 25000]
        : [10, 50, 100, 500, 1000]

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                <div className="modal-header">
                    <div>
                        <h3 style={{ margin: 0, color: '#ffd700', fontSize: '1.2rem' }}>
                            Update Player Wallet
                        </h3>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                            Player: <strong>{user.username}</strong> {user.phone && `(📱 +91 ${user.phone})`}
                        </div>
                    </div>
                    <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleFormSubmit}>
                    {/* Add vs Deduct Toggle Switch */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        background: 'rgba(0,0,0,0.5)',
                        padding: '6px',
                        borderRadius: '10px',
                        marginBottom: '16px'
                    }}>
                        <button
                            type="button"
                            onClick={() => setActionType('add')}
                            style={{
                                padding: '10px',
                                border: 'none',
                                borderRadius: '8px',
                                background: actionType === 'add' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                                color: actionType === 'add' ? '#fff' : '#94a3b8',
                                fontWeight: 800,
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>➕ Add Money</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActionType('deduct')}
                            style={{
                                padding: '10px',
                                border: 'none',
                                borderRadius: '8px',
                                background: actionType === 'deduct' ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'transparent',
                                color: actionType === 'deduct' ? '#fff' : '#94a3b8',
                                fontWeight: 800,
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>➖ Deduct Money</span>
                        </button>
                    </div>

                    {/* Currency Selector */}
                    <div className="form-group">
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Select Currency</span>
                            <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                                Current Balance: {currentBal.toLocaleString()} {adjustCurrency}
                            </span>
                        </label>
                        <select
                            className="form-input"
                            value={adjustCurrency}
                            onChange={(e) => setAdjustCurrency(e.target.value)}
                        >
                            <option value="INR">🇮🇳 INR — Indian Rupee (₹)</option>
                            <option value="AMRAT">👑 $AMRAT — Platform VIP Coins</option>
                            <option value="USDT">₮ USDT — Tether Dollar</option>
                            <option value="BTC">₿ BTC — Bitcoin</option>
                        </select>
                    </div>

                    {/* Amount Input */}
                    <div className="form-group">
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Enter Amount ({adjustCurrency})</span>
                        </label>
                        <input
                            type="number"
                            min="1"
                            step="any"
                            className="form-input"
                            placeholder="e.g. 5000"
                            value={Math.abs(adjustAmount) || ''}
                            onChange={(e) => setAdjustAmount(e.target.value)}
                            required
                            autoFocus
                            style={{ fontSize: '1.2rem', fontWeight: 700, color: actionType === 'add' ? '#34d399' : '#f87171' }}
                        />
                    </div>

                    {/* Quick Amount Buttons */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                        {quickAmounts.map(val => (
                            <button
                                key={val}
                                type="button"
                                onClick={() => setAdjustAmount(val)}
                                style={{
                                    padding: '5px 10px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '6px',
                                    color: '#fbbf24',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                +{val.toLocaleString()}
                            </button>
                        ))}
                    </div>

                    {/* Reason / Note */}
                    <div className="form-group">
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Reason / Note</span>
                            <small style={{ color: '#94a3b8' }}>e.g. UPI Deposit, Manual Adjustment, Bonus</small>
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Received UPI Deposit / Manual Settlement"
                            value={adjustNote}
                            onChange={(e) => setAdjustNote(e.target.value)}
                            required
                        />
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                        <button
                            type="button"
                            className="btn-action"
                            style={{ flex: 1, padding: '12px' }}
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                flex: 2,
                                padding: '12px',
                                background: actionType === 'add'
                                    ? 'linear-gradient(135deg, #10b981, #059669)'
                                    : 'linear-gradient(135deg, #ef4444, #b91c1c)',
                                border: 'none',
                                borderRadius: '10px',
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(0,0,0,0.35)'
                            }}
                        >
                            {actionType === 'add' ? '✓ Confirm Add Money' : '⚠️ Confirm Deduct Money'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
