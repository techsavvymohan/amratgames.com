// Sidebar Component - Direct port from Sidebar.svelte
import { useState, useRef, useEffect, useCallback } from 'react';
import { ROW_COUNT_OPTIONS, AUTO_BET_INTERVAL_MS, getBinColors } from './constants';
import './Sidebar.css';
import { Tooltip, Tag, InputNumber, Button, Typography } from 'antd';
import { TrophyOutlined, StarOutlined, FireOutlined } from '@ant-design/icons';
import { useWallet } from '../../context/WalletContext';
import { useAuth } from '../../context/AuthContext';
import { CurrencyIcon } from '../../components/Header';

const { Text } = Typography;

function Sidebar({
    balance,
    betAmount,
    setBetAmount,
    rowCount,
    setRowCount,
    riskLevel,
    setRiskLevel,
    hasOutstandingBalls,
    onDropBall,
    onSettingsClick,
    onStatsClick,
    isSettingsOpen,
    isStatsOpen,
    // Plinko-specific props
    selectedBallType,
    setSelectedBallType,
    ballTypes,
    currentBall,
    lastWin,
    winRecords,
    currentStreak,
    maxStreak,
}) {
    const { user, openAuthModal } = useAuth();
    const { currencySymbol, currency } = useWallet();
    const minBet = currency === 'INR' ? 10 : 1;

    // Validation
    const isBetAmountNegative = betAmount < minBet;
    const isBetExceedBalance = Boolean(user && betAmount > balance);
    const isDropBallDisabled = Boolean(user && (betAmount <= 0 || isBetAmountNegative || isBetExceedBalance));

    const handleBetClick = () => {
        if (!user) {
            openAuthModal?.('register');
            return;
        }
        onDropBall?.();
    };

    const riskLevels = [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
    ];

    return (
        <div className="sidebar">

            {/* Bet Amount */}
            <div className="form-group">
                <div className="form-header">
                    <label htmlFor="betAmount" className="form-label" style={{ margin: 0 }}>Bet Amount</label>
                    <Text type="secondary" style={{ margin: 0 }}>{currencySymbol}{(betAmount ?? 0).toFixed(2)}</Text>
                </div>
                <div className="input-row">
                    <InputNumber
                        id="betAmount"
                        value={betAmount}
                        onChange={(val) => setBetAmount(isNaN(Number(val)) ? 0 : Number(val))}
                        min={minBet}
                        step={1}
                        style={{ flex: 1 }}
                        controls={false}
                        formatter={(v) => `${v}`}
                        parser={(v) => v.replace(/[₹$₿₮\s,]/g, '')}
                        addonBefore={<CurrencyIcon symbol={currencySymbol} currency={currency} size={20} fontSize={12} />}
                    />
                    <Button.Group>
                        <Button
                            onClick={() => setBetAmount(prev => Math.max(minBet, parseFloat((Number(prev || minBet) / 2).toFixed(2))))}
                        >
                            ½
                        </Button>
                        <Button
                            onClick={() => setBetAmount(prev => parseFloat((Number(prev || minBet) * 2).toFixed(2)))}
                        >
                            2×
                        </Button>
                    </Button.Group>
                </div>
                {user && isBetAmountNegative && (
                    <p className="error-text">Minimum bet is {currencySymbol}{minBet}.</p>
                )}
                {isBetExceedBalance && (
                    <p className="error-text">Can't bet more than your balance!</p>
                )}
            </div>

            {/* Risk & Rows Compact Row */}
            <div className="risk-rows-compact-row">
                <div className="form-group flex-1">
                    <label htmlFor="riskLevel" className="form-label">Risk</label>
                    <select
                        id="riskLevel"
                        value={riskLevel}
                        onChange={(e) => setRiskLevel(e.target.value)}
                        disabled={hasOutstandingBalls}
                        className="form-select"
                    >
                        {riskLevels.map(({ value, label }) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group flex-1">
                    <label htmlFor="rowCount" className="form-label">Rows</label>
                    <select
                        id="rowCount"
                        value={rowCount}
                        onChange={(e) => setRowCount(parseInt(e.target.value))}
                        disabled={hasOutstandingBalls}
                        className="form-select"
                    >
                        {ROW_COUNT_OPTIONS.map((value) => (
                            <option key={value} value={value}>{value}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Bet Button */}
            <button
                id="plinko-drop-btn"
                className="bet-button"
                onClick={handleBetClick}
                disabled={isDropBallDisabled}
            >
                {!user ? 'Sign In to Play' : 'Drop Ball'}
            </button>

            {/* Footer */}
            <div className="sidebar-footer mobile-sheet-secondary">
                <div className="footer-buttons">
                    <button
                        className={`footer-btn ${isSettingsOpen ? 'active' : ''}`}
                        onClick={onSettingsClick}
                        title="Game Settings"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z" />
                        </svg>
                    </button>
                    <button
                        className={`footer-btn ${isStatsOpen ? 'active' : ''}`}
                        onClick={onStatsClick}
                        title="Live Stats"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 11.78l4.24-7.33 1.73 1-5.23 9.05-6.51-3.75L5.46 19H22v2H2V3h2v14.54L9.5 8z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* --- Plinko extra: Ball Selector, Last Win, Streak --- */}
            <div className="ball-selector-card sidebar-card mobile-sheet-secondary">
                <div className="ball-selector-header">
                    <StarOutlined />
                    <span>Ball Type</span>
                </div>
                <div className="ball-types-grid">
                    {Object.values(ballTypes || {}).map(ball => (
                        <Tooltip
                            key={ball.id}
                            title={
                                <div>
                                    <div style={{ fontWeight: 600 }}>{ball.name}</div>
                                    <div>{ball.description}</div>
                                    <div style={{ color: 'var(--text-secondary)' }}>Cost: {ball.cost}× bet</div>
                                </div>
                            }
                        >
                            <div
                                className={`ball-type-option ${selectedBallType === ball.id ? 'selected' : ''}`}
                                onClick={() => setSelectedBallType?.(ball.id)}
                                style={{ '--ball-color': ball.color }}
                            >
                                <div
                                    className="ball-color-circle"
                                    style={{ backgroundImage: `url(${ball.image})`, backgroundSize: 'cover', backgroundColor: 'transparent' }}
                                ></div>
                                <div className="ball-type-content">
                                    <div className="ball-type-name">{ball.name}</div>
                                    <div className="ball-type-cost">{ball.cost}×</div>
                                </div>
                            </div>
                        </Tooltip>
                    ))}
                </div>
            </div>

            {/* Last Win card removed as requested */}

            {/* Streak UI moved to History & Statistics */}
        </div>
    );
}

export default Sidebar;
