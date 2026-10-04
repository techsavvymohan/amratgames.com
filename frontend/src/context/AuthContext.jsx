import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

const TOKEN_KEY = 'amrat_auth_token'
const USER_KEY = 'amrat_auth_user'

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => {
        try {
            return localStorage.getItem(TOKEN_KEY) || null
        } catch {
            return null
        }
    })

    const [user, setUser] = useState(() => {
        try {
            const stored = localStorage.getItem(USER_KEY)
            return stored ? JSON.parse(stored) : null
        } catch {
            return null
        }
    })

    const [isLoading, setIsLoading] = useState(true)
    const [backendOnline, setBackendOnline] = useState(false)

    // Save auth state
    const saveAuth = useCallback((newToken, newUser) => {
        setToken(newToken)
        setUser(newUser)
        try {
            if (newToken) localStorage.setItem(TOKEN_KEY, newToken)
            else localStorage.removeItem(TOKEN_KEY)

            if (newUser) localStorage.setItem(USER_KEY, JSON.stringify(newUser))
            else localStorage.removeItem(USER_KEY)
        } catch (e) {
            console.error('Failed to persist auth state:', e)
        }
    }, [])

    // Check backend health & verify token on mount
    const checkAuthStatus = useCallback(async () => {
        setIsLoading(true)
        try {
            const healthRes = await fetch('/api/health')
            if (healthRes.ok) {
                setBackendOnline(true)

                // If token exists, verify with backend
                if (token) {
                    const meRes = await fetch('/api/auth/me', {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                    if (meRes.ok) {
                        const data = await meRes.json()
                        if (data.success && data.user) {
                            setUser(data.user)
                            localStorage.setItem(USER_KEY, JSON.stringify(data.user))
                        }
                    } else if (meRes.status === 401 || meRes.status === 403) {
                        // Token expired or invalid
                        saveAuth(null, null)
                    }
                }
            } else {
                setBackendOnline(false)
            }
        } catch {
            setBackendOnline(false)
        } finally {
            setIsLoading(false)
        }
    }, [token, saveAuth])

    useEffect(() => {
        checkAuthStatus()
    }, [checkAuthStatus])

    // Modal state for global auth dialog
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
    const [authModalMode, setAuthModalMode] = useState('login') // 'login' | 'otp' | 'register'

    const openAuthModal = useCallback((mode = 'login') => {
        setAuthModalMode(mode)
        setIsAuthModalOpen(true)
    }, [])

    const closeAuthModal = useCallback(() => {
        setIsAuthModalOpen(false)
    }, [])

    // Login with Email OR Phone OR Username + Password
    const login = async (loginId, password) => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login: String(loginId).trim(), password })
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Login failed')
            }
            saveAuth(data.token, data.user)
            setIsAuthModalOpen(false)
            return data.user
        } catch (err) {
            // Standalone Fallback: If backend is offline, support master admin demo login
            if (!backendOnline && (loginId === 'admin' || loginId === 'admin@amratgames.com')) {
                const demoAdmin = {
                    id: 'usr_admin_demo',
                    username: 'amrat_master',
                    email: 'admin@amratgames.com',
                    phone: '9876500001',
                    role: 'admin',
                    status: 'active',
                    balances: { INR: 500000, BTC: 5.5, USDT: 50000, AMRAT: 1000000 },
                    isBanned: false,
                    kycStatus: 'verified'
                }
                saveAuth('demo-admin-jwt-token', demoAdmin)
                setIsAuthModalOpen(false)
                return demoAdmin
            }
            throw err
        }
    }

    // Send Verification OTP to Mobile Number or Email
    const sendOtp = async (identifier, channel = 'sms') => {
        try {
            const res = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: String(identifier).trim(), channel })
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to dispatch OTP')
            }
            return data
        } catch (err) {
            if (!backendOnline) {
                // Offline QA demo fallback
                return {
                    success: true,
                    message: `Offline mode: Use verification OTP 777777`,
                    devOtp: '777777',
                    demoBypassCode: '777777'
                }
            }
            throw err
        }
    }

    // Verify OTP & Fast Login / Auto-Provision Account
    const verifyOtp = async (identifier, otp, username) => {
        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identifier: String(identifier).trim(),
                    otp: String(otp).trim(),
                    username: username ? String(username).trim() : undefined
                })
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'OTP verification failed')
            }
            saveAuth(data.token, data.user)
            setIsAuthModalOpen(false)
            return data
        } catch (err) {
            if (!backendOnline && otp === '777777') {
                const demoUser = {
                    id: 'usr_otp_demo',
                    username: username || 'Player_' + String(identifier).slice(-4),
                    email: identifier.includes('@') ? identifier : undefined,
                    phone: !identifier.includes('@') ? identifier : undefined,
                    role: 'player',
                    status: 'active',
                    balances: { INR: 10000, BTC: 0.1, USDT: 100, AMRAT: 500 },
                    isBanned: false,
                    kycStatus: 'verified'
                }
                saveAuth('demo-otp-token', demoUser)
                setIsAuthModalOpen(false)
                return { success: true, user: demoUser, isNewUser: true }
            }
            throw err
        }
    }

    // Register with Username, Email, Phone, Password & optional OTP
    const register = async ({ username, email, phone, password, otp }) => {
        const payload = {
            username: username ? String(username).trim() : '',
            password
        }
        if (email) payload.email = String(email).trim()
        if (phone) payload.phone = String(phone).trim()
        if (otp) payload.otp = String(otp).trim()

        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Registration failed')
        }
        saveAuth(data.token, data.user)
        setIsAuthModalOpen(false)
        return data.user
    }

    // Quick Admin Sign In
    const quickAdminLogin = async () => {
        try {
            const res = await fetch('/api/auth/quick-admin-login', { method: 'POST' })
            const data = await res.json()
            if (res.ok && data.success) {
                saveAuth(data.token, data.user)
                setIsAuthModalOpen(false)
                return data.user
            }
            throw new Error(data.error || 'Failed to authenticate')
        } catch {
            const demoAdmin = {
                id: 'usr_admin_demo',
                username: 'amrat_master',
                email: 'admin@amratgames.com',
                phone: '9876500001',
                role: 'admin',
                status: 'active',
                balances: { INR: 500000, BTC: 5.5, USDT: 50000, AMRAT: 1000000 },
                isBanned: false,
                kycStatus: 'verified'
            }
            saveAuth('demo-admin-jwt-token', demoAdmin)
            setIsAuthModalOpen(false)
            return demoAdmin
        }
    }

    // Quick VIP Player Demo Login
    const quickPlayerLogin = async (username = 'aarav_king') => {
        try {
            const res = await fetch('/api/auth/quick-demo-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            })
            const data = await res.json()
            if (res.ok && data.success) {
                saveAuth(data.token, data.user)
                setIsAuthModalOpen(false)
                return data.user
            }
            throw new Error(data.error || 'Failed demo login')
        } catch {
            // Standalone fallback
            const demoPlayer = {
                id: 'usr_play_101',
                username: 'aarav_king',
                email: 'aarav.royal@gmail.com',
                phone: '9876510101',
                role: 'player',
                status: 'active',
                balances: { INR: 85400, BTC: 0.12, USDT: 1250, AMRAT: 45000 },
                isBanned: false,
                kycStatus: 'verified'
            }
            saveAuth('demo-player-token', demoPlayer)
            setIsAuthModalOpen(false)
            return demoPlayer
        }
    }

    // Logout
    const logout = () => {
        saveAuth(null, null)
    }

    const value = {
        user,
        token,
        isAdmin: user?.role === 'admin',
        isLoading,
        backendOnline,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        setAuthModalMode,
        login,
        sendOtp,
        verifyOtp,
        register,
        quickAdminLogin,
        quickPlayerLogin,
        logout,
        checkAuthStatus,
        saveAuth
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

export default AuthContext
