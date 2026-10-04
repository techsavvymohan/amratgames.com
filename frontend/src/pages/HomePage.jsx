import { Link } from 'react-router-dom'
import { GAMES } from '../games'
import LivePlatformBets from '../components/LivePlatformBets'
import '../styles/home.css'

const games = [
    ...GAMES,
    { id: 'dice', name: 'Dice', comingSoon: true },
]

const categories = ['Amrat Originals', 'Popular', 'New', 'Slots', 'Live Casino', 'Table Games', 'Jackpot', 'Providers']

function GameCard({ game }) {
    const cardContent = <>
        <div className="amrat-card-image">
            {game.image ? (
                <img src={game.image} alt={`${game.name} game`} className="game-art-image" />
            ) : (
                <div className="game-art-placeholder" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z" /></svg>
                </div>
            )}
            {!game.comingSoon && <div className="card-overlay"><span className="play-btn" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="black"><path d="M8 5v14l11-7z" /></svg></span></div>}
        </div>
        <div className="amrat-card-footer">
            <div>
                <span className="game-name">{game.name}</span>
                {game.rtp && <div className="game-meta"><span>{game.rtp}</span><span>{game.volatility}</span></div>}
            </div>
            {game.comingSoon ? <span className="badge-coming-soon">Coming soon</span> : <span className="card-play-label" aria-hidden="true">Play <span>→</span></span>}
        </div>
    </>

    if (game.comingSoon) return <div className="amrat-card is-coming-soon">{cardContent}</div>

    return <Link to={game.path} className="amrat-card">{cardContent}</Link>
}

