import { Link } from 'react-router-dom'
import '../styles/legalPages.css'

export default function ResponsibleGamblingPage() {
    return (
        <div className="legal-page-container">
            <div className="legal-page-content">
                {/* Header */}
                <div className="legal-header">
                    <div className="legal-header-left">
                        <div className="legal-header-icon" aria-hidden="true">🎯</div>
                        <div className="legal-title-wrap">
                            <h1>
                                Responsible Gaming Policy
                                <span className="legal-badge">18+ ONLY</span>
                            </h1>
                            <p>Our commitment to player well-being, self-protection, and safe entertainment</p>
                            <div className="legal-last-updated">Last Updated: October 2026 · Player Protection Guidelines</div>
                        </div>
                    </div>
                </div>

                {/* Quick Navigation */}
                <nav className="legal-nav-bar" aria-label="Responsible Gaming Sections">
                    <a href="#core-principles" className="legal-nav-pill">1. Core Principles</a>
                    <a href="#age-verification" className="legal-nav-pill">2. 18+ Age Restriction</a>
                    <a href="#demo-credits" className="legal-nav-pill">3. Virtual Demo Credits</a>
                    <a href="#self-exclusion" className="legal-nav-pill">4. Self-Exclusion &amp; Cool-Off</a>
                    <a href="#support-resources" className="legal-nav-pill">5. Help &amp; Support</a>
                </nav>

                {/* Section 1 */}
                <section id="core-principles" className="legal-card">
                    <h2>
                        <span>🎲</span>
                        <span>1. Entertainment, Never an Income Source</span>
                    </h2>
                    <p>
                        At <strong>AmratGames.com</strong>, we believe real-money casino gaming should strictly be enjoyed as a form of digital entertainment—never as a primary income stream, financial investment, or way to resolve debts.
                    </p>
                    <p>
                        We encourage all players to keep these golden rules in mind whenever playing:
                    </p>
                    <ul>
                        <li><strong>Set a clear budget:</strong> Only play with discretionary funds you can comfortably afford to lose.</li>
                        <li><strong>Never chase losses:</strong> Attempting to recover previous losses by increasing bet sizes is the primary cause of distress.</li>
                        <li><strong>Take regular breaks:</strong> Set session time limits and step away from the screen frequently.</li>
                        <li><strong>Do not play under emotional distress:</strong> Avoid gaming when feeling anxious, stressed, or under the influence of substances.</li>
                    </ul>

                    <div className="legal-callout gold">
                        <span className="callout-icon">💡</span>
                        <div className="callout-text">
                            <h4>Remember the Golden Rule</h4>
                            <p>Casino games are games of probability. No strategy or automated script can alter mathematical odds in the long run.</p>
                        </div>
                    </div>
                </section>

                {/* Section 2 */}
                <section id="age-verification" className="legal-card">
                    <h2>
                        <span>🔞</span>
                        <span>2. Strict 18+ Age Verification</span>
                    </h2>
                    <p>
                        AmratGames strictly prohibits anyone under the age of <strong>18</strong> (or the legal age of majority in your jurisdiction) from creating an account or placing real-money wagers on our platform.
                    </p>
                    <p>
                        We enforce strict KYC and identity checks on withdrawal requests. Any account discovered to belong to a minor will have all wagers voided, access immediately terminated, and balances handled in accordance with regulatory laws.
                    </p>
                </section>

                {/* Section 3 */}
                <section id="demo-credits" className="legal-card">
                    <h2>
                        <span>🪙</span>
                        <span>3. Free Virtual Practice Credits</span>
                    </h2>
                    <p>
                        To ensure that players can explore our games without spending real rupees, every player account has access to <strong>₹10,000 in free virtual practice credits</strong>.
                    </p>
                    <p>
                        You can reset your practice balance at any time from the wallet dropdown. This allows you to test Crash multipliers, Plinko rows, and Mines strategies risk-free.
                    </p>
                </section>

                {/* Section 4 */}
                <section id="self-exclusion" className="legal-card">
                    <h2>
                        <span>🛑</span>
                        <span>4. Self-Exclusion &amp; Account Cool-Off</span>
                    </h2>
                    <p>
                        If you ever feel that your gaming habits are becoming unhealthy, AmratGames offers comprehensive self-exclusion tools:
                    </p>
                    <ul>
                        <li><strong>24-Hour Cool-Off:</strong> Temporarily freeze your account access for 24 hours to clear your mind.</li>
                        <li><strong>Extended Timeout:</strong> Lock your account for 7 days, 30 days, or 90 days.</li>
                        <li><strong>Permanent Self-Exclusion:</strong> Permanently close your account with all promotional communication ceased immediately.</li>
                    </ul>
                    <p>
                        To request self-exclusion or deposit limits, simply email our dedicated support team at <a href="mailto:support@amratgames.com" style={{ color: '#fbbf24', textDecoration: 'underline' }}>support@amratgames.com</a> with the subject <em>"Self-Exclusion Request"</em>. Requests are processed within 2 hours.
                    </p>
                </section>

                {/* Section 5 */}
                <section id="support-resources" className="legal-card">
                    <h2>
                        <span>🤝</span>
                        <span>5. External Help &amp; Support Resources</span>
                    </h2>
                    <p>If you or someone you know is struggling with problem gaming, free and confidential support is available:</p>
                    <ul>
                        <li><strong>Gamblers Anonymous:</strong> International mutual-aid fellowship offering confidential support groups: <a href="https://www.gamblersanonymous.org" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>gamblersanonymous.org</a></li>
                        <li><strong>GamCare:</strong> Free information, advice, and support for anyone affected by gambling harms: <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>gamcare.org.uk</a></li>
                        <li><strong>National Helpline:</strong> Check your local regional counseling directory for immediate counseling.</li>
                    </ul>
                </section>

                {/* Footer CTA */}
                <div className="legal-contact-card">
                    <h3>Need Assistance with Account Limits?</h3>
                    <p>Our player support team is on standby 24/7 to assist with deposit caps, session reminders, or self-exclusion requests.</p>
                    <a href="mailto:support@amratgames.com?subject=Responsible%20Gaming%20Support" className="legal-contact-btn">
                        <span>✉️</span>
                        <span>Contact Responsible Gaming Team</span>
                    </a>
                </div>
            </div>
        </div>
    )
}
