import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { CONFIG, validateConfig, logConfigSummary } from './config.js'
import { authenticate } from './middleware/auth.js'
import { initWebSocketServer, broadcastEvent } from './websocket.js'
import { db } from './db/db.js'

import authRoutes from './routes/auth.routes.js'
import adminPanelModule from './admin-panel/index.js'
import walletRoutes from './routes/wallet.routes.js'
import gamesRoutes from './routes/games.routes.js'

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
        tokenTreasuryRemaining: db.data.settings.tokenTreasury.treasuryBalance
    })
})

// Mount API routes
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminPanelModule.getRouter())
app.use('/api/wallet', walletRoutes)
app.use('/api/games', gamesRoutes)

// 404 handler
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found on AmratGames API' })
})

// Background Live Community Activity Simulator (Realistic real-time casino feel)
const SIMULATED_PLAYERS = ['rohit_777', 'priya_crypto', 'vikram_dice', 'neha_lucky', 'kabir_whale']
const GAMES = [
    { game: 'crash', gameName: 'Crash 1000x', minMult: 1.1, maxMult: 15.0 },
    { game: 'plinko', gameName: 'Plinko 16-Pin', minMult: 0.2, maxMult: 29.0 },
    { game: 'mines', gameName: 'Mines 5x5', minMult: 1.2, maxMult: 8.5 },
    { game: 'limbo', gameName: 'Limbo Turbo', minMult: 1.05, maxMult: 50.0 },
    { game: 'dragon-tiger', gameName: 'Dragon Tiger Live', minMult: 1.95, maxMult: 11.0 }
]

setInterval(() => {
    try {
        const randomPlayer = SIMULATED_PLAYERS[Math.floor(Math.random() * SIMULATED_PLAYERS.length)]
        const randomGame = GAMES[Math.floor(Math.random() * GAMES.length)]
        const isWin = Math.random() < 0.52
        const multiplier = isWin
            ? parseFloat((randomGame.minMult + Math.random() * (randomGame.maxMult - randomGame.minMult)).toFixed(2))
            : 0.00
        const betAmount = [100, 250, 500, 1000, 2500, 5000][Math.floor(Math.random() * 6)]
        const currency = Math.random() > 0.4 ? 'INR' : (Math.random() > 0.5 ? 'USDT' : 'AMRAT')
        const payout = isWin ? Math.round(betAmount * multiplier) : 0

        const bet = {
            id: 'bet_' + Date.now().toString(36),
            userId: 'sim_' + randomPlayer,
            username: randomPlayer,
            game: randomGame.game,
            gameName: randomGame.gameName,
            currency,
            betAmount,
            multiplier,
            payout,
            profit: payout - betAmount,
            won: isWin,
            timestamp: new Date().toISOString()
        }

        db.data.bets.unshift(bet)
        if (db.data.bets.length > 500) db.data.bets = db.data.bets.slice(0, 500)

        // Broadcast to WebSocket clients
        broadcastEvent('NEW_BET', bet)
    } catch (e) {
        // quiet catch
    }
}, 8000)

// Start Server
const PORT = CONFIG.PORT
server.listen(PORT, CONFIG.HOST, () => {
    validateConfig()
    logConfigSummary()
    console.log(`🚀 Server listening at http://${CONFIG.HOST}:${PORT}`)
    console.log(`📡 WebSocket server live at ws://${CONFIG.HOST}:${PORT}/ws`)
    console.log(`🛡️  Admin account: ${CONFIG.ADMIN_DEFAULT_EMAIL}`)
    console.log(`======================================================\n`)
})

process.on('SIGINT', () => {
    console.log('\n[SERVER] Gracefully shutting down...')
    db.persist()
    process.exit(0)
})
