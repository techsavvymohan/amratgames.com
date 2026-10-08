import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { CONFIG, validateConfig, logConfigSummary } from './config.js'
import { authenticate } from './middleware/auth.js'
import { initWebSocketServer, broadcastEvent } from './websocket.js'
import { db } from './db/db.js'
import { testSupabaseConnection } from './db/SupabaseClient.js'
import { emailService } from './services/EmailService.js'

import authRoutes from './routes/auth.routes.js'
import adminPanelModule from './admin-panel/index.js'
import walletRoutes from './routes/wallet.routes.js'
import gamesRoutes from './routes/games.routes.js'
import affiliateRoutes from './routes/affiliate.routes.js'
import vipRoutes from './routes/vip.routes.js'
import communityRoutes from './routes/community.routes.js'
import { checkPlatformMaintenance } from './middleware/circuitBreaker.js'

const app = express()
const server = http.createServer(app)

// Initialize WebSockets
initWebSocketServer(server)

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())
app.use(authenticate)

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        platform: 'AmratGames.com Gaming & Casino Engine',
        version: '2.0.0',
        rtp: db.data.settings.rtp,
        serverTime: new Date().toISOString(),
        activePlayers: db.data.users.filter(u => !u.isBanned).length,
        tokenTreasuryRemaining: db.data.settings.tokenTreasury.treasuryBalance,
        database: CONFIG.USE_SUPABASE ? 'Supabase (PostgreSQL)' : 'Local JSON DB'
    })
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
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal Server Error'
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
