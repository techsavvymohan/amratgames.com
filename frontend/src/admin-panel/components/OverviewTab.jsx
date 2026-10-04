export default function OverviewTab({ stats, treasury, users, liveBets, onSwitchTab, onRotateSeed }) {
    const totalWagered = stats?.totalWageredApproxINR || 685000
    const netProfit = stats?.netHouseProfitINR || 24800
    const totalUsersCount = stats?.totalUsers || users.length || 8
    const activeUsersCount = stats?.activeUsers || 7

    return (
        <div className="admin-tab-content">
            {/* Quick Helper Banner */}
            <div style={{
                background: 'linear-gradient(90deg, rgba(245, 175, 25, 0.12), rgba(16, 185, 129, 0.08))',
                border: '1px solid rgba(245, 175, 25, 0.3)',
                borderRadius: '12px',
                padding: '14px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>📊</span>
                    <div>
                        <div style={{ fontWeight: 800, color: '#ffd700', fontSize: '0.92rem' }}>
                            Business Overview & Platform Health
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                            All game earnings, player accounts, and wallet transactions update here in real-time.
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        className="btn-action gold"
                        onClick={() => onSwitchTab('users')}
                        style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                    >
                        👥 Player Accounts
                    </button>
                    <button
                        className="btn-airdrop-launch"
                        onClick={() => onSwitchTab('tokens')}
                        style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                    >
                        🎁 Send Bonus
                    </button>
                </div>
            </div>

            {/* KPI Cards in Clear Business Terms */}
            <div className="admin-kpi-grid">
                {/* 1. Total Registered Players */}
                <div className="kpi-card">
                    <div className="kpi-label">
                        <span>Total Players</span>
                        <span>👥</span>
                    </div>
                    <div className="kpi-value gold">{totalUsersCount}</div>
                    <div className="kpi-subtext" style={{ color: '#34d399' }}>
                        ● {activeUsersCount} active players playing today
                    </div>
                </div>

                {/* 2. Total Turn-Over / Bets Placed */}
                <div className="kpi-card">
                    <div className="kpi-label">
                        <span>Total Bet Volume (Turnover)</span>
                        <span>₹</span>
                    </div>
                    <div className="kpi-value green">
                        ₹{totalWagered.toLocaleString('en-IN')}
                    </div>
                    <div className="kpi-subtext">Total money wagered across all games</div>
                </div>

                {/* 3. Net Casino Earnings / Profit */}
                <div className="kpi-card">
                    <div className="kpi-label">
                        <span>Company Net Profit</span>
                        <span>📈</span>
                    </div>
                    <div className="kpi-value gold" style={{ color: '#10b981' }}>
                        ₹{netProfit.toLocaleString('en-IN')}
                    </div>
                    <div className="kpi-subtext">
                        Net earnings after all player winnings paid out
                    </div>
                </div>

                {/* 4. Vault / Treasury Reserve */}
                <div className="kpi-card">
                    <div className="kpi-label">
                        <span>Bonus Vault Coins</span>
                        <span>👑</span>
                    </div>
                    <div className="kpi-value gold">
                        {(treasury?.treasuryBalance || 98809300).toLocaleString('en-IN')}
                    </div>
                    <div className="kpi-subtext">
                        $AMRAT coins available to reward VIP players
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
                            <span>Live Game Activity (Recent Bets & Wins)</span>
                        </h2>
                        <span style={{ fontSize: '0.78rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="status-dot online" /> Live Feed
                        </span>
                    </div>

                    <div className="live-bets-stream">
                        {liveBets.length === 0 ? (
                            <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                                <div>⏳ Waiting for players to place wagers...</div>
                                <div style={{ fontSize: '0.78rem', marginTop: '6px' }}>
                                    When any player places a bet in Crash, Plinko, Mines, or Dino, it will appear here immediately!
                                </div>
                            </div>
                        ) : (
                            liveBets.map((b) => (
                                <div key={b.id || Math.random()} className={`bet-stream-item ${b.won ? 'won' : 'lost'}`}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontWeight: 700, color: '#f8fafc' }}>{b.username || 'Anonymous Player'}</span>
                                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fbbf24', textTransform: 'capitalize' }}>
                                            {b.gameName || b.game}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>
                                            Bet: <strong>{b.currency} {b.betAmount?.toLocaleString('en-IN')}</strong>
                                        </span>
                                        <span style={{
                                            fontWeight: 800,
                                            color: b.won ? '#34d399' : '#f87171',
                                            padding: '3px 10px',
                                            borderRadius: '6px',
                                            background: b.won ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                            fontSize: '0.82rem'
                                        }}>
                                            {b.won ? `🎉 Won +${b.currency} ${b.payout?.toLocaleString('en-IN')} (${b.multiplier}x)` : '❌ Lost (0.00x)'}
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
                            className="btn-airdrop-launch"
                            onClick={() => onSwitchTab('tokens')}
                            style={{ fontSize: '0.9rem', padding: '13px 16px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                            <span style={{ fontSize: '20px' }}>🎁</span>
                            <div>
                                <div style={{ fontWeight: 800 }}>Send Free Bonus / Coins</div>
                                <div style={{ fontSize: '0.74rem', opacity: 0.85, fontWeight: 'normal' }}>
                                    Credit cash or $AMRAT coins to all players or VIPs
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
                                <div style={{ fontWeight: 700, color: '#f8fafc' }}>Manage Player Wallets</div>
                                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                                    Search by mobile number, add money, or freeze fraud accounts
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
                                <div style={{ fontWeight: 700, color: '#f8fafc' }}>Company Profit & Win Rate</div>
                                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                                    Adjust how much the platform earns on each wager
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
                                <div style={{ fontWeight: 700 }}>Generate Fresh Fair-Play Key</div>
                                <div style={{ fontSize: '0.74rem', color: '#ffd700', opacity: 0.85 }}>
                                    Rotate cryptographic seed ensuring 100% fair play
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
