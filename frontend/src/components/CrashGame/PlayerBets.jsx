import { useState, useEffect, useRef } from 'react'
import { Card, Typography, Space, Badge, Collapse, Avatar } from 'antd'
import { UserOutlined, CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons'
import { useWallet } from '../../context/WalletContext'

const { Text } = Typography

function PlayerBets({ multiplier, phase, onPlayerCashout, userBetData, roomBets = [], isArena = false }) {
    const { currencySymbol, currency } = useWallet()
    const [expanded, setExpanded] = useState(true)

    // Dynamic players list driven by either shared arena room bets or solo bet
    const activePlayers = isArena
        ? (roomBets.length > 0 ? roomBets : (userBetData ? [userBetData] : []))
        : (userBetData ? [userBetData] : [])

    const totalBet = activePlayers.reduce((sum, p) => {
        const amt = parseFloat(p.amount ?? p.betAmount ?? 0)
        return sum + (isNaN(amt) ? 0 : amt)
    }, 0)
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
                        activePlayers.map((player, i) => {
                            const isCashed = Boolean(player.cashedOut || player.profit)
                            const mult = player.multiplier || player.cashoutAt
                            const pName = player.username || player.name || 'Player'
                            const betAmt = parseFloat(player.betAmount ?? player.amount ?? 0)
                            const displayAmt = isCashed
                                ? `+${(parseFloat(player.payout || player.profit || (betAmt * mult)) || 0).toFixed(2)}`
                                : betAmt.toFixed(2)

                            return (
                                <div key={player.userId || player.id || i} className={`player-bet-row ${isCashed ? 'cashed-out' : ''}`}>
                                    <div className="player-info">
                                        <Text className="player-name">{pName}</Text>
                                        {isCashed && mult && (
                                            <Text className="cashout-mult" type="success">
                                                {parseFloat(mult).toFixed(2)}×
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
                                        <Text className={isCashed ? 'profit' : ''}>
                                            {displayAmt}
                                        </Text>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            )}
        </div>
    )
}

export default PlayerBets
