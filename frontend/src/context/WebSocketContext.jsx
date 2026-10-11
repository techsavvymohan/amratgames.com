import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

const WebSocketContext = createContext(null)

export function WebSocketProvider({ children }) {
    const [isConnected, setIsConnected] = useState(false)
    const [crashRoomState, setCrashRoomState] = useState(null)
    const [recentBets, setRecentBets] = useState([])
    const [chatMessages, setChatMessages] = useState([])

    const wsRef = useRef(null)
    const subscribersRef = useRef(new Map()) // eventType -> Set of callbacks
    const reconnectTimerRef = useRef(null)
    const pingTimerRef = useRef(null)

    // Event subscription helper
    const subscribe = useCallback((eventType, callback) => {
        if (!subscribersRef.current.has(eventType)) {
            subscribersRef.current.set(eventType, new Set())
        }
        const set = subscribersRef.current.get(eventType)
        set.add(callback)

        return () => {
            set.delete(callback)
            if (set.size === 0) {
                subscribersRef.current.delete(eventType)
            }
        }
    }, [])

    // Send JSON message over the single shared connection
    const sendJson = useCallback((payload) => {
        const ws = wsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(payload))
                return true
            } catch (err) {
                console.error('[WS] Send error:', err)
            }
        }
        return false
    }, [])

    const connect = useCallback(() => {
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
            return
        }

        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            const host = window.location.host || 'localhost:3001'
            const wsUrl = `${protocol}//${host}/ws`

            const ws = new WebSocket(wsUrl)
            wsRef.current = ws

            ws.onopen = () => {
                setIsConnected(true)
                // Start 25s client-side heartbeat
                clearInterval(pingTimerRef.current)
                pingTimerRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        try { ws.send(JSON.stringify({ type: 'PING' })) } catch {}
                    }
                }, 25000)
            }

            ws.onclose = () => {
                setIsConnected(false)
                clearInterval(pingTimerRef.current)
                // Auto-reconnect with 3-second delay
                clearTimeout(reconnectTimerRef.current)
                reconnectTimerRef.current = setTimeout(() => {
                    connect()
                }, 3000)
            }

            ws.onerror = () => {
                // let onclose handle reconnect
            }

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    const { type, payload } = data

                    // 1. Maintain shared state caches
                    if (type === 'CONNECTED') {
                        if (data.crashRoom) setCrashRoomState(data.crashRoom)
                        if (Array.isArray(data.recentChat)) setChatMessages(data.recentChat)
                    } else if (type === 'CRASH_ROOM_STATE' && payload) {
                        setCrashRoomState(payload)
                    } else if (type === 'CRASH_ROOM_TICK' && payload) {
                        setCrashRoomState(prev => prev ? { ...prev, ...payload } : payload)
                    } else if (type === 'CRASH_ROOM_BUST' && payload) {
                        setCrashRoomState(prev => prev ? { ...prev, state: 'CRASHED', ...payload } : payload)
                    } else if (type === 'NEW_BET' && payload) {
                        setRecentBets(prev => [payload, ...prev.slice(0, 49)])
                    } else if (type === 'NEW_CHAT_MESSAGE' && payload) {
                        setChatMessages(prev => {
                            if (prev.some(m => m.id === payload.id)) return prev
                            return [...prev, payload].slice(-60)
                        })
                    } else if (type === 'RECENT_CHAT_HISTORY' && Array.isArray(payload)) {
                        setChatMessages(payload)
                    }

                    // 2. Dispatch to subscribed listeners
                    const cbs = subscribersRef.current.get(type)
                    if (cbs) {
                        cbs.forEach(cb => {
                            try { cb(payload, data) } catch (err) { console.error('[WS] Callback error:', err) }
                        })
                    }

                    // Also dispatch to wildcard '*' listeners
                    const allCbs = subscribersRef.current.get('*')
                    if (allCbs) {
                        allCbs.forEach(cb => {
                            try { cb(type, payload, data) } catch (err) { console.error('[WS] Callback error:', err) }
                        })
                    }
                } catch {
                    // Ignore malformed payloads
                }
            }
        } catch {
            clearTimeout(reconnectTimerRef.current)
            reconnectTimerRef.current = setTimeout(connect, 4000)
        }
    }, [])

    useEffect(() => {
        connect()

        return () => {
            clearTimeout(reconnectTimerRef.current)
            clearInterval(pingTimerRef.current)
            if (wsRef.current) {
                try { wsRef.current.close() } catch {}
                wsRef.current = null
            }
        }
    }, [connect])

    const value = {
        isConnected,
        crashRoomState,
        recentBets,
        chatMessages,
        subscribe,
        sendJson
    }

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    )
}

export function useWebSocket() {
    const context = useContext(WebSocketContext)
    if (!context) {
        throw new Error('useWebSocket must be used within a WebSocketProvider')
    }
    return context
}

export default WebSocketContext
