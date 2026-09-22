import { useEffect } from 'react'
import { Drawer } from 'antd'
import { NavLink, useLocation } from 'react-router-dom'
import { GAMES } from '../games'
import { useThemeSettings } from '../context/ThemeContext'
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

const GAME_ICONS = {
    crash: CrashIcon,
    plinko: PlinkoIcon,
    dino: DinoIcon,
    mines: MinesIcon
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
                <label className="mobile-drawer-field">
                    <span>Search</span>
                    <input type="search" placeholder="Search your game" />
                </label>
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
                        <button key={label} type="button">{label}</button>
                    ))}
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
