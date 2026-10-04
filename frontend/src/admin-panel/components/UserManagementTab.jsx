export default function UserManagementTab({
    users,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    onSelectUserForBalance,
    onToggleBan,
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
                        <span>Player Accounts & Wallets ({users.length} Players)</span>
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0' }}>
                        View all registered player accounts, search by mobile number, adjust wallet balances, and manage access.
                    </p>
                </div>
                <button className="btn-action gold" onClick={onRefresh} title="Reload latest player balances">
                    ↻ Refresh Accounts
                </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="admin-controls-bar">
                <input
                    type="text"
                    className="admin-search-input"
                    placeholder="🔍 Search by Mobile Number, Username or Email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                    className="admin-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">All Players</option>
                    <option value="active">Active Players</option>
                    <option value="vip">VIP High Rollers</option>
                    <option value="banned">Blocked / Suspended</option>
                </select>
            </div>

            <div className="admin-table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Status</th>
                            <th>Cash Balance (₹ INR)</th>
                            <th>Bitcoin (₿)</th>
                            <th>USDT (₮)</th>
                            <th>Bonus Coins ($AMRAT)</th>
                            <th>KYC Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan="8" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
                                    <div>No player found matching your search. Try searching by 10-digit mobile number or username.</div>
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
                                                {/* Mobile Number Prominently Displayed */}
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
                                            <span className="badge badge-banned">🚫 Blocked</span>
                                        ) : u.isVip() ? (
                                            <span className="badge badge-vip">👑 VIP Whale</span>
                                        ) : (
                                            <span className="badge badge-active">✓ Active</span>
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
                                        <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            color: u.kycStatus === 'verified' ? '#10b981' : '#f59e0b',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            {u.kycStatus === 'verified' ? '✓ Verified' : '○ Pending'}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                                            <button
                                                className="btn-action gold"
                                                onClick={() => onSelectUserForBalance(u)}
                                                title="Add or cut balance from this player's wallet"
                                            >
                                                💰 Adjust Balance
                                            </button>
                                            {!u.isAdmin() && (
                                                <button
                                                    className={`btn-action ${u.isSuspended() ? 'gold' : 'danger'}`}
                                                    onClick={() => onToggleBan(u)}
                                                    title={u.isSuspended() ? "Unblock this account" : "Suspend this account to prevent playing"}
                                                >
                                                    {u.isSuspended() ? '✓ Unblock' : '🚫 Block'}
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
