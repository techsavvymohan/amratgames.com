// =============================================================================
// 👑 AmratGames.com — Floor Vitality & Liquidity Market Maker Engine
// Automated PvP Liquidity Provision, Community Chat Simulator & Live Bets Feed
// =============================================================================

import crypto from 'node:crypto'
import { db } from '../db/db.js'
import { broadcastEvent } from '../websocket.js'
import { pvpService } from './PvPService.js'
import { chatService } from './ChatService.js'
import { houseVaultService } from './HouseVaultService.js'
import { CONFIG } from '../config.js'

export const BOT_PERSONAS = [
    { id: 'usr_bot_aryan', username: 'Aryan_King', email: 'aryan_bot@amratgames.internal', vipTier: 'Gold' },
    { id: 'usr_bot_rohit', username: 'Rohit_Trader', email: 'rohit_bot@amratgames.internal', vipTier: 'Platinum' },
    { id: 'usr_bot_simran', username: 'SimranBets', email: 'simran_bot@amratgames.internal', vipTier: 'Silver' },
    { id: 'usr_bot_crypto', username: 'CryptoRaja', email: 'crypto_bot@amratgames.internal', vipTier: 'Gold' },
    { id: 'usr_bot_priya', username: 'Priya_99', email: 'priya_bot@amratgames.internal', vipTier: 'Bronze' },
    { id: 'usr_bot_kabir', username: 'Kabir_HighRoller', email: 'kabir_bot@amratgames.internal', vipTier: 'Diamond' },
    { id: 'usr_bot_vicky', username: 'Vicky_Gamer', email: 'vicky_bot@amratgames.internal', vipTier: 'Silver' },
    { id: 'usr_bot_aarav', username: 'Aarav_Luck', email: 'aarav_bot@amratgames.internal', vipTier: 'Gold' }
]

const CHAT_SCRIPTS = [
    // Win flexes
    'Boom! Just cashed 6.8x on Crash 🚀',
    'Mines 5 diamonds safely cleared 💎💎💎',
    'Limbo 8x target hit! Aaj ka din sahi chal raha hai',
    'Coin toss Heads streak is crazy rn 🔥',
    'Withdrew ₹3,800 to UPI, credited in 35 seconds! Instant settlement is real',
    'Just hit 4.2x cashout on Crash room, taking profits',
    'Mines 3 gems strategy is the safest imo',
    'Limbo paying out today 🔥',
    '₹2,500 withdrawal approved instantly, love this platform',
    // Banter & challenges
    'Who wants to 1v1 on Coin Toss? Put up a challenge',
    'Accepted your duel Rohit, let\'s see who takes it!',
    'Next crash round going above 10x trust me',
    'GG well played on that coin toss duel',
    'Vault APY 21% looking solid, staking half my profits',
    'Good luck everyone tonight!',
    'Admin Chat Rain drop when? 🌧️',
    'Aaj ka luck tagda hai, keep spinning'
]

const MASKED_USERS = [
    'Roh***42', 'Ami***91', 'Deep***07', 'Suni***88', 'Vik***12',
    'Kav***55', 'Rah***99', 'Puj***03', 'San***77', 'Neh***19',
    'Har***64', 'Man***33', 'Kunal_***', 'Rajesh_***', 'Simr***21',
    'Ankit_***', 'Adit***78', 'Tanvi_***', 'Gaur***09', 'Varun_***'
]

const GAMES_CATALOG = [
    { game: 'crash', gameName: 'Crash 1000x' },
    { game: 'limbo', gameName: 'Limbo' },
    { game: 'mines', gameName: 'Mines Gold' },
    { game: 'color-match', gameName: 'Color Match' },
    { game: 'coin-toss', gameName: 'Coin Toss 1v1' }
]

export class FloorActivityEngine {
    constructor() {
        this.isRunning = false
        this.pvpTimer = null
        this.chatTimer = null
        this.betTimer = null
        this.humanMatchTimer = null
    }

    /**
     * Ensure bot personas exist in db with adequate liquidity reserves
     */
    ensureBotPersonas() {
        if (!db.data.users) db.data.users = []
        for (const persona of BOT_PERSONAS) {
            let u = db.findUserById(persona.id)
            if (!u) {
                u = {
                    id: persona.id,
                    username: persona.username,
                    email: persona.email,
                    role: 'player',
                    isBot: true,
                    isMarketMaker: true,
                    balances: { INR: 500000.0, USDT: 10000.0, BTC: 1.0, AMRAT: 500000.0 },
                    totalWagered: 150000.0,
                    vipTier: persona.vipTier,
                    isBanned: false,
                    createdAt: new Date().toISOString()
                }
                db.data.users.push(u)
            } else {
                // Top up if depleted
                if (!u.balances) u.balances = { INR: 500000.0, USDT: 10000.0, BTC: 1.0, AMRAT: 500000.0 }
                if ((u.balances.AMRAT || 0) < 50000.0) {
                    u.balances.AMRAT = 500000.0
                }
                if ((u.balances.INR || 0) < 50000.0) {
                    u.balances.INR = 500000.0
                }
                u.isMarketMaker = true
            }
            if (db._indexUser) db._indexUser(u)
        }
        db.persist()
    }

