import React from 'react'
import './CasinoCard.css'

/**
 * High-Detail SVG Card Suits for Razor-Sharp Rendering
 */
export function SuitIcon({ suit, size = 16, className = '' }) {
    if (suit === '♥' || suit === 'heart') {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="#dc2626"
                className={`card-suit-svg suit-heart ${className}`}
                xmlns="http://www.w3.org/2000/svg"
            >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
        )
    }
    if (suit === '♦' || suit === 'diamond') {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="#dc2626"
                className={`card-suit-svg suit-diamond ${className}`}
                xmlns="http://www.w3.org/2000/svg"
            >
                <path d="M12 1.5L2.5 12 12 22.5 21.5 12 12 1.5z" />
            </svg>
        )
    }
    if (suit === '♣' || suit === 'club') {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="#0f172a"
                className={`card-suit-svg suit-club ${className}`}
                xmlns="http://www.w3.org/2000/svg"
            >
                <path d="M12 2a4 4 0 0 0-3.8 5.25A4.2 4.2 0 0 0 4 11.5a4.2 4.2 0 0 0 4.2 4.2c.4 0 .8-.05 1.18-.16l-.88 5.46h7l-.88-5.46c.38.11.78.16 1.18.16A4.2 4.2 0 0 0 20 11.5a4.2 4.2 0 0 0-4.2-4.25A4 4 0 0 0 12 2z" />
            </svg>
        )
    }
    // Default Spade ♠
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="#0f172a"
            className={`card-suit-svg suit-spade ${className}`}
            xmlns="http://www.w3.org/2000/svg"
        >
            <path d="M12 2C9.5 5.5 4 10.5 4 14.5a4.5 4.5 0 0 0 7.5 3.35l-.75 4.15h2.5l-.75-4.15A4.5 4.5 0 0 0 20 14.5c0-4-5.5-9-8-12.5z" />
        </svg>
    )
}

/**
 * Standard Playing Card Pip Grids for Numbers 2 - 10
 */
function CardPips({ rank, suit }) {
    const num = parseInt(rank, 10)
    if (isNaN(num)) return null

    // Pre-calculated relative standard casino pip coordinates in % (x, y)
    const pipCoords = {
        2: [
            { x: 50, y: 22, rotate: false },
            { x: 50, y: 78, rotate: true }
        ],
        3: [
            { x: 50, y: 22, rotate: false },
            { x: 50, y: 50, rotate: false },
            { x: 50, y: 78, rotate: true }
        ],
        4: [
            { x: 28, y: 24, rotate: false },
            { x: 72, y: 24, rotate: false },
            { x: 28, y: 76, rotate: true },
            { x: 72, y: 76, rotate: true }
        ],
        5: [
            { x: 28, y: 24, rotate: false },
            { x: 72, y: 24, rotate: false },
            { x: 50, y: 50, rotate: false },
            { x: 28, y: 76, rotate: true },
            { x: 72, y: 76, rotate: true }
        ],
        6: [
            { x: 28, y: 24, rotate: false },
            { x: 72, y: 24, rotate: false },
            { x: 28, y: 50, rotate: false },
            { x: 72, y: 50, rotate: false },
            { x: 28, y: 76, rotate: true },
            { x: 72, y: 76, rotate: true }
        ],
        7: [
            { x: 28, y: 24, rotate: false },
            { x: 72, y: 24, rotate: false },
            { x: 50, y: 37, rotate: false },
            { x: 28, y: 50, rotate: false },
            { x: 72, y: 50, rotate: false },
            { x: 28, y: 76, rotate: true },
            { x: 72, y: 76, rotate: true }
        ],
        8: [
            { x: 28, y: 24, rotate: false },
            { x: 72, y: 24, rotate: false },
            { x: 50, y: 37, rotate: false },
            { x: 28, y: 50, rotate: false },
            { x: 72, y: 50, rotate: false },
            { x: 50, y: 63, rotate: true },
            { x: 28, y: 76, rotate: true },
            { x: 72, y: 76, rotate: true }
        ],
        9: [
            { x: 28, y: 22, rotate: false },
            { x: 72, y: 22, rotate: false },
            { x: 28, y: 40, rotate: false },
            { x: 72, y: 40, rotate: false },
            { x: 50, y: 50, rotate: false },
            { x: 28, y: 60, rotate: true },
            { x: 72, y: 60, rotate: true },
            { x: 28, y: 78, rotate: true },
            { x: 72, y: 78, rotate: true }
        ],
        10: [
            { x: 28, y: 20, rotate: false },
            { x: 72, y: 20, rotate: false },
            { x: 50, y: 32, rotate: false },
            { x: 28, y: 40, rotate: false },
            { x: 72, y: 40, rotate: false },
            { x: 28, y: 60, rotate: true },
            { x: 72, y: 60, rotate: true },
            { x: 50, y: 68, rotate: true },
            { x: 28, y: 80, rotate: true },
            { x: 72, y: 80, rotate: true }
        ]
    }

    const coords = pipCoords[num] || []

    return (
        <div className="card-pips-arena">
            {coords.map((c, i) => (
                <div
                    key={i}
                    className="card-pip"
                    style={{
                        left: `${c.x}%`,
                        top: `${c.y}%`,
                        transform: `translate(-50%, -50%) ${c.rotate ? 'rotate(180deg)' : ''}`
                    }}
                >
                    <SuitIcon suit={suit} size={20} />
                </div>
            ))}
        </div>
    )
}

