import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { App as AntApp } from 'antd'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import GameAuthGuard from './components/Auth/GameAuthGuard'
import { useWallet } from './context/WalletContext'

function CashierRoute({ defaultTab = 'deposit' }) {
    const { openWalletModal } = useWallet()
    useEffect(() => {
        openWalletModal(defaultTab)
    }, [openWalletModal, defaultTab])
    return <HomePage />
}

// Automatic recovery from Vite dynamic import chunk hash mismatches after deployments
function lazyWithRetry(componentImport) {
    return lazy(async () => {
        const pageKey = 'chunk_retry_' + (typeof window !== 'undefined' ? window.location.pathname : '')
        const hasRetried = typeof window !== 'undefined' ? window.sessionStorage.getItem(pageKey) : null

        try {
            const component = await componentImport()
            if (typeof window !== 'undefined') window.sessionStorage.removeItem(pageKey)
            return component
        } catch (error) {
            console.error('[Dynamic Import Failed]', error)
            const isChunkError = /failed to fetch dynamically imported module|importing a module script failed|loading chunk|chunkloaderror/i.test(
                error?.message || ''
            )

            if (!hasRetried && isChunkError && typeof window !== 'undefined') {
                window.sessionStorage.setItem(pageKey, 'true')
                window.location.reload()
                return new Promise(() => {}) // suspend while reloading
            }

            if (typeof window !== 'undefined') window.sessionStorage.removeItem(pageKey)
            throw error
        }
    })
}

const HomePage = lazyWithRetry(() => import('./pages/HomePage'))
const loadCrash = () => import('./games/crash')
const loadPlinko = () => import('./games/plinko')
const loadMines = () => import('./games/mines')
const loadLimbo = () => import('./games/limbo')
const loadDragonTiger = () => import('./games/dragon-tiger')
const loadColorMatch = () => import('./games/color-match')
const loadCoinToss = () => import('./games/coin-toss')
const loadAdmin = () => import('./admin-panel')

const CrashPage = lazyWithRetry(loadCrash)
const PlinkoPage = lazyWithRetry(loadPlinko)
const MinesPage = lazyWithRetry(loadMines)
const LimboPage = lazyWithRetry(loadLimbo)
const DragonTigerPage = lazyWithRetry(loadDragonTiger)
const ColorMatchPage = lazyWithRetry(loadColorMatch)
const CoinTossPage = lazyWithRetry(loadCoinToss)
const AdminPage = lazyWithRetry(loadAdmin)
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'))
const FavouritesPage = lazyWithRetry(() => import('./pages/FavouritesPage'))
const RecentPage = lazyWithRetry(() => import('./pages/RecentPage'))
const ChallengesPage = lazyWithRetry(() => import('./pages/ChallengesPage'))
const MyBetsPage = lazyWithRetry(() => import('./pages/MyBetsPage'))
const ProvablyFairPage = lazyWithRetry(() => import('./pages/ProvablyFairPage'))
const ResponsibleGamblingPage = lazyWithRetry(() => import('./pages/ResponsibleGamblingPage'))
const TermsPage = lazyWithRetry(() => import('./pages/TermsPage'))
const PrivacyPage = lazyWithRetry(() => import('./pages/PrivacyPage'))
const CrashStrategyPage = lazyWithRetry(() => import('./pages/CrashStrategyPage'))
const PlinkoOddsPage = lazyWithRetry(() => import('./pages/PlinkoOddsPage'))
const UpiWithdrawalsGuidePage = lazyWithRetry(() => import('./pages/UpiWithdrawalsGuidePage'))
const VipRewardsPage = lazyWithRetry(() => import('./pages/VipRewardsPage'))

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
                            <Route path="crash" element={<GameAuthGuard gameName="Aviator"><CrashPage /></GameAuthGuard>} />
                            <Route path="aviator" element={<GameAuthGuard gameName="Aviator"><CrashPage /></GameAuthGuard>} />
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
                            <Route path="provably-fair" element={<ProvablyFairPage />} />
                            <Route path="responsible-gambling" element={<ResponsibleGamblingPage />} />
                            <Route path="terms" element={<TermsPage />} />
                            <Route path="privacy" element={<PrivacyPage />} />
                            <Route path="guides/crash-strategy" element={<CrashStrategyPage />} />
                            <Route path="guides/plinko-odds" element={<PlinkoOddsPage />} />
                            <Route path="payments/instant-upi-withdrawals" element={<UpiWithdrawalsGuidePage />} />
                            <Route path="vip-rewards" element={<VipRewardsPage />} />
                            <Route path="deposit" element={<CashierRoute defaultTab="deposit" />} />
                            <Route path="withdraw" element={<CashierRoute defaultTab="withdraw" />} />
                            <Route path="wallet" element={<CashierRoute defaultTab="deposit" />} />
                            <Route path="cashier" element={<CashierRoute defaultTab="deposit" />} />

                            {/* Game Route Aliases & Permalinks */}
                            <Route path="games/crash" element={<Navigate to="/crash" replace />} />
                            <Route path="games/aviator" element={<Navigate to="/aviator" replace />} />
                            <Route path="games/plinko" element={<Navigate to="/plinko" replace />} />
                            <Route path="games/mines" element={<Navigate to="/mines" replace />} />
                            <Route path="games/limbo" element={<Navigate to="/limbo" replace />} />
                            <Route path="games/dragon-tiger" element={<Navigate to="/dragon-tiger" replace />} />
                            <Route path="games/color-match" element={<Navigate to="/color-match" replace />} />
                            <Route path="games/coin-toss" element={<Navigate to="/coin-toss" replace />} />
                            <Route path="wingo" element={<Navigate to="/color-match" replace />} />
                            <Route path="games/wingo" element={<Navigate to="/color-match" replace />} />
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


