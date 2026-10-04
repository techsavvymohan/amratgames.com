export default function TokenDistributionTab({
    treasury,
    airdrops,
    eligiblePlayersCount,
    vipCount,
    airdropToken,
    setAirdropToken,
    airdropAmount,
    setAirdropAmount,
    airdropTarget,
    setAirdropTarget,
    airdropCampaign,
    setAirdropCampaign,
    airdropNote,
    setAirdropNote,
    airdropStatus,
    onLaunchAirdrop
}) {
    const quickBonusAmounts = airdropToken === 'INR'
        ? [50, 100, 250, 500, 1000]
        : [100, 500, 1000, 2500, 5000]

    const targetRecipientCount = airdropTarget === 'all_players'
        ? eligiblePlayersCount
        : airdropTarget === 'vip'
        ? vipCount
        : Math.max(1, Math.round(eligiblePlayersCount * 0.75))

    return (
        <div className="airdrop-hub-grid">
            {/* Distribution Form */}
            <div className="airdrop-form-card">
                <div className="section-header">
                    <div>
                        <h2>
                            <span>🎁</span>
                            <span>Send Free Bonuses & Rewards</span>
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '4px 0 0' }}>
                            Send real cash (₹ INR) or $AMRAT coins directly to players' wallets in 1 click.
                        </p>
                    </div>
                </div>

                {airdropStatus && (
                    <div style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        background: airdropStatus.includes('Success') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 175, 25, 0.2)',
                        border: '1px solid rgba(245, 175, 25, 0.4)',
                        color: '#f8fafc',
                        fontSize: '0.85rem',
                        marginBottom: '16px',
                        fontWeight: 600
                    }}>
                        {airdropStatus}
                    </div>
                )}

                <form onSubmit={onLaunchAirdrop}>
                    {/* Currency / Reward Type */}
                    <div className="form-group">
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>What to Gift?</span>
                            <small style={{ color: '#94a3b8' }}>Currency or Token</small>
                        </label>
                        <select
                            className="form-input"
                            value={airdropToken}
                            onChange={(e) => setAirdropToken(e.target.value)}
                        >
                            <option value="AMRAT">👑 $AMRAT VIP Coins (Game Coins)</option>
                            <option value="INR">🇮🇳 Real Cash ₹ INR</option>
                            <option value="USDT">₮ USDT (Crypto Dollar)</option>
                            <option value="BTC">₿ Bitcoin (BTC)</option>
                        </select>
                    </div>

                    {/* Target Group */}
                    <div className="form-group">
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Whom to Send?</span>
                            <small style={{ color: '#fbbf24', fontWeight: 600 }}>Total: {targetRecipientCount} players</small>
                        </label>
                        <select
                            className="form-input"
                            value={airdropTarget}
                            onChange={(e) => setAirdropTarget(e.target.value)}
                        >
                            <option value="all_players">All Registered Players ({eligiblePlayersCount} players)</option>
                            <option value="vip">VIP High Rollers Only ({vipCount} players)</option>
                            <option value="active_24h">Active in Last 24 Hours</option>
                        </select>
                    </div>

                    {/* Amount Per Player */}
                    <div className="form-group">
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Amount to Give Each Player</span>
                            <small style={{ color: '#94a3b8' }}>{airdropToken}</small>
                        </label>
                        <input
                            type="number"
                            className="form-input"
                            value={airdropAmount}
                            onChange={(e) => setAirdropAmount(e.target.value)}
                            placeholder="500"
                            min="1"
                            step="any"
                            required
                            style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fbbf24' }}
                        />
                        {/* Quick Pills */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            {quickBonusAmounts.map(val => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setAirdropAmount(val)}
                                    style={{
                                        padding: '4px 8px',
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '6px',
                                        color: '#cbd5e1',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    +{val} {airdropToken}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Campaign Name */}
                    <div className="form-group">
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Offer / Occasion Name</span>
                            <small style={{ color: '#94a3b8' }}>e.g. Weekend Bonus, Special Drop</small>
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            value={airdropCampaign}
                            onChange={(e) => setAirdropCampaign(e.target.value)}
                            placeholder="e.g. Royal Weekend Free Bonus / Festival Special"
                            required
                        />
                    </div>

                    {/* Message for Players */}
                    <div className="form-group">
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Message for Players</span>
                            <small style={{ color: '#94a3b8' }}>Optional</small>
                        </label>
                        <textarea
                            className="form-textarea"
                            rows="2"
                            value={airdropNote}
                            onChange={(e) => setAirdropNote(e.target.value)}
                            placeholder="e.g. Enjoy free bonus to play Crash, Plinko and Mines today!"
                        />
                    </div>

                    {/* Launch Button */}
                    <button type="submit" className="btn-airdrop-launch" style={{ marginTop: '12px', fontSize: '0.95rem' }}>
                        <span>🚀</span>
                        <span>Send Free Bonus to {targetRecipientCount} Players Now</span>
                    </button>
                </form>
            </div>

            {/* Treasury Overview & Distribution Ledger */}
            <div>
                <div className="admin-card-section" style={{ marginBottom: '20px' }}>
                    <div className="section-header">
                        <h2>
                            <span>💎</span>
                            <span>Bonus Coins Vault</span>
                        </h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ background: 'rgba(0,0,0,0.4)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Coins in Vault</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffd700', marginTop: '4px' }}>
                                {(treasury?.treasuryBalance || 98809300).toLocaleString('en-IN')}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>$AMRAT ready to distribute</div>
                        </div>

                        <div style={{ background: 'rgba(0,0,0,0.4)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Distributed to Players</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
                                {(treasury?.circulatingSupply || 1190700).toLocaleString('en-IN')}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>Currently in player hands</div>
                        </div>
                    </div>
                </div>

                {/* Past Bonus Grant Records */}
                <div className="admin-card-section">
                    <div className="section-header">
                        <h2>
                            <span>📜</span>
                            <span>Previous Bonus Distributions</span>
                        </h2>
                    </div>

                    {airdrops.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                            No previous campaigns yet. Send your first bonus using the form!
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {airdrops.map((a) => (
                                <div
                                    key={a.id}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: '10px',
                                        padding: '12px 14px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: '8px'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#ffd700', fontSize: '0.88rem' }}>
                                            {a.campaign}
                                        </div>
                                        <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                                            Target: {a.targetGroup === 'all_players' ? 'All Players' : a.targetGroup} · {a.recipientsCount} players rewarded
                                        </div>
                                        {a.note && (
                                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                                                "{a.note}"
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{
                                            fontWeight: 800,
                                            color: '#10b981',
                                            fontSize: '0.9rem',
                                            padding: '4px 8px',
                                            background: 'rgba(16, 185, 129, 0.12)',
                                            borderRadius: '6px'
                                        }}>
                                            +{a.amount?.toLocaleString('en-IN')} {a.token} / player
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
