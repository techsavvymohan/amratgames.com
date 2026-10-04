import { useState, useEffect, useRef } from 'react'
import { Card, Typography, Space, Badge, Collapse, Avatar } from 'antd'
import { UserOutlined, CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons'
import { useWallet } from '../../context/WalletContext'

const { Text } = Typography

function PlayerBets({ multiplier, phase, onPlayerCashout, userBetData }) {
    const { currencySymbol, currency } = useWallet()
    const [expanded, setExpanded] = useState(true)

    // Dynamic players list driven strictly by active player bets
    const activePlayers = userBetData ? [userBetData] : []
    const totalBet = userBetData?.amount || 0
    const playerCount = activePlayers.length

    return (
        <div className="player-bets-panel">
            {/* Header */}
            <div
                className="player-bets-header"
                onClick={() => setExpanded(!expanded)}
            >
                <Space>
                    <Badge status={phase === 'running' ? 'processing' : 'default'} color="var(--success)" />
                    <UserOutlined />
                    <Text strong>{playerCount}</Text>
                </Space>
                <Space>
                    <span
                        className="currency-badge"
                        style={{
                            background: currency === 'INR' ? 'linear-gradient(135deg, #f5af19, #d49110)' : (currency === 'BTC' ? 'linear-gradient(135deg, #f7931a, #ffb347)' : 'linear-gradient(135deg, #26a17b, #137554)'),
                            color: '#fff',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '12px'
                        }}
                    >
                        {currencySymbol}
                    </span>
                    <Text strong>{totalBet.toFixed(2)}</Text>
                    {expanded ? <CaretUpOutlined /> : <CaretDownOutlined />}
                </Space>
            </div>

            {/* Player List */}
            {expanded && (
                <div className="player-bets-list">
                    {activePlayers.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                            Waiting for bets in round...
                        </div>
                    ) : (
                        activePlayers.map((player, i) => (
                            <div key={i} className={`player-bet-row ${player.profit ? 'cashed-out' : ''}`}>
                                <div className="player-info">
                                    <Text className="player-name">{player.name || 'You'}</Text>
                                    {player.cashoutAt && player.profit && (
                                        <Text className="cashout-mult" type="success">
                                            {player.cashoutAt}×
                                        </Text>
                                    )}
                                </div>
                                <div className="bet-amount">
                                    <span
                                        className="currency-badge small"
                                        style={{ background: '#f5af19' }}
                                    >
                                        {currencySymbol}
                                    </span>
                                    <Text className={player.profit ? 'profit' : ''}>
                                        {player.profit || (typeof player.amount === 'number' ? player.amount.toFixed(2) : player.betAmount)}
                                    </Text>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

export default PlayerBets
