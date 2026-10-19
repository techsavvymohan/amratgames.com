import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../styles/hubPages.css'

const CHALLENGES = [
    {
        id: 'crash-sky-high',
        gameId: 'crash',
        gameName: 'Crash (Rocket)',
        gamePath: '/crash',
        icon: '🚀',
        type: 'daily',
        typeLabel: 'Daily Quest',
        badgeClass: 'badge-daily',
        title: 'Crash: Sky High 10x',
        description: 'Launch the rocket and successfully cash out at 10.00x multiplier or higher.',
        minBet: '₹50',
        reward: '₹500 Bonus + 500 VIP XP',
        progress: 60,
        currentProgress: 'Current High: 6.20x',
        targetProgress: 'Target: 10.00x',
        expiresIn: 'Resets in 11h 45m',
    },
    {
        id: 'cointoss-streak',
        gameId: 'coin-toss',
        gameName: 'Coin Toss (Heads or Tails)',
        gamePath: '/coin-toss',
        icon: '🪙',
        type: 'daily',
        typeLabel: 'Daily Quest',
        badgeClass: 'badge-daily',
        title: 'Coin Toss: Fortune Streak',
        description: 'Flip the 3D golden coin and score 5 consecutive wins on Heads or Tails.',
        minBet: '₹20',
        reward: '₹350 Bonus + 350 VIP XP',
        progress: 40,
        currentProgress: 'Best Streak: 2 Wins',
        targetProgress: 'Target: 5 Wins',
        expiresIn: 'Resets in 11h 45m',
    },
    {
        id: 'mines-diamond-hunter',
        gameId: 'mines',
        gameName: 'Mines (Diamonds)',
        gamePath: '/mines',
        icon: '💣',
        type: 'hard',
        typeLabel: 'High Multiplier',
        badgeClass: 'badge-hard',
        title: 'Mines: Diamond Hunter',
        description: 'Uncover 8 consecutive safe diamonds on a grid with 3 or more active mines.',
        minBet: '₹50',
        reward: '₹1,000 Bonus + 1,000 VIP XP',
        progress: 25,
        currentProgress: 'Best: 4 Diamonds',
        targetProgress: 'Target: 8 Diamonds',
        expiresIn: 'Weekly Mission • 3d left',
    },
    {
        id: 'limbo-turbo-50x',
        gameId: 'limbo',
        gameName: 'Limbo Turbo',
        gamePath: '/limbo',
        icon: '⚡',
        type: 'hard',
        typeLabel: 'High Multiplier',
        badgeClass: 'badge-hard',
        title: 'Limbo: Turbo 50x Target',
        description: 'Set your target to 50.00x multiplier or higher and hit a successful roll.',
        minBet: '₹30',
        reward: '₹1,500 Bonus + 1,500 VIP XP',
        progress: 10,
        currentProgress: 'Best Roll: 18.40x',
        targetProgress: 'Target: 50.00x',
        expiresIn: 'Weekly Mission • 3d left',
    },
    {
        id: 'plinko-outer-edge',
        gameId: 'plinko',
        gameName: 'Plinko',
        gamePath: '/plinko',
        icon: '🎯',
        type: 'weekly',
        typeLabel: 'Weekly Master',
        badgeClass: 'badge-weekly',
        title: 'Plinko: Outer Edge Sniper',
        description: 'Drop balls down the pyramid and land in any outer slot with 29x or higher multiplier.',
        minBet: '₹25',
        reward: '₹750 Bonus + 750 VIP XP',
        progress: 50,
        currentProgress: 'Best Landing: 13x',
        targetProgress: 'Target: 29x+',
        expiresIn: 'Weekly Mission • 4d left',
    },
    {
        id: 'dragontiger-duelist',
        gameId: 'dragon-tiger',
        gameName: 'Dragon Tiger',
        gamePath: '/dragon-tiger',
        icon: '🐉',
        type: 'daily',
        typeLabel: 'Daily Quest',
        badgeClass: 'badge-daily',
        title: 'Dragon Tiger: Royal Duelist',
        description: 'Win 4 rounds betting on Dragon or Tiger in the lightning card duel.',
        minBet: '₹50',
        reward: '₹300 Bonus + 300 VIP XP',
        progress: 75,
        currentProgress: 'Won: 3 / 4 Rounds',
        targetProgress: 'Target: 4 Wins',
        expiresIn: 'Resets in 11h 45m',
    },
    {
        id: 'colormatch-spectrum',
        gameId: 'color-match',
        gameName: 'Color Match',
        gamePath: '/color-match',
        icon: '🎨',
        type: 'weekly',
        typeLabel: 'Weekly Master',
        badgeClass: 'badge-weekly',
        title: 'Color Match: Lucky 9x',
        description: 'Predict and win on Violet (4.5x) or an exact single Lucky Number (9.0x).',
        minBet: '₹50',
        reward: '₹800 Bonus + 800 VIP XP',
        progress: 30,
        currentProgress: 'Pending Match',
        targetProgress: 'Target: Violet or 9x Number',
        expiresIn: 'Weekly Mission • 5d left',
    },
]

