import { useState, useMemo } from 'react'

export default function DepositsTab({
    deposits = [],
    loading = false,
    onApprove,
    onReject,
    onRefresh,
    triggerToast
}) {
    const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'pending' | 'completed' | 'rejected'
    const [channelFilter, setChannelFilter] = useState('all') // 'all' | 'youpi' | 'manual'
    const [searchQuery, setSearchQuery] = useState('')

    // Modal state for Approval
    const [approvingItem, setApprovingItem] = useState(null)
    const [approvalNote, setApprovalNote] = useState('UTR Verified & Funds Credited')
    const [isSubmittingApproval, setIsSubmittingApproval] = useState(false)

    // Modal state for Rejection
    const [rejectingItem, setRejectingItem] = useState(null)
    const [rejectionReason, setRejectionReason] = useState('Invalid UTR / Payment Not Received')
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

    // Filtered deposits
    const filteredDeposits = useMemo(() => {
        return deposits.filter(d => {
            if (statusFilter !== 'all' && d.status !== statusFilter) return false

            const isAuto = Boolean(
                d.isAutomatedGateway?.() ||
                (d.paymentMethod && d.paymentMethod.toUpperCase().includes('YOUPI')) ||
                (d.approvedBy && d.approvedBy.toUpperCase().includes('WEBHOOK'))
            )

            if (channelFilter === 'youpi' && !isAuto) return false
            if (channelFilter === 'manual' && isAuto) return false

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                const matchesUsername = d.username?.toLowerCase().includes(q)
                const matchesId = d.id?.toLowerCase().includes(q)
                const matchesUtr = d.utrNumber?.toLowerCase().includes(q)
                const matchesPhone = d.userPhone?.includes(q)
                const matchesEmail = d.userEmail?.toLowerCase().includes(q)
                if (!matchesUsername && !matchesId && !matchesUtr && !matchesPhone && !matchesEmail) {
                    return false
                }
            }

            return true
        })
    }, [deposits, statusFilter, channelFilter, searchQuery])

    // KPI Metrics
    const stats = useMemo(() => {
        const automated = deposits.filter(d =>
            d.isAutomatedGateway?.() ||
            (d.paymentMethod && d.paymentMethod.toUpperCase().includes('YOUPI')) ||
            (d.approvedBy && d.approvedBy.toUpperCase().includes('WEBHOOK'))
        )
        const manual = deposits.filter(d =>
            !d.isAutomatedGateway?.() &&
            !(d.paymentMethod && d.paymentMethod.toUpperCase().includes('YOUPI')) &&
            !(d.approvedBy && d.approvedBy.toUpperCase().includes('WEBHOOK'))
        )

        const pending = manual.filter(d => d.status === 'pending')
        const manualCompleted = manual.filter(d => d.status === 'completed')
        const rejected = deposits.filter(d => d.status === 'rejected')

        const automatedAmount = automated.reduce((sum, d) => sum + (d.amount || 0), 0)
        const pendingAmount = pending.reduce((sum, d) => sum + (d.amount || 0), 0)
        const manualCompletedAmount = manualCompleted.reduce((sum, d) => sum + (d.amount || 0), 0)

        return {
            totalCount: deposits.length,
            automatedCount: automated.length,
            automatedAmount,
            pendingCount: pending.length,
            pendingAmount,
            manualCompletedCount: manualCompleted.length,
            manualCompletedAmount,
            rejectedCount: rejected.length
        }
    }, [deposits])

    // Handle Confirm Approval
    const handleConfirmApprove = async () => {
        if (!approvingItem) return
        try {
            setIsSubmittingApproval(true)
            await onApprove(approvingItem.id, { adminNote: approvalNote.trim() })
            triggerToast?.(`✓ Deposit of ₹${approvingItem.amount.toLocaleString('en-IN')} approved for ${approvingItem.username}!`)
            setApprovingItem(null)
        } catch (err) {
            triggerToast?.(`✕ Approval failed: ${err.message}`)
        } finally {
            setIsSubmittingApproval(false)
        }
    }

    // Handle Confirm Rejection
    const handleConfirmReject = async () => {
        if (!rejectingItem) return
        try {
            setIsSubmittingRejection(true)
            await onReject(rejectingItem.id, { rejectionReason: rejectionReason.trim() })
            triggerToast?.(`Deposit request rejected for ${rejectingItem.username}.`)
            setRejectingItem(null)
        } catch (err) {
            triggerToast?.(`✕ Rejection failed: ${err.message}`)
        } finally {
            setIsSubmittingRejection(false)
        }
    }

    return (
        <div className="admin-card-section">
            {/* Header & KPI Summary */}
            <div className="section-header">
                <div>
                    <h2>
                        <span>📥</span>
                        <span>Deposit Verification &amp; Cashier Review</span>
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0' }}>
                        Match player UPI UTR references against bank receipts and credit player wallets.
                    </p>
                </div>
                <button
                    className="btn-action gold"
                    onClick={onRefresh}
                    disabled={loading}
                    title="Reload latest deposit requests"
                >
                    {loading ? 'Refreshing...' : '↻ Refresh'}
                </button>
            </div>

            {/* Gateway Banner */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 95, 70, 0.2))',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '12px',
                padding: '14px 20px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '26px' }}>⚡</span>
                    <div>
                        <div style={{ fontWeight: 800, color: '#34d399', fontSize: '0.94rem' }}>
                            YouPi-PG Sovereign Payment Gateway Synchronized
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '2px' }}>
                            Automated deposits are verified &amp; credited via webhook in real-time. Manual UPI deposits require UTR review.
                        </div>
                    </div>
                </div>
                <a
                    href="/youpi-admin/"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <span>YouPi Merchant Hub</span>
                    <span>↗</span>
                </a>
            </div>

            {/* Quick KPI Stat Tiles */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                marginBottom: '18px'
            }}>
                <div style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '10px',
                    padding: '14px'
                }}>
                    <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 700 }}>⚡ YOUPI AUTO-CREDITED</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                        ₹{stats.automatedAmount.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6ee7b7', marginTop: '2px' }}>
                        {stats.automatedCount} gateway webhook deposits
                    </div>
                </div>

                <div style={{
                    background: stats.pendingCount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    border: stats.pendingCount > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '14px'
                }}>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>PENDING MANUAL REVIEW</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: stats.pendingCount > 0 ? '#fbbf24' : '#fff', marginTop: '4px' }}>
                        {stats.pendingCount} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>requests</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#fbbf24', marginTop: '2px' }}>
                        ₹{stats.pendingAmount.toLocaleString('en-IN')} awaiting verification
                    </div>
                </div>

                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '14px'
                }}>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>MANUAL VERIFIED</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                        ₹{stats.manualCompletedAmount.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                        {stats.manualCompletedCount} manual UTRs approved
                    </div>
                </div>

                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '14px'
                }}>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>TOTAL ATTEMPTS</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                        {stats.totalCount}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                        {stats.rejectedCount} rejected / invalid
                    </div>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="admin-controls-bar">
                <input
                    type="text"
                    className="admin-search-input"
                    placeholder="Search by Player, UTR, or Deposit ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                    className="admin-select"
                    value={channelFilter}
                    onChange={(e) => setChannelFilter(e.target.value)}
                    style={{ minWidth: '170px' }}
                >
                    <option value="all">All Channels ({deposits.length})</option>
                    <option value="youpi">⚡ YouPi Gateway ({stats.automatedCount})</option>
                    <option value="manual">🖐️ Manual UPI ({stats.pendingCount + stats.manualCompletedCount})</option>
                </select>
                <select
                    className="admin-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">All Statuses</option>
                    <option value="pending">⏳ Pending Review ({stats.pendingCount})</option>
                    <option value="completed">✓ Verified &amp; Completed</option>
                    <option value="rejected">✕ Rejected ({stats.rejectedCount})</option>
                </select>
            </div>

            {/* Deposits Table */}
            <div className="admin-table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Date / Time</th>
                            <th>Player</th>
                            <th>Amount (₹)</th>
                            <th>Method</th>
                            <th>UTR Reference</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Cashier Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDeposits.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>📥</div>
                                    <div>No deposit records found matching criteria.</div>
                                </td>
                            </tr>
                        ) : (
                            filteredDeposits.map((d) => (
                                <tr key={d.id} style={{ background: d.status === 'pending' ? 'rgba(245, 158, 11, 0.04)' : undefined }}>
                                    <td style={{ fontSize: '0.82rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                        {d.getFormattedDate ? d.getFormattedDate() : new Date(d.createdAt).toLocaleString('en-IN')}
                                    </td>
                                    <td>
                                        <div className="user-cell">
                                            <div className="user-avatar">👤</div>
                                            <div>
                                                <div className="user-info-name">{d.username}</div>
                                                {d.userPhone && (
                                                    <div style={{ color: '#fbbf24', fontSize: '0.78rem', fontWeight: 600 }}>
                                                        📱 +91 {d.userPhone}
                                                    </div>
                                                )}
                                                {d.userEmail && <div className="user-info-email">{d.userEmail}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 800, color: '#f5af19', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                                        ₹{d.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td>
                                        {d.isAutomatedGateway?.() || (d.paymentMethod && d.paymentMethod.toUpperCase().includes('YOUPI')) || (d.approvedBy && d.approvedBy.toUpperCase().includes('WEBHOOK')) ? (
                                            <span style={{
                                                fontSize: '0.78rem',
                                                fontWeight: 800,
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                background: 'rgba(16, 185, 129, 0.18)',
                                                color: '#34d399',
                                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                ⚡ YouPi Auto
                                            </span>
                                        ) : (
                                            <span style={{
                                                fontSize: '0.78rem',
                                                fontWeight: 700,
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                background: 'rgba(99, 102, 241, 0.15)',
                                                color: '#818cf8',
                                                border: '1px solid rgba(99, 102, 241, 0.3)'
                                            }}>
                                                🖐️ Manual UPI
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {d.utrNumber ? (
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                <code style={{
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.88rem',
                                                    background: 'rgba(0,0,0,0.3)',
                                                    padding: '3px 6px',
                                                    borderRadius: '4px',
                                                    color: '#38bdf8',
                                                    border: '1px solid rgba(56, 189, 248, 0.25)'
                                                }}>
                                                    {d.utrNumber}
                                                </code>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(d.utrNumber, 'UTR Number')}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        fontSize: '0.85rem',
                                                        color: '#94a3b8'
                                                    }}
                                                    title="Copy UTR"
                                                >
                                                    📋
                                                </button>
                                            </div>
                                        ) : (
                                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>None provided</span>
                                        )}
                                    </td>
                                    <td>
                                        {d.status === 'pending' && (
                                            <span className="badge badge-pending" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.5)' }}>
                                                ⏳ Needs Verification
                                            </span>
                                        )}
                                        {d.status === 'completed' && (
                                            <span className="badge badge-active" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                                                ✓ Verified
                                            </span>
                                        )}
                                        {d.status === 'rejected' && (
                                            <span className="badge badge-banned" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                                                ✕ Rejected
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {d.status === 'pending' ? (
                                            <div style={{ display: 'inline-flex', gap: '8px' }}>
                                                <button
                                                    className="btn-action gold"
                                                    style={{ background: '#10b981', borderColor: '#10b981', color: '#fff' }}
                                                    onClick={() => setApprovingItem(d)}
                                                    title="Verify UTR and credit player balance"
                                                >
                                                    ✓ Approve
                                                </button>
                                                <button
                                                    className="btn-action danger"
                                                    onClick={() => setRejectingItem(d)}
                                                    title="Reject unverified deposit"
                                                >
                                                    ✕ Reject
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.3 }}>
                                                {d.status === 'completed' && (
                                                    d.isAutomatedGateway?.() || (d.paymentMethod && d.paymentMethod.toUpperCase().includes('YOUPI')) || (d.approvedBy && d.approvedBy.toUpperCase().includes('WEBHOOK')) ? (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            color: '#34d399',
                                                            fontWeight: 700
                                                        }}>
                                                            <span>⚡ Auto-Credited</span>
                                                        </span>
                                                    ) : (
                                                        <span>By <strong>{d.approvedBy || 'Admin'}</strong></span>
                                                    )
                                                )}
                                                {d.status === 'rejected' && (
                                                    <span style={{ color: '#f87171' }}>{d.rejectionReason || 'Rejected'}</span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Approval Confirmation Modal */}
            {approvingItem && (
                <div className="amrat-admin-modal-overlay" onClick={() => !isSubmittingApproval && setApprovingItem(null)}>
                    <div className="amrat-admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, color: '#10b981', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>✓</span> Confirm &amp; Credit Deposit
                            </h3>
                            <button
                                type="button"
                                onClick={() => setApprovingItem(null)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Player:</span>
                                <strong style={{ color: '#f8fafc' }}>{approvingItem.username}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Amount:</span>
                                <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>₹{approvingItem.amount.toLocaleString('en-IN')}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Payment Method:</span>
                                <span style={{ color: '#cbd5e1' }}>{approvingItem.paymentMethod}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>UTR Reference:</span>
                                <code style={{ color: '#38bdf8', fontWeight: 700 }}>{approvingItem.utrNumber || 'N/A'}</code>
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px' }}>
                                Verification Note (Optional)
                            </label>
                            <input
                                type="text"
                                className="admin-search-input"
                                style={{ width: '100%' }}
                                value={approvalNote}
                                onChange={e => setApprovalNote(e.target.value)}
                                placeholder="UTR Verified & Funds Credited"
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="btn-action"
                                onClick={() => setApprovingItem(null)}
                                disabled={isSubmittingApproval}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-action gold"
                                style={{ background: '#10b981', borderColor: '#10b981', color: '#fff' }}
                                onClick={handleConfirmApprove}
                                disabled={isSubmittingApproval}
                            >
                                {isSubmittingApproval ? 'Crediting Wallet...' : 'Confirm & Credit ₹' + approvingItem.amount.toLocaleString('en-IN')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejection Modal */}
            {rejectingItem && (
                <div className="amrat-admin-modal-overlay" onClick={() => !isSubmittingRejection && setRejectingItem(null)}>
                    <div className="amrat-admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, color: '#ef4444', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>✕</span> Reject Deposit Request
                            </h3>
                            <button
                                type="button"
                                onClick={() => setRejectingItem(null)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Player:</span>
                                <strong style={{ color: '#f8fafc' }}>{rejectingItem.username}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Amount:</span>
                                <strong style={{ color: '#f87171' }}>₹{rejectingItem.amount.toLocaleString('en-IN')}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>UTR Reference:</span>
                                <code style={{ color: '#cbd5e1' }}>{rejectingItem.utrNumber || 'N/A'}</code>
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px' }}>
                                Rejection Reason
                            </label>
                            <select
                                className="admin-select"
                                style={{ width: '100%', marginBottom: '8px' }}
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                            >
                                <option value="Invalid UTR / Payment Not Received">Invalid UTR / Payment Not Received</option>
                                <option value="Duplicate UTR Submission">Duplicate UTR Submission</option>
                                <option value="Amount Deposited Does Not Match Receipt">Amount Deposited Does Not Match Receipt</option>
                                <option value="Suspicious / Tampered Receipt">Suspicious / Tampered Receipt</option>
                                <option value="Other">Other</option>
                            </select>
                            {rejectionReason === 'Other' && (
                                <input
                                    type="text"
                                    className="admin-search-input"
                                    style={{ width: '100%' }}
                                    placeholder="Enter specific reason..."
                                    onChange={e => setRejectionReason(e.target.value)}
                                />
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="btn-action"
                                onClick={() => setRejectingItem(null)}
                                disabled={isSubmittingRejection}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-action danger"
                                onClick={handleConfirmReject}
                                disabled={isSubmittingRejection}
                            >
                                {isSubmittingRejection ? 'Rejecting...' : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
