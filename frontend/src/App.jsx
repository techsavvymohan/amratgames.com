import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { App as AntApp } from 'antd'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'

const HomePage = lazy(() => import('./pages/HomePage'))
const loadCrash = () => import('./games/crash')
const loadPlinko = () => import('./games/plinko')
const loadDino = () => import('./games/dino')
const loadMines = () => import('./games/mines')
const loadLimbo = () => import('./games/limbo')
const loadDragonTiger = () => import('./games/dragon-tiger')
const loadColorMatch = () => import('./games/color-match')
const loadCoinToss = () => import('./games/coin-toss')
const loadAdmin = () => import('./admin-panel')

const CrashPage = lazy(loadCrash)
const PlinkoPage = lazy(loadPlinko)
const DinoPage = lazy(loadDino)
const MinesPage = lazy(loadMines)
const LimboPage = lazy(loadLimbo)
const DragonTigerPage = lazy(loadDragonTiger)
const ColorMatchPage = lazy(loadColorMatch)
const CoinTossPage = lazy(loadCoinToss)
const AdminPage = lazy(loadAdmin)
const ProfilePage = lazy(() => import('./pages/ProfilePage'))

function App() {
    // Eagerly prefetch game modules during browser idle time
    useEffect(() => {
        const schedulePreload = () => {
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(() => {
                    loadCrash()
                    loadPlinko()
                    loadDino()
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
                    loadDino()
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
                            <Route path="crash" element={<CrashPage />} />
                            <Route path="plinko" element={<PlinkoPage />} />
                            <Route path="dino" element={<DinoPage />} />
                            <Route path="mines" element={<MinesPage />} />
                            <Route path="limbo" element={<LimboPage />} />
                            <Route path="dragon-tiger" element={<DragonTigerPage />} />
                            <Route path="color-match" element={<ColorMatchPage />} />
                            <Route path="coin-toss" element={<CoinTossPage />} />
                            <Route path="profile" element={<ProfilePage />} />
                        </Route>

                        {/* Dedicated Standalone Admin Portal (Independent Fullscreen Page) */}
                        <Route path="/admin" element={<AdminPage />} />
                    </Routes>
                </Suspense>
            </ErrorBoundary>
        </AntApp>
    )
}

export default App


