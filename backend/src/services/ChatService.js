// =============================================================================
// 👑 AmratGames.com — Real-Time Community Chat & Social Flywheel Engine
// Centralized chat broadcaster, bet sharing, slow-mode guard, and Chat Rain
// =============================================================================

import crypto from 'node:crypto'
import { db } from '../db/db.js'
import { broadcastEvent } from '../websocket.js'

export class ChatService {
    constructor() {
        this.messages = [] // Last 60 chat messages
        this.userCooldowns = new Map() // userId -> timestamp
        this.activeChatters = new Map() // userId -> { username, lastSpokeAt }
        this.seedInitialChat()
    }

    seedInitialChat() {
        const demoMessages = [
            { username: 'Rahul_Delhi', text: 'Boom! Just hit 8.4x on Crash! 🚀', tier: 'Gold', timeAgo: 180000 },
            { username: 'CryptoRaja', text: 'Limbo paying out crazy multipliers today 🔥', tier: 'Silver', timeAgo: 120000 },
            { username: 'VikramSingh', text: 'Good luck everyone, let us hit that 100x!', tier: 'Platinum', timeAgo: 60000 },
            { username: 'Pooja_K', text: 'Mines 5 gems cleared safely 💎💎💎', tier: 'Bronze', timeAgo: 25000 },
            { username: 'AmratHighRoller', text: 'Who wants a rain drop? 🌧️', tier: 'Diamond', timeAgo: 5000 }
        ]

        const now = Date.now()
        this.messages = demoMessages.map((m, i) => ({
            id: 'msg_seed_' + (now - m.timeAgo).toString(36) + i,
            userId: 'usr_demo_' + i,
            username: m.username,
            text: m.text,
            vipTier: m.tier,
            type: 'text',
            createdAt: new Date(now - m.timeAgo).toISOString()
        }))
    }

    getRecentMessages(limit = 50) {
        return this.messages.slice(-limit)
    }

    sanitizeText(input) {
        if (!input || typeof input !== 'string') return ''
        return input
            .trim()
            .replace(/<[^>]*>/g, '') // Strip HTML tags
            .slice(0, 250) // Enforce 250 max characters
    }

    async postMessage({ user, text }) {
        if (!user || !user.id) {
            const err = new Error('Authentication required to send chat messages')
            err.status = 401
            throw err
        }

        const cleanText = this.sanitizeText(text)
        if (!cleanText || cleanText.length === 0) {
            const err = new Error('Message cannot be empty')
            err.status = 400
            throw err
        }

        // Slow-mode: 2 seconds cooldown per user
        const now = Date.now()
        const lastSpoke = this.userCooldowns.get(user.id) || 0
        if (now - lastSpoke < 2000) {
            const waitSec = Math.ceil((2000 - (now - lastSpoke)) / 1000)
            const err = new Error(`Slow mode active. Please wait ${waitSec}s before sending another message.`)
            err.status = 429
            throw err
        }
        this.userCooldowns.set(user.id, now)

        // VIP Tier attribution
        const totalWagered = user.totalWagered || 0
        const vip = db.getVipTier(totalWagered)

        const messageObj = {
            id: 'msg_' + now.toString(36) + crypto.randomBytes(3).toString('hex'),
            userId: user.id,
            username: user.username,
            vipTier: vip.tier.charAt(0).toUpperCase() + vip.tier.slice(1),
            text: cleanText,
            type: 'text',
            createdAt: new Date(now).toISOString()
        }

        this.messages.push(messageObj)
        if (this.messages.length > 60) {
            this.messages.shift()
        }

        // Track active chatter for Rain eligibility (last 15 mins)
        this.activeChatters.set(user.id, {
            userId: user.id,
            username: user.username,
            lastSpokeAt: now
        })

        // Broadcast to all connected clients
        broadcastEvent('NEW_CHAT_MESSAGE', messageObj)

        return messageObj
    }

