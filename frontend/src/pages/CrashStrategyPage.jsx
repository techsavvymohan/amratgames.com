import { Link } from 'react-router-dom'
import '../styles/legalPages.css'

export default function CrashStrategyPage() {
    return (
        <div className="legal-page-container">
            <div className="legal-page-content">
                {/* Header */}
                <div className="legal-header">
                    <div className="legal-header-left">
                        <div className="legal-header-icon" aria-hidden="true">🚀</div>
                        <div className="legal-title-wrap">
                            <h1>
                                Aviator &amp; Crash Game Strategy Guide
                                <span className="legal-badge">99% RTP MATHEMATICS</span>
                            </h1>
                            <p>Proven bankroll tactics, multiplier probability curves, and auto-cashout setups for Indian players</p>
                            <div className="legal-last-updated">Updated: October 2026 · Mathematical Analysis &amp; Betting Systems</div>
                        </div>
                    </div>
                </div>

                {/* Quick Navigation */}
                <nav className="legal-nav-bar" aria-label="Crash Strategy Sections">
                    <a href="#how-curve-works" className="legal-nav-pill">1. The Multiplier Curve Math</a>
                    <a href="#popular-strategies" className="legal-nav-pill">2. 3 Core Strategies</a>
                    <a href="#bankroll-rules" className="legal-nav-pill">3. Bankroll Rules</a>
                    <a href="#auto-cashout-guide" className="legal-nav-pill">4. Auto-Cashout Setup</a>
                    <a href="#common-mistakes" className="legal-nav-pill">5. Mistakes to Avoid</a>
                </nav>

                {/* Section 1 */}
                <section id="how-curve-works" className="legal-card">
                    <h2>
                        <span>📈</span>
                        <span>1. Understanding the Crash Multiplier Math</span>
                    </h2>
                    <p>
                        Unlike traditional slot games, the multiplier in <strong>Amrat Crash</strong> grows exponentially according to continuous mathematical curves.
                        The platform operates with a certified <strong>99.00% Return to Player (RTP)</strong> and an industry-low <strong>1.00% house edge</strong>.
                    </p>
                    <p>
                        Every round outcome is pre-committed before your wager using <strong>HMAC-SHA256</strong> hashing. Here is the statistical reality of multiplier probabilities:
                    </p>

                    <div style={{ overflowX: 'auto', margin: '16px 0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#fbbf24' }}>
                                    <th style={{ padding: '10px' }}>Target Multiplier</th>
                                    <th style={{ padding: '10px' }}>Statistical Win Probability</th>
                                    <th style={{ padding: '10px' }}>House Edge</th>
                                    <th style={{ padding: '10px' }}>Recommended Player Style</th>
                                </tr>
                            </thead>
                            <tbody style={{ color: '#cbd5e1' }}>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '10px', fontWeight: '700', color: '#34d399' }}>1.20x</td>
                                    <td style={{ padding: '10px' }}>82.5%</td>
                                    <td style={{ padding: '10px' }}>1.0%</td>
                                    <td style={{ padding: '10px' }}>Steady conservative compounding</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '10px', fontWeight: '700', color: '#60a5fa' }}>1.50x</td>
                                    <td style={{ padding: '10px' }}>66.0%</td>
                                    <td style={{ padding: '10px' }}>1.0%</td>
                                    <td style={{ padding: '10px' }}>Balanced growth</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '10px', fontWeight: '700', color: '#fbbf24' }}>2.00x</td>
                                    <td style={{ padding: '10px' }}>49.5%</td>
                                    <td style={{ padding: '10px' }}>1.0%</td>
                                    <td style={{ padding: '10px' }}>Classic coin-flip doubling</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '10px', fontWeight: '700', color: '#f87171' }}>5.00x</td>
                                    <td style={{ padding: '10px' }}>19.8%</td>
                                    <td style={{ padding: '10px' }}>1.0%</td>
                                    <td style={{ padding: '10px' }}>High roller aggression</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '10px', fontWeight: '700', color: '#c084fc' }}>10.00x+</td>
                                    <td style={{ padding: '10px' }}>9.9% or lower</td>
                                    <td style={{ padding: '10px' }}>1.0%</td>
                                    <td style={{ padding: '10px' }}>Jackpot hunters (micro-wagers)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Section 2 */}
                <section id="popular-strategies" className="legal-card">
                    <h2>
                        <span>🎯</span>
                        <span>2. Top 3 Tested Crash Strategies</span>
                    </h2>

                    <h3>Strategy A: The Conservative Low-Multiplier Compounding (1.20x – 1.35x)</h3>
                    <p>
                        The most sustainable strategy among experienced players. Instead of waiting for 10x rockets, you set an <strong>Auto-Cashout at 1.25x</strong>.
                    </p>
                    <ul>
                        <li><strong>Win Rate:</strong> ~79% of rounds succeed.</li>
                        <li><strong>Execution:</strong> Bet 2% of your bankroll (e.g. ₹100 on a ₹5,000 balance). Collect ₹25 profit repeatedly.</li>
                        <li><strong>Strength:</strong> Protects your principal from long losing streaks.</li>
                    </ul>

                    <h3>Strategy B: The 2.00x Flat-Wager Discipline</h3>
                    <p>
                        The mathematical benchmark strategy. Set Auto-Cashout to <strong>2.00x</strong> and keep your bet size constant throughout the session.
                    </p>
                    <ul>
                        <li><strong>Win Rate:</strong> 49.50% probability with 99% RTP.</li>
                        <li><strong>Advantage:</strong> Eliminates human hesitation. You never miss a cashout by a fraction of a second.</li>
                    </ul>

                    <h3>Strategy C: Dual-Bet Hedging System</h3>
                    <p>
                        Place two concurrent bets in the same round:
                    </p>
                    <ol>
                        <li><strong>Bet 1 (Cover Wager):</strong> Larger bet with Auto-Cashout at <strong>1.50x</strong>. The profit covers both stakes.</li>
                        <li><strong>Bet 2 (Moonshot Wager):</strong> Micro-stake (e.g., ₹20) targeting <strong>10.00x or 50.00x</strong> for pure upside.</li>
                    </ol>

                    <div className="legal-callout gold">
                        <span className="callout-icon">💡</span>
                        <div className="callout-text">
                            <h4>Why Auto-Cashout is Essential</h4>
                            <p>Network latency or touch delays on mobile can cost you milliseconds. Auto-cashout executes server-side, guaranteeing you exit at your exact desired target.</p>
                        </div>
                    </div>
                </section>

                {/* Section 3 */}
                <section id="bankroll-rules" className="legal-card">
                    <h2>
                        <span>🛡️</span>
                        <span>3. Golden Rules of Bankroll Management</span>
                    </h2>
                    <p>
                        Professional players never risk more than <strong>1% to 3%</strong> of their total wallet on any single round:
                    </p>
                    <ul>
                        <li><strong>The 1% Rule:</strong> If your wallet balance is ₹5,000, your standard bet should be ₹50 (1%).</li>
                        <li><strong>Stop-Loss Limit:</strong> Stop immediately if your session balance drops by 20%. Step away for the day.</li>
                        <li><strong>Take-Profit Target:</strong> Lock in gains when you achieve a 30% to 50% profit increase. Withdraw your initial deposit via UPI.</li>
                    </ul>
                </section>

                {/* Section 4 */}
                <section id="common-mistakes" className="legal-card">
                    <h2>
                        <span>⚠️</span>
                        <span>4. The "Crash Predictor" Myth: Avoid Scams</span>
                    </h2>
                    <p>
                        You will see many Telegram channels and YouTube videos claiming to sell "Crash Predictor APKs" or "AI signals."
                        <strong>These are 100% fraudulent scams.</strong>
                    </p>
                    <p>
                        Because Amrat Crash uses <strong>HMAC-SHA256</strong> cryptographic hashing, the outcome is mathematically unpredictable until the server seed and player client seed are combined in real time. No software or signal group can predict or manipulate future round hashes.
                    </p>
                </section>

                {/* CTA Card */}
                <div className="legal-contact-card">
                    <h3>Ready to Test These Strategies Free?</h3>
                    <p>Every account receives ₹10,000 in free virtual demo balance. Test low-multiplier compounding and dual-bet hedging risk-free.</p>
                    <Link to="/crash" className="legal-contact-btn">
                        <span>🚀</span>
                        <span>Launch Crash Game Now</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}
