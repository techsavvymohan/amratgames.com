import { Link } from 'react-router-dom'
import { getOptimizedImageUrl } from '../../utils/cloudinary'
import './Footer.css'

export default function Footer({ onOpenVerifier, onOpenRace }) {
    const currentYear = new Date().getFullYear()

    return (
        <footer className="amrat-global-footer" aria-label="Site Footer">
            <div className="footer-top-strip">
                <div className="footer-container footer-top-inner">
                    <div className="footer-brand-summary">
                        <Link to="/" className="footer-logo-link" aria-label="AmratGames Home">
                            <img
                                src={getOptimizedImageUrl('/amrat-logo.png', { width: 72 })}
                                alt="AmratGames Logo"
                                className="footer-brand-logo"
                                loading="lazy"
                            />
                            <div className="footer-brand-text">
                                <span className="brand-name">AmratGames<span className="domain-suffix">.com</span></span>
                                <span className="brand-tagline">India's Premier Online Casino &amp; Originals</span>
                            </div>
                        </Link>
                        <p className="footer-brand-bio">
                            Play genuine casino games in Indian Rupees (₹). Instant UPI deposits, 24/7 direct bank withdrawals, and certified 99% Return to Player (RTP) across all Provably Fair originals.
                        </p>
                    </div>

                    <div className="footer-payment-badges">
                        <span className="pay-badge upi">UPI</span>
                        <span className="pay-badge gpay">GPay</span>
                        <span className="pay-badge phonepe">PhonePe</span>
                        <span className="pay-badge paytm">Paytm</span>
                        <span className="pay-badge imps">IMPS</span>
                        <span className="pay-badge btc">BTC</span>
                        <span className="pay-badge usdt">USDT</span>
                    </div>
                </div>
            </div>

            {/* Main Links Grid */}
            <div className="footer-links-grid-wrap">
                <div className="footer-container footer-links-grid">
                    {/* Column 1: Casino Originals */}
                    <div className="footer-col">
                        <h4 className="footer-col-title">Original Games</h4>
                        <ul className="footer-links-list">
                            <li><Link to="/crash">Rocket Crash (JetX)</Link></li>
                            <li><Link to="/plinko">Plinko Peg Drop</Link></li>
                            <li><Link to="/mines">Mines &amp; Diamonds</Link></li>
                            <li><Link to="/limbo">Limbo Multiplier</Link></li>
                            <li><Link to="/dragon-tiger">Dragon Tiger Live</Link></li>
                            <li><Link to="/color-match">Color Match 30s</Link></li>
                            <li><Link to="/coin-toss">3D Coin Toss</Link></li>
                        </ul>
                    </div>

                    {/* Column 2: Platform Features */}
                    <div className="footer-col">
                        <h4 className="footer-col-title">Platform Features</h4>
                        <ul className="footer-links-list">
                            <li><Link to="/favourites">Pinned Favourites</Link></li>
                            <li><Link to="/recent">Recent Games</Link></li>
                            <li><Link to="/challenges">Challenges &amp; Quests</Link></li>
                            <li><Link to="/my-bets">Live Bet History</Link></li>
                            <li>
                                <button
                                    type="button"
                                    className="footer-action-link"
                                    onClick={() => onOpenRace?.()}
                                >
                                    Daily Wager Race (₹50k)
                                </button>
                            </li>
                            <li>
                                <button
                                    type="button"
                                    className="footer-action-link"
                                    onClick={() => onOpenVerifier?.()}
                                >
                                    Provably Fair Verifier
                                </button>
                            </li>
                        </ul>
                    </div>

                    {/* Column 3: Guides & Cashier */}
                    <div className="footer-col">
                        <h4 className="footer-col-title">Guides &amp; VIP</h4>
                        <ul className="footer-links-list">
                            <li><Link to="/guides/crash-strategy">Crash Multiplier Strategy</Link></li>
                            <li><Link to="/guides/plinko-odds">Plinko Odds &amp; Physics</Link></li>
                            <li><Link to="/payments/instant-upi-withdrawals">Instant UPI Cashier</Link></li>
                            <li><Link to="/vip-rewards">VIP Rakeback &amp; Club</Link></li>
                        </ul>
                    </div>

                    {/* Column 4: Transparency & Trust (E-E-A-T) */}
                    <div className="footer-col">
                        <h4 className="footer-col-title">Trust &amp; Legal</h4>
                        <ul className="footer-links-list">
                            <li><Link to="/provably-fair">Provably Fair System</Link></li>
                            <li><Link to="/responsible-gambling">Responsible Gaming (18+)</Link></li>
                            <li><Link to="/terms">Terms of Service</Link></li>
                            <li><Link to="/privacy">Privacy Policy</Link></li>
                            <li><a href="mailto:support@amratgames.com">24/7 Email Support</a></li>
                        </ul>
                    </div>

                    {/* Column 5: Guarantees */}
                    <div className="footer-col">
                        <h4 className="footer-col-title">Security &amp; Guarantees</h4>
                        <div className="footer-guarantees">
                            <div className="guarantee-item">
                                <span className="guarantee-icon">🛡️</span>
                                <div>
                                    <strong>HMAC-SHA256 Certified</strong>
                                    <p>Seed commitment on every round</p>
                                </div>
                            </div>
                            <div className="guarantee-item">
                                <span className="guarantee-icon">⚡</span>
                                <div>
                                    <strong>Instant UPI Settlements</strong>
                                    <p>Withdrawals in under 5 minutes</p>
                                </div>
                            </div>
                            <div className="guarantee-item">
                                <span className="guarantee-icon">👑</span>
                                <div>
                                    <strong>99% Return to Player</strong>
                                    <p>Lowest 1% house edge in India</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Badges Bar */}
            <div className="footer-badges-bar">
                <div className="footer-container footer-badges-inner">
                    <span className="badge-pill age">🔞 18+ Only</span>
                    <span className="badge-pill">🇮🇳 Indian Rupees (₹)</span>
                    <span className="badge-pill">⚡ Direct UPI</span>
                    <span className="badge-pill">🛡️ Provably Fair</span>
                    <span className="badge-pill">📊 99% RTP</span>
                    <span className="badge-pill">🔒 TLS 1.3 Encryption</span>
                </div>
            </div>

            {/* Bottom Copyright & Disclaimer Bar */}
            <div className="footer-bottom-bar">
                <div className="footer-container footer-bottom-inner">
                    <p className="footer-disclaimer">
                        AmratGames.com is dedicated to safe, transparent, and responsible entertainment. Real-money gaming carries financial risk and may be addictive. Please play responsibly and within your limits. All Amrat Originals run with certified 99% theoretical Return to Player (RTP).
                    </p>
                    <div className="footer-copyright-row">
                        <span>&copy; {currentYear} AmratGames Ltd. All Rights Reserved.</span>
                        <span>Contact: <a href="mailto:support@amratgames.com">support@amratgames.com</a></span>
                    </div>
                </div>
            </div>
        </footer>
    )
}