    async shareBet({ user, betId }) {
        if (!user || !user.id) {
            const err = new Error('Authentication required to share bets')
            err.status = 401
            throw err
        }

        if (!betId) {
            const err = new Error('betId is required')
            err.status = 400
            throw err
        }

        // Find bet in DB
        const bet = db.data.bets?.find(b => b.id === betId)
        if (!bet) {
            const err = new Error('Bet record not found')
            err.status = 404
            throw err
        }

        if (bet.userId !== user.id) {
            const err = new Error('You can only share your own bets')
            err.status = 403
            throw err
        }

        const now = Date.now()
        const totalWagered = user.totalWagered || 0
        const vip = db.getVipTier(totalWagered)

        const messageObj = {
            id: 'msg_bet_' + now.toString(36) + crypto.randomBytes(3).toString('hex'),
            userId: user.id,
            username: user.username,
            vipTier: vip.tier.charAt(0).toUpperCase() + vip.tier.slice(1),
            type: 'bet_share',
            text: `Shared a ${bet.gameName || bet.game} bet!`,
            sharedBet: {
                id: bet.id,
                game: bet.game,
                gameName: bet.gameName || bet.game,
                currency: bet.currency || 'INR',
                betAmount: bet.betAmount,
                multiplier: bet.multiplier,
                payout: bet.payout,
                profit: bet.profit,
                won: bet.won
            },
            createdAt: new Date(now).toISOString()
        }

        this.messages.push(messageObj)
        if (this.messages.length > 60) {
            this.messages.shift()
        }

        this.activeChatters.set(user.id, {
            userId: user.id,
            username: user.username,
            lastSpokeAt: now
        })

        broadcastEvent('NEW_CHAT_MESSAGE', messageObj)
        return messageObj
    }

    async triggerRain({ user, amount, numWinners = 3, currency = 'INR' }) {
        if (!user || !user.id) {
            const err = new Error('Authentication required to rain')
            err.status = 401
            throw err
        }

        const parsedAmount = parseFloat(amount)
        if (isNaN(parsedAmount) || parsedAmount < 50) {
            const err = new Error('Minimum rain amount is ₹50')
            err.status = 400
            throw err
        }

        const parsedWinners = Math.max(2, Math.min(parseInt(numWinners, 10) || 3, 10))

        // Get active chatters in the last 15 minutes (excluding sender)
        const cutoff = Date.now() - 15 * 60 * 1000
        const eligible = []
        for (const [uid, chatter] of this.activeChatters.entries()) {
            if (uid !== user.id && chatter.lastSpokeAt >= cutoff) {
                eligible.push(chatter)
            }
        }

        if (eligible.length < 2) {
            const err = new Error('Not enough active chatters online to trigger rain. At least 2 active players required.')
            err.status = 400
            throw err
        }

        // Shuffle and pick winners
        const shuffled = [...eligible].sort(() => 0.5 - Math.random())
        const selectedWinners = shuffled.slice(0, Math.min(parsedWinners, shuffled.length))
        const sharePerWinner = parseFloat((parsedAmount / selectedWinners.length).toFixed(2))

        // Atomically deduct sender and credit winners
        await db.withUserLock(user.id, async () => {
            const sender = db.findUserById(user.id)
            const bal = sender?.balances?.[currency] || 0
            if (parsedAmount > bal + 0.0001) {
                const err = new Error(`Insufficient ${currency} balance to trigger rain`)
                err.status = 400
                throw err
            }
            db.updateUserBalance(user.id, currency, -parsedAmount, `Chat Rain Sponsored (${selectedWinners.length} players)`)
        })

        // Credit winners
        for (const winner of selectedWinners) {
            try {
                await db.withUserLock(winner.userId, async () => {
                    db.updateUserBalance(winner.userId, currency, sharePerWinner, `Chat Rain from ${user.username}`)
                })
            } catch (e) {
                console.error('[CHAT RAIN] Failed to credit winner:', e.message)
            }
        }

        const now = Date.now()
        const totalWagered = user.totalWagered || 0
        const vip = db.getVipTier(totalWagered)

        const rainMessage = {
            id: 'msg_rain_' + now.toString(36) + crypto.randomBytes(3).toString('hex'),
            userId: user.id,
            username: user.username,
            vipTier: vip.tier.charAt(0).toUpperCase() + vip.tier.slice(1),
            type: 'rain',
            text: `🌧️ Rained ₹${parsedAmount.toFixed(2)} to ${selectedWinners.length} active chatters!`,
            rainData: {
                totalAmount: parsedAmount,
                perWinner: sharePerWinner,
                winners: selectedWinners.map(w => w.username)
            },
            createdAt: new Date(now).toISOString()
        }

        this.messages.push(rainMessage)
        if (this.messages.length > 60) {
            this.messages.shift()
        }

        broadcastEvent('NEW_CHAT_MESSAGE', rainMessage)
        broadcastEvent('CHAT_RAIN_NOTIFICATION', rainMessage)

        return rainMessage
    }
}

export const chatService = new ChatService()
