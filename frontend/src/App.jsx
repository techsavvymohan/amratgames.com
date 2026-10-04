import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { App as AntApp } from 'antd'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'

const HomePage = lazy(() => import('./pages/HomePage'))
const loadCrash = () => import('./pages/CrashPage')
const loadPlinko = () => import('./pages/PlinkoPage')
const loadDino = () => import('./pages/DinoPage')
const loadMines = () => import('./pages/MinesPage')
const loadLimbo = () => import('./pages/LimboPage')
const loadDragonTiger = () => import('./pages/DragonTigerPage')
const loadColorMatch = () => import('./pages/ColorMatchPage')
const loadAdmin = () => import('./admin-panel')

const CrashPage = lazy(loadCrash)
const PlinkoPage = lazy(loadPlinko)
const DinoPage = lazy(loadDino)
const MinesPage = lazy(loadMines)
const LimboPage = lazy(loadLimbo)
const DragonTigerPage = lazy(loadDragonTiger)
const ColorMatchPage = lazy(loadColorMatch)
const AdminPage = lazy(loadAdmin)

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
                }, 800)
            }
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


