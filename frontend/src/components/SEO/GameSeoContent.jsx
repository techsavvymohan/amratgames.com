import { useState } from 'react'
import { Link } from 'react-router-dom'
import './GameSeoContent.css'

const GAME_INFO = {
    '/crash': {
        title: 'Aviator Crash Rocket Game',
        badge: '🚀 HOT ORIGINAL',
        rtp: '99% Return to Player (RTP)',
        houseEdge: '1.0% Low House Edge',
        maxWin: '10,000x Bet Multiplier',
        payoutSpeed: 'Instant UPI (< 60s)',
        summary: 'Amrat Crash is a real-time multiplayer rocket multiplier game. Place your bet in Indian Rupees (₹) and watch the rocket ascend. As the altitude climbs, the win multiplier increases from 1.00x up to 10,000x. Cash out before the rocket crashes to multiply your stake.',
        features: [
            { icon: '⚡', title: 'Auto-Cashout', desc: 'Set an automatic target cashout (e.g. 2.00x) so your winnings lock in without manual delay.' },
            { icon: '🛡️', title: 'HMAC-SHA256 Fair', desc: 'Every round crash point is cryptographically sealed before betting starts. Fully auditable.' },
            { icon: '🇮🇳', title: 'Direct INR via UPI', desc: 'Play in rupees with zero forex conversion. Works with PhonePe, Google Pay, and Paytm.' },
            { icon: '👥', title: 'Live Platform Bets', desc: 'Watch other players cash out in real-time with transparent platform statistics.' },
        ],
        steps: [
            { step: '1', title: 'Choose Your Wager', desc: 'Enter any amount from ₹10 to ₹50,000, or practice free with ₹10,000 virtual balance.' },
            { step: '2', title: 'Watch Multiplier Climb', desc: 'The rocket launches and the multiplier increases dynamically along the exponential curve.' },
            { step: '3', title: 'Cash Out & Win', desc: 'Hit CASH OUT before the rocket explodes. Winnings credit instantly to your INR cashier.' },
        ],
        faqs: [
            { q: 'What is the maximum win in Crash?', a: 'The maximum multiplier is 10,000x your wager, with instant withdrawals up to platform limits.' },
            { q: 'Can I practice Crash for free?', a: 'Yes! Every new user receives ₹10,000 in free virtual demo balance to test strategies risk-free.' },
            { q: 'How is Provably Fair guaranteed?', a: 'The crash point is generated using HMAC-SHA256 with the server seed and client seed combined with the round nonce.' },
        ]
    },
    '/plinko': {
        title: 'Plinko Casino Peg Drop Game',
        badge: '🎯 POPULAR ORIGINAL',
        rtp: '99% Return to Player (RTP)',
        houseEdge: '1.0% Low House Edge',
        maxWin: '1,000x Bet Multiplier',
        payoutSpeed: 'Instant UPI (< 60s)',
        summary: 'Drop bouncing balls down a customizable triangular peg pyramid. Real-time Matter.js physics deliver authentic gravity and deflection as balls cascade into high-multiplier buckets at the base.',
        features: [
            { icon: '📐', title: '8 to 16 Rows', desc: 'Customize the grid depth from 8 rows for steady hits to 16 rows for massive 1,000x edges.' },
            { icon: '🎚️', title: '3 Risk Profiles', desc: 'Switch between Low, Medium, and High volatility depending on your target betting style.' },
            { icon: '⚽', title: 'Continuous Drop Mode', desc: 'Drop multiple balls in rapid succession to create cascading multi-ball win streaks.' },
            { icon: '🔍', title: 'Verifiable Physics', desc: 'Every peg deflection path is verified with deterministic cryptographic seeds.' },
        ],
        steps: [
            { step: '1', title: 'Select Rows & Risk', desc: 'Choose between 8 and 16 peg rows, and pick Low, Medium, or High risk volatility.' },
            { step: '2', title: 'Drop The Ball', desc: 'Click Bet to release a ball from the apex of the pyramid into the pin field.' },
            { step: '3', title: 'Collect Multiplier', desc: 'When the ball settles in a bottom pocket, your stake is multiplied by that bucket’s value.' },
        ],
        faqs: [
            { q: 'Which Plinko setting gives the highest payout?', a: 'Setting 16 rows on High Risk unlocks the outer edge buckets paying up to 1,000x.' },
            { q: 'Is Plinko rigged or randomized?', a: 'Plinko outcomes are 100% Provably Fair. Each ball’s left/right deflection at every peg is determined by SHA-256 hashes.' },
            { q: 'Can I play Plinko on my phone?', a: 'Yes, the game is 100% mobile-optimized with smooth 60fps canvas physics and touch controls.' },
        ]
    },
    '/mines': {
        title: 'Mines & Diamonds 5x5 Grid Game',
        badge: '💎 TRENDING ORIGINAL',
        rtp: '99% Return to Player (RTP)',
        houseEdge: '1.0% Low House Edge',
        maxWin: '10,000x Bet Multiplier',
        payoutSpeed: 'Instant UPI (< 60s)',
        summary: 'Explore a 5x5 grid of 25 mystery tiles. Every tile reveals either a sparkling diamond that boosts your cashout multiplier or a game-ending mine. Cash out after 1 tile or clear the board for astronomical returns.',
        features: [
            { icon: '💣', title: '1 to 24 Configurable Mines', desc: 'Set your difficulty: 1 mine for casual 96% win probability or 24 mines for instant huge multipliers.' },
            { icon: '💰', title: 'Cash Out Anytime', desc: 'Take your profit after every single uncovered diamond or keep going for bigger streaks.' },
            { icon: '🎲', title: 'Provably Fair Tiles', desc: 'Mine positions are shuffled with server & client seed entropy before the round begins.' },
            { icon: '⚡', title: 'Rapid Pick Controls', desc: 'Responsive touch grid with instant audio feedback and tactile diamond reveals.' },
        ],
        steps: [
            { step: '1', title: 'Configure Board', desc: 'Pick your bet and select how many hidden mines to place on the 25-tile grid (1 to 24).' },
            { step: '2', title: 'Uncover Diamonds', desc: 'Tap any tile. Uncovering a diamond multiplies your cashout value.' },
            { step: '3', title: 'Cash Out or Continue', desc: 'Click Cash Out whenever you want to lock in your profit before hitting a mine.' },
        ],
        faqs: [
            { q: 'How many mines should I play with?', a: 'Casual players prefer 3 to 5 mines for steady wins. High rollers pick 10+ mines for rapid exponential multipliers.' },
            { q: 'Can I see the remaining mines after cashout?', a: 'Yes, all remaining diamonds and hidden mine positions are revealed upon cashout.' },
            { q: 'What is the RTP of Mines?', a: 'Amrat Mines has an industry-leading 99.00% Return to Player with only a 1.00% house edge.' },
        ]
    },
    '/limbo': {
        title: 'Limbo Target Multiplier Game',
        badge: '⚡ BIG WIN MULTIPLIER',
        rtp: '99% Return to Player (RTP)',
        houseEdge: '1.0% Low House Edge',
        maxWin: '1,000,000x Multiplier',
        payoutSpeed: 'Instant UPI (< 60s)',
        summary: 'Test your nerve in the simplest high-octane casino game. Choose any target multiplier from 1.01x up to 1,000,000x. If the randomized rocket roll hits or beats your target, you win instantly.',
        features: [
            { icon: '🎯', title: '1,000,000x Top Payout', desc: 'Shoot for life-changing multipliers with transparent mathematical win probabilities.' },
            { icon: '⚡', title: 'Instant Sub-100ms Draws', desc: 'No waiting for wheel spins or timers. Instant cryptographic outcome generation.' },
            { icon: '📊', title: 'Calculated Win Chances', desc: 'Live probability calculator shows exact win likelihood for any chosen multiplier.' },
            { icon: '🛡️', title: 'Zero Manipulation', desc: 'Each roll is generated via HMAC-SHA256 with verifiable round seeds.' },
        ],
        steps: [
            { step: '1', title: 'Set Target Multiplier', desc: 'Enter any target multiplier (e.g. 2.00x, 10.00x, or 100.00x).' },
            { step: '2', title: 'Confirm Wager', desc: 'Input your wager in INR or virtual practice tokens and click Bet.' },
            { step: '3', title: 'Check Result', desc: 'If the roll equals or exceeds your target multiplier, your payout is credited immediately.' },
        ],
        faqs: [
            { q: 'What is the lowest multiplier I can target?', a: 'You can target as low as 1.01x for a 98% statistical win probability.' },
            { q: 'Can I automate bets on Limbo?', a: 'Yes, auto-betting features allow you to set win/loss adjustments and round counts.' },
        ]
    },
    '/dragon-tiger': {
        title: 'Dragon Tiger VIP Live Cards',
        badge: '🃏 HIGH ROLLER TABLE',
        rtp: '96.27% - 99.00% RTP',
        houseEdge: 'Low Card Edge',
        maxWin: '8x Tie Multiplier',
        payoutSpeed: 'Instant UPI (< 60s)',
        summary: 'Known as the two-card baccarat of Asian gaming, Dragon Tiger pits the Dragon against the Tiger in rapid-fire rounds. Whichever card is highest wins at 1:1, with 8:1 payouts for Ties.',
        features: [
            { icon: '🎴', title: 'Two-Card Simplicity', desc: 'No complex third card rules. The highest card ranking wins every round.' },
            { icon: '📈', title: 'Macau Bead Roadmaps', desc: 'Track comprehensive live trend roadmaps including Bead Plate, Big Road, and Cockroach Pig.' },
            { icon: '🤝', title: '8x Tie Payout', desc: 'Bet on equal card ranks to win an 8:1 return on your wager.' },
            { icon: '⏱️', title: '15-Second Rounds', desc: 'Fast betting cycles allow rapid action and continuous table play.' },
        ],
        steps: [
            { step: '1', title: 'Pick Your Side', desc: 'Bet on Dragon, Tiger, or Tie during the countdown betting window.' },
            { step: '2', title: 'Cards Dealt', desc: 'One card is dealt face-up to Dragon, and one to Tiger.' },
            { step: '3', title: 'Higher Card Wins', desc: 'King is high (13), Ace is low (1). Highest card takes the pot.' },
        ],
        faqs: [
            { q: 'What happens if Dragon and Tiger have the same value?', a: 'If you bet on Tie, you receive an 8x payout. If you bet Dragon or Tiger, 50% of your stake is returned.' },
            { q: 'Are cards shuffled fairly?', a: 'Yes, our digital 8-deck shoe uses cryptographically certified Fisher-Yates random shuffling.' },
        ]
    },
    '/color-match': {
        title: 'Color Match Fast Prediction Game',
        badge: '🎨 VIRAL 30-SECOND ROUNDS',
        rtp: '99% Return to Player (RTP)',
        houseEdge: '1.0% Low House Edge',
        maxWin: '9x Number Multiplier',
        payoutSpeed: 'Instant UPI (< 60s)',
        summary: 'A fast-paced color prediction game popular across India. Guess whether the next 30-second draw will be Green, Red, or Violet, or predict the exact number 0-9 for 9x payouts.',
        features: [
            { icon: '🟢', title: 'Green & Red (2x)', desc: 'Predict primary colors for steady 2x doubling returns.' },
            { icon: '🟣', title: 'Violet Multiplier (4.5x)', desc: 'Special draw color that triggers generous 4.5x payouts on mixed results.' },
            { icon: '🔢', title: 'Exact Number (9x)', desc: 'Nail the single digit from 0 to 9 for an instant 9x jackpot.' },
            { icon: '⏱️', title: '30-Second Cycles', desc: 'Non-stop adrenaline with new rounds starting every half-minute.' },
        ],
        steps: [
            { step: '1', title: 'Select Color or Number', desc: 'Choose Green, Red, Violet, or a specific number from 0 to 9.' },
            { step: '2', title: 'Place Your Bet', desc: 'Confirm your wager before the round timer reaches the final 5 seconds.' },
            { step: '3', title: 'Win Payout', desc: 'Winning predictions are paid automatically at the end of each 30-second timer.' },
        ],
        faqs: [
            { q: 'How often do draws take place?', a: 'Draws occur 24/7 every 30 seconds with automated round resolution.' },
            { q: 'Can I bet on both a color and a number?', a: 'Yes! You can spread your bet across multiple outcomes in the same round.' },
        ]
    },
    '/coin-toss': {
        title: 'Coin Toss 3D Heads or Tails',
        badge: '🪙 INSTANT 1.96X CASINO',
        rtp: '96% - 99% Return',
        houseEdge: 'Low House Edge',
        maxWin: '1.96x Instant Doubler',
        payoutSpeed: 'Instant UPI (< 60s)',
        summary: 'The timeless duel of Heads or Tails brought to life in 3D physics. Choose Heads or Tails, flip the golden royal coin, and collect instant 1.96x payouts with zero waiting.',
        features: [
            { icon: '👑', title: 'Royal Heads (1.96x)', desc: 'Pick the royal crown emblem for instant 1.96x payout.' },
            { icon: '⭐', title: 'Golden Tails (1.96x)', desc: 'Pick the star spade emblem for equal 1.96x returns.' },
            { icon: '🪙', title: '3D Physics Flip', desc: 'Smooth physics simulation with realistic coin bounce and sound design.' },
            { icon: '⚔️', title: 'Live PvP Arena', desc: 'Challenge other online players in real-time heads-up coin toss duels.' },
        ],
        steps: [
            { step: '1', title: 'Select Coin Side', desc: 'Choose Heads or Tails.' },
            { step: '2', title: 'Set Bet Amount', desc: 'Place your wager using INR or virtual practice balance.' },
            { step: '3', title: 'Flip & Win', desc: 'Watch the 3D coin spin and collect your 1.96x payout on correct call.' },
        ],
        faqs: [
            { q: 'Can I challenge other players in Coin Toss?', a: 'Yes! The PvP Duels Arena allows you to create or join coin flip battles against other players.' },
            { q: 'How is the toss randomized?', a: 'Toss physics and landing entropy are calculated via HMAC-SHA256 seed hashing.' },
        ]
    }
}

