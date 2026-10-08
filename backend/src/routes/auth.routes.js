import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db, normalizePhone } from '../db/db.js'
import { CONFIG } from '../config.js'
import { requireAuth, revokeToken } from '../middleware/auth.js'
import { emailService } from '../services/EmailService.js'
import { loginRateLimiter, otpRateLimiter, registerRateLimiter } from '../middleware/rateLimiter.js'

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
router.post('/login', loginRateLimiter, (req, res) => {
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
router.post('/send-otp', otpRateLimiter, (req, res) => {
    try {
        const { identifier, channel } = req.body
        if (!identifier) {
            return res.status(400).json({ success: false, error: 'Phone number or email is required' })
        }

        const cleanId = String(identifier).trim()
        const isEmail = cleanId.includes('@')
        const normalizedPhone = normalizePhone(cleanId)

        if (!isEmail && (!normalizedPhone || normalizedPhone.length < 10)) {
            return res.status(400).json({ success: false, error: 'Invalid mobile number or email' })
        }

        const target = isEmail ? cleanId.toLowerCase() : normalizedPhone
        const { otp, expiresAt } = db.generateOtp(target)

        // Dispatch real email via support@amratgames.com if recipient is an email address
        if (isEmail) {
            const user = db.findUserByLogin(target)
            emailService.sendOtpEmail({
                to: target,
                otp,
                username: user?.username || 'Player'
            }).catch(e => {
                console.warn('[AUTH] Notice sending OTP email:', e.message)
            })
        }

        res.json({
            success: true,
            message: `OTP sent to ${isEmail ? cleanId : '+91 ' + normalizedPhone}`,
            target,
            expiresAt
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
            return res.status(400).json({ success: false, error: 'Phone/email and OTP are required' })
        }

        const cleanId = String(identifier).trim()
        const isEmail = cleanId.includes('@')
        const target = isEmail ? cleanId.toLowerCase() : normalizePhone(cleanId)

        const isValid = db.verifyOtp(target, otp)
        if (!isValid) {
            return res.status(400).json({ success: false, error: 'Invalid or expired OTP' })
        }

        // Check if user already exists
        let user = db.findUserByLogin(target)
        let isNewUser = false

        if (user) {
            if (user.isBanned) {
                return res.status(403).json({ success: false, error: 'Account suspended. Contact support.' })
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
                ? `🎉 Welcome, ${user.username}! ₹100 Welcome Bonus has been credited to your wallet!`
                : `Welcome back, ${user.username}!`
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// ── 4. Standard Registration with Validation ──────────────
// POST /api/auth/register
router.post('/register', registerRateLimiter, (req, res) => {
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

        // Enforce mandatory OTP verification to prevent bot registration & bonus farming
        if (!otp) {
            return res.status(400).json({ success: false, error: 'OTP verification is required to complete registration' })
        }
        const idToCheck = cleanPhone || cleanEmail
        if (!db.verifyOtp(idToCheck, otp)) {
            return res.status(400).json({ success: false, error: 'Invalid or expired OTP verification code' })
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
            message: '🎉 Registration successful! ₹100 Welcome Bonus has been credited to your wallet!'
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

// ── 5B. Player Profile & KYC Verification ─────────────────
// GET /api/auth/profile
router.get('/profile', requireAuth, (req, res) => {
    res.json({
        success: true,
        profile: sanitizeUser(req.user)
    })
})

// PUT /api/auth/profile
router.put('/profile', requireAuth, (req, res) => {
    try {
        const { firstName, lastName, dob, gender, country, city, newsletter } = req.body
        const updates = {}
        if (firstName !== undefined) updates.firstName = String(firstName).trim()
        if (lastName !== undefined) updates.lastName = String(lastName).trim()
        if (dob !== undefined) updates.dob = dob
        if (gender !== undefined) updates.gender = String(gender).trim()
        if (country !== undefined) updates.country = String(country).trim()
        if (city !== undefined) updates.city = String(city).trim()
        if (newsletter !== undefined) updates.newsletter = Boolean(newsletter)

        const updated = db.updateUser(req.user.id, updates)
        res.json({
            success: true,
            user: sanitizeUser(updated),
            message: 'Profile data updated successfully!'
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/auth/change-password
router.post('/change-password', requireAuth, (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ success: false, error: 'Current password and new password are required' })
        }
        if (String(newPassword).length < 6) {
            return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' })
        }

        const valid = bcrypt.compareSync(oldPassword, req.user.passwordHash)
        if (!valid) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' })
        }

        const salt = bcrypt.genSaltSync(10)
        const passwordHash = bcrypt.hashSync(newPassword, salt)
        db.updateUser(req.user.id, { passwordHash })

        res.json({
            success: true,
            message: 'Password changed successfully!'
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/auth/verify-profile (KYC Verification)
router.post('/verify-profile', requireAuth, (req, res) => {
    try {
        const { documentType, documentNumber, fullName } = req.body
        if (!documentType || !documentNumber) {
            return res.status(400).json({ success: false, error: 'Document type and document number are required' })
        }

        const updates = {
            kycStatus: 'pending_review',
            kycDocumentType: String(documentType).toUpperCase(),
            kycDocumentNumber: String(documentNumber).trim(),
            kycSubmittedAt: new Date().toISOString()
        }
        if (fullName) {
            const parts = fullName.trim().split(' ')
            updates.firstName = parts[0] || req.user.firstName || ''
            if (parts.length > 1) updates.lastName = parts.slice(1).join(' ')
        }

        const updated = db.updateUser(req.user.id, updates)
        res.json({
            success: true,
            user: sanitizeUser(updated),
            message: '📋 KYC documents submitted successfully! Your account is currently under review by compliance.'
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// GET /api/auth/bets-history
router.get('/bets-history', requireAuth, (req, res) => {
    try {
        const bets = db.getUserBets(req.user.id, 50)
        res.json({
            success: true,
            bets
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// GET /api/auth/payments-history
router.get('/payments-history', requireAuth, (req, res) => {
    try {
        const transactions = db.getUserTransactions(req.user.id, 50)
        const withdrawals = db.getAllWithdrawals({ userId: req.user.id })
        res.json({
            success: true,
            transactions,
            withdrawals
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// ── 6. Contact & Support Inquiry Route ────────────────────
// POST /api/auth/contact
router.post('/contact', async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body
        if (!name || !email || !message) {
            return res.status(400).json({ success: false, error: 'Name, email, and message are required' })
        }

        const result = await emailService.sendContactInquiry({ name, email, phone, subject, message })
        res.json({
            success: true,
            ticketId: result.ticketId,
            message: `Thank you! Your message has been sent to ${CONFIG.SUPPORT_EMAIL}. We will respond within 24 hours.`
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// GET /api/auth/support-info
router.get('/support-info', (req, res) => {
    res.json({
        success: true,
        email: CONFIG.SUPPORT_EMAIL,
        supportEmail: CONFIG.SUPPORT_EMAIL,
        telegram: '@AmratGamesSupport',
        hours: '24/7/365 Live Player Support',
        expectedResponseTime: '< 2 hours',
        smtpActive: emailService.isSmtpConfigured()
    })
})

// ── 7. Secure Session Logout (Token Revocation) ──────────
// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
    try {
        if (req.token) {
            revokeToken(req.token)
        }
        res.json({ success: true, message: 'Logged out successfully. Session invalidated.' })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

export default router