/**
 * Royal Court Card Illustrations (King, Queen, Jack, Ace)
 */
function CourtIllustration({ rank, suit, isRed }) {
    if (rank === 'A') {
        return (
            <div className="court-ace-emblem">
                <div className="ace-radiance" />
                <SuitIcon suit={suit} size={54} />
                <span className="ace-sub-title">AMRAT</span>
            </div>
        )
    }

    // Royal Face Cards Artwork (K, Q, J)
    const crownIcons = {
        K: '👑',
        Q: '👸',
        J: '⚔️'
    }
    const titles = {
        K: 'KING',
        Q: 'QUEEN',
        J: 'JACK'
    }

    return (
        <div className={`court-portrait-box ${isRed ? 'court-red' : 'court-black'}`}>
            <div className="court-inner-border">
                <div className="court-royal-crown">{crownIcons[rank]}</div>
                <div className="court-center-suit">
                    <SuitIcon suit={suit} size={26} />
                </div>
                <div className="court-royal-banner">{titles[rank]}</div>
                <div className="court-royal-crown inverted">{crownIcons[rank]}</div>
            </div>
        </div>
    )
}

/**
 * Authentic Casino Playing Card Component
 */
export default function CasinoCard({
    card, // { rank: 'A'|'K'|..., suit: '♠'|'♥'|'♦'|'♣' }
    flipped = false,
    theme = 'dragon', // 'dragon' (ruby/gold) or 'tiger' (sapphire/gold)
    isWinner = false,
    size = 'normal',
    className = ''
}) {
    if (!card) {
        return (
            <div className={`casino-card-placeholder ${theme} ${className}`}>
                <div className="placeholder-felt-inner">
                    <span className="placeholder-icon">{theme === 'dragon' ? '🐉' : '🐅'}</span>
                    <span className="placeholder-label">WAITING</span>
                </div>
            </div>
        )
    }

    const { rank, suit } = card
    const isRed = suit === '♥' || suit === '♦'
    const isCourt = ['A', 'J', 'Q', 'K'].includes(rank)

    return (
        <div
            className={`casino-card-wrapper ${size} ${flipped ? 'is-flipped' : ''} ${isWinner ? 'is-winner' : ''} ${className}`}
        >
            <div className="casino-card-inner">
                {/* CARD BACK (Authentic Royal Casino Deck) */}
                <div className={`casino-card-face card-back ${theme}`}>
                    <div className="card-back-margin">
                        <div className="card-back-pattern">
                            <div className="card-back-medallion">
                                <span className="medallion-crown">👑</span>
                                <span className="medallion-brand">AMRAT</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CARD FRONT (Crisp Linen Stock with Precision Indices & Pips) */}
                <div className={`casino-card-face card-front ${isRed ? 'card-red' : 'card-black'}`}>
                    <div className="card-linen-border" />

                    {/* Top-Left Corner Index */}
                    <div className="card-corner top-left">
                        <span className="corner-rank">{rank}</span>
                        <SuitIcon suit={suit} size={15} />
                    </div>

                    {/* Center Artwork: Pips or Royal Court Art */}
                    <div className="card-center-stage">
                        {isCourt ? (
                            <CourtIllustration rank={rank} suit={suit} isRed={isRed} />
                        ) : (
                            <CardPips rank={rank} suit={suit} />
                        )}
                    </div>

                    {/* Bottom-Right Inverted Corner Index */}
                    <div className="card-corner bottom-right">
                        <span className="corner-rank">{rank}</span>
                        <SuitIcon suit={suit} size={15} />
                    </div>
                </div>
            </div>

            {/* Winner Aura Glow Highlight */}
            {isWinner && (
                <div className={`card-winner-aura ${theme}`} />
            )}
        </div>
    )
}
