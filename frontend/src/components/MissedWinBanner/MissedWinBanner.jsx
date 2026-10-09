import React from 'react'
import { ThunderboltFilled, FireFilled, ArrowRightOutlined } from '@ant-design/icons'
import './MissedWinBanner.css'

/**
 * High-Converting Missed Opportunity FOMO Banner
 * Displays when a live non-stop round resolves and the spectator/visitor missed out on winning.
 */
export default function MissedWinBanner({
    visible,
    outcome,
    multiplier,
    amount = 100,
    payout,
    currencySymbol = '₹',
    onAction,
    countdown = 4,
    gameName = 'Game'
}) {
    if (!visible) return null

    const formattedPayout = payout
        ? Number(payout).toLocaleString('en-IN')
        : Number(amount * (multiplier || 2)).toLocaleString('en-IN')

    return (
        <div className="missed-win-banner-container" role="alert">
            <div className="missed-win-glow" />
            <div className="missed-win-content">
                <div className="missed-win-icon-badge">
                    <FireFilled className="missed-flame-icon" />
                    <span className="missed-mult-tag">{multiplier ? `${multiplier}x` : 'WIN'}</span>
                </div>

                <div className="missed-win-text-col">
                    <div className="missed-win-title">
                        <span className="missed-headline">😱 YOU MISSED IT!</span>
                        <span className="missed-outcome-chip">{outcome ? outcome.toUpperCase() : 'WINNER'} HIT</span>
                    </div>
                    <div className="missed-win-subtext">
                        If you bet <span className="highlight-amt">{currencySymbol}{amount}</span>, you would have won{' '}
                        <span className="highlight-win">{currencySymbol}{formattedPayout}</span>!
                    </div>
                </div>

                <button
                    type="button"
                    className="missed-win-cta-btn"
                    onClick={onAction}
                >
                    <ThunderboltFilled />
                    <span>BET NEXT ({countdown}s)</span>
                    <ArrowRightOutlined className="cta-arrow" />
                </button>
            </div>
        </div>
    )
}
