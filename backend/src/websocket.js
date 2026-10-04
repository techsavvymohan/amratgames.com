import { WebSocketServer, WebSocket } from 'ws'

let wss = null

export function initWebSocketServer(server) {
    wss = new WebSocketServer({ server, path: '/ws' })

    wss.on('connection', (ws) => {
        // Send initial welcome
        ws.send(JSON.stringify({
            type: 'CONNECTED',
            message: 'Connected to AmratGames Real-time Live Engine',
            timestamp: new Date().toISOString()
        }))

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message)
                if (data.type === 'PING') {
                    ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }))
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
    if (!wss) return

    const message = JSON.stringify({
        type,
        payload,
        timestamp: new Date().toISOString()
    })

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message)
        }
    })
}
