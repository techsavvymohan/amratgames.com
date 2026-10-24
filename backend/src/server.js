import http from 'node:http'
import express from 'express'
import cors from 'cors'
import compression from 'compression'
import { CONFIG, validateConfig, logConfigSummary } from './config.js'
import { authenticate } from './middleware/auth.js'
import { initWebSocketServer, broadcastEvent } from './websocket.js'
import { db } from './db/db.js'
import { testSupabaseConnection } from './db/SupabaseClient.js'
import { emailService } from './services/EmailService.js'
import { redisCache } from './services/RedisCacheService.js'
import { floorActivityEngine } from './services/FloorActivityEngine.js'
import { globalApiLimiter } from './middleware/rateLimiter.js'

import authRoutes from './routes/auth.routes.js'
import adminPanelModule from './admin-panel/index.js'
import walletRoutes from './routes/wallet.routes.js'
import gamesRoutes from './routes/games.routes.js'
import affiliateRoutes from './routes/affiliate.routes.js'
import vipRoutes from './routes/vip.routes.js'
import communityRoutes from './routes/community.routes.js'
import pvpRoutes from './routes/pvp.routes.js'
import vaultRoutes from './routes/vault.routes.js'
import gatewayRoutes from './routes/gateway.routes.js'
import { checkPlatformMaintenance } from './middleware/circuitBreaker.js'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)

const server = http.createServer(app)
server.keepAliveTimeout = 65000
server.headersTimeout = 66000

// Initialize WebSockets
initWebSocketServer(server)

// High-Performance Middleware
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false
        return compression.filter(req, res)
    }
}))
const defaultAllowedOrigins = [
    'https://amratgames.com',
    'http://amratgames.com',
    'https://www.amratgames.com',
    'http://www.amratgames.com',
    'https://admin.amratgames.com',
    'http://admin.amratgames.com',
    'http://103.216.168.84',
    'https://103.216.168.84',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:3001'
]

function isOriginAllowed(origin) {
    if (!origin) return true
    if (!CONFIG.isProduction) return true

    const configuredOrigins = Array.isArray(CONFIG.CORS_ORIGIN)
        ? CONFIG.CORS_ORIGIN
        : (CONFIG.CORS_ORIGIN && CONFIG.CORS_ORIGIN !== '*'
            ? (CONFIG.CORS_ORIGIN.includes(',') ? CONFIG.CORS_ORIGIN.split(',').map(s => s.trim()) : [CONFIG.CORS_ORIGIN])
            : [])

    if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) {
        return true
    }

    if (defaultAllowedOrigins.includes(origin)) {
        return true
    }

    try {
        const parsed = new URL(origin)
        const hostname = parsed.hostname.toLowerCase()
        if (
            hostname === 'amratgames.com' ||
            hostname.endsWith('.amratgames.com') ||
            hostname === '103.216.168.84' ||
            hostname === 'localhost' ||
            hostname === '127.0.0.1'
        ) {
            return true
        }
    } catch {
        return false
    }

    return false
}

app.use(cors({
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
            return callback(null, true)
        }
        const corsErr = new Error(`Origin ${origin} blocked by CORS security policy`)
        corsErr.status = 403
        corsErr.code = 'CORS_FORBIDDEN'
        return callback(corsErr)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Signature', 'Webhook-Signature', 'X-Signature', 'X-Device-Fingerprint']
}))
app.use(express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
        req.rawBody = buf
    }
}))
app.use(authenticate)

// ── Resilience & Anti-DoS: Request Timeout (15s) and Global Rate Limiter ──
function requestTimeout(seconds = 15) {
    return (req, res, next) => {
        if (req.headers.upgrade === 'websocket') return next()
        const timer = setTimeout(() => {
            if (!res.headersSent) {
                res.status(504).json({
                    success: false,
                    error: 'Gateway Timeout: Request processing took too long under high load. Please retry.',
                    code: 'GATEWAY_TIMEOUT'
                })
            }
        }, seconds * 1000)
        if (timer.unref) timer.unref()
        res.on('finish', () => clearTimeout(timer))
        res.on('close', () => clearTimeout(timer))
        next()
    }
}
app.use('/api', requestTimeout(15), globalApiLimiter)

