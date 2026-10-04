import { useEffect } from 'react'
import { Drawer } from 'antd'
import { NavLink, useLocation } from 'react-router-dom'
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

const GAME_ICONS = {
    crash: CrashIcon,
    plinko: PlinkoIcon,
    dino: DinoIcon,
    mines: MinesIcon,
    limbo: LimboIcon,
    'dragon-tiger': DragonTigerIcon,
    'color-match': ColorMatchIcon
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

function MobileNavigation({ drawerOpen, onClose, returnFocusRef }) {
    const location = useLocation()
    const { paletteId, palettes, setPaletteId } = useThemeSettings()
    const { user, logout, openAuthModal } = useAuth()
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => onClose(), [location.pathname, onClose])

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
                {/* User Status / Auth CTA in Drawer */}
                <div style={{ marginBottom: '16px' }}>
                    {user ? (
                        <div style={{
                            padding: '12px',
                            background: 'rgba(245, 175, 25, 0.1)',
                            border: '1px solid rgba(245, 175, 25, 0.35)',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    width: '30px',
                                    height: '30px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #f5af19, #d49110)',
                                    color: '#0b0f19',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px'
                                }}>
                                    {user.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.85rem' }}>{user.username}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                        {user.phone ? `📱 +91 ${user.phone}` : (user.email || 'Verified Player')}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { logout(); onClose(); }}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    color: '#f87171',
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => { onClose(); openAuthModal('otp'); }}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'linear-gradient(135deg, #f5af19, #d49110)',
                                border: 'none',
                                borderRadius: '10px',
                                color: '#0b0f19',
                                fontWeight: 800,
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                boxShadow: '0 4px 12px rgba(245, 175, 25, 0.25)'
                            }}
                        >
                            <span>⚡</span>
                            <span>Sign In</span>
                        </button>
                    )}
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
                                if (label === 'Profile' && !user) {
                                    onClose()
                                    openAuthModal('login')
                                }
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div style={{ marginBottom: '20px' }}>
                    <NavLink
                        to="/admin"
                        onClick={onClose}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '12px 14px',
                            background: 'linear-gradient(135deg, rgba(245, 175, 25, 0.25), rgba(212, 145, 16, 0.12))',
                            border: '1px solid rgba(245, 175, 25, 0.45)',
                            borderRadius: '10px',
                            color: '#fbbf24',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            textDecoration: 'none',
                            boxShadow: '0 4px 14px rgba(245, 175, 25, 0.15)',
                            minHeight: '44px'
                        }}
                    >
                        <span>👑</span>
                        <span>Admin Panel</span>
                    </NavLink>
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
                {primaryRoutes.map(route => {
                    const IconComponent = route.Icon
                    return (
                        <NavLink
                            key={route.path}
                            to={route.path}
                            end={route.path === '/'}
                            className={({ isActive }) => isActive ? 'active' : ''}
                        >
                            <span className="nav-icon-wrap" aria-hidden="true">
                                <IconComponent />
                            </span>
                            <span>{route.label}</span>
                        </NavLink>
                    )
                })}
            </nav>
        </>
    )
}

export default MobileNavigation