function HomePage() {
    const focusGames = () => requestAnimationFrame(() => document.getElementById('amrat-originals')?.focus())

    return (
        <div className="home-page-container">
            <section className="home-page-hero">
                <div className="hero-content">
                    <div className="hero-copy">
                        <div className="hero-eyebrow" style={{ color: 'var(--primary)', fontWeight: '700' }}>Provably Fair Originals</div>
                        <h1 className="hero-title">
                            <span>Play in <strong style={{ color: 'var(--primary)' }}>₹ INR &amp; Crypto.</strong></span>
                        </h1>
                        <p className="hero-description">Instant UPI deposits, fast withdrawals, and 99% RTP provably fair games.</p>
                        <div className="hero-actions">
                            <a href="#amrat-originals" onClick={focusGames} className="hero-primary-button" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>Play Now</a>
                            <a className="hero-secondary-link" href="#amrat-originals" onClick={focusGames}>Browse games <span aria-hidden="true">→</span></a>
                        </div>
                    </div>
                </div>
            </section>

            <nav className="game-category-nav" aria-label="Game categories">
                <div className="game-category-list">
                    {categories.map((category, index) => (
                        <button key={category} type="button" className={`game-category-chip ${index === 0 ? 'active' : ''}`} aria-pressed={index === 0}>{category}</button>
                    ))}
                </div>
            </nav>

            <section id="amrat-originals" className="home-section" tabIndex="-1">
                <div className="section-header-copy">
                    <p className="section-kicker">Play now</p>
                    <h2>Amrat Originals</h2>
                    <p>Seven fast games. 99% RTP with transparent provably fair odds.</p>
                </div>
                <div className="amrat-games-grid">
                    {games.map((game) => <GameCard key={game.id} game={game} />)}
                </div>
            </section>

            {/* Live Real-Time Platform Bets */}
            <LivePlatformBets />

            {/* Platform Feature Highlights */}
            <section className="home-metrics-section" aria-label="Platform Highlights">
                <div className="home-metrics-grid">
                    <div className="metric-card">
                        <span className="metric-badge">UPI &amp; Crypto</span>
                        <div className="metric-value">Instant INR</div>
                        <p className="metric-desc">Deposit and withdraw via UPI and Crypto with zero conversion fees.</p>
                    </div>
                    <div className="metric-card">
                        <span className="metric-badge">Fairness</span>
                        <div className="metric-value">99% RTP</div>
                        <p className="metric-desc">Low 1% house edge across all original titles.</p>
                    </div>
                    <div className="metric-card">
                        <span className="metric-badge">Provably Fair</span>
                        <div className="metric-value">100% Verifiable</div>
                        <p className="metric-desc">Cryptographic fairness verified before and after each round.</p>
                    </div>
                    <div className="metric-card">
                        <span className="metric-badge">Withdrawals</span>
                        <div className="metric-value">24/7 Payouts</div>
                        <p className="metric-desc">Instant settlements to your account around the clock.</p>
                    </div>
                </div>
            </section>

            {/* Frequently Asked Questions */}
            <section className="home-faq-section" itemScope itemType="https://schema.org/FAQPage" aria-labelledby="faq-heading">
                <div className="faq-header">
                    <h2 id="faq-heading">Frequently Asked Questions</h2>
                    <p>Quick answers on payments, fairness, and gameplay.</p>
                </div>
                <div className="faq-list">
                    <article className="faq-item" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                        <h3 className="faq-question" itemProp="name">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
                            Can I play directly in Indian Rupees (₹ INR)?
                        </h3>
                        <div className="faq-answer" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                            <p itemProp="text">
                                Yes. AmratGames supports Indian Rupees (₹) and crypto (BTC, USDT) via UPI (Google Pay, PhonePe, Paytm), NetBanking, and IMPS with zero conversion fees.
                            </p>
                        </div>
                    </article>

                    <article className="faq-item" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                        <h3 className="faq-question" itemProp="name">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
                            How do I get free ₹10,000 INR practice balance?
                        </h3>
                        <div className="faq-answer" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                            <p itemProp="text">
                                Every new player receives ₹10,000 practice credits automatically. You can reset your balance anytime from the wallet dropdown.
                            </p>
                        </div>
                    </article>

                    <article className="faq-item" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                        <h3 className="faq-question" itemProp="name">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
                            What makes the platform provably fair?
                        </h3>
                        <div className="faq-answer" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                            <p itemProp="text">
                                All round outcomes are derived from SHA-256 cryptographic hashes combining server seeds, client seeds, and nonces. Players can verify any game outcome independently.
                            </p>
                        </div>
                    </article>

                    <article className="faq-item" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                        <h3 className="faq-question" itemProp="name">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
                            What are the Return to Player (RTP) rates?
                        </h3>
                        <div className="faq-answer" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                            <p itemProp="text">
                                All Amrat Originals feature 99.00% theoretical RTP with an industry-low 1.00% house edge.
                            </p>
                        </div>
                    </article>

                    <article className="faq-item" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                        <h3 className="faq-question" itemProp="name">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
                            Can I play on mobile devices?
                        </h3>
                        <div className="faq-answer" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                            <p itemProp="text">
                                Yes. AmratGames is fully responsive on all mobile browsers with touch controls and no app download required.
                            </p>
                        </div>
                    </article>
                </div>
            </section>

            {/* Trust & Transparency */}
            <section className="home-eeat-section" aria-label="Trust and Transparency">
                <div className="eeat-card">
                    <div className="eeat-grid">
                        <div className="eeat-pillar">
                            <h3>👑 Amrat Games</h3>
                            <p>
                                Provably fair gaming platform featuring transparent cryptographic odds and instant settlements.
                            </p>
                        </div>
                        <div className="eeat-pillar">
                            <h3>🛡️ Cryptographic Proof</h3>
                            <p>
                                SHA-256 verifiable seed commitment on every round ensures 100% tamper-proof outcomes.
                            </p>
                        </div>
                        <div className="eeat-pillar">
                            <h3>🎯 Responsible Entertainment</h3>
                            <p>
                                18+ only. Play responsibly and test games risk-free using virtual practice credits.
                            </p>
                        </div>
                    </div>

                    <div className="eeat-disclaimer-bar">
                        <div className="eeat-badges">
                            <span className="badge-tag">18+ Only</span>
                            <span className="badge-tag">UPI &amp; INR</span>
                            <span className="badge-tag">Crypto (BTC &amp; USDT)</span>
                            <span className="badge-tag">Provably Fair</span>
                            <span className="badge-tag">99% RTP</span>
                        </div>
                        <div>
                            <span>Contact: <a href="mailto:support@amratgames.com" style={{ color: 'var(--primary)', textDecoration: 'none' }}>support@amratgames.com</a> · &copy; {new Date().getFullYear()} AmratGames.com</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

export default HomePage
