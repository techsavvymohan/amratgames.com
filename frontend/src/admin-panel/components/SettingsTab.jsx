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
                            <span>Game Profit & Winning Settings</span>
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '4px 0 0' }}>
                            Adjust platform winning percentage, change the home notice board, or pause games for maintenance.
                        </p>
                    </div>
                </div>

                <form onSubmit={onSaveSettings}>
                    {/* RTP / Company Profit Slider */}
                    <div className="form-group" style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>
                                Player Winning Rate: <span style={{ color: '#ffd700' }}>{settings.rtp}%</span>
                            </span>
                            <span style={{
                                padding: '3px 10px',
                                borderRadius: '12px',
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                                fontWeight: 800,
                                fontSize: '0.82rem'
                            }}>
                                Company Profit Margin: {settings.houseEdge}%
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
                            <span>95.0% (Higher Company Profit)</span>
                            <span>97.0% - 98.0% (Balanced)</span>
                            <span>99.5% (Higher Player Wins)</span>
                        </div>

                        {/* Non-Tech Explanation Box */}
                        <div style={{
                            marginTop: '14px',
                            padding: '12px 14px',
                            background: 'rgba(245, 175, 25, 0.08)',
                            border: '1px solid rgba(245, 175, 25, 0.25)',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            lineHeight: 1.5,
                            color: '#fef08a'
                        }}>
                            <strong>💡 Simple Explanation:</strong>
                            <div style={{ marginTop: '4px', color: '#cbd5e1' }}>
                                When set to <strong>{settings.rtp}%</strong>:
                                <br />
                                • Out of every <strong>₹100</strong> total wagers, players win back <strong>₹{settings.rtp}</strong> on average.
                                <br />
                                • <strong>₹{settings.houseEdge} ({settings.houseEdge}%)</strong> remains as guaranteed company profit.
                            </div>
                        </div>
                    </div>

                    {/* Provably Fair Secret Key */}
                    <div className="form-group" style={{ marginTop: '20px', background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 700 }}>100% Fair Play Security Key</span>
                            <small style={{ color: '#10b981' }}>Active & Verified</small>
                        </label>
                        <p style={{ fontSize: '0.76rem', color: '#94a3b8', margin: '2px 0 8px' }}>
                            This cryptographic seed guarantees to players that games are 100% random and tamper-proof.
                        </p>
                        <input
                            type="text"
                            className="form-input"
                            readOnly
                            value={stats?.settings?.serverSeedHash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                            style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#34d399', background: 'rgba(0,0,0,0.6)' }}
                        />
                        <div style={{ marginTop: '10px' }}>
                            <button
                                type="button"
                                className="btn-action gold"
                                onClick={onRotateSeed}
                                style={{ fontSize: '0.82rem' }}
                            >
                                🔄 Generate New Secret Key
                            </button>
                        </div>
                    </div>

                    {/* Announcements Notice Board */}
                    <div className="form-group" style={{ marginTop: '20px' }}>
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Player Notice Board Message</span>
                            <small style={{ color: '#94a3b8' }}>Live on Homepage</small>
                        </label>
                        <textarea
                            className="form-textarea"
                            rows="2"
                            value={settings.activeAnnouncements || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, activeAnnouncements: e.target.value }))}
                            placeholder="e.g. 👑 Welcome to AmratGames — India's Premier Gaming Platform!"
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
                                🛑 Temporary Site Pause for Maintenance
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                                When turned ON, players will see "Platform undergoing upgrade" and betting will be paused.
                            </div>
                        </label>
                    </div>

                    {/* Save Button */}
                    <button type="submit" className="btn-airdrop-launch" style={{ marginTop: '24px', fontSize: '0.95rem' }}>
                        💾 Save All Settings
                    </button>
                </form>
            </div>
        </div>
    )
}
