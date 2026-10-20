import { Link } from 'react-router-dom'
import '../styles/legalPages.css'

export default function UpiWithdrawalsGuidePage() {
    return (
        <div className="legal-page-container">
            <div className="legal-page-content">
                {/* Header */}
                <div className="legal-header">
                    <div className="legal-header-left">
                        <div className="legal-header-icon" aria-hidden="true">⚡</div>
                        <div className="legal-title-wrap">
                            <h1>
                                Instant UPI &amp; Bank Withdrawal Guide
                                <span className="legal-badge">24/7 AUTOMATED PAYOUTS</span>
                            </h1>
                            <p>Fast deposits and withdrawals with Google Pay, PhonePe, Paytm, and IMPS in Indian Rupees (₹)</p>
                            <div className="legal-last-updated">Updated: October 2026 · Sovereign Banking &amp; Automated Cashier</div>
                        </div>
                    </div>
                </div>

                {/* Quick Navigation */}
                <nav className="legal-nav-bar" aria-label="UPI Payment Sections">
                    <a href="#supported-apps" className="legal-nav-pill">1. Supported Apps</a>
                    <a href="#how-to-deposit" className="legal-nav-pill">2. How to Deposit</a>
                    <a href="#how-to-withdraw" className="legal-nav-pill">3. How to Withdraw</a>
                    <a href="#zero-fees" className="legal-nav-pill">4. Zero Forex Fees</a>
                    <a href="#security-rules" className="legal-nav-pill">5. Safety &amp; UTR Security</a>
                </nav>

                {/* Section 1 */}
                <section id="supported-apps" className="legal-card">
                    <h2>
                        <span>📱</span>
                        <span>1. 100% Native Indian Payment Gateways</span>
                    </h2>
                    <p>
                        At <strong>AmratGames.com</strong>, we eliminate the complexity of offshore payment processors.
                        You play directly in <strong>Indian Rupees (₹ INR)</strong> using your favorite everyday banking apps:
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', margin: '16px 0' }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <strong style={{ color: '#60a5fa', display: 'block', marginBottom: '4px' }}>Google Pay (GPay)</strong>
                            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>1-tap UPI app intent and dynamic QR codes</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <strong style={{ color: '#a78bfa', display: 'block', marginBottom: '4px' }}>PhonePe</strong>
                            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Instant authorization with direct bank linkage</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <strong style={{ color: '#38bdf8', display: 'block', marginBottom: '4px' }}>Paytm UPI</strong>
                            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Fast wallet UPI and NetBanking IMPS</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <strong style={{ color: '#34d399', display: 'block', marginBottom: '4px' }}>IMPS &amp; NetBanking</strong>
                            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Direct bank-to-bank high-roller settlements</span>
                        </div>
                    </div>
                </section>

                {/* Section 2 */}
                <section id="how-to-deposit" className="legal-card">
                    <h2>
                        <span>💳</span>
                        <span>2. How to Deposit via UPI in 3 Easy Steps</span>
                    </h2>
                    <ol>
                        <li>
                            <strong>Open Cashier:</strong> Click the green <strong>Deposit</strong> button in the top navigation bar.
                        </li>
                        <li>
                            <strong>Enter Amount:</strong> Choose an amount (starting from ₹100 up to ₹50,000 per transaction) and click <em>Pay via UPI</em>.
                        </li>
                        <li>
                            <strong>Complete &amp; Confirm UTR:</strong> Scan the QR code or tap your preferred UPI app. Copy the <strong>12-digit UTR reference number</strong> from your bank SMS/app receipt and submit it. Your balance credits automatically in under 60 seconds.
                        </li>
                    </ol>

                    <div className="legal-callout gold">
                        <span className="callout-icon">⚡</span>
                        <div className="callout-text">
                            <h4>Automatic UTR Matching</h4>
                            <p>Our banking gateway reconciles bank webhooks 24/7. Once your bank approves the transfer, your casino wallet updates instantaneously.</p>
                        </div>
                    </div>
                </section>

                {/* Section 3 */}
                <section id="how-to-withdraw" className="legal-card">
                    <h2>
                        <span>💸</span>
                        <span>3. How to Withdraw to Your Bank Account</span>
                    </h2>
                    <p>Withdrawals are settled 24/7 directly to your bank account or UPI VPA address:</p>
                    <ol>
                        <li>Click <strong>Wallet</strong> ➔ Select the <strong>Withdraw</strong> tab.</li>
                        <li>Enter your target withdrawal amount (minimum ₹500).</li>
                        <li>Provide your <strong>UPI ID</strong> (e.g. <code>yourname@okhdfcbank</code>) or <strong>Bank Account Number &amp; IFSC</strong>.</li>
                        <li>Confirm the request. Funds are dispatched via automated IMPS gateway directly to your account.</li>
                    </ol>
                </section>

                {/* Section 4 */}
                <section id="zero-fees" className="legal-card">
                    <h2>
                        <span>🛡️</span>
                        <span>4. Zero Conversion Fees (Save 3.5% Forex)</span>
                    </h2>
                    <p>
                        Most international casinos convert your Indian Rupees into US Dollars (USD) or Euros (EUR), charging 3.5% to 5.0% foreign exchange fees on both deposit and withdrawal.
                    </p>
                    <p>
                        <strong>AmratGames operates 100% in INR:</strong> ₹1,000 deposited is exactly ₹1,000 in your player wallet. When you win ₹5,000, you withdraw exactly ₹5,000 to your bank account with zero hidden deductions.
                    </p>
                </section>

                {/* CTA Card */}
                <div className="legal-contact-card">
                    <h3>Deposit in 5 Seconds &amp; Start Playing</h3>
                    <p>Instant UPI credit via Google Pay, PhonePe, or Paytm with zero fees.</p>
                    <Link to="/" className="legal-contact-btn">
                        <span>⚡</span>
                        <span>Go to Deposit Cashier</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}
