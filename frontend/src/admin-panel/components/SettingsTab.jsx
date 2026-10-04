export default function SettingsTab({
    settings,
    setSettings,
    stats,
    onRotateSeed,
    onSaveSettings
}) {
    return (
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
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
        </div>
    )
}
