import { useState, useEffect } from 'react'
import { Typography } from 'antd'

const { Text } = Typography

function PlayerResults({
    cashouts = [],
    isPanel = false,
    phase = 'idle',
    multiplier = 1.00,
    history = [],
    currencySymbol = '₹'
}) {
    const [visibleCashouts, setVisibleCashouts] = useState([])

    // Add new cashouts and remove old ones
    useEffect(() => {
        if (cashouts && cashouts.length > 0) {
            const latest = cashouts[cashouts.length - 1]
            const newCashout = {
                ...latest,
                id: Date.now() + Math.random(),
                visible: true
            }

            setVisibleCashouts(prev => [...prev, newCashout].slice(-5))

            // Auto-remove after 10 seconds for floating overlay
            if (!isPanel) {
                const timer = setTimeout(() => {
                    setVisibleCashouts(prev =>
                        prev.filter(c => c.id !== newCashout.id)
                    )
                }, 10000)
                return () => clearTimeout(timer)
            }
        }
    }, [cashouts?.length, isPanel])

    // For panel view (mobile tab), render rich in-flow results list without returning null
    if (isPanel) {
        const allCashouts = cashouts && cashouts.length > 0 ? cashouts : visibleCashouts

        return (
            <div className="crash-results-panel">
                {allCashouts.length > 0 ? (
                    <div className="crash-results-list">
                        {allCashouts.map((cashout, index) => {
                            const name = cashout.name || cashout.username || 'Player'
                            const mult = cashout.multiplier
                                ? Number(cashout.multiplier).toFixed(2)
                                : (cashout.cashoutAt ? Number(cashout.cashoutAt).toFixed(2) : '2.00')
                            const amt = cashout.amount || (cashout.profit ? `+${Number(cashout.profit).toFixed(2)}` : '')

                            return (
                                <div key={cashout.id || index} className="crash-result-row">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '13px' }}>👤</span>
                                        <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{name}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                            fontWeight: 800,
                                            color: '#22c55e',
                                            background: 'rgba(34, 197, 94, 0.12)',
                                            padding: '1px 6px',
                                            borderRadius: '4px',
                                            fontSize: '11px'
                                        }}>
                                            {mult}×
                                        </span>
                                        {amt && (
                                            <span style={{ fontWeight: 700, color: '#4ade80' }}>
                                                {currencySymbol}{amt}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="crash-results-empty">
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>
                            {phase === 'running'
                                ? '🚀 Rocket in flight — waiting for cashouts...'
                                : (phase === 'crashed'
                                    ? `💥 Crashed @ ${Number(multiplier || 1).toFixed(2)}x (No cashouts)`
                                    : '⏳ Waiting for next round to start...'
                                )
                            }
                        </div>
                        {history && history.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' }}>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>Recent:</span>
                                {history.slice(0, 5).map((h, idx) => {
                                    const val = typeof h === 'object' ? Number(h?.crashPoint || h?.multiplier || 1) : Number(h || 1)
                                    const isWin = val >= 2
                                    return (
                                        <span
                                            key={h?.id || idx}
                                            style={{
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                padding: '1px 5px',
                                                borderRadius: '4px',
                                                background: isWin ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                color: isWin ? '#4ade80' : '#f87171',
                                                border: `1px solid ${isWin ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                                            }}
                                        >
                                            {val.toFixed(2)}×
                                        </span>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    // Default desktop floating overlay widget
    if (visibleCashouts.length === 0) return null

    return (
        <div className="player-results">
            {visibleCashouts.map((cashout, index) => (
                <div
                    key={cashout.id}
                    className="player-result-item"
                    style={{
                        animationDelay: `${index * 0.1}s`,
                        top: `${80 + index * 45}px`
                    }}
                >
                    <Text className="result-name">{cashout.name}</Text>
                    <span
                        className="currency-badge"
                        style={{ background: cashout.currency?.color || '#f5af19' }}
                    >
                        {cashout.currency?.symbol || '₹'}
                    </span>
                    <Text className="result-amount" style={{ color: 'var(--success)' }}>
                        {cashout.amount}
                    </Text>
                </div>
            ))}
        </div>
    )
}

export default PlayerResults