// Fast Health Check (Cached in Redis for 3s to handle high-frequency LB probes)
app.get('/api/health', async (req, res) => {
    try {
        const payload = await redisCache.getOrSet('platform:health', 3, async () => {
            return {
                status: 'online',
                platform: 'AmratGames.com Gaming & Casino Engine',
                version: '2.0.0',
                rtp: db.data.settings?.rtp || 98,
                serverTime: new Date().toISOString(),
                activePlayers: db.data.users ? db.data.users.filter(u => !u.isBanned).length : 0,
                tokenTreasuryRemaining: db.data.settings?.tokenTreasury?.treasuryBalance || 0,
                database: CONFIG.USE_SUPABASE ? 'Supabase (PostgreSQL)' : 'Local JSON DB'
            }
        })
        res.json(payload)
    } catch {
        res.json({
            status: 'online',
            platform: 'AmratGames.com Gaming & Casino Engine',
            version: '2.0.0',
            serverTime: new Date().toISOString()
        })
    }
})

// Supabase Connection Health Check
app.get('/api/health/supabase', async (req, res) => {
    const status = await testSupabaseConnection()
    res.json({
        success: status.ok,
        ...status
    })
})

// Spacemail SMTP Connection Health Check
app.get('/api/health/smtp', async (req, res) => {
    const status = await emailService.verifyConnection()
    res.json({
        success: status.ok,
        ...status
    })
})

// Mount API routes (with Emergency Circuit Breaker protection)
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminPanelModule.getRouter())
app.use('/api/wallet', checkPlatformMaintenance, walletRoutes)
app.use('/api/games', checkPlatformMaintenance, gamesRoutes)
app.use('/api/pvp', checkPlatformMaintenance, pvpRoutes)
app.use('/api/affiliate', affiliateRoutes)
app.use('/api/vault', vaultRoutes)
app.use('/api/vip', vipRoutes)
app.use('/api/community', communityRoutes)
app.use('/api/gateway', gatewayRoutes)

// 404 handler
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found on AmratGames API' })
})

// Central error handler
app.use((err, req, res, next) => {
    console.error('[API ERROR]', err)
    const statusCode = err.status || err.statusCode || (err.name === 'UnauthorizedError' ? 401 : 500)
    let message = err.message || 'Internal Server Error'

    // Only scrub sensitive internal errors (DB passwords, service keys) in production
    if (statusCode === 500 && CONFIG.isProduction) {
        if (/(password|secret|key|supabase_key|token|credential)/i.test(message)) {
            message = 'A temporary server error occurred. Please try again.'
        }
    }

    res.status(statusCode).json({
        success: false,
        error: message,
        ...(err.code ? { code: err.code } : {})
    })
})



// Start Server
const PORT = CONFIG.PORT
server.listen(PORT, CONFIG.HOST, () => {
    validateConfig()
    logConfigSummary()
    console.log(`🚀 Server listening at http://${CONFIG.HOST}:${PORT}`)
    console.log(`📡 WebSocket server live at ws://${CONFIG.HOST}:${PORT}/ws`)
    console.log(`🛡️  Admin account: ${CONFIG.ADMIN_DEFAULT_EMAIL}`)
    console.log(`======================================================\n`)

    if (CONFIG.USE_SUPABASE) {
        db.hydrateFromSupabase().catch(() => {})
    }

    // Start Floor Activity & Market Maker Engine on primary instance
    const isPrimaryInstance = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0'
    if (isPrimaryInstance) {
        floorActivityEngine.start()
    }
})

function gracefulShutdown(signal) {
    console.log(`\n[SERVER] Received ${signal}. Gracefully shutting down...`)
    try { floorActivityEngine.stop() } catch {}
    try { db.persist() } catch {}
    server.close(() => {
        process.exit(0)
    })
    setTimeout(() => process.exit(0), 5000).unref?.()
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

process.on('unhandledRejection', (reason) => {
    console.error('[UNHANDLED REJECTION]', reason)
})

process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT EXCEPTION]', err)
    try { db.persist() } catch {}
    process.exit(1)
})
