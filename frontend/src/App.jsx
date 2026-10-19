import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { App as AntApp } from 'antd'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import GameAuthGuard from './components/Auth/GameAuthGuard'

const HomePage = lazy(() => import('./pages/HomePage'))
const loadCrash = () => import('./games/crash')
const loadPlinko = () => import('./games/plinko')
const loadMines = () => import('./games/mines')
const loadLimbo = () => import('./games/limbo')
const loadDragonTiger = () => import('./games/dragon-tiger')
const loadColorMatch = () => import('./games/color-match')
const loadCoinToss = () => import('./games/coin-toss')
const loadAdmin = () => import('./admin-panel')

const CrashPage = lazy(loadCrash)
const PlinkoPage = lazy(loadPlinko)
const MinesPage = lazy(loadMines)
const LimboPage = lazy(loadLimbo)
const DragonTigerPage = lazy(loadDragonTiger)
const ColorMatchPage = lazy(loadColorMatch)
const CoinTossPage = lazy(loadCoinToss)
const AdminPage = lazy(loadAdmin)
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const FavouritesPage = lazy(() => import('./pages/FavouritesPage'))
const RecentPage = lazy(() => import('./pages/RecentPage'))
const ChallengesPage = lazy(() => import('./pages/ChallengesPage'))
const MyBetsPage = lazy(() => import('./pages/MyBetsPage'))

function App() {
    // Eagerly prefetch game modules during browser idle time
    useEffect(() => {
        const schedulePreload = () => {
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(() => {
                    loadCrash()
                    loadPlinko()
                    loadMines()
                    loadLimbo()
                    loadDragonTiger()
                    loadColorMatch()
                    loadCoinToss()
                })
            } else {
                setTimeout(() => {
                    loadCrash()
                    loadPlinko()
                    loadMines()
                    loadLimbo()
                    loadDragonTiger()
                    loadColorMatch()
                    loadCoinToss()
                }, 800)
            }
        }

        // Unregister any stale legacy service workers so fresh SPA bundles always load
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                for (const registration of registrations) {
                    registration.unregister()
                }
            }).catch(() => {})
        }

        schedulePreload()
    }, [])

    return (
        <AntApp>
            <ErrorBoundary>
                <Suspense
                    fallback={
                        <div className="route-loading" role="status" aria-live="polite">
                            Loading…
                        </div>
                    }
                >
                    <Routes>
                        {/* Casino Games & Player Portal (Wrapped in Casino Layout) */}
                        <Route path="/" element={<Layout />}>
                            <Route index element={<HomePage />} />
                            <Route path="crash" element={<GameAuthGuard gameName="Crash (JetX)"><CrashPage /></GameAuthGuard>} />
                            <Route path="plinko" element={<GameAuthGuard gameName="Plinko"><PlinkoPage /></GameAuthGuard>} />
                            <Route path="mines" element={<GameAuthGuard gameName="Mines"><MinesPage /></GameAuthGuard>} />
                            <Route path="limbo" element={<GameAuthGuard gameName="Limbo"><LimboPage /></GameAuthGuard>} />
                            <Route path="dragon-tiger" element={<GameAuthGuard gameName="Dragon Tiger"><DragonTigerPage /></GameAuthGuard>} />
                            <Route path="color-match" element={<GameAuthGuard gameName="Color Match"><ColorMatchPage /></GameAuthGuard>} />
                            <Route path="coin-toss" element={<GameAuthGuard gameName="Coin Toss"><CoinTossPage /></GameAuthGuard>} />
                            <Route path="profile" element={<ProfilePage />} />
                            <Route path="favourites" element={<FavouritesPage />} />
                            <Route path="recent" element={<RecentPage />} />
                            <Route path="challenges" element={<ChallengesPage />} />
                            <Route path="my-bets" element={<MyBetsPage />} />
                        </Route>

                        {/* Dedicated Standalone Admin Portal (Independent Fullscreen Page) */}
                        <Route path="/admin" element={<AdminPage />} />

                        {/* Graceful Catch-All Fallback (Prevent blank screens on unmatched routes) */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
            </ErrorBoundary>
        </AntApp>
    )
}

export default App


