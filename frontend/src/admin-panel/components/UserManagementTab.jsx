export default function UserManagementTab({
    users,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    onSelectUserForBalance,
    onToggleBan,
    onApproveKYC,
    onRejectKYC,
    onRefresh
}) {
    const filteredUsers = users.filter((u) => {
        const matchesSearch = u.matchesSearch(searchQuery)
        if (!matchesSearch) return false

        if (statusFilter === 'active') return !u.isSuspended() && !u.isVip()
        if (statusFilter === 'vip') return u.isVip()
        if (statusFilter === 'banned') return u.isSuspended()
        return true
    })

    return (
        <div className="admin-card-section">
            <div className="section-header">
                <div>
                    <h2>
                        <span>👥</span>
                        <span>Players ({users.length})</span>
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0' }}>
                        Manage accounts, balances, and access.
                    </p>
                </div>
                <button className="btn-action gold" onClick={onRefresh} title="Reload latest player balances">
                    ↻ Refresh
                </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="admin-controls-bar">
                <input
                    type="text"
                    className="admin-search-input"
                    placeholder="Search players..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                    className="admin-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">All Players</option>
                    <option value="active">Active</option>
                    <option value="vip">VIP</option>
                    <option value="banned">Suspended</option>
                </select>
            </div>

            <div className="admin-table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Status</th>
                            <th>INR (₹)</th>
                            <th>BTC (₿)</th>
                            <th>USDT (₮)</th>
                            <th>AMRAT</th>
                            <th>KYC</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan="8" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
                                    <div>No players found matching your search.</div>
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map((u) => (
                                <tr key={u.id}>
                                    <td>
                                        <div className="user-cell">
                                            <div className="user-avatar">{u.avatar}</div>
                                            <div>
                                                <div className="user-info-name">
                                                    {u.username} {u.isAdmin() && <span style={{ color: '#ffd700', fontSize: '11px', fontWeight: 800 }}>[ADMIN]</span>}
                                                </div>
                                                {/* Mobile Number */}
                                                {u.phone && (
                                                    <div style={{ color: '#fbbf24', fontSize: '0.78rem', fontWeight: 700, marginTop: '2px' }}>
                                                        📱 +91 {u.phone}
                                                    </div>
                                                )}
                                                <div className="user-info-email">{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        {u.isSuspended() ? (
                                            <span className="badge badge-banned">Suspended</span>
                                        ) : u.isVip() ? (
                                            <span className="badge badge-vip">VIP</span>
                                        ) : (
                                            <span className="badge badge-active">Active</span>
                                        )}
                                    </td>
                                    <td style={{ fontWeight: 800, color: '#f5af19', fontSize: '0.95rem' }}>
                                        {u.getFormattedBalance('INR')}
                                    </td>
                                    <td style={{ color: '#f7931a' }}>
                                        {u.getFormattedBalance('BTC')}
                                    </td>
                                    <td style={{ color: '#26a17b' }}>
                                        {u.getFormattedBalance('USDT')}
                                    </td>
                                    <td style={{ fontWeight: 700, color: '#ffd700' }}>
                                        {u.getFormattedBalance('AMRAT')}
                                    </td>
                                    <td>
                                        {u.kycStatus === 'verified' && (
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                ✓ Verified
                                            </span>
                                        )}
                                        {u.kycStatus === 'pending_review' && (
                                            <div>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fbbf24', background: 'rgba(245, 158, 11, 0.2)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px' }}>
                                                    ⏳ Under Review
                                                </span>
                                                {u.kycDocumentType && (
                                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                                                        {u.kycDocumentType}: {u.kycDocumentNumber}
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                                    <button
                                                        type="button"
                                                        style={{ fontSize: '0.68rem', padding: '2px 6px', background: '#10b981', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
                                                        onClick={() => onApproveKYC && onApproveKYC(u.id)}
                                                        title="Approve KYC documents"
                                                    >
                                                        ✓ Pass
                                                    </button>
                                                    <button
                                                        type="button"
                                                        style={{ fontSize: '0.68rem', padding: '2px 6px', background: '#ef4444', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
                                                        onClick={() => onRejectKYC && onRejectKYC(u.id)}
                                                        title="Reject KYC documents"
                                                    >
                                                        ✕ Reject
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {u.kycStatus === 'rejected' && (
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444' }}>
                                                ✕ Rejected
                                            </span>
                                        )}
                                        {(!u.kycStatus || u.kycStatus === 'unverified') && (
                                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                Unverified
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                                            <button
                                                className="btn-action gold"
                                                onClick={() => onSelectUserForBalance(u)}
                                                title="Adjust player wallet balance"
                                            >
                                                Edit Balance
                                            </button>
                                            {!u.isAdmin() && (
                                                <button
                                                    className={`btn-action ${u.isSuspended() ? 'gold' : 'danger'}`}
                                                    onClick={() => onToggleBan(u)}
                                                    title={u.isSuspended() ? "Unblock account" : "Suspend account"}
                                                >
                                                    {u.isSuspended() ? 'Unblock' : 'Suspend'}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
