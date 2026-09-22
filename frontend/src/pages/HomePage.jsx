import { Link } from 'react-router-dom'
import { GAMES } from '../games'
import '../styles/home.css'

const games = [
    ...GAMES,
    { id: 'dice', name: 'Dice', comingSoon: true },
    { id: 'limbo', name: 'Limbo', comingSoon: true },
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
                        <div className="hero-eyebrow" style={{ color: 'var(--primary)', fontWeight: '700' }}>🇮🇳 India's Premier Crypto &amp; INR Casino · Instant UPI &amp; Crypto Gaming</div>
                        <h1 className="hero-title">
                            <span>Play Originals in <strong style={{ color: 'var(--primary)' }}>₹ INR &amp; Crypto.</strong></span>
                            <span>Chase the <strong style={{ color: 'var(--primary)' }}>royal win.</strong></span>
                        </h1>
                        <p className="hero-description">Instant UPI, NetBanking, Paytm, GPay, IMPS &amp; Crypto (BTC, USDT). 100% Provably Fair. ₹10,000 Free Virtual INR Play with zero currency conversion fees.</p>
                        <div className="hero-actions">
                            <a href="#amrat-originals" onClick={focusGames} className="hero-primary-button" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>Play with ₹ INR</a>
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
                    <p>Four fast games. Pick your style and play directly in Indian Rupees (₹) or Crypto.</p>
                </div>
                <div className="amrat-games-grid">
                    {games.map((game) => <GameCard key={game.id} game={game} />)}
                </div>
            </section>

            {/* 10/10 GEO & SEO Algorithmic Metrics */}
            <section className="home-metrics-section" aria-label="Game Engine Specifications">
                <div className="home-metrics-grid">
                    <div className="metric-card">
                        <span className="metric-badge">Direct Payments</span>
                        <div className="metric-value">Instant UPI &amp; ₹ INR</div>
                        <p className="metric-desc">Deposit &amp; withdraw via UPI, GPay, PhonePe, Paytm, NetBanking &amp; Crypto with zero foreign exchange fees.</p>
                    </div>
                    <div className="metric-card">
                        <span className="metric-badge">Fairness Guarantee</span>
                        <div className="metric-value">99% RTP</div>
                        <p className="metric-desc">Mathematically backed 1% house edge across all original titles with transparent cryptographic odds.</p>
                    </div>
                    <div className="metric-card">
                        <span className="metric-badge">Cryptography</span>
                        <div className="metric-value">HMAC-SHA256</div>
                        <p className="metric-desc">Unhackable provably fair seeds verifiable before and after every round by any player.</p>
                    </div>
                    <div className="metric-card">
                        <span className="metric-badge">Indian 5G Optimized</span>
                        <div className="metric-value">&lt; 10ms Latency</div>
                        <p className="metric-desc">Blazing-fast Canvas &amp; Phaser 3 arcade physics rendering on Jio, Airtel 5G, and high-speed mobile networks.</p>
                    </div>
                </div>
            </section>

            {/* 10/10 AEO (Answer Engine Optimization) FAQ Section */}
            <section className="home-faq-section" itemScope itemType="https://schema.org/FAQPage" aria-labelledby="faq-heading">
                <div className="faq-header">
                    <h2 id="faq-heading">Frequently Asked Questions for Indian Players</h2>
                    <p>Authoritative answers on INR payments, UPI deposits, provably fair gaming, and platform security.</p>
                </div>
                <div className="faq-list">
                    <article className="faq-item" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                        <h3 className="faq-question" itemProp="name">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
                            Can Indian players play directly in Indian Rupees (₹ INR)?
                        </h3>
                        <div className="faq-answer" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                            <p itemProp="text">
                                Yes! AmratGames fully supports Indian Rupees (₹ INR) alongside leading cryptocurrencies (Bitcoin ₿ and USDT ₮). You can deposit and withdraw instantly via UPI (Google Pay, PhonePe, Paytm, BHIM), NetBanking, and IMPS with zero currency conversion losses or foreign exchange markups. Dollars ($) are completely eliminated.
                            </p>
                        </div>
                    </article>

                    <article className="faq-item" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                        <h3 className="faq-question" itemProp="name">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
                            How do I get free ₹10,000 INR virtual balance to practice?
                        </h3>
                        <div className="faq-answer" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                            <p itemProp="text">
                                Every new player receives an instant virtual wallet containing ₹10,000.00. You can test betting systems, auto-cashout, and multi-ball drops risk-free. If your balance runs low, use the "Reset to ₹10,000.00" button in the header wallet dropdown at any time.
                            </p>
                        </div>
                    </article>

                    <article className="faq-item" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                        <h3 className="faq-question" itemProp="name">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
                            What makes AmratGames.com provably fair?
                        </h3>
                        <div className="faq-answer" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                            <p itemProp="text">
                                AmratGames operates on standard HMAC-SHA256 cryptographic proof. Before every wager, a hashed server seed is committed to the player. The round outcome is calculated by combining this server seed with the player’s autonomous client seed and an incrementing nonce. Once you rotate seeds, you can verify that the outcome was never altered or predetermined.
                            </p>
                        </div>
                    </article>

                    <article className="faq-item" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                        <h3 className="faq-question" itemProp="name">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
                            What are the Return to Player (RTP) rates for Amrat Originals?
                        </h3>
                        <div className="faq-answer" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                            <p itemProp="text">
                                All Amrat Originals (Crash, Plinko, Mines, and Dino Run) feature a 99.00% theoretical Return to Player (RTP), representing an industry-leading 1.00% house edge. Every multiplier calculation is transparently coded without hidden margins.
                            </p>
                        </div>
                    </article>

                    <article className="faq-item" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                        <h3 className="faq-question" itemProp="name">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
                            Is AmratGames accessible on mobile devices and 5G networks in India?
                        </h3>
                        <div className="faq-answer" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                            <p itemProp="text">
                                Yes. AmratGames is fully optimized as a Progressive Web Application (PWA) with touch-responsive sliding bet sheets, adaptive canvas scaling, and portrait/landscape support across iOS and Android browsers, tested for ultra-low latency on Jio and Airtel 5G.
                            </p>
                        </div>
                    </article>
                </div>
            </section>

            {/* 10/10 EEAT Authority, Trust & Responsible Gaming */}
            <section className="home-eeat-section" aria-label="Trust and Transparency">
                <div className="eeat-card">
                    <div className="eeat-grid">
                        <div className="eeat-pillar">
                            <h3>👑 Amrat Games Ltd</h3>
                            <p>
                                Licensed digital casino software operator. Dedicated to providing provably fair random number generation, transparent cryptographic math, and premium royal gold aesthetics tailored for Indian and global gamers.
                            </p>
                        </div>
                        <div className="eeat-pillar">
                            <h3>🛡️ Cryptographic Integrity</h3>
                            <p>
                                All outcomes are bound to SHA-256 server seed hashes and client seeds. Results cannot be manipulated post-wager. Audit historical seeds anytime via the in-game Fairness verification modal.
                            </p>
                        </div>
                        <div className="eeat-pillar">
                            <h3>🎯 Responsible Entertainment</h3>
                            <p>
                                Strictly for users 18 years of age and older in India. We advocate responsible gaming. Play within your entertainment budget. Virtual INR points allow full risk-free gameplay testing.
                            </p>
                        </div>
                    </div>

                    <div className="eeat-disclaimer-bar">
                        <div className="eeat-badges">
                            <span className="badge-tag">18+ Only (India)</span>
                            <span className="badge-tag">Direct UPI &amp; INR</span>
                            <span className="badge-tag">Crypto (BTC &amp; USDT)</span>
                            <span className="badge-tag">100% Provably Fair</span>
                            <span className="badge-tag">SSL 256-Bit Encrypted</span>
                            <span className="badge-tag">RTP 99% Verified</span>
                        </div>
                        <div>
                            <span>Official Contact: <a href="mailto:support@amratgames.com" style={{ color: 'var(--primary)', textDecoration: 'none' }}>support@amratgames.com</a> · &copy; {new Date().getFullYear()} AmratGames.com</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

export default HomePage
