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

import authRoutes from './routes/auth.routes.js'
import adminPanelModule from './admin-panel/index.js'
import walletRoutes from './routes/wallet.routes.js'
import gamesRoutes from './routes/games.routes.js'
import affiliateRoutes from './routes/affiliate.routes.js'
import vipRoutes from './routes/vip.routes.js'
import communityRoutes from './routes/community.routes.js'
import pvpRoutes from './routes/pvp.routes.js'
import { checkPlatformMaintenance } from './middleware/circuitBreaker.js'

const app = express()
app.disable('x-powered-by')

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
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
        req.rawBody = buf
    }
}))
app.use(authenticate)

// Fast Health Check (Cached in Redis for 3s to handle high-frequency LB probes)
app.get('/api/health', async (req, res) => {
    try {
        const payload = await redisCache.getOrSet('platform:health', 3, async () => {
            return {
                status: 'online',
                platform: 'AmratGames.com Gaming & Casino Engine',
                version: '2.0.0',
                rtp: db.data.settings?.rtp || 99,
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
app.use('/api/vip', vipRoutes)
app.use('/api/community', communityRoutes)

// 404 handler
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found on AmratGames API' })
})

// Central error handler
app.use((err, req, res, next) => {
    console.error('[API ERROR]', err)
    const statusCode = err.status || err.statusCode || 500
    const message = (statusCode === 500 && CONFIG.isProduction)
        ? 'Internal Server Error'
        : (err.message || 'Internal Server Error')

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
})

process.on('SIGINT', () => {
    console.log('\n[SERVER] Gracefully shutting down...')
    db.persist()
    process.exit(0)
})
