import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { App as AntApp } from 'antd'
import Layout from './components/Layout'

const HomePage = lazy(() => import('./pages/HomePage'))
const loadCrash = () => import('./pages/CrashPage')
const loadPlinko = () => import('./pages/PlinkoPage')
const loadDino = () => import('./pages/DinoPage')
const loadMines = () => import('./pages/MinesPage')

const CrashPage = lazy(loadCrash)
const PlinkoPage = lazy(loadPlinko)
const DinoPage = lazy(loadDino)
const MinesPage = lazy(loadMines)

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
                })
            } else {
                setTimeout(() => {
                    loadCrash()
                    loadPlinko()
                    loadDino()
                    loadMines()
                }, 800)
            }
        }

        schedulePreload()
    }, [])

    return (
        <AntApp>
            <Suspense
                fallback={
                    <div className="route-loading" role="status" aria-live="polite">
                        Loading…
                    </div>
                }
            >
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<HomePage />} />
                        <Route path="crash" element={<CrashPage />} />
                        <Route path="plinko" element={<PlinkoPage />} />
                        <Route path="dino" element={<DinoPage />} />
                        <Route path="mines" element={<MinesPage />} />
                    </Route>
                </Routes>
            </Suspense>
        </AntApp>
    )
}

export default App