export default function ChallengesPage() {
    const navigate = useNavigate()
    const [selectedCategory, setSelectedCategory] = useState('all')

    const filteredChallenges = CHALLENGES.filter(c => {
        if (selectedCategory === 'all') return true
        if (selectedCategory === 'daily') return c.type === 'daily'
        if (selectedCategory === 'hard') return c.type === 'hard'
        if (selectedCategory === 'weekly') return c.type === 'weekly'
        return true
    })

    return (
        <div className="hub-page-container">
            <div className="hub-page-content">
                {/* Header */}
            <div className="hub-header">
                <div className="hub-header-left">
                    <div className="hub-header-icon" aria-hidden="true">🏆</div>
                    <div className="hub-title-wrap">
                        <h1>
                            Casino Challenges
                            <span className="hub-badge">Season 1 Active</span>
                        </h1>
                        <p>Complete daily and weekly wagering missions to unlock bonus cash and VIP perks</p>
                    </div>
                </div>
                <div className="hub-header-actions">
                    <Link to="/profile?tab=vip" className="hub-tab-btn">
                        <span>👑 VIP Club Perks</span>
                    </Link>
                </div>
            </div>

            {/* Metrics */}
            <div className="hub-metrics-grid">
                <div className="hub-metric-card">
                    <div className="hub-metric-icon">🎯</div>
                    <div className="hub-metric-info">
                        <span className="hub-metric-label">Active Missions</span>
                        <span className="hub-metric-value">{CHALLENGES.length} Available</span>
                    </div>
                </div>
                <div className="hub-metric-card">
                    <div className="hub-metric-icon">💰</div>
                    <div className="hub-metric-info">
                        <span className="hub-metric-label">Total Cash Rewards</span>
                        <span className="hub-metric-value" style={{ color: '#10b981' }}>₹5,200 INR</span>
                    </div>
                </div>
                <div className="hub-metric-card">
                    <div className="hub-metric-icon">⚡</div>
                    <div className="hub-metric-info">
                        <span className="hub-metric-label">VIP XP Pool</span>
                        <span className="hub-metric-value" style={{ color: '#fbbf24' }}>5,200 XP</span>
                    </div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="hub-nav-tabs">
                <button
                    type="button"
                    className={`hub-tab-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('all')}
                >
                    All Challenges ({CHALLENGES.length})
                </button>
                <button
                    type="button"
                    className={`hub-tab-btn ${selectedCategory === 'daily' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('daily')}
                >
                    ☀️ Daily Quests
                </button>
                <button
                    type="button"
                    className={`hub-tab-btn ${selectedCategory === 'hard' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('hard')}
                >
                    🔥 High Multipliers (10x - 50x)
                </button>
                <button
                    type="button"
                    className={`hub-tab-btn ${selectedCategory === 'weekly' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('weekly')}
                >
                    👑 Weekly Masters
                </button>
            </div>

            {/* Challenges Grid */}
            <div className="hub-challenges-grid">
                {filteredChallenges.map(challenge => (
                    <div key={challenge.id} className="hub-challenge-card">
                        <div>
                            <div className="hub-challenge-top">
                                <div className="hub-challenge-icon-box">
                                    {challenge.icon}
                                </div>
                                <span className={`hub-challenge-type-badge ${challenge.badgeClass}`}>
                                    {challenge.typeLabel}
                                </span>
                            </div>

                            <h3 className="hub-challenge-title">{challenge.title}</h3>
                            <p className="hub-challenge-desc">{challenge.description}</p>

                            <div className="hub-challenge-reward-box">
                                <span className="hub-challenge-reward-label">Reward</span>
                                <span className="hub-challenge-reward-val">{challenge.reward}</span>
                            </div>

                            <div className="hub-challenge-progress-wrap">
                                <div className="hub-challenge-progress-labels">
                                    <span>{challenge.currentProgress}</span>
                                    <span>{challenge.targetProgress}</span>
                                </div>
                                <div className="hub-challenge-progress-bar">
                                    <div
                                        className="hub-challenge-progress-fill"
                                        style={{ width: `${challenge.progress}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontSize: '0.78rem', color: '#94a3b8' }}>
                                <span>Min Bet: <strong style={{ color: '#fff' }}>{challenge.minBet}</strong></span>
                                <span>{challenge.expiresIn}</span>
                            </div>

                            <button
                                type="button"
                                className="hub-game-play-btn"
                                onClick={() => navigate(challenge.gamePath)}
                            >
                                <span>PLAY {challenge.gameName.toUpperCase()}</span>
                                <span>▶</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            </div>
        </div>
    )
}
