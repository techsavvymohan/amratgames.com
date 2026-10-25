import jwt from 'jsonwebtoken'
import { CONFIG } from '../config.js'
import { db } from '../db/db.js'
import { antiFraudService } from '../services/AntiFraudService.js'

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

        // Track IP and session fingerprint for anti-sybil & cashier protection
        try {
            antiFraudService.trackSession(user.id, {
                ip: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
                userAgent: req.headers['user-agent'] || '',
                fingerprint: req.headers['x-device-fingerprint'] || ''
            })
        } catch {}

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

/**
 * Guards observer bank telemetry ingest (SMS/Email) and verification pipeline.
 * Accepts:
 *  - Observer API token (X-Observer-Token or Bearer)
 *  - Master Admin Key (X-API-Key, X-Admin-Key, or Bearer)
 *  - Authenticated admin JWT session
 */
export function requireObserverOrAdmin(req, res, next) {
    const observerToken = process.env.YOUPI_OBSERVER_API_TOKEN || 'youpi_observer_internal_token_2025'
    const adminKey = CONFIG.ADMIN_API_KEY || 'amrat_internal_secret_admin_key_2025'

    const headerObserver = req.headers['x-observer-token']
    const headerAdmin = req.headers['x-api-key'] || req.headers['x-admin-key']
    const authHeader = req.headers['authorization'] || ''
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

    if (headerObserver && (headerObserver === observerToken || headerObserver === adminKey)) {
        return next()
    }
    if (headerAdmin && headerAdmin === adminKey) {
        return next()
    }
    if (bearer && (bearer === observerToken || bearer === adminKey)) {
        return next()
    }
    if (req.user && req.user.role === 'admin') {
        return next()
    }

    return res.status(401).json({
        success: false,
        error: 'Unauthorized: observer or administrator credentials required.'
    })
}
