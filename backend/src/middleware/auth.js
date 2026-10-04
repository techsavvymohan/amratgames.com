import jwt from 'jsonwebtoken'
import { CONFIG } from '../config.js'
import { db } from '../db/db.js'

export function authenticate(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null
        return next()
    }

    const token = authHeader.split(' ')[1]
    try {
        const decoded = jwt.verify(token, CONFIG.JWT_SECRET)
        const user = db.findUserById(decoded.id)
        if (!user || user.isBanned) {
            req.user = null
            return next()
        }
        req.user = user
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
