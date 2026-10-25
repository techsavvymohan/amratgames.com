import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'
import { CONFIG } from './config.js'
import { db } from './db/db.js'
import { crashRoomService } from './services/CrashRoomService.js'
import { colorMatchRoomService } from './services/ColorMatchRoomService.js'
import { chatService } from './services/ChatService.js'
import { redisPubSub } from './services/RedisPubSubService.js'
import { isTokenRevoked } from './middleware/auth.js'

let wss = null

const PRIVATE_USER_EVENTS = new Set(['DEPOSIT_STATUS_UPDATED', 'WITHDRAWAL_STATUS_UPDATED'])

function sendLocalClients(type, payload) {
    if (!wss) return
    const isPrivate = PRIVATE_USER_EVENTS.has(type)
    const message = JSON.stringify({
        type,
        payload,
        timestamp: new Date().toISOString()
    })

    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // 1 = WebSocket.OPEN
            if (isPrivate) {
                // Privacy protection: Never broadcast financial transactions/UTRs to all players.
                // Only dispatch to the authenticated owner of the deposit/withdrawal or an administrator.
                if (payload?.userId && (client.userId === payload.userId || client.userRole === 'admin')) {
                    try { client.send(message) } catch {}
                }
            } else {
                try { client.send(message) } catch {}
            }
        }
    })
}

