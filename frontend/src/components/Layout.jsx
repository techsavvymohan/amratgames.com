import { useCallback, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import MobileNavigation from './MobileNavigation'
import AuthModal from './Auth/AuthModal'
import WalletModal from './Wallet/WalletModal'
import ChatDrawer from './Chat/ChatDrawer'
import DailyWagerRaceModal from './Tournament/DailyWagerRaceModal'
import ProvablyFairVerifierModal from './ProvablyFair/ProvablyFairVerifierModal'

function Layout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isChatOpen, setIsChatOpen] = useState(false)
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
            <Sidebar
                isOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(value => !value)}
            />
            <div className="app-main-wrapper">
                <Header
                    menuOpen={isMobileMenuOpen}
                    menuButtonRef={mobileMenuButtonRef}
                    onMenuClick={() => setIsMobileMenuOpen(true)}
                    onToggleChat={() => setIsChatOpen((o) => !o)}
                    isChatOpen={isChatOpen}
                    onOpenRace={() => setIsRaceOpen(true)}
                    onOpenVerifier={handleOpenVerifier}
                />
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
            <MobileNavigation
                drawerOpen={isMobileMenuOpen}
                onClose={closeMobileMenu}
                returnFocusRef={mobileMenuButtonRef}
            />
            <ChatDrawer
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                onOpenVerifier={handleOpenVerifier}
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
