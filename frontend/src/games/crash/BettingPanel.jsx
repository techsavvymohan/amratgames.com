import { useState, useEffect } from 'react'
import { Switch } from 'antd'
import { PlusOutlined, MinusOutlined, CloseOutlined } from '@ant-design/icons'
import { useWallet } from '../../context/WalletContext'
import casinoAudio from '../../utils/casinoAudio'

function BettingPanel({
    panelId = 1,
    phase = 'waiting',
    betPlaced = false,
    betAmount = 25,
    multiplier = 1.00,
    onBet,
    onCancel,
    onCashout,
    cashedOut = false,
    payout = 0,
    canRemove = false,
    onRemove = null
}) {
    const { currencySymbol, currency, balance } = useWallet()
    const [activeTab, setActiveTab] = useState('bet') // 'bet' | 'auto'
    const [amount, setAmount] = useState(betAmount || 25)
    const [autoBetEnabled, setAutoBetEnabled] = useState(false)
    const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(false)
    const [autoCashoutMult, setAutoCashoutMult] = useState(2.00)

    // Sync external betAmount if updated
    useEffect(() => {
        if (betAmount && !betPlaced) {
            setAmount(betAmount)
        }
    }, [betAmount, betPlaced])

    // Stepper amount adjustment
    const adjustAmount = (delta) => {
        casinoAudio.playChip?.()
        setAmount((prev) => {
            const next = Math.max(1, parseFloat((Number(prev || 0) + delta).toFixed(2)))
            return next
        })
    }

    // Set quick chip amount
    const handleChipClick = (chipVal) => {
        casinoAudio.playChip?.()
        setAmount(chipVal)
    }

    // Auto Cashout stepper
    const adjustAutoCashout = (delta) => {
        casinoAudio.playChip?.()
        setAutoCashoutMult((prev) => Math.max(1.05, parseFloat((Number(prev || 2.0) + delta).toFixed(2))))
    }

    // Main action button click handler
    const handleActionClick = () => {
        if (phase === 'waiting' || phase === 'idle') {
            if (betPlaced) {
                // Cancel placed bet before round begins
                if (onCancel) {
                    casinoAudio.playChip?.()
                    onCancel(panelId)
                }
            } else {
                // Place bet
                if (amount > 0 && onBet) {
                    casinoAudio.playBet?.()
                    onBet(amount, autoCashoutEnabled ? autoCashoutMult : null, panelId)
                }
            }
        } else if (phase === 'running' && betPlaced && !cashedOut) {
            // Cash out live during flight
            if (onCashout) {
                casinoAudio.playWin?.()
                onCashout(panelId)
            }
        }
    }

    // Auto-bet placing hook during countdown
    useEffect(() => {
        if (autoBetEnabled && phase === 'waiting' && !betPlaced && amount > 0 && amount <= balance) {
            const timer = setTimeout(() => {
                if (onBet && !betPlaced) {
                    onBet(amount, autoCashoutEnabled ? autoCashoutMult : null, panelId)
                }
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [autoBetEnabled, phase, betPlaced, amount, balance, autoCashoutEnabled, autoCashoutMult, onBet, panelId])

    // Render button appearance & state
    const isRunning = phase === 'running'
    const isWaiting = phase === 'waiting' || phase === 'idle'
    const isCrashed = phase === 'crashed'

    const liveCashoutVal = (amount * multiplier).toFixed(2)

    let btnStateClass = 'state-bet'
    let topLabel = 'Bet'
    let bottomLabel = `${Number(amount || 0).toFixed(2)} ${currency}`
    let isDisabled = false

    if (isWaiting) {
        if (betPlaced) {
            btnStateClass = 'state-cancel'
            topLabel = 'Cancel'
            bottomLabel = `${Number(amount || 0).toFixed(2)} ${currency}`
        } else {
            btnStateClass = 'state-bet'
            topLabel = 'Bet'
            bottomLabel = `${Number(amount || 0).toFixed(2)} ${currency}`
        }
    } else if (isRunning) {
        if (betPlaced && !cashedOut) {
            btnStateClass = 'state-cashout'
            topLabel = 'Cash Out'
            bottomLabel = `${liveCashoutVal} ${currency}`
        } else if (cashedOut) {
            btnStateClass = 'state-cashed'
            topLabel = 'Cashed Out'
            bottomLabel = `+${Number(payout || 0).toFixed(2)} ${currency}`
            isDisabled = true
        } else {
            btnStateClass = 'state-waiting-next'
            topLabel = 'Waiting'
            bottomLabel = 'Next Round'
            isDisabled = true
        }
    } else if (isCrashed) {
        if (cashedOut) {
            btnStateClass = 'state-cashed'
            topLabel = 'Won'
            bottomLabel = `+${Number(payout || 0).toFixed(2)} ${currency}`
        } else {
            btnStateClass = 'state-crashed'
            topLabel = 'Crashed'
            bottomLabel = 'Next Round'
        }
        isDisabled = true
    }

    return (
        <div className={`aviator-bet-panel panel-${panelId} ${betPlaced ? 'has-active-bet' : ''}`}>
            {/* Top Bar: Bet/Auto Segmented Switch + Optional Remove Panel Button */}
            <div className="panel-top-bar">
                <div className="aviator-segmented-control">
                    <button
                        type="button"
                        className={`seg-btn ${activeTab === 'bet' ? 'active' : ''}`}
                        onClick={() => {
                            casinoAudio.playChip?.()
                            setActiveTab('bet')
                        }}
                    >
                        Bet
                    </button>
                    <button
                        type="button"
                        className={`seg-btn ${activeTab === 'auto' ? 'active' : ''}`}
                        onClick={() => {
                            casinoAudio.playChip?.()
                            setActiveTab('auto')
                        }}
                    >
                        Auto
                    </button>
                </div>

                {canRemove && onRemove && (
                    <button
                        type="button"
                        className="panel-toggle-btn"
                        onClick={onRemove}
                        title="Remove second betting panel"
                    >
                        <CloseOutlined />
                    </button>
                )}
            </div>

            {/* Main Panel Content: 2 Columns */}
            <div className="panel-main-row">
                {/* Left Column: Stepper & Quick Chips (or Auto Options) */}
                <div className="panel-controls-col">
                    {activeTab === 'bet' ? (
                        <>
                            {/* Stepper: [-]  Amount  [+] */}
                            <div className="aviator-stepper">
                                <button
                                    type="button"
                                    className="stepper-btn minus-btn"
                                    onClick={() => adjustAmount(-10)}
                                    disabled={betPlaced}
                                >
                                    <MinusOutlined />
                                </button>
                                <div className="stepper-input-wrap">
                                    <input
                                        type="number"
                                        className="stepper-input"
                                        value={amount}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value)
                                            setAmount(isNaN(val) ? 0 : val)
                                        }}
                                        min="1"
                                        step="1"
                                        disabled={betPlaced}
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="stepper-btn plus-btn"
                                    onClick={() => adjustAmount(10)}
                                    disabled={betPlaced}
                                >
                                    <PlusOutlined />
                                </button>
                            </div>

                            {/* 2x2 Quick Chips: [ 100 ] [ 200 ] / [ 500 ] [ 1,000 ] */}
                            <div className="aviator-quick-chips">
                                <button
                                    type="button"
                                    className="chip-btn"
                                    onClick={() => handleChipClick(100)}
                                    disabled={betPlaced}
                                >
                                    100
                                </button>
                                <button
                                    type="button"
                                    className="chip-btn"
                                    onClick={() => handleChipClick(200)}
                                    disabled={betPlaced}
                                >
                                    200
                                </button>
                                <button
                                    type="button"
                                    className="chip-btn"
                                    onClick={() => handleChipClick(500)}
                                    disabled={betPlaced}
                                >
                                    500
                                </button>
                                <button
                                    type="button"
                                    className="chip-btn"
                                    onClick={() => handleChipClick(1000)}
                                    disabled={betPlaced}
                                >
                                    1,000
                                </button>
                            </div>
                        </>
                    ) : (
                        /* Auto Mode Controls */
                        <div className="aviator-auto-settings">
                            {/* Auto Bet Toggle */}
                            <div className="auto-row">
                                <span className="auto-label">Auto Bet</span>
                                <Switch
                                    size="small"
                                    checked={autoBetEnabled}
                                    onChange={setAutoBetEnabled}
                                    className="aviator-switch"
                                />
                            </div>

                            {/* Auto Cashout Toggle + Stepper */}
                            <div className="auto-cashout-group">
                                <div className="auto-row">
                                    <span className="auto-label">Auto Cash Out</span>
                                    <Switch
                                        size="small"
                                        checked={autoCashoutEnabled}
                                        onChange={setAutoCashoutEnabled}
                                        className="aviator-switch"
                                    />
                                </div>
                                {autoCashoutEnabled && (
                                    <div className="aviator-stepper compact-stepper">
                                        <button
                                            type="button"
                                            className="stepper-btn minus-btn"
                                            onClick={() => adjustAutoCashout(-0.1)}
                                            disabled={betPlaced}
                                        >
                                            <MinusOutlined />
                                        </button>
                                        <div className="stepper-input-wrap">
                                            <span className="stepper-val-text">{autoCashoutMult.toFixed(2)}x</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="stepper-btn plus-btn"
                                            onClick={() => adjustAutoCashout(0.1)}
                                            disabled={betPlaced}
                                        >
                                            <PlusOutlined />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: GIANT Action Button */}
                <div className="panel-action-col">
                    <button
                        type="button"
                        id={`crash-bet-btn-${panelId}`}
                        className={`aviator-action-btn ${btnStateClass}`}
                        onClick={handleActionClick}
                        disabled={isDisabled}
                    >
                        <span className="btn-main-label">{topLabel}</span>
                        <span className="btn-sub-label">{bottomLabel}</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default BettingPanel
