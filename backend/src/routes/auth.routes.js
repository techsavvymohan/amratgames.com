import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db, normalizePhone } from '../db/db.js'
import { CONFIG } from '../config.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            email: user.email || '',
            phone: user.phone || '',
            role: user.role
        },
        CONFIG.JWT_SECRET,
        { expiresIn: CONFIG.JWT_EXPIRES_IN }
    )
}

function sanitizeUser(user) {
    const { passwordHash, ...safeUser } = user
    return safeUser
}

// ── 1. Password Login (Email, Phone, or Username) ──────────
// POST /api/auth/login
router.post('/login', (req, res) => {
    try {
        const { login, password } = req.body
        if (!login || !password) {
            return res.status(400).json({ success: false, error: 'Email / Phone / Username and password are required' })
        }

        const user = db.findUserByLogin(login)
        if (!user) {
            return res.status(401).json({ success: false, error: 'No account found with this email, phone, or username' })
        }

        if (user.isBanned) {
            return res.status(403).json({ success: false, error: 'Account has been suspended. Please contact support.' })
        }

        const valid = bcrypt.compareSync(password, user.passwordHash)
        if (!valid) {
            return res.status(401).json({ success: false, error: 'Invalid password. Please check your credentials.' })
        }

        // Update last login
        db.updateUser(user.id, { lastLoginAt: new Date().toISOString() })

        const token = generateToken(user)
        res.json({
            success: true,
            token,
            user: sanitizeUser(user),
            message: `Welcome back, ${user.username}!`
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// ── 2. Request OTP (SMS or Email) ──────────────────────────
// POST /api/auth/send-otp
router.post('/send-otp', (req, res) => {
    try {
        const { identifier, channel } = req.body
        if (!identifier) {
            return res.status(400).json({ success: false, error: 'Phone number or email is required' })
        }

        const cleanId = String(identifier).trim()
        const isEmail = cleanId.includes('@')
        const normalizedPhone = normalizePhone(cleanId)

        if (!isEmail && (!normalizedPhone || normalizedPhone.length < 10)) {
            return res.status(400).json({ success: false, error: 'Please enter a valid 10-digit mobile number or email address' })
        }

        const target = isEmail ? cleanId.toLowerCase() : normalizedPhone
        const { otp, expiresAt } = db.generateOtp(target)

        res.json({
            success: true,
            message: `Verification OTP dispatched to ${isEmail ? cleanId : '+91 ' + normalizedPhone}`,
            target,
            expiresAt,
            // Exposed for automated QA & local demo testing without paid SMS gateway
            devOtp: otp,
            demoBypassCode: '777777'
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// ── 3. Verify OTP & Fast Login / Register ──────────────────
// POST /api/auth/verify-otp
router.post('/verify-otp', (req, res) => {
    try {
        const { identifier, otp, username } = req.body
        if (!identifier || !otp) {
            return res.status(400).json({ success: false, error: 'Phone/Email and OTP code are required' })
        }

        const cleanId = String(identifier).trim()
        const isEmail = cleanId.includes('@')
        const target = isEmail ? cleanId.toLowerCase() : normalizePhone(cleanId)

        const isValid = db.verifyOtp(target, otp)
        if (!isValid) {
            return res.status(400).json({ success: false, error: 'Invalid or expired OTP. Please try again or use 777777.' })
        }

        // Check if user already exists
        let user = db.findUserByLogin(target)
        let isNewUser = false

        if (user) {
            if (user.isBanned) {
                return res.status(403).json({ success: false, error: 'Account has been suspended. Please contact support.' })
            }

            // Mark verified
            const updates = { lastLoginAt: new Date().toISOString() }
            if (isEmail) updates.emailVerified = true
            else updates.phoneVerified = true

            user = db.updateUser(user.id, updates)
        } else {
            // Auto-provision new player account
            isNewUser = true
            const autoUsername = username && username.trim()
                ? username.trim()
                : (isEmail ? cleanId.split('@')[0] : `Player_${target.slice(-4)}`)

            // Ensure unique username
            let finalUsername = autoUsername
            let counter = 1
            while (db.findUserByUsername(finalUsername)) {
                finalUsername = `${autoUsername}_${counter++}`
            }

            const defaultPassword = 'OtpUser' + Math.random().toString(36).slice(2, 8)
            const passwordHash = bcrypt.hashSync(defaultPassword, 10)

            user = db.createUser({
                username: finalUsername,
                email: isEmail ? cleanId : `${finalUsername}@player.amratgames.com`,
                phone: !isEmail ? target : '',
                phoneVerified: !isEmail,
                emailVerified: isEmail,
                passwordHash,
                role: 'player'
            })
        }

        const token = generateToken(user)
        res.json({
            success: true,
            token,
            user: sanitizeUser(user),
            isNewUser,
            message: isNewUser
                ? `Welcome to AmratGames, ${user.username}! ₹10,000 + 500 $AMRAT welcome bonus credited!`
                : `Welcome back, ${user.username}!`
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// ── 4. Standard Registration with Validation ──────────────
// POST /api/auth/register
router.post('/register', (req, res) => {
    try {
        const { username, email, phone, password, otp } = req.body

        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password are required' })
        }

        if (!email && !phone) {
            return res.status(400).json({ success: false, error: 'Either email or mobile number is required' })
        }

        if (username.length < 3) {
            return res.status(400).json({ success: false, error: 'Username must be at least 3 characters' })
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' })
        }

        if (db.findUserByUsername(username)) {
            return res.status(400).json({ success: false, error: 'Username is already taken' })
        }

        let cleanEmail = ''
        if (email) {
            cleanEmail = email.trim().toLowerCase()
            if (db.findUserByEmail(cleanEmail)) {
                return res.status(400).json({ success: false, error: 'Email is already registered' })
            }
        }

        let cleanPhone = ''
        if (phone) {
            cleanPhone = normalizePhone(phone)
            if (cleanPhone.length < 10) {
                return res.status(400).json({ success: false, error: 'Please enter a valid 10-digit mobile number' })
            }
            if (db.findUserByPhone(cleanPhone)) {
                return res.status(400).json({ success: false, error: 'Mobile number is already registered' })
            }
        }

        // Optional OTP verification check if OTP was supplied
        if (otp) {
            const idToCheck = cleanPhone || cleanEmail
            if (!db.verifyOtp(idToCheck, otp)) {
                return res.status(400).json({ success: false, error: 'Invalid or expired OTP verification code' })
            }
        }

        const passwordHash = bcrypt.hashSync(password, 10)
        const newUser = db.createUser({
            username: username.trim(),
            email: cleanEmail || `${username.trim()}@player.amratgames.com`,
            phone: cleanPhone,
            phoneVerified: Boolean(cleanPhone && otp),
            emailVerified: Boolean(cleanEmail && otp),
            passwordHash,
            role: 'player'
        })

        const token = generateToken(newUser)
        res.status(201).json({
            success: true,
            token,
            user: sanitizeUser(newUser),
            message: 'Registration successful! ₹10,000 + 500 $AMRAT welcome bonus credited.'
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// ── 5. Current Authenticated User ──────────────────────────
// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
    res.json({
        success: true,
        user: sanitizeUser(req.user)
    })
})

// ── 6. Instant Demo / Test Sign-In ─────────────────────────
// POST /api/auth/quick-demo-login
router.post('/quick-demo-login', (req, res) => {
    try {
        const { role = 'player', username = 'aarav_king' } = req.body

        let targetUser = null
        if (role === 'admin') {
            targetUser = db.data.users.find(u => u.role === 'admin')
        } else {
            targetUser = db.findUserByUsername(username) || db.data.users.find(u => u.role === 'player' && !u.isBanned)
        }

        if (!targetUser) {
            return res.status(404).json({ success: false, error: 'Target demo account not found' })
        }

        db.updateUser(targetUser.id, { lastLoginAt: new Date().toISOString() })
        const token = generateToken(targetUser)

        res.json({
            success: true,
            token,
            user: sanitizeUser(targetUser),
            message: `Authenticated as ${targetUser.username} (${targetUser.role})`
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// Backwards compatibility endpoint for admin login
router.post('/quick-admin-login', (req, res) => {
    try {
        const adminUser = db.data.users.find(u => u.role === 'admin')
        if (!adminUser) return res.status(404).json({ success: false, error: 'Admin account not found' })
        db.updateUser(adminUser.id, { lastLoginAt: new Date().toISOString() })
        const token = generateToken(adminUser)
        res.json({ success: true, token, user: sanitizeUser(adminUser), message: 'Logged in as Master Administrator' })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

export default router
