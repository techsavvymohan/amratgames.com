import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GAMES } from '../games'
import { getFavourites, toggleFavourite } from '../utils/userGamePreferences'
import '../styles/hubPages.css'

export default function FavouritesPage() {
    const navigate = useNavigate()
    const [favIds, setFavIds] = useState(() => getFavourites())
    const [filterCategory, setFilterCategory] = useState('all')

    useEffect(() => {
        const handleSync = (e) => {
            if (e.detail?.favourites) {
                setFavIds(e.detail.favourites)
            } else {
                setFavIds(getFavourites())
            }
        }
        window.addEventListener('amrat_favourites_changed', handleSync)
        return () => window.removeEventListener('amrat_favourites_changed', handleSync)
    }, [])

    const handleToggle = (e, gameId) => {
        e.preventDefault()
        e.stopPropagation()
        toggleFavourite(gameId)
    }

    const favouriteGames = GAMES.filter(game => favIds.includes(game.id))
    const nonFavouriteGames = GAMES.filter(game => !favIds.includes(game.id))

    const filteredFavourites = favouriteGames.filter(game => {
        if (filterCategory === 'all') return true
        return game.category?.toLowerCase() === filterCategory.toLowerCase()
    })

    const categories = ['all', 'Fast', 'Originals', 'Table']

    return (
        <div className="hub-page-container">
            {/* Header */}
            <div className="hub-header">
                <div className="hub-header-left">
                    <div className="hub-header-icon" aria-hidden="true">⭐</div>
                    <div className="hub-title-wrap">
                        <h1>
                            Favourites
                            <span className="hub-badge">{favouriteGames.length} Pinned</span>
                        </h1>
                        <p>Your pinned casino games for instant 1-click access</p>
                    </div>
                </div>
                <div className="hub-header-actions">
                    <Link to="/" className="hub-tab-btn">
                        <span>🏛️ All Games Lobby</span>
                    </Link>
                </div>
            </div>

            {/* Metrics */}
            <div className="hub-metrics-grid">
                <div className="hub-metric-card">
                    <div className="hub-metric-icon">⭐</div>
                    <div className="hub-metric-info">
                        <span className="hub-metric-label">Pinned Games</span>
                        <span className="hub-metric-value">{favouriteGames.length} / {GAMES.length}</span>
                    </div>
                </div>
                <div className="hub-metric-card">
                    <div className="hub-metric-icon">⚡</div>
                    <div className="hub-metric-info">
                        <span className="hub-metric-label">Fast Originals</span>
                        <span className="hub-metric-value">99% Provably Fair</span>
                    </div>
                </div>
                <div className="hub-metric-card">
                    <div className="hub-metric-icon">🏆</div>
                    <div className="hub-metric-info">
                        <span className="hub-metric-label">Highest Multiplier</span>
                        <span className="hub-metric-value">100,000x</span>
                    </div>
                </div>
            </div>

            {/* Category Filter Tabs */}
            {favouriteGames.length > 0 && (
                <div className="hub-nav-tabs">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            type="button"
                            className={`hub-tab-btn ${filterCategory === cat ? 'active' : ''}`}
                            onClick={() => setFilterCategory(cat)}
                        >
                            {cat === 'all' ? 'All Favourites' : cat}
                        </button>
                    ))}
                </div>
            )}

            {/* Favourited Games Grid */}
            {filteredFavourites.length > 0 ? (
                <div className="hub-games-grid">
                    {filteredFavourites.map(game => (
                        <div
                            key={game.id}
                            className="hub-game-card"
                            onClick={() => navigate(game.path)}
                            role="button"
                            tabIndex={0}
                        >
                            <div className="hub-game-art-wrap">
                                <img src={game.image} alt={game.name} className="hub-game-art" loading="lazy" />
                                <button
                                    type="button"
                                    className="hub-game-fav-btn is-fav"
                                    onClick={(e) => handleToggle(e, game.id)}
                                    title="Remove from Favourites"
                                >
                                    ★
                                </button>
                                <div className="hub-game-badges">
                                    {game.badge && <span className="hub-badge">{game.badge}</span>}
                                    <span className="hub-badge" style={{ color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                                        {game.rtp?.split(' ')[0] || '99%'} RTP
                                    </span>
                                </div>
                            </div>
                            <div className="hub-game-info">
                                <h3 className="hub-game-title">{game.name}</h3>
                                <div className="hub-game-meta">
                                    <span>{game.volatility}</span>
                                    <span className="hub-game-maxwin">Max: {game.maxWin}</span>
                                </div>
                                <button type="button" className="hub-game-play-btn">
                                    <span>PLAY NOW</span>
                                    <span>▶</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="hub-empty-state">
                    <div className="hub-empty-icon">⭐</div>
                    <div className="hub-empty-title">No Favourites Yet</div>
                    <p className="hub-empty-desc">
                        Star any of the games below to pin them here for instant 1-click access anytime!
                    </p>
                </div>
            )}

            {/* Quick Add More Games to Favourites */}
            {nonFavouriteGames.length > 0 && (
                <>
                    <div className="hub-section-title">
                        <span>➕</span> Add More Games to Favourites
                    </div>
                    <div className="hub-games-grid">
                        {nonFavouriteGames.map(game => (
                            <div
                                key={game.id}
                                className="hub-game-card"
                                onClick={() => navigate(game.path)}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="hub-game-art-wrap">
                                    <img src={game.image} alt={game.name} className="hub-game-art" loading="lazy" />
                                    <button
                                        type="button"
                                        className="hub-game-fav-btn"
                                        onClick={(e) => handleToggle(e, game.id)}
                                        title="Add to Favourites"
                                    >
                                        ☆
                                    </button>
                                    <div className="hub-game-badges">
                                        {game.badge && <span className="hub-badge">{game.badge}</span>}
                                        <span className="hub-badge" style={{ color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                                            {game.rtp?.split(' ')[0] || '99%'} RTP
                                        </span>
                                    </div>
                                </div>
                                <div className="hub-game-info">
                                    <h3 className="hub-game-title">{game.name}</h3>
                                    <div className="hub-game-meta">
                                        <span>{game.volatility}</span>
                                        <span className="hub-game-maxwin">Max: {game.maxWin}</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="hub-tab-btn"
                                        style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }}
                                        onClick={(e) => handleToggle(e, game.id)}
                                    >
                                        ⭐ Pin to Favourites
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
