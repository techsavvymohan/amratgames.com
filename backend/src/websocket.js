import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'
import { CONFIG } from './config.js'
import { db } from './db/db.js'
import { crashRoomService } from './services/CrashRoomService.js'
import { chatService } from './services/ChatService.js'
import { redisPubSub } from './services/RedisPubSubService.js'

let wss = null

function sendLocalClients(type, payload) {
    if (!wss) return
    const message = JSON.stringify({
        type,
        payload,
        timestamp: new Date().toISOString()
    })

    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // 1 = WebSocket.OPEN
            try { client.send(message) } catch {}
        }
    })
}

export function initWebSocketServer(server) {
    wss = new WebSocketServer({ server, path: '/ws' })

    // Start synchronized multiplayer Crash room loop
    crashRoomService.start()

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

    wss.on('connection', (ws) => {
        // Send initial welcome with active Crash room state and recent community chat
        ws.send(JSON.stringify({
            type: 'CONNECTED',
            message: 'Connected to AmratGames Real-time Live Engine',
            crashRoom: crashRoomService.getState(),
            recentChat: chatService.getRecentMessages(30),
            timestamp: new Date().toISOString()
        }))

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message)
                if (data.type === 'PING') {
                    ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }))
                } else if (data.type === 'GET_CRASH_ROOM_STATE') {
                    ws.send(JSON.stringify({ type: 'CRASH_ROOM_STATE', payload: crashRoomService.getState() }))
                } else if (data.type === 'GET_CHAT_HISTORY') {
                    ws.send(JSON.stringify({ type: 'CHAT_HISTORY', payload: chatService.getRecentMessages(50) }))
                } else if (data.type === 'SEND_CHAT_MESSAGE') {
                    const { text, token } = data.payload || {}
                    if (!token) {
                        return ws.send(JSON.stringify({ type: 'CHAT_ERROR', error: 'Authentication required' }))
                    }
                    try {
                        const decoded = jwt.verify(token, CONFIG.JWT_SECRET)
                        const user = db.findUserById(decoded.id)
                        if (!user) throw new Error('User not found')
                        await chatService.postMessage({ user, text })
                    } catch (authErr) {
                        ws.send(JSON.stringify({ type: 'CHAT_ERROR', error: authErr.message }))
                    }
                } else if (data.type === 'SHARE_BET') {
                    const { betId, token } = data.payload || {}
                    if (!token) {
                        return ws.send(JSON.stringify({ type: 'CHAT_ERROR', error: 'Authentication required' }))
                    }
                    try {
                        const decoded = jwt.verify(token, CONFIG.JWT_SECRET)
                        const user = db.findUserById(decoded.id)
                        if (!user) throw new Error('User not found')
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

    console.log('[WS] WebSocket server initialized on path /ws')
    return wss
}

export function broadcastEvent(type, payload) {
    // 1. Immediately send to locally connected clients
    sendLocalClients(type, payload)

    // 2. Publish across Redis Pub/Sub bus to all other cluster worker instances
    redisPubSub.broadcast(type, payload).catch(() => {})
}
