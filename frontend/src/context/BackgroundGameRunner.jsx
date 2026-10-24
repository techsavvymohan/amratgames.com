import { useEffect, useRef } from 'react'
import { useWebSocket } from './WebSocketContext'
import { useWallet } from './WalletContext'
import { useAuth } from './AuthContext'

/**
 * BackgroundGameRunner
 * Stays mounted at application root to guarantee 24/7 background continuous execution
 * for Color Match (Win Go) and Aviator (Crash). If player enables Auto-Betting / Auto-Run,
 * bets will continue to be placed across global rounds even if user navigates to another page.
 */
export default function BackgroundGameRunner() {
    const { crashRoomState, colorGameState, subscribe } = useWebSocket()
    const { placeRoomCrashBet, placeColorMatchRoomBet, balance, currencySymbol, showToast } = useWallet()
    const { user } = useAuth()

    const lastWingoBetPeriodRef = useRef(null)
    const lastAviatorBetRoundRef = useRef(null)
    const balanceRef = useRef(balance)
    balanceRef.current = balance

    // ─────────────────────────────────────────────────────────────
    // 1. COLOR MATCH / WIN GO AUTO-RUN BACKGROUND TICKER
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user || !colorGameState) return

        const isWingoAutoRunning = localStorage.getItem('amrat_wingo_autorun_enabled') === 'true'
        if (!isWingoAutoRunning) return

        const currentPeriod = colorGameState.periodId
        const timeLeft = colorGameState.timeLeft
        const isLocked = colorGameState.isLocked

        // Check if round is open for betting (> 5s remaining) and not already placed
        if (currentPeriod && timeLeft > 6 && !isLocked && lastWingoBetPeriodRef.current !== currentPeriod) {
            try {
                const rawTemplate = localStorage.getItem('amrat_wingo_autorun_template')
                if (!rawTemplate) return
                const template = JSON.parse(rawTemplate)
                const templateTotal = Object.values(template).reduce((a, b) => a + (Number(b) || 0), 0)

                if (templateTotal > 0) {
                    if (balanceRef.current >= templateTotal) {
                        lastWingoBetPeriodRef.current = currentPeriod
                        placeColorMatchRoomBet({
                            periodId: currentPeriod,
                            bets: template
                        }).then((res) => {
                            if (res && res.success) {
                                // Round stake registered successfully in background
                            } else if (res && res.code === 'ROUND_LOCKED') {
                                // Round locked; wait for next cycle
                            } else if (res && !res.success) {
                                // Stop auto run if insufficient balance
                                if (res.error && res.error.includes('balance')) {
                                    localStorage.removeItem('amrat_wingo_autorun_enabled')
                                    showToast('error', 'Auto Run Paused', 'Insufficient balance')
                                }
                            }
                        }).catch(() => {})
                    } else {
                        localStorage.removeItem('amrat_wingo_autorun_enabled')
                        showToast('error', 'Auto Run Paused', 'Insufficient balance')
                    }
                }
            } catch {
                // Ignore parse errors
            }
        }
    }, [colorGameState, user, placeColorMatchRoomBet, showToast])

    // ─────────────────────────────────────────────────────────────
    // 2. AVIATOR / CRASH AUTO-BET BACKGROUND TICKER
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user || !crashRoomState) return

        const currentRoundId = crashRoomState.roundId
        const currentState = crashRoomState.state

        if (currentState === 'WAITING' && currentRoundId && lastAviatorBetRoundRef.current !== currentRoundId) {
            // Check Panel 1 auto-bet
            const isP1Auto = localStorage.getItem('amrat_aviator_autobet_p1') === 'true'
            if (isP1Auto) {
                const p1Amount = parseFloat(localStorage.getItem('amrat_aviator_amount_p1') || '25')
                const p1AutoCashout = localStorage.getItem('amrat_aviator_autocashout_enabled_p1') === 'true'
                    ? parseFloat(localStorage.getItem('amrat_aviator_autocashout_mult_p1') || '2.00')
                    : null

                if (p1Amount > 0 && balanceRef.current >= p1Amount) {
                    lastAviatorBetRoundRef.current = currentRoundId
                    placeRoomCrashBet({
                        betAmount: p1Amount,
                        autoCashout: p1AutoCashout,
                        panelId: 1
                    }).catch(() => {})
                }
            }

            // Check Panel 2 auto-bet
            const isP2Auto = localStorage.getItem('amrat_aviator_autobet_p2') === 'true'
            if (isP2Auto) {
                const p2Amount = parseFloat(localStorage.getItem('amrat_aviator_amount_p2') || '25')
                const p2AutoCashout = localStorage.getItem('amrat_aviator_autocashout_enabled_p2') === 'true'
                    ? parseFloat(localStorage.getItem('amrat_aviator_autocashout_mult_p2') || '2.00')
                    : null

                if (p2Amount > 0 && balanceRef.current >= p2Amount) {
                    placeRoomCrashBet({
                        betAmount: p2Amount,
                        autoCashout: p2AutoCashout,
                        panelId: 2
                    }).catch(() => {})
                }
            }
        }
    }, [crashRoomState, user, placeRoomCrashBet])

    // Listen for global settlement events to display win toasts even from other pages
    useEffect(() => {
        const unsub = subscribe('COLOR_GAME_PLAYER_SETTLEMENT', (payload) => {
            if (user && payload.userId === user.id && payload.won && payload.payout > 0) {
                showToast(
                    'win',
                    `+${currencySymbol}${Number(payload.payout).toFixed(2)}`,
                    `Win Go Period ${payload.periodId}`,
                    1000
                )
            }
        })
        return () => {
            if (typeof unsub === 'function') unsub()
        }
    }, [subscribe, user, currencySymbol, showToast])

    return null
}
