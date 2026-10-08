import jwt from 'jsonwebtoken'
import { CONFIG } from '../config.js'
import { db } from '../db/db.js'

// In-memory token revocation blacklist (with automatic cleanup)
const revokedTokens = new Map() // token -> expiryTimestamp

export function revokeToken(token) {
    if (!token) return
    try {
        const decoded = jwt.decode(token)
        const exp = decoded?.exp ? decoded.exp * 1000 : Date.now() + 7 * 24 * 3600 * 1000
        revokedTokens.set(token, exp)
    } catch {
        revokedTokens.set(token, Date.now() + 3600000)
    }
}

export function isTokenRevoked(token) {
    if (!token) return false
    const exp = revokedTokens.get(token)
    if (!exp) return false
    if (Date.now() > exp) {
        revokedTokens.delete(token)
        return false
    }
    return true
}

// Clean up expired revoked tokens every 15 minutes
setInterval(() => {
    const now = Date.now()
    for (const [t, exp] of revokedTokens.entries()) {
        if (now > exp) revokedTokens.delete(t)
    }
}, 15 * 60 * 1000).unref?.()

export function authenticate(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null
        return next()
    }

    const token = authHeader.split(' ')[1]
    if (isTokenRevoked(token)) {
        req.user = null
        return next()
    }

    try {
        const decoded = jwt.verify(token, CONFIG.JWT_SECRET)
        const user = db.findUserById(decoded.id)
        if (!user || user.isBanned) {
            req.user = null
            return next()
        }
        req.user = user
        req.token = token
        next()
    } catch (err) {
        req.user = null
        next()
    }
}

export function requireAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required. Please log in.'
        })
    }
    if (req.user.isBanned) {
        return res.status(403).json({
            success: false,
            error: 'Account suspended. Contact support.'
        })
    }
    next()
}

export function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required.'
        })
    }
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Access denied. Administrator privileges required.'
        })
    }
    next()
}
