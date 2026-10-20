import { useCallback, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isGamePath } from '../games'
import Header from './Header'
import Sidebar from './Sidebar'
import MobileNavigation from './MobileNavigation'
import AuthModal from './Auth/AuthModal'
import WalletModal from './Wallet/WalletModal'
import DailyWagerRaceModal from './Tournament/DailyWagerRaceModal'
import ProvablyFairVerifierModal from './ProvablyFair/ProvablyFairVerifierModal'
import SEOManager from './SEO/SEOManager'
import Footer from './Footer/Footer'

function Layout() {
    const location = useLocation()
    const { user, token } = useAuth()
    const isGame = isGamePath(location.pathname)
    const showFooter = !isGame
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isRaceOpen, setIsRaceOpen] = useState(false)
    const [isVerifierOpen, setIsVerifierOpen] = useState(false)
    const [verifierInitialData, setVerifierInitialData] = useState(null)

    const mobileMenuButtonRef = useRef(null)
    const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), [])

    const handleOpenVerifier = useCallback((data) => {
        setVerifierInitialData(data || null)
        setIsVerifierOpen(true)
    }, [])

    return (
        <div className="app-layout">
            <SEOManager />
            <Sidebar
                isOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(value => !value)}
            />
            <div className="app-main-wrapper">
                <Header
                    menuOpen={isMobileMenuOpen}
                    menuButtonRef={mobileMenuButtonRef}
                    onMenuClick={() => setIsMobileMenuOpen(true)}
                    onOpenRace={() => setIsRaceOpen(true)}
                    onOpenVerifier={handleOpenVerifier}
                />
                <main className={`main-content ${isGame ? 'main-content-game' : 'main-content-scrollable'}`}>
                    <Outlet />
                    {showFooter && (
                        <Footer
                            onOpenRace={() => setIsRaceOpen(true)}
                            onOpenVerifier={handleOpenVerifier}
                        />
                    )}
                </main>
            </div>
            <MobileNavigation
                drawerOpen={isMobileMenuOpen}
                onClose={closeMobileMenu}
                returnFocusRef={mobileMenuButtonRef}
            />
            <DailyWagerRaceModal
                isOpen={isRaceOpen}
                onClose={() => setIsRaceOpen(false)}
            />
            <ProvablyFairVerifierModal
                isOpen={isVerifierOpen}
                onClose={() => setIsVerifierOpen(false)}
                initialData={verifierInitialData}
            />
            <AuthModal />
            <WalletModal />
        </div>
    )
}

export default Layout
