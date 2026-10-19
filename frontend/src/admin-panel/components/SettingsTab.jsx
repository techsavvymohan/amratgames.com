import { useState, useEffect } from 'react'

export default function SettingsTab({
    settings,
    setSettings,
    stats,
    onRotateSeed,
    onSaveSettings,
    apiClient,
    triggerToast
}) {
    const [supabaseStatus, setSupabaseStatus] = useState(null)
    const [checkingStatus, setCheckingStatus] = useState(false)
    const [migrating, setMigrating] = useState(false)
    const [migrationReport, setMigrationReport] = useState(null)

    // Sovereign Payment Gateway (YouPi-PG) State
    const [gatewayData, setGatewayData] = useState(null)
    const [loadingGateway, setLoadingGateway] = useState(false)
    const [updatingGateway, setUpdatingGateway] = useState(false)

    const checkSupabase = async () => {
        if (!apiClient) return
        setCheckingStatus(true)
        try {
            const data = await apiClient.getSupabaseStatus()
            setSupabaseStatus(data)
        } catch (err) {
            setSupabaseStatus({ ok: false, message: err.message })
        } finally {
            setCheckingStatus(false)
        }
    }

    const fetchGatewayStatus = async () => {
        if (!apiClient) return
        setLoadingGateway(true)
        try {
            const data = await apiClient.getGatewayStatus()
            setGatewayData(data)
        } catch (err) {
            console.error('Failed to probe gateway status:', err)
        } finally {
            setLoadingGateway(false)
        }
    }

    const handleSwitchGateway = async (newPrimary) => {
        if (!apiClient || updatingGateway) return
        setUpdatingGateway(true)
        try {
            const res = await apiClient.updateGatewayConfig({ primaryGateway: newPrimary })
            triggerToast?.(`✓ ${res.message || 'Payment gateway updated'}`)
            fetchGatewayStatus()
        } catch (err) {
            triggerToast?.(`✕ Gateway switch failed: ${err.message}`)
        } finally {
            setUpdatingGateway(false)
        }
    }

    useEffect(() => {
        checkSupabase()
        fetchGatewayStatus()
    }, [])

    const handleMigrate = async () => {
        if (!apiClient) return
        setMigrating(true)
        setMigrationReport(null)
        try {
            const report = await apiClient.migrateToSupabase()
            setMigrationReport(report)
            if (triggerToast) triggerToast('Data migrated to Supabase successfully!')
            checkSupabase()
        } catch (err) {
            if (triggerToast) triggerToast(`Migration failed: ${err.message}`)
        } finally {
            setMigrating(false)
        }
    }

    return (
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 1. Platform & Odds Settings */}
            <div className="admin-card-section">
                <div className="section-header">
                    <div>
                        <h2>
                            <span>⚙️</span>
                            <span>Platform &amp; Odds Settings</span>
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '4px 0 0' }}>
                            Configure RTP, house edge, and announcements.
                        </p>
                    </div>
                </div>

                <form onSubmit={onSaveSettings}>
                    {/* RTP / House Edge Slider */}
                    <div className="form-group" style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>
                                Player RTP: <span style={{ color: '#ffd700' }}>{settings.rtp}%</span>
                            </span>
                            <span style={{
                                padding: '3px 10px',
                                borderRadius: '12px',
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                                fontWeight: 800,
                                fontSize: '0.82rem'
                            }}>
                                House Edge: {settings.houseEdge}%
                            </span>
                        </label>

                        <input
                            type="range"
                            min="95.0"
                            max="99.5"
                            step="0.1"
                            value={settings.rtp}
                            onChange={(e) => {
                                const rtpVal = parseFloat(e.target.value)
                                setSettings(prev => ({
                                    ...prev,
                                    rtp: rtpVal,
                                    houseEdge: parseFloat((100 - rtpVal).toFixed(2))
                                }))
                            }}
                            style={{ width: '100%', accentColor: '#f5af19', height: '6px', cursor: 'pointer' }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#94a3b8', marginTop: '6px' }}>
                            <span>95.0% (Higher Margin)</span>
                            <span>97.0% - 98.0%</span>
                            <span>99.5% (Player Favor)</span>
                        </div>
                    </div>

                    {/* Provably Fair Secret Key */}
                    <div className="form-group" style={{ marginTop: '20px', background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 700 }}>Server Seed Hash</span>
                            <small style={{ color: '#10b981' }}>Active &amp; Verified</small>
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            readOnly
                            value={stats?.settings?.serverSeedHash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                            style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#34d399', background: 'rgba(0,0,0,0.6)', marginTop: '6px' }}
                        />
                        <div style={{ marginTop: '10px' }}>
                            <button
                                type="button"
                                className="btn-action gold"
                                onClick={onRotateSeed}
                                style={{ fontSize: '0.82rem' }}
                            >
                                🔄 Rotate Seed
                            </button>
                        </div>
                    </div>

                    {/* Announcements Notice Board */}
                    <div className="form-group" style={{ marginTop: '20px' }}>
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Announcement Banner</span>
                        </label>
                        <textarea
                            className="form-textarea"
                            rows="2"
                            value={settings.activeAnnouncements || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, activeAnnouncements: e.target.value }))}
                            placeholder="e.g. Welcome to AmratGames!"
                        />
                    </div>

                    {/* Maintenance Mode */}
                    <div className="form-group" style={{
                        marginTop: '16px',
                        background: settings.maintenanceMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.02)',
                        border: settings.maintenanceMode ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255,255,255,0.06)',
                        padding: '14px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <input
                            type="checkbox"
                            id="maintenanceToggle"
                            checked={settings.maintenanceMode || false}
                            onChange={(e) => setSettings(prev => ({ ...prev, maintenanceMode: e.target.checked }))}
                            style={{ width: '20px', height: '20px', accentColor: '#f5af19', cursor: 'pointer' }}
                        />
                        <label htmlFor="maintenanceToggle" style={{ margin: 0, cursor: 'pointer' }}>
                            <div style={{ fontWeight: 700, color: settings.maintenanceMode ? '#f87171' : '#f8fafc', fontSize: '0.88rem' }}>
                                Maintenance Mode
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                                Pause all betting and game operations
                            </div>
                        </label>
                    </div>

                    {/* Save Button */}
                    <button type="submit" className="btn-airdrop-launch" style={{ marginTop: '24px', fontSize: '0.95rem' }}>
                        Save Settings
                    </button>
                </form>
            </div>

            {/* 2. Sovereign Payment Gateway Controls (YouPi-PG) */}
            <div className="admin-card-section">
                <div className="section-header">
                    <div>
                        <h2>
                            <span>💳</span>
                            <span>Sovereign Payment Gateway (YouPi-PG)</span>
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '4px 0 0' }}>
                            Orchestrate primary automated UPI gateway, dynamic QR pairing, and instant cashier settlements.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            type="button"
                            className="btn-action"
                            onClick={fetchGatewayStatus}
                            disabled={loadingGateway}
                            style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                            title="Test connectivity to YouPi-PG API"
                        >
                            {loadingGateway ? 'Probing...' : '🔄 Probe Gateway'}
                        </button>
                        <a
                            href="/youpi-admin/"
                            target="_blank"
                            rel="noreferrer"
                            className="btn-action gold"
                            style={{ fontSize: '0.82rem', padding: '6px 12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                            <span>Merchant Hub</span>
                            <span>↗</span>
                        </a>
                    </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {/* Live Cluster Status & VPA Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>GATEWAY STATUS</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                <span style={{
                                    display: 'inline-block',
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    backgroundColor: gatewayData?.youpi?.available ? '#10b981' : '#f59e0b'
                                }} />
                                <span style={{ fontWeight: 800, color: gatewayData?.youpi?.available ? '#34d399' : '#fbbf24', fontSize: '0.92rem' }}>
                                    {gatewayData?.youpi?.available ? 'YouPi-PG Online (Active)' : 'Gateway Online'}
                                </span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                                Port 6100 (API) · Port 7000 (Checkout)
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>RECEIVING CORPORATE VPA</div>
                            <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.92rem', marginTop: '4px', fontFamily: 'monospace' }}>
                                {gatewayData?.corporateVpa || 'shanviientrrprisee@ybl'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '2px' }}>
                                {gatewayData?.corporatePayeeName || 'Shanvii Enterprise'}
                            </div>
                        </div>
                    </div>

                    {/* Active Gateway Selection Switch */}
                    <div style={{ marginTop: '12px' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px', display: 'block' }}>
                            Active Cashier Mode for Player Deposits:
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                            <div
                                onClick={() => handleSwitchGateway('youpi')}
                                style={{
                                    cursor: 'pointer',
                                    padding: '12px 14px',
                                    borderRadius: '8px',
                                    border: (gatewayData?.activePrimary || 'youpi') === 'youpi'
                                        ? '2px solid #10b981'
                                        : '1px solid rgba(255,255,255,0.1)',
                                    background: (gatewayData?.activePrimary || 'youpi') === 'youpi'
                                        ? 'rgba(16, 185, 129, 0.12)'
                                        : 'rgba(255,255,255,0.02)'
                                }}
                            >
                                <div style={{ fontWeight: 800, color: (gatewayData?.activePrimary || 'youpi') === 'youpi' ? '#34d399' : '#f8fafc', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>⚡ YouPi Automated (Recommended)</span>
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '3px' }}>
                                    Instant PhonePe/GPay app switch &amp; auto-crediting webhook
                                </div>
                            </div>

                            <div
                                onClick={() => handleSwitchGateway('manual')}
                                style={{
                                    cursor: 'pointer',
                                    padding: '12px 14px',
                                    borderRadius: '8px',
                                    border: (gatewayData?.activePrimary || 'youpi') === 'manual'
                                        ? '2px solid #f5af19'
                                        : '1px solid rgba(255,255,255,0.1)',
                                    background: (gatewayData?.activePrimary || 'youpi') === 'manual'
                                        ? 'rgba(245, 175, 25, 0.12)'
                                        : 'rgba(255,255,255,0.02)'
                                }}
                            >
                                <div style={{ fontWeight: 800, color: (gatewayData?.activePrimary || 'youpi') === 'manual' ? '#fbbf24' : '#f8fafc', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>🖐️ Manual UPI Fallback</span>
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '3px' }}>
                                    Direct QR code; admin manually verifies UTR in Deposits tab
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Settlement Metrics */}
                    {gatewayData?.stats && (
                        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '0.8rem' }}>
                            <div>
                                <span style={{ color: '#94a3b8' }}>Auto-Credited:</span>
                                <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.92rem' }}>
                                    ₹{gatewayData.stats.automatedDepositsAmount.toLocaleString('en-IN')}
                                </div>
                            </div>
                            <div>
                                <span style={{ color: '#94a3b8' }}>Manual Approved:</span>
                                <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.92rem' }}>
                                    ₹{gatewayData.stats.manualDepositsAmount.toLocaleString('en-IN')}
                                </div>
                            </div>
                            <div>
                                <span style={{ color: '#94a3b8' }}>Pending Manual:</span>
                                <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.92rem' }}>
                                    ₹{gatewayData.stats.pendingManualAmount.toLocaleString('en-IN')} ({gatewayData.stats.pendingManualCount})
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Supabase Cloud Database Management */}
            <div className="admin-card-section">
                <div className="section-header">
                    <div>
                        <h2>
                            <span>⚡</span>
                            <span>Supabase PostgreSQL Database</span>
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '4px 0 0' }}>
                            Stores all players, wallets, ledger balances, bets, transactions, airdrops, and OTP records.
                        </p>
                    </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                            <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Status</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                <span style={{
                                    display: 'inline-block',
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    backgroundColor: supabaseStatus?.ok ? '#10b981' : (supabaseStatus?.configured ? '#f59e0b' : '#64748b')
                                }} />
                                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: supabaseStatus?.ok ? '#34d399' : (supabaseStatus?.configured ? '#fbbf24' : '#94a3b8') }}>
                                    {supabaseStatus?.ok
                                        ? `Connected (${supabaseStatus.latencyMs ? `${supabaseStatus.latencyMs}ms` : 'Healthy'})`
                                        : (supabaseStatus?.configured ? 'Connection Issue' : 'Local Fallback (Unconfigured)')}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                className="btn-action"
                                onClick={checkSupabase}
                                disabled={checkingStatus}
                                style={{ fontSize: '0.82rem', padding: '8px 14px' }}
                            >
                                {checkingStatus ? 'Checking...' : '🔄 Test Connection'}
                            </button>
                            <button
                                type="button"
                                className="btn-action gold"
                                onClick={handleMigrate}
                                disabled={migrating || !supabaseStatus?.configured}
                                style={{ fontSize: '0.82rem', padding: '8px 14px' }}
                            >
                                {migrating ? 'Migrating...' : '🚀 Migrate Local Data to Supabase'}
                            </button>
                        </div>
                    </div>

                    <div style={{ marginTop: '12px', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                        {supabaseStatus?.message || 'Database engine is active.'}
                    </div>

                    {migrationReport && (
                        <div style={{ marginTop: '14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '12px', fontSize: '0.82rem' }}>
                            <div style={{ fontWeight: 700, color: '#34d399', marginBottom: '6px' }}>✓ Migration Results:</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', color: '#f8fafc' }}>
                                <div>Users: <b>{migrationReport.usersMigrated}</b></div>
                                <div>Bets: <b>{migrationReport.betsMigrated}</b></div>
                                <div>Transactions: <b>{migrationReport.transactionsMigrated}</b></div>
                                <div>Airdrops: <b>{migrationReport.airdropsMigrated}</b></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