export function initWebSocketServer(server) {
    wss = new WebSocketServer({
        server,
        path: '/ws',
        maxPayload: 1024 * 1024 // 1MB payload cap to prevent memory exhaustion DoS
    })

    // Start synchronized multiplayer Crash and Color Game room loops (only on primary worker instance)
    const isPrimaryInstance = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0'
    if (isPrimaryInstance) {
        crashRoomService.start()
        colorMatchRoomService.start()
    }

    // Subscribe to cross-instance Redis event channels
    redisPubSub.subscribe(redisPubSub.CHANNELS.EVENTS, (msg) => {
        if (msg.senderInstance !== redisPubSub.instanceId) {
            sendLocalClients(msg.type, msg.payload)
        }
    })

    redisPubSub.subscribe(redisPubSub.CHANNELS.CHAT, (msg) => {
        if (msg.type === 'NEW_CHAT_MESSAGE' && msg.payload) {
            chatService.ingestRemoteMessage(msg.payload)
        }
        if (msg.senderInstance !== redisPubSub.instanceId) {
            sendLocalClients(msg.type, msg.payload)
        }
    })

    redisPubSub.subscribe(redisPubSub.CHANNELS.CRASH, (msg) => {
        if (msg.senderInstance !== redisPubSub.instanceId) {
            sendLocalClients(msg.type, msg.payload)
        }
    })

    redisPubSub.subscribe(redisPubSub.CHANNELS.BETS, (msg) => {
        if (msg.senderInstance !== redisPubSub.instanceId) {
            sendLocalClients(msg.type, msg.payload)
        }
    })

    // Track concurrent connections per IP to prevent socket starvation / file descriptor exhaustion
    const activeIpConnections = new Map() // IP -> count
    const MAX_WS_PER_IP = 30

    wss.on('connection', (ws, req) => {
        const clientIp = (req?.headers?.['x-forwarded-for']
            ? req.headers['x-forwarded-for'].split(',')[0].trim()
            : (req?.socket?.remoteAddress || '127.0.0.1'))

        const ipCount = (activeIpConnections.get(clientIp) || 0) + 1
        if (ipCount > MAX_WS_PER_IP) {
            try {
                ws.close(1008, 'Too many concurrent WebSocket connections from this IP')
            } catch {}
            return
        }
        activeIpConnections.set(clientIp, ipCount)

        ws.isAlive = true
        ws.messageCount = 0
        ws.lastMessageReset = Date.now()
        ws.userId = null
        ws.userRole = null

        // Authenticate connection from query param (?token=...)
        try {
            const urlObj = new URL(req.url, 'http://localhost')
            const queryToken = urlObj.searchParams.get('token')
            if (queryToken && !isTokenRevoked(queryToken)) {
                const decoded = jwt.verify(queryToken, CONFIG.JWT_SECRET)
                const user = db.findUserById(decoded.id)
                if (user && !user.isBanned) {
                    ws.userId = user.id
                    ws.userRole = user.role
                }
            }
        } catch {}

        const cleanupIp = () => {
            const count = (activeIpConnections.get(clientIp) || 1) - 1
            if (count <= 0) {
                activeIpConnections.delete(clientIp)
            } else {
                activeIpConnections.set(clientIp, count)
            }
        }

        ws.on('close', cleanupIp)
        ws.on('error', cleanupIp)

        ws.on('pong', () => {
            ws.isAlive = true
        })

        // Send initial welcome with active Crash room, Color Game room state and recent community chat
        ws.send(JSON.stringify({
            type: 'CONNECTED',
            message: 'Connected to AmratGames Real-time Live Engine',
            crashRoom: crashRoomService.getState(),
            colorRoom: colorMatchRoomService.getState(),
            recentChat: chatService.getRecentMessages(30),
            authenticated: Boolean(ws.userId),
            userId: ws.userId || null,
            timestamp: new Date().toISOString()
        }))

        ws.on('message', async (message) => {
            try {
                // Rate limit: max 50 messages per second per socket connection
                const now = Date.now()
                if (now - ws.lastMessageReset > 1000) {
                    ws.messageCount = 0
                    ws.lastMessageReset = now
                }
                ws.messageCount++
                if (ws.messageCount > 50) {
                    return ws.send(JSON.stringify({ type: 'RATE_LIMIT_EXCEEDED', error: 'Too many messages sent. Please slow down.' }))
                }

                const data = JSON.parse(message)
                if (data.type === 'PING') {
                    ws.isAlive = true
                    ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }))
                } else if (data.type === 'AUTH') {
                    const token = data.payload?.token || data.token
                    if (!token) {
                        return ws.send(JSON.stringify({ type: 'AUTH_ERROR', error: 'Token is required' }))
                    }
                    if (isTokenRevoked(token)) {
                        return ws.send(JSON.stringify({ type: 'AUTH_ERROR', error: 'Token is revoked' }))
                    }
                    try {
                        const decoded = jwt.verify(token, CONFIG.JWT_SECRET)
                        const user = db.findUserById(decoded.id)
                        if (!user || user.isBanned) {
                            return ws.send(JSON.stringify({ type: 'AUTH_ERROR', error: 'User not authorized' }))
                        }
                        ws.userId = user.id
                        ws.userRole = user.role
                        return ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', userId: user.id }))
                    } catch (err) {
                        return ws.send(JSON.stringify({ type: 'AUTH_ERROR', error: 'Invalid authentication token' }))
                    }
                } else if (data.type === 'GET_CRASH_ROOM_STATE') {
                    ws.send(JSON.stringify({ type: 'CRASH_ROOM_STATE', payload: crashRoomService.getState() }))
                } else if (data.type === 'GET_COLOR_ROOM_STATE') {
                    ws.send(JSON.stringify({ type: 'COLOR_GAME_STATE', payload: colorMatchRoomService.getState() }))
                } else if (data.type === 'GET_CHAT_HISTORY') {
                    ws.send(JSON.stringify({ type: 'CHAT_HISTORY', payload: chatService.getRecentMessages(50) }))
                } else if (data.type === 'SEND_CHAT_MESSAGE') {
                    const { text, token } = data.payload || {}
                    if (!token) {
                        return ws.send(JSON.stringify({ type: 'CHAT_ERROR', error: 'Authentication required' }))
                    }
                    if (isTokenRevoked(token)) {
                        return ws.send(JSON.stringify({ type: 'CHAT_ERROR', error: 'Session expired or logged out' }))
                    }
                    try {
                        const decoded = jwt.verify(token, CONFIG.JWT_SECRET)
                        const user = db.findUserById(decoded.id)
                        if (!user) throw new Error('User not found')
                        if (user.isBanned) throw new Error('Account suspended')
                        ws.userId = user.id
                        ws.userRole = user.role
                        await chatService.postMessage({ user, text })
                    } catch (authErr) {
                        ws.send(JSON.stringify({ type: 'CHAT_ERROR', error: authErr.message }))
                    }
                } else if (data.type === 'SHARE_BET') {
                    const { betId, token } = data.payload || {}
                    if (!token) {
                        return ws.send(JSON.stringify({ type: 'CHAT_ERROR', error: 'Authentication required' }))
                    }
                    if (isTokenRevoked(token)) {
                        return ws.send(JSON.stringify({ type: 'CHAT_ERROR', error: 'Session expired or logged out' }))
                    }
                    try {
                        const decoded = jwt.verify(token, CONFIG.JWT_SECRET)
                        const user = db.findUserById(decoded.id)
                        if (!user) throw new Error('User not found')
                        if (user.isBanned) throw new Error('Account suspended')
                        ws.userId = user.id
                        ws.userRole = user.role
                        await chatService.shareBet({ user, betId })
                    } catch (authErr) {
                        ws.send(JSON.stringify({ type: 'CHAT_ERROR', error: authErr.message }))
                    }
                }
            } catch (e) {
                // ignore
            }
        })
    })

    // Active heartbeat sweep to terminate dead zombie sockets
    const heartbeatInterval = setInterval(() => {
        if (!wss) return
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                return ws.terminate()
            }
            ws.isAlive = false
            try { ws.ping() } catch {}
        })
    }, 30000)

    wss.on('close', () => clearInterval(heartbeatInterval))

    console.log('[WS] WebSocket server initialized on path /ws')
    return wss
}

export function broadcastEvent(type, payload) {
    // 1. Immediately send to locally connected clients
    sendLocalClients(type, payload)

    // 2. Publish across Redis Pub/Sub bus to all other cluster worker instances
    redisPubSub.broadcast(type, payload).catch(() => {})
}
