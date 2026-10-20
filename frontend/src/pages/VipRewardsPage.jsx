import { Link } from 'react-router-dom'
import '../styles/legalPages.css'

export default function VipRewardsPage() {
    return (
        <div className="legal-page-container">
            <div className="legal-page-content">
                {/* Header */}
                <div className="legal-header">
                    <div className="legal-header-left">
                        <div className="legal-header-icon" aria-hidden="true">👑</div>
                        <div className="legal-title-wrap">
                            <h1>
                                VIP Loyalty Club, Rakeback &amp; Daily Race
                                <span className="legal-badge">INSTANT CASHBACK</span>
                            </h1>
                            <p>Earn up to 25% instant house edge rakeback, ₹50,000 daily wager race prizes, and multi-tier affiliate earnings</p>
                            <div className="legal-last-updated">Updated: October 2026 · VIP Rewards &amp; Affiliate Commission Schedule</div>
                        </div>
                    </div>
                </div>

                {/* Quick Navigation */}
                <nav className="legal-nav-bar" aria-label="VIP Rewards Sections">
                    <a href="#how-rakeback-works" className="legal-nav-pill">1. Rakeback Formula</a>
                    <a href="#vip-tiers" className="legal-nav-pill">2. VIP Tier Brackets</a>
                    <a href="#daily-race" className="legal-nav-pill">3. Daily ₹50,000 Race</a>
                    <a href="#affiliate-program" className="legal-nav-pill">4. 3-Tier Affiliate Commission</a>
                </nav>

                {/* Section 1 */}
                <section id="how-rakeback-works" className="legal-card">
                    <h2>
                        <span>💰</span>
                        <span>1. What is Instant Casino Rakeback?</span>
                    </h2>
                    <p>
                        Every time you place a wager on AmratGames—win or lose—a percentage of the theoretical house edge is calculated and credited directly back to your <strong>VIP Rakeback vault</strong>.
                    </p>
                    <div className="legal-code-block">
                        <code>Rakeback Earned = Real INR Wager × 1.00% House Edge × Tier Rakeback %</code>
                    </div>
                    <p>
                        Unlike other casinos that impose 30x wagering requirements on cash bonuses, <strong>Amrat Rakeback is 100% wager-free cash</strong> that can be withdrawn directly to your bank account or used to place new bets anytime.
                    </p>
                </section>

                {/* Section 2 */}
                <section id="vip-tiers" className="legal-card">
                    <h2>
                        <span>🏆</span>
                        <span>2. VIP Tier Brackets &amp; Perks</span>
                    </h2>
                    <p>Your VIP progress is cumulative and never expires. As your lifetime wager turnover grows, you automatically advance through six prestige tiers:</p>

                    <div style={{ overflowX: 'auto', margin: '14px 0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#fbbf24' }}>
                                    <th style={{ padding: '10px' }}>VIP Tier</th>
                                    <th style={{ padding: '10px' }}>Turnover Required</th>
                                    <th style={{ padding: '10px' }}>Instant Rakeback</th>
                                    <th style={{ padding: '10px' }}>Exclusive Privileges</th>
                                </tr>
                            </thead>
                            <tbody style={{ color: '#cbd5e1' }}>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '10px', fontWeight: '700', color: '#94a3b8' }}>Bronze</td>
                                    <td style={{ padding: '10px' }}>₹0</td>
                                    <td style={{ padding: '10px', color: '#34d399' }}>5.0%</td>
                                    <td style={{ padding: '10px' }}>Standard 24/7 UPI settlements</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '10px', fontWeight: '700', color: '#e2e8f0' }}>Silver</td>
                                    <td style={{ padding: '10px' }}>₹1,00,000</td>
                                    <td style={{ padding: '10px', color: '#34d399' }}>8.0%</td>
                                    <td style={{ padding: '10px' }}>Level-up cash bonus + Daily Race priority</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '10px', fontWeight: '700', color: '#fbbf24' }}>Gold</td>
                                    <td style={{ padding: '10px' }}>₹5,00,000</td>
                                    <td style={{ padding: '10px', color: '#34d399' }}>12.0%</td>
                                    <td style={{ padding: '10px' }}>Higher withdrawal limits + Weekly boost</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '10px', fontWeight: '700', color: '#38bdf8' }}>Platinum</td>
                                    <td style={{ padding: '10px' }}>₹25,00,000</td>
                                    <td style={{ padding: '10px', color: '#34d399' }}>16.0%</td>
                                    <td style={{ padding: '10px' }}>Dedicated VIP host on WhatsApp</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '10px', fontWeight: '700', color: '#c084fc' }}>Diamond</td>
                                    <td style={{ padding: '10px' }}>₹1,00,00,000</td>
                                    <td style={{ padding: '10px', color: '#34d399' }}>20.0%</td>
                                    <td style={{ padding: '10px' }}>Zero-fee priority fast-track bank payout</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '10px', fontWeight: '700', color: '#f59e0b', fontSize: '1rem' }}>👑 Royal King</td>
                                    <td style={{ padding: '10px' }}>₹5,00,00,000</td>
                                    <td style={{ padding: '10px', color: '#34d399', fontWeight: '800' }}>25.0%</td>
                                    <td style={{ padding: '10px' }}>Bespoke gifts, luxury tournament entries</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Section 3 */}
                <section id="daily-race" className="legal-card">
                    <h2>
                        <span>🏎️</span>
                        <span>3. Daily ₹50,000 Wager Race Tournament</span>
                    </h2>
                    <p>
                        Every 24 hours, AmratGames hosts a platform-wide <strong>₹50,000 Daily Wager Race</strong>. Every ₹1 wagered on any casino original earns you 1 leaderboard point.
                    </p>
                    <ul>
                        <li><strong>Top 10 Players Paid Daily:</strong> 1st place wins ₹20,000 direct cash, 2nd wins ₹10,000, 3rd wins ₹6,000, and top 10 receive automated cash awards.</li>
                        <li><strong>Automated Settlement:</strong> Prizes are credited instantly at 00:00 UTC daily to your wallet with zero wagering rollover.</li>
                    </ul>
                </section>

                {/* Section 4 */}
                <section id="affiliate-program" className="legal-card">
                    <h2>
                        <span>🤝</span>
                        <span>4. 3-Tier Passive Affiliate Turnover Commissions</span>
                    </h2>
                    <p>
                        Share your unique referral link to earn lifetime turnover commissions on every bet your network places, win or lose:
                    </p>
                    <ul>
                        <li><strong>Tier 1 (Direct Referrals):</strong> Earn <strong>0.30%</strong> of every rupee your direct players wager.</li>
                        <li><strong>Tier 2 (Sub-Affiliates):</strong> Earn <strong>0.10%</strong> of wagers placed by your referrals' referrals.</li>
                        <li><strong>Tier 3 (Extended Network):</strong> Earn <strong>0.05%</strong> from the 3rd referral tier.</li>
                    </ul>
                </section>

                {/* CTA Card */}
                <div className="legal-contact-card">
                    <h3>View Your Live VIP Rakeback Vault</h3>
                    <p>Track your real-time turnover and claim your accumulated rakeback directly from your profile.</p>
                    <Link to="/profile" className="legal-contact-btn">
                        <span>👑</span>
                        <span>Open VIP Cashier &amp; Rakeback</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}
