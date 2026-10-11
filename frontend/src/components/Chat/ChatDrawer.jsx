import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWebSocket } from '../../context/WebSocketContext'
import './ChatDrawer.css'

export default function ChatDrawer({ isOpen, onClose, onOpenVerifier }) {
    const { user, token, openAuthModal } = useAuth()
    const { chatMessages: sharedChatMessages, subscribe } = useWebSocket()
    const [messages, setMessages] = useState([])
    const [inputText, setInputText] = useState('')
    const [cooldown, setCooldown] = useState(0)
    const [isSending, setIsSending] = useState(false)
    const [showRainModal, setShowRainModal] = useState(false)
    const [rainAmount, setRainAmount] = useState('100')
    const [rainWinners, setRainWinners] = useState('3')
    const [rainStatus, setRainStatus] = useState('')
    const [isSharingBet, setIsSharingBet] = useState(false)

    const messagesEndRef = useRef(null)
    const cooldownTimerRef = useRef(null)

    // Scroll chat to bottom
    const scrollToBottom = useCallback((smooth = true) => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
        }
    }, [])

    // Sync from shared WebSocket context
    useEffect(() => {
        if (Array.isArray(sharedChatMessages) && sharedChatMessages.length > 0) {
            setMessages(sharedChatMessages)
            setTimeout(() => scrollToBottom(false), 50)
        }
    }, [sharedChatMessages, scrollToBottom])

    // Fetch initial chat messages via REST fallback
    const fetchChatMessages = useCallback(async () => {
        try {
            const res = await fetch('/api/community/chat/messages?limit=50')
            if (res.ok) {
                const data = await res.json()
                if (data.success && Array.isArray(data.messages)) {
                    setMessages(data.messages)
                    setTimeout(() => scrollToBottom(false), 50)
                }
            }
        } catch (err) {
            console.error('Failed to load chat history:', err)
        }
    }, [scrollToBottom])

    // Real-time message streaming via shared WebSocket
    useEffect(() => {
        fetchChatMessages()

        const unsubMessage = subscribe('NEW_CHAT_MESSAGE', (payload) => {
            if (payload) {
                setMessages((prev) => {
                    if (prev.some((m) => m.id === payload.id)) return prev
                    return [...prev, payload].slice(-60)
                })
                setTimeout(() => scrollToBottom(true), 50)
            }
        })

        const unsubHistory = subscribe('RECENT_CHAT_HISTORY', (payload) => {
            if (Array.isArray(payload)) {
                setMessages(payload)
                setTimeout(() => scrollToBottom(false), 50)
            }
        })

        const pollInterval = setInterval(fetchChatMessages, 15000)

        return () => {
            clearInterval(pollInterval)
            unsubMessage()
            unsubHistory()
        }
    }, [fetchChatMessages, scrollToBottom, subscribe])

    // Cooldown timer ticker
    useEffect(() => {
        if (cooldown > 0) {
            cooldownTimerRef.current = setTimeout(() => {
                setCooldown((c) => Math.max(0, c - 1))
            }, 1000)
        }
        return () => clearTimeout(cooldownTimerRef.current)
    }, [cooldown])

    // Send chat message
    const handleSendMessage = async (e) => {
        if (e) e.preventDefault()
        if (!user) {
            openAuthModal?.('login')
            return
        }

        const cleanText = inputText.trim()
        if (!cleanText || cooldown > 0 || isSending) return

        setIsSending(true)
        try {
            const res = await fetch('/api/community/chat/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ text: cleanText })
            })

            const data = await res.json()
            if (res.ok && data.success) {
                setInputText('')
                setCooldown(2) // 2s slow mode cooldown
                setMessages((prev) => {
                    if (prev.some((m) => m.id === data.message.id)) return prev
                    return [...prev, data.message].slice(-60)
                })
                setTimeout(() => scrollToBottom(true), 50)
            } else {
                alert(data.error || 'Failed to send message')
            }
        } catch {
            alert('Network error sending message')
        } finally {
            setIsSending(false)
        }
    }

    // Share player's latest bet
    const handleShareLatestBet = async () => {
        if (!user) {
            openAuthModal?.('login')
            return
        }

        setIsSharingBet(true)
        try {
            // Fetch player's bets from API
            const res = await fetch('/api/auth/profile/bets?limit=1', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            const latestBet = data.bets?.[0]

            if (!latestBet) {
                alert('Place a bet first before sharing to community chat!')
                return
            }

            const shareRes = await fetch('/api/community/chat/share-bet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ betId: latestBet.id })
            })

            const shareData = await shareRes.json()
            if (shareRes.ok && shareData.success) {
                setCooldown(2)
                setMessages((prev) => {
                    if (prev.some((m) => m.id === shareData.message.id)) return prev
                    return [...prev, shareData.message].slice(-60)
                })
                setTimeout(() => scrollToBottom(true), 50)
            } else {
                alert(shareData.error || 'Failed to share bet')
            }
        } catch {
            alert('Error sharing bet')
        } finally {
            setIsSharingBet(false)
        }
    }

    // Trigger Chat Rain drop
    const handleTriggerRain = async (e) => {
        e.preventDefault()
        if (!user) {
            openAuthModal?.('login')
            return
        }

        const amt = parseFloat(rainAmount)
        const winners = parseInt(rainWinners, 10)
        if (isNaN(amt) || amt < 50) {
            setRainStatus('Minimum rain amount is ₹50')
            return
        }
        if (isNaN(winners) || winners < 2 || winners > 20) {
            setRainStatus('Winners must be between 2 and 20')
            return
        }

        setRainStatus('Processing rain drop...')
        try {
            const res = await fetch('/api/community/chat/rain', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ amount: amt, numWinners: winners, currency: 'INR' })
            })

            const data = await res.json()
            if (res.ok && data.success) {
                setShowRainModal(false)
                setRainStatus('')
                setMessages((prev) => {
                    if (prev.some((m) => m.id === data.rainMessage.id)) return prev
                    return [...prev, data.rainMessage].slice(-60)
                })
                setTimeout(() => scrollToBottom(true), 50)
            } else {
                setRainStatus(data.error || 'Failed to sponsor rain')
            }
        } catch {
            setRainStatus('Network error sponsoring rain')
        }
    }

    // VIP badge helper
    const getVipBadge = (vipTier) => {
        switch (String(vipTier).toLowerCase()) {
            case 'diamond':
                return { label: 'Diamond', icon: '👑', color: '#ffb703' }
            case 'platinum':
                return { label: 'Platinum', icon: '💎', color: '#00b4d8' }
            case 'gold':
                return { label: 'Gold', icon: '🥇', color: '#e0a96d' }
            case 'silver':
                return { label: 'Silver', icon: '🥈', color: '#c0c0c0' }
            default:
                return { label: 'Bronze', icon: '🥉', color: '#cd7f32' }
        }
    }

    // Format timestamp
    const formatTime = (isoString) => {
        if (!isoString) return ''
        try {
            const d = new Date(isoString)
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        } catch {
            return ''
        }
    }

    if (!isOpen) return null

    return (
        <aside className="chat-drawer-container" aria-label="Community Live Chat">
            {/* Header */}
            <div className="chat-drawer-header">
                <div className="chat-header-title-box">
                    <div className="chat-live-pulse" />
                    <div>
                        <h3 className="chat-header-title">Live Community</h3>
                        <span className="chat-header-subtitle">India's Provably Fair Gamers</span>
                    </div>
                </div>
                <button
                    className="chat-close-btn"
                    onClick={onClose}
                    aria-label="Close Chat"
                    title="Close Chat"
                >
                    ✕
                </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="chat-quick-actions">
                <button
                    className="chat-quick-btn chat-rain-quick-btn"
                    onClick={() => setShowRainModal(true)}
                    title="Drop free rupees to active chatters"
                >
                    🌧️ Chat Rain
                </button>
                <button
                    className="chat-quick-btn"
                    onClick={handleShareLatestBet}
                    disabled={isSharingBet}
                    title="Share your latest winning bet"
                >
                    {isSharingBet ? 'Sharing...' : '📋 Share Last Bet'}
                </button>
            </div>

            {/* Chat Messages Feed */}
            <div className="chat-messages-scroll">
                {messages.length === 0 ? (
                    <div className="chat-empty-state">
                        <span className="chat-empty-icon">💬</span>
                        <p>No messages yet. Say hello to the community!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const vip = getVipBadge(msg.vipTier)

                        // 1. Rain Drop Card
                        if (msg.type === 'rain_drop') {
                            return (
                                <div key={msg.id} className="chat-rain-card">
                                    <div className="chat-rain-header">
                                        <span className="chat-rain-emoji">🌧️</span>
                                        <span className="chat-rain-title">COMMUNITY RAIN DROP!</span>
                                    </div>
                                    <div className="chat-rain-body">
                                        <p className="chat-rain-text">{msg.text}</p>
                                        {msg.rainDetails?.winners && (
                                            <div className="chat-rain-winners-list">
                                                {msg.rainDetails.winners.map((w, idx) => (
                                                    <span key={idx} className="chat-rain-winner-pill">
                                                        @{w.username} (+₹{w.prizeAmount})
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <span className="chat-msg-time">{formatTime(msg.createdAt)}</span>
                                </div>
                            )
                        }

                        // 2. Bet Slip Share Card
                        if (msg.type === 'bet_share' && msg.sharedBet) {
                            const b = msg.sharedBet
                            const isWin = Boolean(b.won)
                            return (
                                <div key={msg.id} className="chat-msg-row">
                                    <div className="chat-msg-user-line">
                                        <span
                                            className="chat-vip-badge"
                                            style={{ borderColor: vip.color, color: vip.color }}
                                            title={`VIP ${vip.label}`}
                                        >
                                            {vip.icon} {vip.label}
                                        </span>
                                        <span className="chat-username">{msg.username}</span>
                                        <span className="chat-msg-time">{formatTime(msg.createdAt)}</span>
                                    </div>
                                    <div className={`chat-bet-card ${isWin ? 'chat-bet-card-win' : 'chat-bet-card-loss'}`}>
                                        <div className="chat-bet-card-top">
                                            <span className="chat-bet-game-tag">
                                                🎲 {b.gameName || b.game?.toUpperCase()}
                                            </span>
                                            <span className={`chat-bet-badge ${isWin ? 'badge-won' : 'badge-lost'}`}>
                                                {isWin ? 'WON' : 'BUST'}
                                            </span>
                                        </div>
                                        <div className="chat-bet-card-stats">
                                            <div className="chat-bet-stat-col">
                                                <span className="chat-bet-label">Multiplier</span>
                                                <span className="chat-bet-value chat-bet-mult">
                                                    {(b.multiplier || 0).toFixed(2)}x
                                                </span>
                                            </div>
                                            <div className="chat-bet-stat-col">
                                                <span className="chat-bet-label">Wager</span>
                                                <span className="chat-bet-value">
                                                    ₹{parseFloat(b.betAmount || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="chat-bet-stat-col">
                                                <span className="chat-bet-label">Payout</span>
                                                <span className="chat-bet-value chat-bet-payout">
                                                    ₹{parseFloat(b.payout || 0).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                        {onOpenVerifier && (
                                            <button
                                                className="chat-bet-verify-btn"
                                                onClick={() => onOpenVerifier({ game: b.game, bet: b })}
                                            >
                                                ⚖️ Verify Provably Fair
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        }

                        // 3. Regular Chat Message
                        return (
                            <div key={msg.id} className="chat-msg-row">
                                <div className="chat-msg-user-line">
                                    <span
                                        className="chat-vip-badge"
                                        style={{ borderColor: vip.color, color: vip.color }}
                                        title={`VIP ${vip.label}`}
                                    >
                                        {vip.icon} {vip.label}
                                    </span>
                                    <span className="chat-username">{msg.username}</span>
                                    <span className="chat-msg-time">{formatTime(msg.createdAt)}</span>
                                </div>
                                <div className="chat-msg-text-bubble">
                                    {msg.text}
                                </div>
                            </div>
                        )
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="chat-drawer-footer">
                {!user ? (
                    <div className="chat-auth-prompt">
                        <p>Sign in to chat with other players & win Rain Drops!</p>
                        <button
                            className="chat-auth-login-btn"
                            onClick={() => openAuthModal?.('login')}
                        >
                            Log In / Register
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSendMessage} className="chat-input-form">
                        <input
                            type="text"
                            className="chat-text-input"
                            placeholder={cooldown > 0 ? `Slow mode: wait ${cooldown}s...` : 'Message the community...'}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            maxLength={200}
                            disabled={cooldown > 0 || isSending}
                        />
                        <button
                            type="submit"
                            className="chat-send-btn"
                            disabled={!inputText.trim() || cooldown > 0 || isSending}
                        >
                            {cooldown > 0 ? `${cooldown}s` : '➤'}
                        </button>
                    </form>
                )}
            </div>

            {/* Sponsoring Rain Modal */}
            {showRainModal && (
                <div className="chat-modal-overlay">
                    <div className="chat-modal-dialog">
                        <div className="chat-modal-header">
                            <h4>🌧️ Sponsor Chat Rain</h4>
                            <button
                                className="chat-modal-close"
                                onClick={() => {
                                    setShowRainModal(false)
                                    setRainStatus('')
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleTriggerRain} className="chat-modal-form">
                            <p className="chat-rain-explainer">
                                Reward recent active chatters directly with cash from your balance!
                            </p>
                            <label className="chat-modal-label">
                                Total Drop Amount (₹)
                                <input
                                    type="number"
                                    min="50"
                                    step="10"
                                    value={rainAmount}
                                    onChange={(e) => setRainAmount(e.target.value)}
                                    className="chat-modal-input"
                                    required
                                />
                            </label>
                            <label className="chat-modal-label">
                                Number of Lucky Winners
                                <input
                                    type="number"
                                    min="2"
                                    max="20"
                                    value={rainWinners}
                                    onChange={(e) => setRainWinners(e.target.value)}
                                    className="chat-modal-input"
                                    required
                                />
                            </label>

                            {rainStatus && <div className="chat-rain-status-text">{rainStatus}</div>}

                            <div className="chat-modal-actions">
                                <button
                                    type="button"
                                    className="chat-btn-secondary"
                                    onClick={() => setShowRainModal(false)}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="chat-btn-primary">
                                    Drop Rain (₹{rainAmount})
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </aside>
    )
}