    /**
     * Start all floor vitality automation loops
     */
    start() {
        if (this.isRunning) return
        this.isRunning = true

        this.ensureBotPersonas()

        // 1. Seed House Vault Float (₹75,000 baseline institutional TVL)
        try {
            if (houseVaultService && houseVaultService.seedTreasuryFloat) {
                houseVaultService.seedTreasuryFloat(75000)
            }
        } catch (e) {
            console.error('[FLOOR ENGINE] Error seeding vault float:', e.message)
        }

        // 2. Initial PvP liquidity seeding
        this.maintainPvPLiquidity().catch(() => {})

        // 3. Periodic PvP liquidity maintenance (every 25s)
        this.pvpTimer = setInterval(() => {
            this.maintainPvPLiquidity().catch(() => {})
        }, 25000)
        if (this.pvpTimer.unref) this.pvpTimer.unref()

        // 4. Human Duel Auto-Challenger (every 12s)
        this.humanMatchTimer = setInterval(() => {
            this.matchHumanDuels().catch(() => {})
        }, 12000)
        if (this.humanMatchTimer.unref) this.humanMatchTimer.unref()

        // 5. Live Bets Ticker Simulation (every 5-8s)
        this.scheduleNextBet()

        // 6. Community Chat Banter Simulation (every 40-70s)
        this.scheduleNextChat()

        console.log('🏛️ [FLOOR ACTIVITY ENGINE] PvP Market Maker, Live Bets Feed & Community Chat online')
    }

    /**
     * Stop all automation loops
     */
    stop() {
        this.isRunning = false
        if (this.pvpTimer) clearInterval(this.pvpTimer)
        if (this.humanMatchTimer) clearInterval(this.humanMatchTimer)
        if (this.betTimer) clearTimeout(this.betTimer)
        if (this.chatTimer) clearTimeout(this.chatTimer)
    }

    /**
     * Maintain 3 to 4 open PvP challenges in the lobby at diverse stakes
     */
    async maintainPvPLiquidity() {
        if (!this.isRunning) return

        const activeDuels = Array.from(pvpService.activeDuels.values())
        const openDuels = activeDuels.filter(d => d.status === 'open')

        // Clean up stale bot duels older than 10 minutes to keep timestamps crisp
        const now = Date.now()
        for (const d of openDuels) {
            if (d.creatorId && d.creatorId.startsWith('usr_bot_')) {
                const ageMs = now - new Date(d.createdAt).getTime()
                if (ageMs > 10 * 60 * 1000) {
                    try {
                        await pvpService.cancelDuel({ duelId: d.id, userId: d.creatorId })
                    } catch {}
                }
            }
        }

        // Count open bot duels specifically
        const currentBotOpen = Array.from(pvpService.activeDuels.values()).filter(
            d => d.status === 'open' && d.creatorId && d.creatorId.startsWith('usr_bot_')
        )
        const targetBotOpen = 3

        if (currentBotOpen.length < targetBotOpen) {
            const needed = targetBotOpen - currentBotOpen.length
            const stakeTiers = [50, 100, 250, 500, 1000]

            for (let i = 0; i < needed; i++) {
                const currentOpenNow = Array.from(pvpService.activeDuels.values()).filter(d => d.status === 'open')
                const busyBotIds = new Set(currentOpenNow.map(d => d.creatorId))
                const availableBots = BOT_PERSONAS.filter(b => !busyBotIds.has(b.id))
                const bot = availableBots.length > 0
                    ? availableBots[Math.floor(Math.random() * availableBots.length)]
                    : BOT_PERSONAS[Math.floor(Math.random() * BOT_PERSONAS.length)]

                const stake = stakeTiers[(currentBotOpen.length + i) % stakeTiers.length]
                const choice = (i % 2 === 0) ? 'heads' : 'tails'

                try {
                    await pvpService.createDuel({
                        userId: bot.id,
                        stake,
                        choice,
                        currency: 'AMRAT',
                        clientSeed: 'floor-mm-' + Date.now()
                    })
                } catch (err) {
                    console.error('[FLOOR MM] Error creating duel:', err.message)
                }
            }
        }
    }