export default function GameSeoContent({ pathname, onOpenAuth }) {
    const info = GAME_INFO[pathname] || GAME_INFO['/crash']
    const [openFaq, setOpenFaq] = useState(null)

    const toggleFaq = (idx) => {
        setOpenFaq(openFaq === idx ? null : idx)
    }

    return (
        <section className="game-seo-section" aria-label={`Complete Guide to ${info.title}`}>
            {/* Header / Summary Card */}
            <div className="game-seo-card game-seo-overview">
                <div className="game-seo-badge-row">
                    <span className="game-seo-badge">{info.badge}</span>
                    <span className="game-seo-rtp-pill">{info.rtp}</span>
                    <span className="game-seo-payout-pill">⚡ {info.payoutSpeed}</span>
                </div>
                <h2 className="game-seo-title">{info.title} — Official Indian Player Guide</h2>
                <p className="game-seo-desc">{info.summary}</p>

                {/* Quick Specs Strip */}
                <div className="game-seo-specs-grid">
                    <div className="game-spec-item">
                        <span className="spec-label">Theoretical RTP</span>
                        <span className="spec-val highlight-green">{info.rtp.split(' ')[0]}</span>
                    </div>
                    <div className="game-spec-item">
                        <span className="spec-label">House Edge</span>
                        <span className="spec-val">{info.houseEdge.split(' ')[0]}</span>
                    </div>
                    <div className="game-spec-item">
                        <span className="spec-label">Max Win Multiplier</span>
                        <span className="spec-val highlight-gold">{info.maxWin}</span>
                    </div>
                    <div className="game-spec-item">
                        <span className="spec-label">Verification</span>
                        <span className="spec-val highlight-blue">HMAC-SHA256</span>
                    </div>
                </div>
            </div>

            {/* How to Play 3-Step Guide */}
            <div className="game-seo-card game-seo-how-to">
                <div className="game-seo-section-title">
                    <span className="section-title-icon">📖</span>
                    <h3>How to Play &amp; Win in Indian Rupees (₹)</h3>
                </div>
                <div className="how-to-steps-grid">
                    {info.steps.map((st) => (
                        <div key={st.step} className="how-to-step-card">
                            <div className="step-number">{st.step}</div>
                            <h4 className="step-title">{st.title}</h4>
                            <p className="step-desc">{st.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="game-seo-card game-seo-features">
                <div className="game-seo-section-title">
                    <span className="section-title-icon">⭐</span>
                    <h3>Key Game Features &amp; Fair Play Mechanics</h3>
                </div>
                <div className="game-features-grid">
                    {info.features.map((feat, idx) => (
                        <div key={idx} className="game-feature-card">
                            <span className="feature-icon">{feat.icon}</span>
                            <div className="feature-text">
                                <h4 className="feature-title">{feat.title}</h4>
                                <p className="feature-desc">{feat.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Frequently Asked Questions */}
            <div className="game-seo-card game-seo-faqs">
                <div className="game-seo-section-title">
                    <span className="section-title-icon">❓</span>
                    <h3>Frequently Asked Questions About {info.title}</h3>
                </div>
                <div className="game-faq-list">
                    {info.faqs.map((faq, idx) => {
                        const isOpen = openFaq === idx
                        return (
                            <div key={idx} className={`game-faq-item ${isOpen ? 'open' : ''}`}>
                                <button
                                    type="button"
                                    className="game-faq-question"
                                    onClick={() => toggleFaq(idx)}
                                    aria-expanded={isOpen}
                                >
                                    <span>{faq.q}</span>
                                    <span className="faq-chevron" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                                </button>
                                {isOpen && (
                                    <div className="game-faq-answer">
                                        <p>{faq.a}</p>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Bottom Conversion CTA Strip */}
            <div className="game-seo-cta-strip">
                <div className="cta-copy">
                    <h4>Ready to Play {info.title}?</h4>
                    <p>Register in 10 seconds to claim your free ₹100 welcome bonus or test free with ₹10,000 practice credits.</p>
                </div>
                <div className="cta-actions">
                    <button
                        type="button"
                        className="game-seo-btn-primary"
                        onClick={() => onOpenAuth?.('register')}
                    >
                        🎁 Create Free Account (Claim ₹100)
                    </button>
                    <button
                        type="button"
                        className="game-seo-btn-secondary"
                        onClick={() => onOpenAuth?.('login')}
                    >
                        🔑 Sign In to Existing Account
                    </button>
                </div>
            </div>
        </section>
    )
}
