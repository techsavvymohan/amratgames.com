import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { recordGamePlay } from '../../utils/userGamePreferences'
import './GameAuthGuard.css'

/**
 * GameAuthGuard — Forces players to sign up or log in before playing any game.
 * Displays a premium Casino Gatekeeper overlay and automatically triggers the registration modal.
 */
export function GameAuthGuard({ children, gameName = 'this game' }) {
    const location = useLocation()
    const { user, token, openAuthModal } = useAuth()
    const isAuthenticated = Boolean(user && token)

    useEffect(() => {
        if (location.pathname) {
            recordGamePlay(location.pathname)
        }
    }, [location.pathname])

    useEffect(() => {
        if (!isAuthenticated) {
            // Automatically prompt the registration modal with a brief delay for smooth transition
            const timer = setTimeout(() => {
                openAuthModal('register')
            }, 300)
            return () => clearTimeout(timer)
        }
    }, [isAuthenticated, openAuthModal])

    if (isAuthenticated) {
        return children
    }

    return (
        <div className="amrat-game-gate">
            <div className="amrat-gate-card">
                <img src="/amrat-logo.png" alt="AmratGames" className="amrat-gate-logo" />
                <div className="amrat-gate-badge">AUTHENTICATION REQUIRED</div>
                
                <h1 className="amrat-gate-title">Create Account to Play</h1>
                
                <p className="amrat-gate-desc">
                    Sign up now to unlock <strong>{gameName}</strong> and claim your instant{' '}
                    <span className="amrat-gate-highlight">₹100 Free Welcome Bonus</span>!
                </p>

                <div className="amrat-gate-perks">
                    <div className="gate-perk">
                        <span className="perk-icon">🎁</span>
                        <span>₹100 Instant Welcome Bonus</span>
                    </div>
                    <div className="gate-perk">
                        <span className="perk-icon">⚡</span>
                        <span>Instant UPI & QR Withdrawals</span>
                    </div>
                    <div className="gate-perk">
                        <span className="perk-icon">🛡️</span>
                        <span>100% Provably Fair Gaming</span>
                    </div>
                </div>

                <div className="amrat-gate-actions">
                    <button
                        type="button"
                        className="gate-btn-primary"
                        onClick={() => openAuthModal('register')}
                    >
                        🎁 Create Free Account (Claim ₹100)
                    </button>
                    <button
                        type="button"
                        className="gate-btn-secondary"
                        onClick={() => openAuthModal('login')}
                    >
                        🔑 Already have an account? Sign In
                    </button>
                </div>
            </div>
        </div>
    )
}

export default GameAuthGuard
