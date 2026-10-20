import { Link } from 'react-router-dom'
import '../styles/legalPages.css'

export default function PlinkoOddsPage() {
    return (
        <div className="legal-page-container">
            <div className="legal-page-content">
                {/* Header */}
                <div className="legal-header">
                    <div className="legal-header-left">
                        <div className="legal-header-icon" aria-hidden="true">🎯</div>
                        <div className="legal-title-wrap">
                            <h1>
                                Plinko Odds, Rows &amp; Multiplier Calculator Guide
                                <span className="legal-badge">BINOMIAL PHYSICS</span>
                            </h1>
                            <p>Complete statistical breakdown of 8–16 rows, Low vs High risk, and 1,000x multiplier probability</p>
                            <div className="legal-last-updated">Updated: October 2026 · Matter.js Physics &amp; Statistical Modeling</div>
                        </div>
                    </div>
                </div>

                {/* Quick Navigation */}
                <nav className="legal-nav-bar" aria-label="Plinko Sections">
                    <a href="#how-physics-work" className="legal-nav-pill">1. Binomial Distribution</a>
                    <a href="#risk-levels" className="legal-nav-pill">2. 3 Risk Levels Explained</a>
                    <a href="#rows-comparison" className="legal-nav-pill">3. 8 vs 16 Rows</a>
                    <a href="#odds-table" className="legal-nav-pill">4. Multiplier Odds Table</a>
                    <a href="#best-strategy" className="legal-nav-pill">5. Recommended Playstyles</a>
                </nav>

                {/* Section 1 */}
                <section id="how-physics-work" className="legal-card">
                    <h2>
                        <span>⚽</span>
                        <span>1. How Plinko Physics &amp; Binomial Math Work</span>
                    </h2>
                    <p>
                        Plinko is based on the famous 19th-century <strong>Quincunx / Galton Board</strong> invented by Sir Francis Galton.
                        When a ball drops and strikes a peg, it has exactly a <strong>50% probability of deflecting left</strong> and a <strong>50% probability of deflecting right</strong>.
                    </p>
                    <p>
                        Across multiple rows of pegs, the paths combine to create a classic <strong>Bell Curve (Normal Distribution)</strong>:
                    </p>
                    <ul>
                        <li><strong>Center Buckets:</strong> The vast majority of balls fall into the center slots because there are hundreds of paths leading to the middle.</li>
                        <li><strong>Edge Buckets:</strong> To reach the extreme edges, a ball must bounce left on <em>every single peg</em> or right on <em>every single peg</em>. This is rare, which is why outer buckets pay up to <strong>1,000x</strong>!</li>
                    </ul>

                    <div className="legal-callout green">
                        <span className="callout-icon">📊</span>
                        <div className="callout-text">
                            <h4>Certified 99% Return to Player</h4>
                            <p>Amrat Plinko maintains an exact 99.00% theoretical return across all risk configurations. Every peg deflection is cryptographically seeded via HMAC-SHA256.</p>
                        </div>
                    </div>
                </section>

                {/* Section 2 */}
                <section id="risk-levels" className="legal-card">
                    <h2>
                        <span>🎚️</span>
                        <span>2. Choosing Your Risk Profile</span>
                    </h2>
                    <p>Amrat Plinko lets you toggle between three distinct risk engines:</p>
                    <ul>
                        <li>
                            <strong>Low Risk:</strong> Built for bankroll preservation and steady compounding. Center slots return 0.7x to 0.9x, meaning you rarely lose more than 20% of a ball, with outer edges paying up to 16x–29x.
                        </li>
                        <li>
                            <strong>Medium Risk:</strong> The balanced sweet spot. Center slots pay 0.4x to 0.7x, while outer slots pay between 18x and 110x.
                        </li>
                        <li>
                            <strong>High Risk:</strong> The jackpot hunter's configuration. Center slots return a modest 0.2x, but the outer wings unleash massive multipliers of <strong>170x, 420x, and 1,000x</strong>!
                        </li>
                    </ul>
                </section>

                {/* Section 3 */}
                <section id="rows-comparison" className="legal-card">
                    <h2>
                        <span>📐</span>
                        <span>3. Choosing the Number of Rows (8 to 16)</span>
                    </h2>
                    <p>
                        The number of rows determines the total number of landing buckets at the base:
                    </p>
                    <div style={{ overflowX: 'auto', margin: '14px 0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#fbbf24' }}>
                                    <th style={{ padding: '10px' }}>Row Count</th>
                                    <th style={{ padding: '10px' }}>Landing Buckets</th>
                                    <th style={{ padding: '10px' }}>Max Multiplier (High)</th>
                                    <th style={{ padding: '10px' }}>Ideal Strategy</th>
                                </tr>
                            </thead>
                            <tbody style={{ color: '#cbd5e1' }}>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '10px', fontWeight: '700' }}>8 Rows</td>
                                    <td style={{ padding: '10px' }}>9 Buckets</td>
                                    <td style={{ padding: '10px', color: '#34d399' }}>29x</td>
                                    <td style={{ padding: '10px' }}>Fast rounds, quick turnover wagering</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '10px', fontWeight: '700' }}>12 Rows</td>
                                    <td style={{ padding: '10px' }}>13 Buckets</td>
                                    <td style={{ padding: '10px', color: '#fbbf24' }}>170x</td>
                                    <td style={{ padding: '10px' }}>Medium risk compounding</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '10px', fontWeight: '700' }}>16 Rows</td>
                                    <td style={{ padding: '10px' }}>17 Buckets</td>
                                    <td style={{ padding: '10px', color: '#f87171', fontWeight: '800' }}>1,000x</td>
                                    <td style={{ padding: '10px' }}>Maximum jackpot potential</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Section 4 */}
                <section id="best-strategy" className="legal-card">
                    <h2>
                        <span>🏆</span>
                        <span>4. The "Continuous Multi-Drop" Tactic</span>
                    </h2>
                    <p>
                        Unlike games where you wait between rounds, Plinko allows continuous dropping. Many successful players use the <strong>100-Ball Batch Method</strong>:
                    </p>
                    <ol>
                        <li>Select <strong>16 Rows + High Risk</strong>.</li>
                        <li>Set a small wager representing 0.5% of your bankroll (e.g. ₹20 on a ₹4,000 wallet).</li>
                        <li>Release 50 to 100 balls in continuous succession.</li>
                        <li>The statistical variance ensures that center hits sustain your bankroll while giving you multiple shots at hitting the 130x, 420x, or 1,000x edge slots.</li>
                    </ol>
                </section>

                {/* CTA Card */}
                <div className="legal-contact-card">
                    <h3>Try Custom Physics Plinko Now</h3>
                    <p>Test 8 to 16 rows and feel the real-time canvas bounce with ₹10,000 in free demo credits.</p>
                    <Link to="/plinko" className="legal-contact-btn">
                        <span>🎯</span>
                        <span>Play Plinko with 99% RTP</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}
