export default function OverviewTab({ stats, treasury, users, liveBets, withdrawals = [], onSwitchTab, onRotateSeed }) {
    const totalWagered = stats?.totalWageredApproxINR || 685000
    const netProfit = stats?.netHouseProfitINR || 24800
    const totalUsersCount = stats?.totalUsers || users.length || 8
    const activeUsersCount = stats?.activeUsers || 7

    const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending')
    const pendingCount = stats?.withdrawalStats?.pendingCount ?? pendingWithdrawals.length
    const pendingAmount = stats?.withdrawalStats?.pendingAmount ?? pendingWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0)

    return (
        <div className="admin-tab-content">
            {/* Urgent Pending Withdrawals Banner */}
            {pendingCount > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(180, 83, 9, 0.25))',
                    border: '1px solid rgba(245, 158, 11, 0.5)',
                    borderRadius: '12px',
                    padding: '14px 20px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    boxShadow: '0 4px 20px rgba(245, 158, 11, 0.15)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '26px' }}>⚠️</span>
                        <div>
                            <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '0.95rem' }}>
                                {pendingCount} Pending Withdrawal Request{pendingCount > 1 ? 's' : ''} Awaiting Cashier Transfer (₹{pendingAmount.toLocaleString('en-IN')})
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '2px' }}>
                                Players have requested cashouts. Transfer money from your account and confirm approval.
                            </div>
                        </div>
                    </div>
                    <button
                        className="btn-airdrop-launch"
                        style={{ padding: '9px 20px', fontSize: '0.84rem', fontWeight: 800 }}
                        onClick={() => onSwitchTab('withdrawals')}
                    >
                        Review Payouts &rarr;
                    </button>
                </div>
            )}

            {/* KPI Cards */}
            <div className="admin-kpi-grid">
                {/* 1. Total Registered Players */}
                <div className="kpi-card">
                    <div className="kpi-label">
                        <span>Total Players</span>
                        <span>👥</span>
                    </div>
                    <div className="kpi-value gold">{totalUsersCount}</div>
                    <div className="kpi-subtext" style={{ color: '#34d399' }}>
                        ● {activeUsersCount} active today
                    </div>
                </div>

                {/* 2. Total Turn-Over / Bets Placed */}
                <div className="kpi-card">
                    <div className="kpi-label">
                        <span>Total Wagered</span>
                        <span>₹</span>
                    </div>
                    <div className="kpi-value green">
                        ₹{totalWagered.toLocaleString('en-IN')}
                    </div>
                    <div className="kpi-subtext">All-time bet turnover</div>
                </div>

                {/* 3. Net Casino Earnings / Profit */}
                <div className="kpi-card">
                    <div className="kpi-label">
                        <span>Net Profit</span>
                        <span>📈</span>
                    </div>
                    <div className="kpi-value gold" style={{ color: '#10b981' }}>
                        ₹{netProfit.toLocaleString('en-IN')}
                    </div>
                    <div className="kpi-subtext">
                        Gross gaming revenue
                    </div>
                </div>

                {/* 4. Vault / Treasury Reserve */}
                <div className="kpi-card">
                    <div className="kpi-label">
                        <span>Token Treasury</span>
                        <span>👑</span>
                    </div>
                    <div className="kpi-value gold">
                        {(treasury?.treasuryBalance || 98809300).toLocaleString('en-IN')}
                    </div>
                    <div className="kpi-subtext">
                        Available $AMRAT reserve
                    </div>
                </div>
            </div>

            {/* Split Section: Live Game Stream & Quick Shortcuts */}
            <div className="overview-split-grid">
                {/* Live Community Bets Stream */}
                <div className="admin-card-section">
                    <div className="section-header">
                        <h2>
                            <span>🎲</span>
                            <span>Live Game Activity</span>
                        </h2>
                        <span style={{ fontSize: '0.78rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="status-dot online" /> Live
                        </span>
                    </div>

                    <div className="live-bets-stream">
                        {liveBets.length === 0 ? (
                            <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                                <div>No recent activity</div>
                            </div>
                        ) : (
                            liveBets.map((b) => (
                                <div key={b.id || Math.random()} className={`bet-stream-item ${b.won ? 'won' : 'lost'}`}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontWeight: 700, color: '#f8fafc' }}>{b.username || 'Player'}</span>
                                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fbbf24', textTransform: 'capitalize' }}>
                                            {b.gameName || b.game}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>
                                            {b.currency} {b.betAmount?.toLocaleString('en-IN')}
                                        </span>
                                        <span style={{
                                            fontWeight: 800,
                                            color: b.won ? '#34d399' : '#f87171',
                                            padding: '3px 10px',
                                            borderRadius: '6px',
                                            background: b.won ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                            fontSize: '0.82rem'
                                        }}>
                                            {b.won ? `+${b.currency} ${b.payout?.toLocaleString('en-IN')} (${b.multiplier}x)` : '0.00x'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Quick Operations / Direct Shortcuts */}
                <div className="admin-card-section">
                    <div className="section-header">
                        <h2>
                            <span>⚡</span>
                            <span>Quick Actions</span>
                        </h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button
                            className="btn-action gold"
                            onClick={() => onSwitchTab('withdrawals')}
                            style={{ padding: '13px 16px', fontSize: '0.88rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                            <span style={{ fontSize: '20px' }}>🏧</span>
                            <div>
                                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>Player Withdrawals</span>
                                    {pendingCount > 0 && (
                                        <span style={{
                                            background: '#f59e0b',
                                            color: '#000',
                                            fontSize: '0.68rem',
                                            fontWeight: 800,
                                            padding: '1px 7px',
                                            borderRadius: '10px'
                                        }}>
                                            {pendingCount} Pending
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#ffd700', opacity: 0.9 }}>
                                    Review, send money, and approve payouts
                                </div>
                            </div>
                        </button>

                        <button
                            className="btn-airdrop-launch"
                            onClick={() => onSwitchTab('tokens')}
                            style={{ fontSize: '0.9rem', padding: '13px 16px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                            <span style={{ fontSize: '20px' }}>🎁</span>
                            <div>
                                <div style={{ fontWeight: 800 }}>Distribute Bonus</div>
                                <div style={{ fontSize: '0.74rem', opacity: 0.85, fontWeight: 'normal' }}>
                                    Credit tokens or INR to player wallets
                                </div>
                            </div>
                        </button>

                        <button
                            className="btn-action"
                            onClick={() => onSwitchTab('users')}
                            style={{ padding: '13px 16px', fontSize: '0.88rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                            <span style={{ fontSize: '20px' }}>👥</span>
                            <div>
                                <div style={{ fontWeight: 700, color: '#f8fafc' }}>Manage Players</div>
                                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                                    Adjust player balances and accounts
                                </div>
                            </div>
                        </button>

                        <button
                            className="btn-action"
                            onClick={() => onSwitchTab('settings')}
                            style={{ padding: '13px 16px', fontSize: '0.88rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                            <span style={{ fontSize: '20px' }}>⚙️</span>
                            <div>
                                <div style={{ fontWeight: 700, color: '#f8fafc' }}>Odds &amp; Settings</div>
                                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                                    Configure house edge and RTP
                                </div>
                            </div>
                        </button>

                        <button
                            className="btn-action gold"
                            onClick={onRotateSeed}
                            style={{ padding: '13px 16px', fontSize: '0.88rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                            <span style={{ fontSize: '20px' }}>🔄</span>
                            <div>
                                <div style={{ fontWeight: 700 }}>Rotate Server Seed</div>
                                <div style={{ fontSize: '0.74rem', color: '#ffd700', opacity: 0.85 }}>
                                    Generate new provably fair seed
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
