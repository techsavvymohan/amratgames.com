import { Link } from 'react-router-dom'
import '../styles/legalPages.css'

export default function PrivacyPage() {
    return (
        <div className="legal-page-container">
            <div className="legal-page-content">
                {/* Header */}
                <div className="legal-header">
                    <div className="legal-header-left">
                        <div className="legal-header-icon" aria-hidden="true">🔒</div>
                        <div className="legal-title-wrap">
                            <h1>
                                Privacy Policy
                                <span className="legal-badge">DATA PROTECTION</span>
                            </h1>
                            <p>How AmratGames collects, safeguards, and respects your personal and payment data</p>
                            <div className="legal-last-updated">Last Updated: October 2026 · GDPR &amp; DPDP Compliant</div>
                        </div>
                    </div>
                </div>

                {/* Quick Navigation */}
                <nav className="legal-nav-bar" aria-label="Privacy Policy Sections">
                    <a href="#information-we-collect" className="legal-nav-pill">1. Information We Collect</a>
                    <a href="#how-we-use-data" className="legal-nav-pill">2. How We Use Data</a>
                    <a href="#data-security" className="legal-nav-pill">3. Encryption &amp; Security</a>
                    <a href="#cookies" className="legal-nav-pill">4. Cookies &amp; Storage</a>
                    <a href="#your-rights" className="legal-nav-pill">5. Your Privacy Rights</a>
                </nav>

                {/* Section 1 */}
                <section id="information-we-collect" className="legal-card">
                    <h2>
                        <span>📂</span>
                        <span>1. Information We Collect</span>
                    </h2>
                    <p>
                        To provide secure gaming and instantaneous financial settlements on <strong>AmratGames.com</strong>, we collect limited personal information necessary for operations:
                    </p>
                    <ul>
                        <li><strong>Account Details:</strong> Username, email address, password hash (salted bcrypt), and registration timestamp.</li>
                        <li><strong>Financial Records:</strong> Transaction identifiers, UPI reference numbers (UTR), bank account masks, and deposit/withdrawal timestamps. We never store raw banking passwords or UPI PINs.</li>
                        <li><strong>Technical &amp; Log Data:</strong> IP address, device type, browser specifications, and Provably Fair seed commitments.</li>
                    </ul>
                </section>

                {/* Section 2 */}
                <section id="how-we-use-data" className="legal-card">
                    <h2>
                        <span>⚙️</span>
                        <span>2. How We Use Your Data</span>
                    </h2>
                    <p>We use your information strictly for the following purposes:</p>
                    <ul>
                        <li>Facilitating instant deposits and bank withdrawal settlements.</li>
                        <li>Preventing duplicate account exploitation, identity theft, and fraudulent activity.</li>
                        <li>Calculating VIP rakeback, tournament prize pool rankings, and affiliate turnover payouts.</li>
                        <li>Ensuring system uptime, preventing DDoS attacks, and complying with anti-money laundering (AML) standards.</li>
                    </ul>

                    <div className="legal-callout green">
                        <span className="callout-icon">🛡️</span>
                        <div className="callout-text">
                            <h4>Zero Data Selling Commitment</h4>
                            <p>AmratGames does not sell, rent, or trade your personal or financial data to advertising networks or third-party marketing brokers under any circumstances.</p>
                        </div>
                    </div>
                </section>

                {/* Section 3 */}
                <section id="data-security" className="legal-card">
                    <h2>
                        <span>🔐</span>
                        <span>3. Encryption &amp; Data Security</span>
                    </h2>
                    <p>
                        We employ enterprise-grade security protocols across all infrastructure layers:
                    </p>
                    <ul>
                        <li><strong>End-to-End Encryption:</strong> All data transmitted between your browser and our servers is encrypted using modern <strong>TLS 1.3</strong> cryptography with HSTS preloading.</li>
                        <li><strong>Cryptographic Salting:</strong> Passwords and sensitive tokens are encrypted using irreversible salted hashing algorithms.</li>
                        <li><strong>Isolated Payment Gateways:</strong> Banking interactions utilize tokenized payment gateways with zero unmasked credential retention.</li>
                    </ul>
                </section>

                {/* Section 4 */}
                <section id="cookies" className="legal-card">
                    <h2>
                        <span>🍪</span>
                        <span>4. Cookies &amp; Local Storage</span>
                    </h2>
                    <p>
                        We use minimal, essential browser cookies and local storage tokens strictly to maintain your authenticated login session, keep track of your sound preferences, and store your pinned favorite games. We do not use third-party tracking pixels to stalk your browsing habits across external websites.
                    </p>
                </section>

                {/* Section 5 */}
                <section id="your-rights" className="legal-card">
                    <h2>
                        <span>👤</span>
                        <span>5. Your Data Rights</span>
                    </h2>
                    <p>You have full ownership of your digital footprint on AmratGames. You are entitled to:</p>
                    <ul>
                        <li><strong>Request Data Access:</strong> Obtain a complete copy of all personal records and transaction logs stored under your user account.</li>
                        <li><strong>Data Rectification:</strong> Update or correct outdated contact details or payment references.</li>
                        <li><strong>Right to Erasure ("Right to be Forgotten"):</strong> Request complete deletion of your account and personal identifiers, subject to financial audit compliance records.</li>
                    </ul>
                    <p>
                        To exercise any of these rights, email our Data Protection Officer at <a href="mailto:support@amratgames.com" style={{ color: '#fbbf24' }}>support@amratgames.com</a>.
                    </p>
                </section>

                {/* Footer CTA */}
                <div className="legal-contact-card">
                    <h3>Have Concerns Regarding Your Data?</h3>
                    <p>Our Data Protection team is committed to complete transparency. Contact us anytime for immediate assistance.</p>
                    <a href="mailto:support@amratgames.com?subject=Privacy%20Inquiry" className="legal-contact-btn">
                        <span>✉️</span>
                        <span>Contact Data Protection Officer</span>
                    </a>
                </div>
            </div>
        </div>
    )
}
