import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { GAMES } from '../games'
import { useWallet } from '../context/WalletContext'
import LivePlatformBets from '../components/LivePlatformBets'
import '../styles/home.css'

const ALL_GAMES = [
    ...GAMES,
    { id: 'dice', name: 'Dice', comingSoon: true, category: 'Originals', badge: 'SOON' },
]

const CATEGORIES = [
    { id: 'all', label: 'All Games', icon: '🎮' },
    { id: 'popular', label: 'Hot & Popular', icon: '🔥' },
    { id: 'fast', label: 'Rocket & Fast', icon: '⚡' },
    { id: 'table', label: 'Cards & Table', icon: '🃏' },
    { id: 'originals', label: 'Simple Games', icon: '👑' },
]

function GameCard({ game }) {
    const cardContent = (
        <>
            <div className="amrat-card-image">
                {game.image ? (
                    <img
                        src={game.image}
                        alt={`${game.name} game banner`}
                        className="game-art-image"
                        loading="lazy"
                    />
                ) : (
                    <div className="game-art-placeholder" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z" />
                        </svg>
                    </div>
                )}

                {/* Visual badges */}
                <div className="card-top-badges">
                    {game.badge && (
                        <span className={`game-badge badge-${game.badge.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
                            {game.badge}
                        </span>
                    )}
                    {game.rtp && !game.comingSoon && (
                        <span className="game-rtp-badge">{game.rtp}</span>
                    )}
                </div>

                {!game.comingSoon && (
                    <div className="card-overlay">
                        <div className="card-play-action">
                            <span className="play-btn" aria-hidden="true">
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="#0b0f19">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            </span>
                            <span className="play-text">PLAY NOW</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="amrat-card-footer">
                <div className="card-info">
                    <span className="game-name">{game.name}</span>
                    <div className="game-meta">
                        {game.maxWin && <span className="meta-maxwin">Max: {game.maxWin}</span>}
                        {game.volatility && <span className="meta-vol">{game.volatility}</span>}
                    </div>
                </div>
                {game.comingSoon ? (
                    <span className="badge-coming-soon">Soon</span>
                ) : (
                    <span className="card-play-arrow" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                        </svg>
                    </span>
                )}
            </div>
        </>
    )

    if (game.comingSoon) return <div className="amrat-card is-coming-soon">{cardContent}</div>

    return (
        <Link to={game.path} className="amrat-card" aria-label={`Play ${game.name}`}>
            {cardContent}
        </Link>
    )
}

const HERO_SLIDES = [
    {
        id: 'royal-welcome',
        badge: '⚡ FAST UPI & 24/7 BANK WITHDRAWAL',
        titlePrefix: 'Deposit in 5 Seconds. ',
        titleHighlight: 'Withdraw Directly to Bank.',
        description: 'Add money using Google Pay, PhonePe, or Paytm with zero extra fees. When you win, get your cash directly in your bank account within minutes.',
        primaryCta: { label: 'Play Rocket Game', icon: '🚀', to: '/crash' },
        secondaryCta: { label: 'Add Money via UPI', icon: '⚡', action: 'deposit' },
        navLabel: 'UPI & Fast Withdrawals',
        stats: [
            { label: 'Google Pay, PhonePe, Paytm', value: 'Instant UPI', icon: '🇮🇳' },
            { label: 'Direct to Bank 24/7', value: 'Fast Payouts', icon: '💸' },
            { label: 'Genuine & Honest Games', value: '100% Safe', icon: '🛡️' },
            { label: 'Free Demo Money', value: '₹10,000 Cash', icon: '🎁' },
        ],
        showcase: {
            type: 'deposit',
            tag: 'EASY UPI DEPOSIT',
            title: 'Deposit ₹100 & Start Playing',
            subtitle: 'Pay directly from your phone in 5 seconds',
            gateways: ['Google Pay', 'PhonePe', 'Paytm', 'BHIM UPI'],
            quickAmounts: [100, 500, 1000],
            cta: 'Add Money via UPI',
            action: 'deposit'
        }
    },
    {
        id: 'crash-multipliers',
        badge: '🚀 INDIA’S #1 ROCKET GAME',
        titlePrefix: 'Watch Rocket Fly & ',
        titleHighlight: 'Cash Out Before It Crashes!',
        description: 'Watch the rocket fly higher and multiply your money: 2x, 5x, 10x, 100x! Click Cash Out anytime to collect your profit before it blasts. Quick rounds and big wins!',
        primaryCta: { label: 'Play Rocket Now', icon: '🚀', to: '/crash' },
        secondaryCta: { label: 'Free Practice Game', icon: '🎮', to: '/crash' },
        navLabel: 'Rocket Crash Game',
        stats: [
            { label: 'Big Win Multipliers', value: 'Up to 1,000x', icon: '⚡' },
            { label: 'Fast 10-Second Rounds', value: 'Quick Rounds', icon: '⏱️' },
            { label: 'Take Profit Anytime', value: '1-Tap Cashout', icon: '🎯' },
            { label: 'Real Indian Players Live', value: 'Live Players', icon: '🔥' },
        ],
        showcase: {
            type: 'crash',
            tag: 'LIVE ROCKET ROUND',
            title: 'Rocket Flying High',
            multiplier: '24.50x',
            status: 'Flying High Now',
            players: '2,400+ Playing Now',
            topWin: '₹3,40,000 Won Today',
            cta: 'Launch Rocket Now',
            to: '/crash'
        }
    },
    {
        id: 'provably-fair',
        badge: '💯 100% HONEST & GENUINE GAMING',
        titlePrefix: 'No Cheating, No Tricks. ',
        titleHighlight: '100% Fair Winning Chances.',
        description: 'Every round outcome is decided by automatic computer math with zero human interference. The casino cannot change your result. Play with complete trust and peace of mind.',
        primaryCta: { label: 'See All 7 Games', icon: '🎲', hash: '#amrat-originals' },
        secondaryCta: { label: 'Play Mines & Diamonds', icon: '💎', to: '/mines' },
        navLabel: '100% Honest & Fair',
        stats: [
            { label: 'Zero Cheating or Tricks', value: '100% Genuine', icon: '🔒' },
            { label: 'Highest Player Return', value: '99% Win Rate', icon: '⭐' },
            { label: 'Rocket, Mines, Plinko...', value: '7 Fun Games', icon: '👑' },
            { label: 'Hindi & English Help', value: '24/7 Support', icon: '💬' },
        ],
        showcase: {
            type: 'fair',
            tag: 'OUR HONESTY PROMISE',
            title: 'Fair Games For Everyone',
            hash: 'Verified Honest Game System',
            houseEdge: 'Highest Player Return (99%)',
            seedType: 'Tamper-Proof Guarantee',
            cta: 'Play Mines & Diamonds',
            to: '/mines'
        }
    },
    {
        id: 'coin-toss',
        badge: '🪙 NEW GAME • 1.98X INSTANT WIN',
        titlePrefix: 'Heads or Tails? ',
        titleHighlight: 'Flip & Double Your Cash Instantly!',
        description: 'Pick Heads or Tails, flip the golden 3D coin, and pocket an instant 1.98x multiplier payout. 100% Provably Fair cryptographic math with 99% player RTP.',
        primaryCta: { label: 'Play Coin Toss Now', icon: '🪙', to: '/coin-toss' },
        secondaryCta: { label: 'Explore All Games', icon: '🎮', hash: '#amrat-originals' },
        navLabel: 'Coin Toss (1.98x)',
        stats: [
            { label: 'Instant 1-Second Payout', value: '1.98x Multiplier', icon: '⚡' },
            { label: 'Provably Fair HMAC', value: '99% RTP', icon: '🪙' },
            { label: 'Fast Action Bets', value: '₹10 Min Bet', icon: '🎯' },
            { label: 'Certified Fair Play', value: '100% Honest', icon: '🛡️' },
        ],
        showcase: {
            type: 'coin-toss',
            tag: 'NEW EXCLUSIVE GAME',
            title: 'Coin Toss: Heads or Tails',
            subtitle: 'Choose your side & double up',
            to: '/coin-toss'
        }
    }
]

function HomePage() {
    const { openWalletModal } = useWallet()
    const [activeCategory, setActiveCategory] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
    const [isHeroPaused, setIsHeroPaused] = useState(false)

    // Auto rotate promo slides every 6 seconds when not hovered
    useEffect(() => {
        if (isHeroPaused) return
        const timer = setInterval(() => {
            setCurrentSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length)
        }, 6000)
        return () => clearInterval(timer)
    }, [isHeroPaused])

    const currentSlide = HERO_SLIDES[currentSlideIndex]

    const filteredGames = useMemo(() => {
        return ALL_GAMES.filter(game => {
            const matchesCategory =
                activeCategory === 'all'
                    ? true
                    : activeCategory === 'originals'
                        ? game.category === 'Originals' || game.category === 'Fast'
                        : activeCategory === 'fast'
                            ? game.category === 'Fast'
                            : activeCategory === 'table'
                                ? game.category === 'Table'
                                : activeCategory === 'popular'
                                    ? ['HOT', 'POPULAR', 'TRENDING'].includes(game.badge)
                                    : true

            const matchesSearch = searchQuery.trim()
                ? game.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
                : true

            return matchesCategory && matchesSearch
        })
    }, [activeCategory, searchQuery])

    const focusGames = () => requestAnimationFrame(() => document.getElementById('amrat-originals')?.focus())

    return (
        <div className="home-page-container">
            {/* Redesigned 3D Landing Home Page Hero Banner */}
            <section
                className="home-page-hero"
                onMouseEnter={() => setIsHeroPaused(true)}
                onMouseLeave={() => setIsHeroPaused(false)}
            >
                <div className="hero-content">
                    <div className="hero-copy" key={currentSlide.id}>
                        <div className="hero-eyebrow">
                            <span>{currentSlide.badge.split(' ')[0]}</span>
                            <span>{currentSlide.badge.substring(currentSlide.badge.indexOf(' ') + 1)}</span>
                        </div>
                        <h1 className="hero-title">
                            <span>{currentSlide.titlePrefix}<strong>{currentSlide.titleHighlight}</strong></span>
                        </h1>
                        <p className="hero-description">
                            {currentSlide.description}
                        </p>

                        <div className="hero-actions">
                            {currentSlide.primaryCta.to ? (
                                <Link to={currentSlide.primaryCta.to} className="hero-primary-button">
                                    <span>{currentSlide.primaryCta.icon}</span>
                                    <span>{currentSlide.primaryCta.label}</span>
                                </Link>
                            ) : (
                                <a href={currentSlide.primaryCta.hash} onClick={focusGames} className="hero-primary-button">
                                    <span>{currentSlide.primaryCta.icon}</span>
                                    <span>{currentSlide.primaryCta.label}</span>
                                </a>
                            )}

                            {currentSlide.secondaryCta.action === 'deposit' ? (
                                <button
                                    type="button"
                                    className="hero-secondary-button"
                                    onClick={() => openWalletModal('deposit')}
                                >
                                    <span>{currentSlide.secondaryCta.icon}</span>
                                    <span>{currentSlide.secondaryCta.label}</span>
                                </button>
                            ) : currentSlide.secondaryCta.to ? (
                                <Link to={currentSlide.secondaryCta.to} className="hero-secondary-button">
                                    <span>{currentSlide.secondaryCta.icon}</span>
                                    <span>{currentSlide.secondaryCta.label}</span>
                                </Link>
                            ) : null}
                        </div>

                        {/* Interactive Slide Progress Tabs & Chevron Controls */}
                        <div className="hero-carousel-controls">
                            <div className="hero-slide-nav-tabs">
                                {HERO_SLIDES.map((slide, idx) => (
                                    <button
                                        key={slide.id}
                                        type="button"
                                        className={`hero-nav-tab ${currentSlideIndex === idx ? 'active' : ''}`}
                                        onClick={() => setCurrentSlideIndex(idx)}
                                        aria-label={`Go to slide ${idx + 1}: ${slide.navLabel}`}
                                    >
                                        <span className="nav-tab-idx">0{idx + 1}</span>
                                        <span className="nav-tab-label">{slide.navLabel}</span>
                                        <div className="nav-tab-progress" />
                                    </button>
                                ))}
                            </div>
                            <div className="hero-slide-arrows">
                                <button
                                    type="button"
                                    className="hero-arrow-btn"
                                    onClick={() => setCurrentSlideIndex((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
                                    aria-label="Previous promo slide"
                                >
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="15 18 9 12 15 6" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    className="hero-arrow-btn"
                                    onClick={() => setCurrentSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length)}
                                    aria-label="Next promo slide"
                                >
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Trust highlights & Stat Badges */}
                        <div className="hero-trust-bar">
                            {currentSlide.stats.map((st, i) => (
                                <div key={i} className="hero-trust-item">
                                    <span className="trust-icon">{st.icon}</span>
                                    <div className="trust-text">
                                        <span className="trust-val">{st.value}</span>
                                        <span className="trust-lbl">{st.label}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right-Side Interactive Showcase Widget (Desktop/Tablet) */}
                    <div className="hero-feature-showcase" aria-hidden="false">
                        {currentSlide.showcase?.type === 'deposit' && (
                            <div className="showcase-card showcase-deposit">
                                <div className="showcase-header">
                                    <span className="showcase-tag">{currentSlide.showcase.tag}</span>
                                    <span className="showcase-live-pill">⚡ Instant Credit</span>
                                </div>
                                <h3 className="showcase-title">{currentSlide.showcase.title}</h3>
                                <p className="showcase-sub">{currentSlide.showcase.subtitle}</p>
                                <div className="showcase-gateways">
                                    {currentSlide.showcase.gateways.map((gw, idx) => (
                                        <span key={idx} className="gateway-badge">{gw}</span>
                                    ))}
                                </div>
                                <div className="showcase-presets">
                                    {currentSlide.showcase.quickAmounts.map((amt) => (
                                        <button
                                            key={amt}
                                            type="button"
                                            className="preset-btn"
                                            onClick={() => openWalletModal('deposit')}
                                        >
                                            +₹{amt.toLocaleString('en-IN')}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="showcase-cta-btn"
                                    onClick={() => openWalletModal('deposit')}
                                >
                                    <span>⚡</span> <span>Instant UPI Deposit</span>
                                </button>
                            </div>
                        )}

                        {currentSlide.showcase?.type === 'crash' && (
                            <div className="showcase-card showcase-crash">
                                <div className="showcase-header">
                                    <span className="showcase-tag">{currentSlide.showcase.tag}</span>
                                    <span className="showcase-live-pill is-pulse">🟢 {currentSlide.showcase.status}</span>
                                </div>
                                <div className="crash-multiplier-preview">
                                    <span className="crash-mult-val">{currentSlide.showcase.multiplier}</span>
                                    <span className="crash-mult-label">Live Rocket Multiplier</span>
                                </div>
                                <div className="showcase-stats-row">
                                    <div className="showcase-stat">
                                        <span className="stat-label">Active Players</span>
                                        <span className="stat-val">{currentSlide.showcase.players}</span>
                                    </div>
                                    <div className="showcase-stat">
                                        <span className="stat-label">Top Payout</span>
                                        <span className="stat-val">{currentSlide.showcase.topWin}</span>
                                    </div>
                                </div>
                                <Link to={currentSlide.showcase.to} className="showcase-cta-btn">
                                    <span>🚀</span> <span>Launch Rocket Now</span>
                                </Link>
                            </div>
                        )}

                        {currentSlide.showcase?.type === 'fair' && (
                            <div className="showcase-card showcase-fair">
                                <div className="showcase-header">
                                    <span className="showcase-tag">{currentSlide.showcase.tag}</span>
                                    <span className="showcase-live-pill">🛡️ 100% Honest</span>
                                </div>
                                <h3 className="showcase-title">{currentSlide.showcase.title}</h3>
                                <div className="fairness-hash-preview">
                                    <span className="hash-label">Our Fair Play Guarantee</span>
                                    <code className="hash-code">Every round result is verified & honest</code>
                                </div>
                                <div className="showcase-stats-row">
                                    <div className="showcase-stat">
                                        <span className="stat-label">Winning Return</span>
                                        <span className="stat-val">99% Return Rate</span>
                                    </div>
                                    <div className="showcase-stat">
                                        <span className="stat-label">Security</span>
                                        <span className="stat-val">100% Safe Games</span>
                                    </div>
                                </div>
                                <Link to={currentSlide.showcase.to} className="showcase-cta-btn">
                                    <span>💎</span> <span>Play Mines Game Now</span>
                                </Link>
                            </div>
                        )}

                        {currentSlide.showcase?.type === 'coin-toss' && (
                            <div className="showcase-card showcase-coin">
                                <div className="showcase-header">
                                    <span className="showcase-tag">{currentSlide.showcase.tag}</span>
                                    <span className="showcase-live-pill is-pulse">🪙 1.98x Payout</span>
                                </div>
                                <div className="coin-preview-showcase" style={{ textAlign: 'center', padding: '12px 0 8px 0' }}>
                                    <img
                                        src="/images/coin-toss.jpg?v=1"
                                        alt="Coin Toss Banner"
                                        style={{ width: '100%', maxHeight: '130px', objectFit: 'cover', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.3)', marginBottom: '10px' }}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '4px' }}>
                                        <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '20px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: '700' }}>👑 HEADS (1.98x)</span>
                                        <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '20px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: '700' }}>⭐ TAILS (1.98x)</span>
                                    </div>
                                </div>
                                <div className="showcase-stats-row">
                                    <div className="showcase-stat">
                                        <span className="stat-label">Win Multiplier</span>
                                        <span className="stat-val" style={{ color: '#10b981' }}>1.98x Instant</span>
                                    </div>
                                    <div className="showcase-stat">
                                        <span className="stat-label">House Edge</span>
                                        <span className="stat-val">Only 1% (99% RTP)</span>
                                    </div>
                                </div>
                                <Link to={currentSlide.showcase.to} className="showcase-cta-btn" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0b0f19', fontWeight: '700' }}>
                                    <span>🪙</span> <span>Flip Coin & Win Now</span>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </section>


            {/* Interactive Category Filter & Search Bar */}
            <nav className="game-category-nav" aria-label="Game categories">
                <div className="game-category-container">
                    <div className="game-category-list">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                className={`game-category-chip ${activeCategory === cat.id ? 'active' : ''}`}
                                onClick={() => setActiveCategory(cat.id)}
                                aria-pressed={activeCategory === cat.id}
                            >
                                <span>{cat.icon}</span>
                                <span>{cat.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="category-search-box">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--text-secondary)">
                            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Find a game..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="category-search-input"
                            aria-label="Filter games by name"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', padding: 0 }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            <section id="amrat-originals" className="home-section" tabIndex="-1">
                <div className="section-header-copy">
                    <p className="section-kicker">Play &amp; Win</p>
                    <h2>Popular Games to Play</h2>
                    <p>Choose any game below. Simple rules, instant fun, and real money payouts.</p>
                </div>
                <div className="amrat-games-grid">
                    {filteredGames.length > 0 ? (
                        filteredGames.map((game) => <GameCard key={game.id} game={game} />)
                    ) : (
                        <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                            <p style={{ fontSize: '16px', marginBottom: '8px' }}>No games found matching "{searchQuery}"</p>
                            <button
                                type="button"
                                onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                                className="game-category-chip active"
                                style={{ margin: '0 auto' }}
                            >
                                Clear Filters
                            </button>
                        </div>
                    )}
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
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" /></svg>
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
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" /></svg>
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
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" /></svg>
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
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" /></svg>
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
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" /></svg>
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
