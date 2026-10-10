import { useState, useEffect, useRef, useCallback } from 'react'
import { Drawer } from 'antd'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { GAMES } from '../games'
import { useThemeSettings } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import './MobileNavigation.css'

const HomeIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
)

const CrashIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
)

const PlinkoIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="4" r="1.8"/>
        <circle cx="7.5" cy="10" r="1.8"/>
        <circle cx="16.5" cy="10" r="1.8"/>
        <circle cx="4" cy="16" r="1.8"/>
        <circle cx="12" cy="16" r="1.8"/>
        <circle cx="20" cy="16" r="1.8"/>
        <rect x="2" y="20.5" width="20" height="2" rx="1" opacity="0.75"/>
    </svg>
)

const DinoIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2h-6v2h-2v2h-2v4H8v2H6v2H4v-2H2v6h2v-2h2v4h2v2h2v2h2v-2h-2v-4h2v-2h2v4h2v-2h-2v-2h2v-2h2V8h2V6h-2V4h2V2h-4zm-4 4h-2V4h2v2z"/>
    </svg>
)

const MinesIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="13" r="7.5"/>
        <path d="m19.5 4.5-2.5 2.5"/>
        <path d="M16 8h4"/>
        <path d="M12 2v4"/>
        <path d="M17 11a4.5 4.5 0 0 0-4.5-4.5"/>
    </svg>
)

const LimboIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
)

const DragonTigerIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="13" height="16" rx="2"/>
        <path d="M8 2h11a2 2 0 0 1 2 2v13"/>
    </svg>
)

const ColorMatchIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
        <path d="M12 3a9 9 0 0 1 9 9h-9z" fill="#ff1744"/>
        <path d="M12 12v9a9 9 0 0 1-9-9z" fill="#00e676"/>
        <path d="M3 12a9 9 0 0 1 9-9v9z" fill="#7c4dff"/>
    </svg>
)

const CoinTossIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 7v10"/>
        <path d="M9 10h6"/>
    </svg>
)

const GAME_ICONS = {
    crash: CrashIcon,
    plinko: PlinkoIcon,
    dino: DinoIcon,
    mines: MinesIcon,
    limbo: LimboIcon,
    'dragon-tiger': DragonTigerIcon,
    'color-match': ColorMatchIcon,
    'coin-toss': CoinTossIcon
}

const primaryRoutes = [
    { path: '/', label: 'Home', Icon: HomeIcon },
    ...GAMES.map(game => ({ 
        path: game.path, 
        label: game.name, 
        Icon: GAME_ICONS[game.id] || HomeIcon 
    })),
]

const comingSoon = ['Favourites', 'Recent', 'Challenges', 'My Bets']

