import { Link } from 'react-router-dom'
import '../styles/legalPages.css'

export default function TermsPage() {
    return (
        <div className="legal-page-container">
            <div className="legal-page-content">
                {/* Header */}
                <div className="legal-header">
                    <div className="legal-header-left">
                        <div className="legal-header-icon" aria-hidden="true">📜</div>
                        <div className="legal-title-wrap">
                            <h1>
                                Terms of Service
                                <span className="legal-badge">USER AGREEMENT</span>
                            </h1>
                            <p>Official rules, payment policies, and platform terms for AmratGames.com</p>
                            <div className="legal-last-updated">Effective Date: October 1, 2026 · Version 3.1</div>
                        </div>
                    </div>
                </div>

                {/* Quick Navigation */}
                <nav className="legal-nav-bar" aria-label="Terms of Service Sections">
                    <a href="#acceptance" className="legal-nav-pill">1. Acceptance &amp; Eligibility</a>
                    <a href="#account-security" className="legal-nav-pill">2. Account Security</a>
                    <a href="#payments" className="legal-nav-pill">3. Deposits &amp; Withdrawals</a>
                    <a href="#fair-play" className="legal-nav-pill">4. Fair Play &amp; Conduct</a>
                    <a href="#disputes" className="legal-nav-pill">5. Dispute Resolution</a>
                </nav>

                {/* Section 1 */}
                <section id="acceptance" className="legal-card">
                    <h2>
                        <span>📋</span>
                        <span>1. Acceptance of Terms &amp; Player Eligibility</span>
                    </h2>
                    <p>
                        By creating an account, depositing funds, or participating in games on <strong>AmratGames.com</strong>, you acknowledge that you have read, understood, and agree to be legally bound by these Terms of Service.
                    </p>
                    <ul>
                        <li>You must be at least <strong>18 years of age</strong> (or the legal age of majority in your jurisdiction).</li>
                        <li>It is your sole responsibility to ensure that online casino gaming is permitted under the local laws of your jurisdiction.</li>
                        <li>You are strictly permitted to register only <strong>one account per person, household, IP address, and payment device</strong>. Creating duplicate accounts to exploit promotions will result in permanent suspension.</li>
                    </ul>
                </section>

                {/* Section 2 */}
                <section id="account-security" className="legal-card">
                    <h2>
                        <span>🔐</span>
                        <span>2. Account Security &amp; Credentials</span>
                    </h2>
                    <p>
                        You are responsible for maintaining the confidentiality of your login credentials (username and password). AmratGames will never ask for your password via email or chat.
                    </p>
                    <p>
                        All activities occurring under your account are your sole responsibility. In the event of suspected unauthorized access, you must notify our support team immediately at <a href="mailto:support@amratgames.com" style={{ color: '#fbbf24' }}>support@amratgames.com</a>.
                    </p>
                </section>

                {/* Section 3 */}
                <section id="payments" className="legal-card">
                    <h2>
                        <span>💳</span>
                        <span>3. Deposits, Withdrawals &amp; Banking</span>
                    </h2>
                    <p>
                        AmratGames supports payments in <strong>Indian Rupees (₹ INR)</strong> via UPI (Google Pay, PhonePe, Paytm, BHIM), IMPS bank transfers, and leading cryptocurrencies (Bitcoin, Tether USDT).
                    </p>
                    <ul>
                        <li><strong>Instant Deposits:</strong> UPI deposits are credited automatically within seconds. Always ensure your payment reference (UTR) is accurately confirmed.</li>
                        <li><strong>Withdrawal Settlements:</strong> Legitimate withdrawal requests are processed 24/7. Standard processing times range from 5 minutes to 2 hours depending on bank server availability.</li>
                        <li><strong>Anti-Money Laundering (AML):</strong> Funds deposited onto the platform must be wagered at least 1x before a withdrawal request can be submitted.</li>
                        <li><strong>Account Matching:</strong> Withdrawals will only be approved to bank accounts and UPI IDs matching the verified name on your player profile. Third-party payouts are prohibited.</li>
                    </ul>
                </section>

                {/* Section 4 */}
                <section id="fair-play" className="legal-card">
                    <h2>
                        <span>⚖️</span>
                        <span>4. Fair Play, Bots &amp; Prohibited Activities</span>
                    </h2>
                    <p>
                        All games on AmratGames operate using <strong>Provably Fair HMAC-SHA256</strong> cryptographic algorithms. Players are strictly forbidden from:
                    </p>
                    <ul>
                        <li>Using automated scraping bots, packet manipulation tools, or exploit software.</li>
                        <li>Colluding with other players in multiplayer titles or tournaments.</li>
                        <li>Exploiting software glitches or latency discrepancies.</li>
                    </ul>
                    <p>
                        Any account found engaging in fraudulent activity will have their balance confiscated and access permanently banned.
                    </p>
                </section>

                {/* Section 5 */}
                <section id="disputes" className="legal-card">
                    <h2>
                        <span>🤝</span>
                        <span>5. Dispute Resolution &amp; Governing Law</span>
                    </h2>
                    <p>
                        In the event of a dispute regarding a bet outcome, the cryptographically logged <strong>Server Seed, Client Seed, and Nonce</strong> in our database shall serve as the final and conclusive arbiter.
                    </p>
                    <p>
                        Our support escalation team handles all dispute claims within 48 business hours. If you wish to lodge a formal review, email <a href="mailto:support@amratgames.com" style={{ color: '#fbbf24' }}>support@amratgames.com</a> with your Bet ID and registered email address.
                    </p>
                </section>

                {/* Footer CTA */}
                <div className="legal-contact-card">
                    <h3>Questions Regarding Our Terms?</h3>
                    <p>Our legal and compliance team is available to assist with any questions regarding platform policies.</p>
                    <a href="mailto:support@amratgames.com?subject=Terms%20Inquiry" className="legal-contact-btn">
                        <span>✉️</span>
                        <span>Contact Compliance Team</span>
                    </a>
                </div>
            </div>
        </div>
    )
}
