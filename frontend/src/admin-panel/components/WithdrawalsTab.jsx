import { useState, useMemo } from 'react'
import { QRCode } from 'antd'
import {
    sanitizeUpiId,
    isValidUpiId,
    formatUpiAmount,
    buildUpiPayUri,
    buildAppUpiUris,
    isMobileDevice,
    launchUpiApp
} from '../../utils/upiIntent'

export default function WithdrawalsTab({
    withdrawals = [],
    stats = null,
    loading = false,
    onApprove,
    onReject,
    onRefresh,
    triggerToast
}) {
    const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'pending' | 'approved' | 'rejected'
    const [searchQuery, setSearchQuery] = useState('')

    // Modal state for Approval
    const [approvingItem, setApprovingItem] = useState(null)
    const [transferRef, setTransferRef] = useState('')
    const [approvalNote, setApprovalNote] = useState('')
    const [isSubmittingApproval, setIsSubmittingApproval] = useState(false)
    const [showDesktopQr, setShowDesktopQr] = useState(true)

    // Modal state for Rejection
    const [rejectingItem, setRejectingItem] = useState(null)
    const [rejectionReason, setRejectionReason] = useState('')
    const [rejectionNote, setRejectionNote] = useState('')
    const [isSubmittingRejection, setIsSubmittingRejection] = useState(false)

    // Copy helper
    const handleCopy = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text)
            triggerToast?.(`✓ ${label} copied to clipboard!`)
        } catch {
            triggerToast?.(`${label}: ${text}`)
        }
    }

    // 1-Click UPI Pay Launcher
    const handleOneClickUpi = (w) => {
        const uris = buildAppUpiUris({
            upiId: w.payoutDestination,
            amount: w.amount,
            payeeName: w.username || 'Amrat Player',
            transactionNote: `AmratGames Cashout #${w.id}`
        })

        // On mobile devices, immediately trigger the UPI intent chooser
        if (isMobileDevice() && uris?.universal) {
            launchUpiApp(uris.universal)
            triggerToast?.('⚡ Opening UPI App...')
        }

        // Open approval modal pre-populated
        setApprovingItem(w)
        setTransferRef('')
        setApprovalNote(isMobileDevice() ? 'Dispatched via 1-Click Mobile UPI' : 'Dispatched via UPI Intent / QR')
    }

    // 1-Click Copy All Bank Details for NetBanking
    const handleCopyAllBank = (w) => {
        const holder = w.bankDetails?.holder || w.username || 'Player'
        const acc = w.bankDetails?.accountNumber || '—'
        const ifsc = w.bankDetails?.ifsc || '—'
        const amt = Number(w.amount || 0).toFixed(2)
        const summary = `Beneficiary: ${holder}\nAccount Number: ${acc}\nIFSC Code: ${ifsc}\nAmount: ₹${amt}`
        handleCopy(summary, 'All Bank Transfer Details')
    }

    // Filtered withdrawals
    const filteredWithdrawals = useMemo(() => {
        return withdrawals.filter(w => {
            // Status filter
            if (statusFilter !== 'all' && w.status !== statusFilter) return false

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                const matchesUsername = w.username?.toLowerCase().includes(q)
                const matchesId = w.id?.toLowerCase().includes(q)
                const matchesDest = w.payoutDestination?.toLowerCase().includes(q)
                const matchesPhone = w.userPhone?.includes(q)
                const matchesEmail = w.userEmail?.toLowerCase().includes(q)
                const matchesBankHolder = w.bankDetails?.holder?.toLowerCase().includes(q)
                const matchesBankAcc = w.bankDetails?.accountNumber?.includes(q)
                if (!matchesUsername && !matchesId && !matchesDest && !matchesPhone && !matchesEmail && !matchesBankHolder && !matchesBankAcc) {
                    return false
                }
            }

            return true
        })
    }, [withdrawals, statusFilter, searchQuery])

    // Compute metrics
    const pendingItems = withdrawals.filter(w => w.status === 'pending')
    const approvedItems = withdrawals.filter(w => w.status === 'approved')
    const rejectedItems = withdrawals.filter(w => w.status === 'rejected')

    const pendingTotal = pendingItems.reduce((acc, w) => acc + (w.amount || 0), 0)
    const approvedTotal = approvedItems.reduce((acc, w) => acc + (w.amount || 0), 0)
    const rejectedTotal = rejectedItems.reduce((acc, w) => acc + (w.amount || 0), 0)

    // Quick rejection preset reasons
    const PRESET_REASONS = [
        'Invalid or unroutable UPI ID',
        'Incorrect Bank Account number or IFSC',
        'Account holder name does not match profile',
        'Deposit wagering requirement not completed',
        'Duplicate / Unverified payout request',
        'Technical issue with destination bank'
    ]

    // Handle Confirm Approval
    const handleConfirmApprove = async (e) => {
        e?.preventDefault?.()
        if (!approvingItem) return

        try {
            setIsSubmittingApproval(true)
            await onApprove(approvingItem.id, {
                transactionRef: transferRef.trim(),
                adminNote: approvalNote.trim()
            })
            setApprovingItem(null)
            setTransferRef('')
            setApprovalNote('')
        } catch (err) {
            alert('Approval failed: ' + (err.message || err))
        } finally {
            setIsSubmittingApproval(false)
        }
    }

    // Compute active UPI URIs for currently approving item
    const activeUpiUris = useMemo(() => {
        if (!approvingItem || approvingItem.payoutMethod === 'BANK' || !approvingItem.payoutDestination) {
            return null
        }
        return buildAppUpiUris({
            upiId: approvingItem.payoutDestination,
            amount: approvingItem.amount,
            payeeName: approvingItem.username || 'Amrat Player',
            transactionNote: `AmratGames Cashout #${approvingItem.id}`
        })
    }, [approvingItem])

    // Handle Confirm Rejection
    const handleConfirmReject = async (e) => {
        e.preventDefault()
        if (!rejectingItem) return
        if (!rejectionReason.trim()) {
            alert('Please select or specify a reason for rejection.')
            return
        }

        try {
            setIsSubmittingRejection(true)
            await onReject(rejectingItem.id, {
                rejectionReason: rejectionReason.trim(),
                adminNote: rejectionNote.trim()
            })
            setRejectingItem(null)
            setRejectionReason('')
            setRejectionNote('')
        } catch (err) {
            alert('Rejection failed: ' + (err.message || err))
        } finally {
            setIsSubmittingRejection(false)
        }
    }

    return (
        <div className="admin-tab-content">
            {/* Header / Summary KPI Row */}
            <div className="admin-kpi-grid">
                {/* 1. Pending Payouts Card */}
                <div className={`kpi-card ${pendingItems.length > 0 ? 'highlight-amber' : ''}`} style={{
                    borderColor: pendingItems.length > 0 ? 'rgba(245, 158, 11, 0.5)' : undefined,
                    background: pendingItems.length > 0 ? 'rgba(245, 158, 11, 0.08)' : undefined
                }}>
                    <div className="kpi-label">
                        <span>Pending Payouts</span>
                        <span>⏳</span>
                    </div>
                    <div className="kpi-value gold" style={{ color: '#f59e0b', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span>₹{pendingTotal.toLocaleString('en-IN')}</span>
                        <span style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 600 }}>({pendingItems.length})</span>
                    </div>
                    <div className="kpi-subtext" style={{ color: pendingItems.length > 0 ? '#fbbf24' : '#94a3b8' }}>
                        {pendingItems.length > 0 ? '● Requires manual money transfer' : 'All payouts processed'}
                    </div>
                </div>

                {/* 2. Approved Payouts Card */}
                <div className="kpi-card">
                    <div className="kpi-label">
                        <span>Approved &amp; Paid</span>
                        <span>✅</span>
                    </div>
                    <div className="kpi-value green">
                        ₹{approvedTotal.toLocaleString('en-IN')}
                    </div>
                    <div className="kpi-subtext" style={{ color: '#34d399' }}>
                        {approvedItems.length} payout(s) sent to players
                    </div>
                </div>

                {/* 3. Rejected Payouts Card */}
                <div className="kpi-card">
                    <div className="kpi-label">
                        <span>Rejected &amp; Refunded</span>
                        <span>❌</span>
                    </div>
                    <div className="kpi-value" style={{ color: '#f87171' }}>
                        ₹{rejectedTotal.toLocaleString('en-IN')}
                    </div>
                    <div className="kpi-subtext">
                        {rejectedItems.length} refunded back to players
                    </div>
                </div>

                {/* 4. Total Requests Card */}
                <div className="kpi-card">
                    <div className="kpi-label">
                        <span>Total Requests</span>
                        <span>🏧</span>
                    </div>
                    <div className="kpi-value gold">
                        {withdrawals.length}
                    </div>
                    <div className="kpi-subtext">
                        Cumulative platform withdrawals
                    </div>
                </div>
            </div>

            {/* Workflow Notice Banner for Cashier */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))',
                border: '1px solid rgba(245, 175, 25, 0.25)',
                borderRadius: '14px',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '28px' }}>🏦</span>
                    <div>
                        <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.95rem' }}>
                            Cashier Manual Transfer Workflow
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px', lineHeight: 1.4 }}>
                            1. Review destination details &rarr; 2. Copy UPI ID or Bank A/C &rarr; 3. Send money via your bank/UPI app &rarr; 4. Click <strong>Approve</strong> with UTR/Ref ID.
                        </div>
                    </div>
                </div>
                <button
                    className="btn-action"
                    onClick={onRefresh}
                    disabled={loading}
                    style={{ padding: '8px 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <span>🔄</span>
                    <span>{loading ? 'Refreshing…' : 'Refresh Requests'}</span>
                </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="admin-filter-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
                <div className="admin-search-wrap" style={{ flex: '1', minWidth: '260px' }}>
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="admin-search-input"
                        placeholder="Search player, request ID, UPI ID, or Bank A/C..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 8px' }}
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="admin-status-filters" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('all')}
                    >
                        All ({withdrawals.length})
                    </button>
                    <button
                        type="button"
                        className={`filter-pill ${statusFilter === 'pending' ? 'active warning' : ''}`}
                        onClick={() => setStatusFilter('pending')}
                        style={statusFilter === 'pending' ? { background: 'rgba(245, 158, 11, 0.25)', borderColor: '#f59e0b', color: '#f59e0b' } : {}}
                    >
                        ⏳ Pending ({pendingItems.length})
                    </button>
                    <button
                        type="button"
                        className={`filter-pill ${statusFilter === 'approved' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('approved')}
                    >
                        ✅ Approved ({approvedItems.length})
                    </button>
                    <button
                        type="button"
                        className={`filter-pill ${statusFilter === 'rejected' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('rejected')}
                    >
                        ❌ Rejected ({rejectedItems.length})
                    </button>
                </div>
            </div>

            {/* Withdrawals List Container */}
            <div className="admin-card-section">
                <div className="section-header">
                    <h2>
                        <span>🏧</span>
                        <span>Withdrawal Requests ({filteredWithdrawals.length})</span>
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        Showing {statusFilter.toUpperCase()} requests
                    </span>
                </div>

                {filteredWithdrawals.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        <div style={{ fontSize: '36px', marginBottom: '8px' }}>📭</div>
                        <div style={{ fontWeight: 600, fontSize: '1rem', color: '#94a3b8' }}>No withdrawal requests found</div>
                        <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                            {searchQuery ? 'Try clearing your search query' : 'When players request cashouts, they will appear here.'}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {filteredWithdrawals.map((w) => {
                            const isPending = w.status === 'pending'
                            const isApproved = w.status === 'approved'
                            const isRejected = w.status === 'rejected'

                            return (
                                <div
                                    key={w.id}
                                    style={{
                                        background: isPending
                                            ? 'rgba(245, 158, 11, 0.05)'
                                            : 'rgba(255, 255, 255, 0.02)',
                                        border: `1px solid ${
                                            isPending
                                                ? 'rgba(245, 158, 11, 0.4)'
                                                : isApproved
                                                ? 'rgba(16, 185, 129, 0.25)'
                                                : 'rgba(239, 68, 68, 0.25)'
                                        }`,
                                        borderRadius: '14px',
                                        padding: '18px 20px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '14px',
                                        transition: 'all 0.2s ease',
                                        boxShadow: isPending ? '0 4px 20px rgba(245, 158, 11, 0.1)' : 'none'
                                    }}
                                >
                                    {/* Top Row: ID, Badges, Amount */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: '12px',
                                        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                                        paddingBottom: '12px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                            <span style={{
                                                fontSize: '0.78rem',
                                                fontFamily: 'monospace',
                                                color: '#cbd5e1',
                                                background: 'rgba(255, 255, 255, 0.06)',
                                                padding: '3px 8px',
                                                borderRadius: '6px'
                                            }}>
                                                #{w.id}
                                            </span>

                                            {/* Status Badge */}
                                            {isPending && (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    background: 'rgba(245, 158, 11, 0.2)',
                                                    color: '#fbbf24',
                                                    border: '1px solid rgba(245, 158, 11, 0.4)',
                                                    padding: '3px 10px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700
                                                }}>
                                                    <span className="status-dot offline" /> PENDING CASHOUT
                                                </span>
                                            )}

                                            {isApproved && (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    background: 'rgba(16, 185, 129, 0.15)',
                                                    color: '#34d399',
                                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                                    padding: '3px 10px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700
                                                }}>
                                                    ✓ APPROVED &amp; PAID
                                                </span>
                                            )}

                                            {isRejected && (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                    color: '#f87171',
                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    padding: '3px 10px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700
                                                }}>
                                                    ✕ REJECTED &amp; REFUNDED
                                                </span>
                                            )}

                                            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                                Requested: {w.getFormattedDate ? w.getFormattedDate() : new Date(w.createdAt).toLocaleString()}
                                            </span>
                                        </div>

                                        {/* Amount Display */}
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{
                                                fontSize: '1.45rem',
                                                fontWeight: 800,
                                                color: isPending ? '#fbbf24' : isApproved ? '#34d399' : '#94a3b8',
                                                letterSpacing: '-0.02em'
                                            }}>
                                                ₹{Number(w.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                Payout Currency: {w.currency || 'INR'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Middle Section: Player Info + Destination Box */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                                        gap: '16px',
                                        alignItems: 'start'
                                    }}>
                                        {/* Player Card Column */}
                                        <div style={{
                                            background: 'rgba(0, 0, 0, 0.25)',
                                            padding: '12px 16px',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(255, 255, 255, 0.04)'
                                        }}>
                                            <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
                                                Player Account
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '18px' }}>👤</span>
                                                <strong style={{ color: '#f8fafc', fontSize: '0.95rem' }}>{w.username || 'Anonymous'}</strong>
                                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({w.userId})</span>
                                            </div>
                                            {w.userPhone && (
                                                <div style={{ fontSize: '0.82rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                                    <span>📱 Phone: <strong>{w.userPhone}</strong></span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(w.userPhone, 'Mobile number')}
                                                        style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', padding: 0, fontSize: '0.75rem' }}
                                                        title="Copy phone"
                                                    >
                                                        📋
                                                    </button>
                                                </div>
                                            )}
                                            {w.userEmail && (
                                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                                                    ✉️ {w.userEmail}
                                                </div>
                                            )}
                                        </div>

                                        {/* Payment Destination Column */}
                                        <div style={{
                                            background: 'rgba(0, 0, 0, 0.3)',
                                            padding: '14px 16px',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(245, 175, 25, 0.15)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: '#fbbf24', fontWeight: 700 }}>
                                                    {w.payoutMethod === 'BANK' ? '🏦 Bank Account Transfer' : '📱 UPI Payout Address'}
                                                </span>
                                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                    {w.payoutMethod === 'BANK' ? 'IMPS / NEFT' : 'Instant VPA'}
                                                </span>
                                            </div>

                                            {w.payoutMethod === 'BANK' && w.bankDetails ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ color: '#94a3b8' }}>A/C Holder:</span>
                                                        <strong style={{ color: '#f8fafc' }}>{w.bankDetails.holder || '—'}</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ color: '#94a3b8' }}>Account No:</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <strong style={{ color: '#ffd700', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                                                                {w.bankDetails.accountNumber}
                                                            </strong>
                                                            <button
                                                                type="button"
                                                                className="btn-action"
                                                                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                                                                onClick={() => handleCopy(w.bankDetails.accountNumber, 'Account Number')}
                                                            >
                                                                📋 Copy A/C
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ color: '#94a3b8' }}>IFSC Code:</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>
                                                                {w.bankDetails.ifsc}
                                                            </strong>
                                                            <button
                                                                type="button"
                                                                className="btn-action"
                                                                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                                                                onClick={() => handleCopy(w.bankDetails.ifsc, 'IFSC Code')}
                                                            >
                                                                📋 Copy IFSC
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* UPI ID Display with 1-click Copy */
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '8px 12px',
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    borderRadius: '8px',
                                                    border: '1px solid rgba(255, 255, 255, 0.08)'
                                                }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Target UPI ID</div>
                                                        <div style={{
                                                            fontSize: '1rem',
                                                            fontWeight: 700,
                                                            color: '#ffd700',
                                                            fontFamily: 'monospace'
                                                        }}>
                                                            {w.payoutDestination}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                        <button
                                                            type="button"
                                                            className="btn-action gold"
                                                            onClick={() => handleCopy(w.payoutDestination, 'UPI ID')}
                                                            style={{ padding: '8px 12px', fontSize: '0.78rem', fontWeight: 700 }}
                                                        >
                                                            📋 Copy
                                                        </button>
                                                        {isPending && (
                                                            <button
                                                                type="button"
                                                                className="btn-action gold"
                                                                onClick={() => handleOneClickUpi(w)}
                                                                style={{
                                                                    padding: '8px 14px',
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: 800,
                                                                    background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                                                                    color: '#000',
                                                                    border: 'none',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    boxShadow: '0 2px 10px rgba(245, 158, 11, 0.35)'
                                                                }}
                                                            >
                                                                <span>⚡</span> <span>1-Click Pay</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom Row: Audit Details OR Cashier Action Buttons */}
                                    {isPending ? (
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'flex-end',
                                            alignItems: 'center',
                                            gap: '10px',
                                            marginTop: '6px',
                                            paddingTop: '12px',
                                            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                            flexWrap: 'wrap'
                                        }}>
                                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginRight: 'auto' }}>
                                                💡 Use 1-Click UPI to send payment instantly, then confirm below.
                                            </span>

                                            <button
                                                type="button"
                                                className="btn-action danger"
                                                style={{ padding: '9px 16px', fontSize: '0.84rem' }}
                                                onClick={() => {
                                                    setRejectingItem(w)
                                                    setRejectionReason('')
                                                    setRejectionNote('')
                                                }}
                                            >
                                                ✕ Reject &amp; Refund
                                            </button>

                                            {w.payoutMethod === 'BANK' ? (
                                                <button
                                                    type="button"
                                                    className="btn-action"
                                                    style={{ padding: '9px 16px', fontSize: '0.84rem' }}
                                                    onClick={() => handleCopyAllBank(w)}
                                                >
                                                    📋 Copy Bank Info
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn-action gold"
                                                    style={{
                                                        padding: '9px 18px',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 800,
                                                        background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                                                        color: '#000',
                                                        border: 'none',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)'
                                                    }}
                                                    onClick={() => handleOneClickUpi(w)}
                                                >
                                                    <span>⚡</span> <span>Instant UPI Pay</span>
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                className="btn-airdrop-launch"
                                                style={{ padding: '9px 20px', fontSize: '0.85rem', fontWeight: 800 }}
                                                onClick={() => {
                                                    setApprovingItem(w)
                                                    setTransferRef('')
                                                    setApprovalNote('')
                                                }}
                                            >
                                                ✓ Approve (Money Sent)
                                            </button>
                                        </div>
                                    ) : (
                                        /* Processed Audit Information */
                                        <div style={{
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            background: isApproved ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                                            border: `1px solid ${isApproved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
                                            fontSize: '0.82rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: '10px'
                                        }}>
                                            <div>
                                                <span style={{ color: '#94a3b8' }}>Processed by: </span>
                                                <strong style={{ color: '#f8fafc' }}>{w.processedBy || 'admin'}</strong>
                                                <span style={{ color: '#64748b', marginLeft: '10px' }}>
                                                    {w.processedAt ? new Date(w.processedAt).toLocaleString() : ''}
                                                </span>
                                            </div>

                                            {isApproved && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {w.transactionRef && (
                                                        <span style={{ color: '#34d399', fontFamily: 'monospace' }}>
                                                            UTR/Ref: <strong>{w.transactionRef}</strong>
                                                        </span>
                                                    )}
                                                    {w.adminNote && (
                                                        <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>
                                                            &ldquo;{w.adminNote}&rdquo;
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {isRejected && (
                                                <div style={{ color: '#f87171' }}>
                                                    <span>Reason: </span>
                                                    <strong>{w.rejectionReason || 'Rejected by cashier'}</strong>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════════════════════════
                MODAL 1: APPROVE WITHDRAWAL CONFIRMATION & 1-CLICK DISPATCH
               ══════════════════════════════════════════════════════════ */}
            {approvingItem && (
                <div className="admin-modal-overlay" onClick={() => !isSubmittingApproval && setApprovingItem(null)}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>⚡</span>
                                <span>{activeUpiUris ? '1-Click Instant UPI Payout' : 'Confirm Payout Transfer'}</span>
                            </h3>
                            <button
                                className="modal-close-btn"
                                onClick={() => !isSubmittingApproval && setApprovingItem(null)}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleConfirmApprove}>
                            {activeUpiUris ? (
                                <div style={{
                                    background: 'rgba(245, 158, 11, 0.08)',
                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    marginBottom: '18px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <span style={{ fontSize: '0.76rem', textTransform: 'uppercase', color: '#fbbf24', fontWeight: 800, letterSpacing: '0.05em' }}>
                                            ⚡ Verified Player Cashout
                                        </span>
                                        <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                                            Zero Gateway Fee
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '0.88rem', color: '#cbd5e1' }}>Player: <strong>{approvingItem.username}</strong></span>
                                        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fbbf24', letterSpacing: '-0.02em' }}>
                                            ₹{Number(approvingItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 12px',
                                        background: 'rgba(0, 0, 0, 0.4)',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255, 255, 255, 0.06)',
                                        marginBottom: '14px'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Target UPI ID</div>
                                            <div style={{ fontFamily: 'monospace', fontSize: '0.96rem', color: '#ffd700', fontWeight: 700 }}>
                                                {approvingItem.payoutDestination}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn-action"
                                            style={{ padding: '6px 12px', fontSize: '0.76rem' }}
                                            onClick={() => handleCopy(approvingItem.payoutDestination, 'UPI ID')}
                                        >
                                            📋 Copy UPI
                                        </button>
                                    </div>

                                    {/* 1-Tap App Launcher Buttons */}
                                    <div style={{ marginBottom: '14px' }}>
                                        <div style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
                                            1-Tap Pay via Installed Mobile App
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '8px' }}>
                                            <button
                                                type="button"
                                                className="btn-action gold"
                                                style={{
                                                    padding: '9px 8px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 800,
                                                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                                    color: '#000',
                                                    border: 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '4px'
                                                }}
                                                onClick={() => launchUpiApp(activeUpiUris.universal)}
                                            >
                                                <span>⚡</span> <span>Any UPI App</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-action"
                                                style={{
                                                    padding: '9px 8px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700,
                                                    background: 'rgba(103, 58, 183, 0.25)',
                                                    border: '1px solid #7c3aed',
                                                    color: '#c4b5fd',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '4px'
                                                }}
                                                onClick={() => launchUpiApp(activeUpiUris.phonepe)}
                                            >
                                                <span>🟣</span> <span>PhonePe</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-action"
                                                style={{
                                                    padding: '9px 8px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700,
                                                    background: 'rgba(2, 136, 209, 0.25)',
                                                    border: '1px solid #0288d1',
                                                    color: '#7dd3fc',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '4px'
                                                }}
                                                onClick={() => launchUpiApp(activeUpiUris.paytm)}
                                            >
                                                <span>🔷</span> <span>Paytm</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-action"
                                                style={{
                                                    padding: '9px 8px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700,
                                                    background: 'rgba(59, 130, 246, 0.2)',
                                                    border: '1px solid #3b82f6',
                                                    color: '#93c5fd',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '4px'
                                                }}
                                                onClick={() => launchUpiApp(activeUpiUris.gpay)}
                                            >
                                                <span>🔵</span> <span>Google Pay</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Desktop QR Code Scanner */}
                                    <div style={{
                                        background: 'rgba(0, 0, 0, 0.35)',
                                        borderRadius: '10px',
                                        padding: '12px 14px',
                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.76rem', color: '#cbd5e1', fontWeight: 600 }}>
                                                📷 Scan to Pay with Phone (Auto-fills ₹{formatUpiAmount(approvingItem.amount)})
                                            </span>
                                            <button
                                                type="button"
                                                style={{ background: 'none', border: 'none', color: '#fbbf24', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }}
                                                onClick={() => setShowDesktopQr(!showDesktopQr)}
                                            >
                                                {showDesktopQr ? 'Hide QR' : 'Show QR'}
                                            </button>
                                        </div>

                                        {showDesktopQr && (
                                            <div style={{
                                                padding: '10px',
                                                background: '#ffffff',
                                                borderRadius: '10px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
                                            }}>
                                                <QRCode
                                                    value={activeUpiUris.universal}
                                                    size={150}
                                                    bgColor="#ffffff"
                                                    color="#000000"
                                                    bordered={false}
                                                />
                                                <div style={{ fontSize: '0.68rem', color: '#334155', fontWeight: 700, marginTop: '4px' }}>
                                                    Scan with PhonePe, GPay, or Paytm
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    borderRadius: '10px',
                                    padding: '14px 16px',
                                    marginBottom: '18px'
                                }}>
                                    <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '8px' }}>
                                        You are marking this bank payout as completed. Please ensure funds are transferred via NetBanking/IMPS.
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Player: {approvingItem.username}</span>
                                        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
                                            ₹{Number(approvingItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div style={{
                                        marginTop: '8px',
                                        padding: '8px 10px',
                                        background: 'rgba(0,0,0,0.3)',
                                        borderRadius: '6px',
                                        fontSize: '0.82rem',
                                        color: '#ffd700',
                                        fontFamily: 'monospace'
                                    }}>
                                        {approvingItem.payoutDestination}
                                    </div>
                                    {approvingItem.bankDetails && (
                                        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                                            <button
                                                type="button"
                                                className="btn-action"
                                                style={{ fontSize: '0.76rem', padding: '6px 12px' }}
                                                onClick={() => handleCopyAllBank(approvingItem)}
                                            >
                                                📋 Copy All NetBanking Details
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="form-group" style={{ marginBottom: '14px' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                                    Bank Ref / UPI UTR Number (Optional but Recommended)
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. 429381928374 (From UPI payment receipt)"
                                    value={transferRef}
                                    onChange={(e) => setTransferRef(e.target.value)}
                                    autoFocus
                                />
                                <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                                    This reference will be visible to the player in their cashier ledger.
                                </span>
                            </div>

                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                                    Internal Admin Note (Optional)
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. Sent via PhonePe Instant UPI"
                                    value={approvalNote}
                                    onChange={(e) => setApprovalNote(e.target.value)}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn-action"
                                    disabled={isSubmittingApproval}
                                    onClick={() => setApprovingItem(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-airdrop-launch"
                                    disabled={isSubmittingApproval}
                                    style={{ fontWeight: 800, padding: '10px 24px' }}
                                >
                                    {isSubmittingApproval ? 'Saving Payout…' : 'Confirm Money Sent & Approve'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                MODAL 2: REJECT WITHDRAWAL CONFIRMATION
               ══════════════════════════════════════════════════════════ */}
            {rejectingItem && (
                <div className="admin-modal-overlay" onClick={() => !isSubmittingRejection && setRejectingItem(null)}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171' }}>
                                <span>❌</span>
                                <span>Reject Withdrawal Request</span>
                            </h3>
                            <button
                                className="modal-close-btn"
                                onClick={() => !isSubmittingRejection && setRejectingItem(null)}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleConfirmReject}>
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '10px',
                                padding: '14px 16px',
                                marginBottom: '18px'
                            }}>
                                <div style={{ fontSize: '0.85rem', color: '#fca5a5', fontWeight: 600 }}>
                                    ⚠️ Player Balance Will Be Refunded
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '4px', lineHeight: 1.4 }}>
                                    Rejecting this withdrawal will automatically restore <strong>₹{Number(rejectingItem.amount || 0).toLocaleString('en-IN')}</strong> back into <strong>{rejectingItem.username}</strong>&apos;s wallet balance.
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                                    Select Reason Preset
                                </label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {PRESET_REASONS.map((reason) => (
                                        <button
                                            key={reason}
                                            type="button"
                                            className={`filter-pill ${rejectionReason === reason ? 'active danger' : ''}`}
                                            onClick={() => setRejectionReason(reason)}
                                            style={{
                                                fontSize: '0.74rem',
                                                padding: '4px 10px',
                                                background: rejectionReason === reason ? 'rgba(239, 68, 68, 0.25)' : undefined,
                                                borderColor: rejectionReason === reason ? '#f87171' : undefined,
                                                color: rejectionReason === reason ? '#f87171' : undefined
                                            }}
                                        >
                                            {reason}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '14px' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                                    Rejection Reason (Visible to Player)
                                </label>
                                <textarea
                                    className="form-input"
                                    rows={2}
                                    placeholder="Explain why the withdrawal could not be processed..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    required
                                    style={{ resize: 'vertical' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                                    Admin Internal Log (Optional)
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Optional cashier notes..."
                                    value={rejectionNote}
                                    onChange={(e) => setRejectionNote(e.target.value)}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn-action"
                                    disabled={isSubmittingRejection}
                                    onClick={() => setRejectingItem(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-action danger"
                                    disabled={isSubmittingRejection || !rejectionReason.trim()}
                                    style={{ padding: '10px 24px', fontWeight: 700 }}
                                >
                                    {isSubmittingRejection ? 'Refunding Player…' : 'Confirm Rejection & Refund'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