function MobileNavigation({ drawerOpen, onClose, returnFocusRef, onToggleChat, isChatOpen }) {
    const location = useLocation()
    const navigate = useNavigate()
    const { paletteId, palettes, setPaletteId } = useThemeSettings()
    const { user, logout, openAuthModal } = useAuth()
    const [searchQuery, setSearchQuery] = useState('')

    // Carousel refs & scroll state
    const carouselRef = useRef(null)
    const itemRefs = useRef({})
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(true)

    // Touch/Mouse drag state
    const isDragging = useRef(false)
    const startX = useRef(0)
    const scrollStartX = useRef(0)
    const hasDragged = useRef(false)

    const checkScrollLimits = useCallback(() => {
        const el = carouselRef.current
        if (!el) return
        const left = el.scrollLeft
        const maxScroll = el.scrollWidth - el.clientWidth
        setCanScrollLeft(left > 4)
        setCanScrollRight(left < maxScroll - 4)
    }, [])

    useEffect(() => {
        onClose()
        const activeEl = itemRefs.current[location.pathname]
        if (activeEl && carouselRef.current) {
            activeEl.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            })
            const timer = setTimeout(checkScrollLimits, 350)
            return () => clearTimeout(timer)
        }
    }, [location.pathname, onClose, checkScrollLimits])

    useEffect(() => {
        const el = carouselRef.current
        if (!el) return
        checkScrollLimits()
        el.addEventListener('scroll', checkScrollLimits, { passive: true })
        window.addEventListener('resize', checkScrollLimits)
        return () => {
            el.removeEventListener('scroll', checkScrollLimits)
            window.removeEventListener('resize', checkScrollLimits)
        }
    }, [checkScrollLimits])

    // Desktop click-and-drag smooth scroll support
    const handleMouseDown = (e) => {
        isDragging.current = true
        hasDragged.current = false
        startX.current = e.pageX
        scrollStartX.current = carouselRef.current?.scrollLeft || 0
    }

    const handleMouseMove = (e) => {
        if (!isDragging.current || !carouselRef.current) return
        const delta = e.pageX - startX.current
        if (Math.abs(delta) > 5) {
            hasDragged.current = true
        }
        carouselRef.current.scrollLeft = scrollStartX.current - delta
    }

    const handleMouseUpOrLeave = () => {
        isDragging.current = false
    }

    const handleClickCapture = (e) => {
        if (hasDragged.current) {
            e.preventDefault()
            e.stopPropagation()
            hasDragged.current = false
        }
    }

    return (
        <>
            <Drawer
                title="Menu"
                placement="left"
                width="min(88vw, 360px)"
                open={drawerOpen}
                onClose={onClose}
                afterOpenChange={open => {
                    if (!open) returnFocusRef.current?.focus()
                }}
                rootClassName="mobile-navigation-drawer"
            >
                {/* 👑 UI/UX Pro Max: User Status / Auth CTA & Community Live Chat in Drawer */}
                <div style={{ marginBottom: '18px' }}>
                    {user ? (
                        <div style={{
                            padding: '12px 14px',
                            background: 'linear-gradient(135deg, rgba(245, 175, 25, 0.12), rgba(212, 145, 16, 0.05))',
                            border: '1px solid rgba(245, 175, 25, 0.35)',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)'
                        }}>
                            <div 
                                onClick={() => { onClose(); navigate('/profile'); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                                title="Open Verified Profile"
                            >
                                <div style={{
                                    width: '34px',
                                    height: '34px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #f5af19, #d49110)',
                                    color: '#0b0f19',
                                    fontWeight: 900,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    boxShadow: '0 2px 6px rgba(245, 175, 25, 0.4)'
                                }}>
                                    {user.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span>{user.username}</span>
                                        <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '1px 5px', borderRadius: '4px' }}>VIP</span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                        {user.phone ? `📱 +91 ${user.phone}` : (user.email || 'Verified Player')}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { logout(); onClose(); }}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                    color: '#f87171',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    transition: 'background 0.15s ease'
                                }}
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => { onClose(); openAuthModal('login'); }}
                                style={{
                                    flex: 1,
                                    padding: '12px 14px',
                                    background: 'linear-gradient(135deg, #f5af19, #d49110)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    color: '#0b0f19',
                                    fontWeight: 800,
                                    fontSize: '0.92rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    boxShadow: '0 4px 14px rgba(245, 175, 25, 0.35)'
                                }}
                            >
                                <span>⚡</span>
                                <span>Sign In</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { onClose(); openAuthModal('register'); }}
                                style={{
                                    flex: 1,
                                    padding: '12px 14px',
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '12px',
                                    color: '#f8fafc',
                                    fontWeight: 700,
                                    fontSize: '0.92rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                <span>Register</span>
                            </button>
                        </div>
                    )}

                    {/* 💬 Community Live Chat Button inside Menu Drawer */}
                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            if (onToggleChat) onToggleChat();
                        }}
                        style={{
                            width: '100%',
                            marginTop: '10px',
                            padding: '12px 14px',
                            background: isChatOpen ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            border: isChatOpen ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '12px',
                            color: '#f8fafc',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.2s ease',
                            boxShadow: isChatOpen ? '0 0 14px rgba(16, 185, 129, 0.25)' : 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px' }}>💬</span>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#f8fafc' }}>Community Live Chat</div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Connect with active players</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#10b981',
                                boxShadow: '0 0 8px #10b981'
                            }} />
                            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 800 }}>LIVE</span>
                        </div>
                    </button>
                </div>

                <label className="mobile-drawer-field">
                    <span>Search</span>
                    <input
                        type="search"
                        placeholder="Search games..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </label>
                {searchQuery.trim() && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                        {GAMES.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase().trim())).map(game => (
                            <NavLink
                                key={game.id}
                                to={game.path}
                                onClick={() => {
                                    onClose()
                                    setSearchQuery('')
                                }}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 12px',
                                    background: 'rgba(255,255,255,0.06)',
                                    borderRadius: '8px',
                                    color: '#f8fafc',
                                    textDecoration: 'none',
                                    fontSize: '13px'
                                }}
                            >
                                <span style={{ fontWeight: 600 }}>{game.name}</span>
                                <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 600 }}>{game.rtp}</span>
                            </NavLink>
                        ))}
                    </div>
                )}
                <label className="mobile-drawer-field">
                    <span>Palette</span>
                    <select value={paletteId} onChange={event => setPaletteId(event.target.value)}>
                        {palettes.map(palette => (
                            <option key={palette.id} value={palette.id}>{palette.name}</option>
                        ))}
                    </select>
                </label>
                <div className="mobile-drawer-actions" aria-label="Account shortcuts">
                    {['Profile', 'Notifications', 'Chat'].map(label => (
                        <button
                            key={label}
                            type="button"
                            onClick={() => {
                                if (label === 'Profile') {
                                    onClose()
                                    if (!user) openAuthModal('login')
                                    else navigate('/profile')
                                } else if (label === 'Notifications') {
                                    onClose()
                                    navigate('/profile?tab=transactions')
                                } else if (label === 'Chat') {
                                    onClose()
                                    if (onToggleChat) onToggleChat()
                                }
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div style={{ marginBottom: '20px' }}>

                    <a
                        href="mailto:support@amratgames.com"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '10px 14px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '10px',
                            color: '#94a3b8',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            textDecoration: 'none',
                            marginTop: '8px',
                            minHeight: '40px'
                        }}
                    >
                        <span>💬</span>
                        <span>Live Support: support@amratgames.com</span>
                    </a>
                </div>
                <div className="mobile-coming-soon" aria-label="Coming soon">
                    {comingSoon.map(label => (
                        <button key={label} type="button" disabled>
                            <span>{label}</span>
                            <small>Coming soon</small>
                        </button>
                    ))}
                </div>
            </Drawer>

            <nav className="mobile-bottom-nav" aria-label="Primary navigation">
                {/* Pinned Home button for instant 1-tap lobby access */}
                <NavLink
                    to="/"
                    end
                    className={({ isActive }) => `mobile-nav-home-btn ${isActive ? 'active' : ''}`}
                    title="Home"
                >
                    <span className="nav-icon-wrap" aria-hidden="true">
                        <HomeIcon />
                    </span>
                    <span>Home</span>
                </NavLink>

                <div className="mobile-nav-divider" aria-hidden="true" />

                {/* Horizontal Slidable Games Carousel */}
                <div className={`mobile-nav-carousel-wrapper ${canScrollLeft ? 'has-scroll-left' : ''} ${canScrollRight ? 'has-scroll-right' : ''}`}>
                    <div 
                        className="mobile-nav-carousel-track" 
                        ref={carouselRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUpOrLeave}
                        onMouseLeave={handleMouseUpOrLeave}
                        onClickCapture={handleClickCapture}
                    >
                        {GAMES.map(game => {
                            const GameIcon = GAME_ICONS[game.id] || HomeIcon
                            return (
                                <NavLink
                                    key={game.path}
                                    to={game.path}
                                    ref={el => { itemRefs.current[game.path] = el }}
                                    className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
                                    title={game.name}
                                >
                                    <span className="nav-icon-wrap" aria-hidden="true">
                                        <GameIcon />
                                    </span>
                                    <span>{game.navLabel || game.name}</span>
                                </NavLink>
                            )
                        })}
                    </div>
                </div>
            </nav>
        </>
    )
}

export default MobileNavigation