    /**
     * Auto-challenge human duels waiting longer than 20 seconds
     */
    async matchHumanDuels() {
        if (!this.isRunning) return

        const activeDuels = Array.from(pvpService.activeDuels.values())
        const now = Date.now()

        for (const d of activeDuels) {
            // Market maker bots must NEVER play with unbacked balances in real-money (INR/USDT/BTC) duels in production!
            // Restrict production bot matchmaking strictly to virtual tokens (AMRAT)
            if (CONFIG.isProduction && d.currency !== 'AMRAT') continue

            if (d.status === 'open' && d.creatorId && !d.creatorId.startsWith('usr_bot_')) {
                const waitTime = now - new Date(d.createdAt).getTime()
                // If human has been waiting > 20s, bot accepts duel
                if (waitTime >= 20000) {
                    const availableBots = BOT_PERSONAS.filter(b => b.id !== d.creatorId)
                    const bot = availableBots[Math.floor(Math.random() * availableBots.length)]
                    try {
                        await pvpService.joinDuel({
                            duelId: d.id,
                            userId: bot.id,
                            clientSeed: 'mm-challenger-' + Date.now()
                        })
                    } catch (err) {
                        // ignore
                    }
                }
            }
        }
    }

    /**
     * Schedule next live bet ticker tick (every 4-8 seconds)
     */
    scheduleNextBet() {
        if (!this.isRunning) return
        const delay = 4000 + Math.floor(Math.random() * 4000)
        this.betTimer = setTimeout(() => {
            this.emitLiveBetTick()
            this.scheduleNextBet()
        }, delay)
        if (this.betTimer.unref) this.betTimer.unref()
    }

    /**
     * Emit a live platform bet tick across games
     */
    emitLiveBetTick() {
        if (!this.isRunning) return

        const gameItem = GAMES_CATALOG[Math.floor(Math.random() * GAMES_CATALOG.length)]
        const maskedUsername = MASKED_USERS[Math.floor(Math.random() * MASKED_USERS.length)]

        // Weighted stakes: 70% low (₹50-₹300), 22% mid (₹500-₹2,500), 8% high (₹5,000-₹15,000)
        const rollStake = Math.random()
        let betAmount = 100
        if (rollStake < 0.70) {
            betAmount = [50, 100, 150, 200, 250, 300][Math.floor(Math.random() * 6)]
        } else if (rollStake < 0.92) {
            betAmount = [500, 750, 1000, 1500, 2000, 2500][Math.floor(Math.random() * 6)]
        } else {
            betAmount = [5000, 7500, 10000, 15000][Math.floor(Math.random() * 4)]
        }

        // Realistic win rate (~47%)
        const won = Math.random() < 0.47
        let multiplier = 0
        let payout = 0
        let profit = -betAmount

        if (won) {
            const rollMult = Math.random()
            if (rollMult < 0.70) {
                multiplier = parseFloat((1.20 + Math.random() * 2.30).toFixed(2)) // 1.20x - 3.50x
            } else if (rollMult < 0.92) {
                multiplier = parseFloat((3.60 + Math.random() * 5.40).toFixed(2)) // 3.60x - 9.00x
            } else {
                multiplier = parseFloat((10.00 + Math.random() * 40.00).toFixed(2)) // 10x - 50x
            }
            payout = parseFloat((betAmount * multiplier).toFixed(2))
            profit = parseFloat((payout - betAmount).toFixed(2))
        }

        const betRecord = {
            id: 'bet_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
            userId: 'usr_sim_' + crypto.randomBytes(4).toString('hex'),
            username: maskedUsername,
            game: gameItem.game,
            gameName: gameItem.gameName,
            currency: 'INR',
            betAmount,
            multiplier,
            payout,
            profit,
            won,
            hash: crypto.randomBytes(16).toString('hex'),
            timestamp: new Date().toISOString()
        }

        // Record in simulated bets roll so live ticker reflects it WITHOUT evicting real bets
        if (!db.data.simulatedBets) db.data.simulatedBets = []
        db.data.simulatedBets.unshift(betRecord)
        if (db.data.simulatedBets.length > 50) {
            db.data.simulatedBets = db.data.simulatedBets.slice(0, 50)
        }

        // Broadcast to all active browser connections
        broadcastEvent('NEW_BET', betRecord)
    }

    /**
     * Schedule next chat banter simulation (every 35-65 seconds)
     */
    scheduleNextChat() {
        if (!this.isRunning) return
        const delay = 35000 + Math.floor(Math.random() * 30000)
        this.chatTimer = setTimeout(() => {
            this.emitChatBanter()
            this.scheduleNextChat()
        }, delay)
        if (this.chatTimer.unref) this.chatTimer.unref()
    }

    /**
     * Emit community chat banter message from one of the personas
     */
    emitChatBanter() {
        if (!this.isRunning) return

        const persona = BOT_PERSONAS[Math.floor(Math.random() * BOT_PERSONAS.length)]
        const script = CHAT_SCRIPTS[Math.floor(Math.random() * CHAT_SCRIPTS.length)]

        try {
            if (chatService && chatService.postPersonaMessage) {
                chatService.postPersonaMessage({
                    userId: persona.id,
                    username: persona.username,
                    vipTier: persona.vipTier,
                    text: script
                })
            }
        } catch {}
    }
}

export const floorActivityEngine = new FloorActivityEngine()
