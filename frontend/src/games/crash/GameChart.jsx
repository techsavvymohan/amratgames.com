import React, { useRef, useEffect, useMemo, useCallback } from 'react'
import { Tag, Typography } from 'antd'
import casinoAudio from '../../utils/casinoAudio'
import AviatorPlane from './AviatorPlane'

const { Text } = Typography

export const CRASH_GROWTH_RATE = 0.16

function GameChart({
    phase,
    multiplier = 1.00,
    elapsedTime = 0,
    countdown = 0,
    flightStartTime = null,
    onlinePlayersCount = 1385
}) {
    const canvasRef = useRef(null)
    const planeContainerRef = useRef(null)
    const multiplierNumberRef = useRef(null)
    const centerCardRef = useRef(null)
    const flewAwayRef = useRef(null)
    const milestoneFlashRef = useRef(null)
    const milestonesCrossedRef = useRef({ 5: false, 10: false, 50: false })

    // Canvas size & device pixel ratio
    const canvasSizeRef = useRef({ width: 0, height: 0, dpr: 1 })

    // Animation & synchronization refs
    const animFrameRef = useRef(null)
    const activeFlightStartRef = useRef(null)
    const maxElapsedRef = useRef(0)
    const lastRenderedRef = useRef({ elapsed: 0, multiplier: 1.00 })
    const phaseRef = useRef(phase)
    phaseRef.current = phase

    // Trigger sonic visual pulse on chart arena
    const triggerMilestoneFlash = useCallback((level) => {
        if (!milestoneFlashRef.current) return
        const el = milestoneFlashRef.current
        el.className = 'aviator-sonic-pulse'
        void el.offsetWidth // force DOM reflow to restart CSS animation
        el.className = `aviator-sonic-pulse pulse-${level}x`
    }, [])

    // Draw Aviator Radar Sunburst background + curved flight trajectory
    const drawScene = useCallback((curElapsed, curMult, isCrashed = false) => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        const { width, height, dpr } = canvasSizeRef.current
        if (width === 0 || height === 0) return

        lastRenderedRef.current = { elapsed: curElapsed, multiplier: curMult }

        // Reset transform to handle high DPI displays
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, width, height)

        const isMobile = width < 600
        const padding = isMobile
            ? { left: 16, right: 12, top: 12, bottom: 16 }
            : { left: 32, right: 24, top: 20, bottom: 24 }

        const chartWidth = Math.max(10, width - padding.left - padding.right)
        const chartHeight = Math.max(10, height - padding.top - padding.bottom)

        // Dynamic chart bounds
        const maxT = Math.max(curElapsed + 2, 8)
        const maxM = Math.max(curMult * 1.25, 2.0)

        const originX = padding.left
        const originY = height - padding.bottom

        const timeToX = (time) => padding.left + (time / maxT) * chartWidth
        const multiplierToY = (m) => {
            const normalized = (m - 1) / (maxM - 1)
            return originY - normalized * chartHeight
        }

        // 1. Draw Aviator Sunburst Rays / Radar Backdrop
        ctx.save()
        const rayCount = 14
        const maxRadius = Math.sqrt(width * width + height * height)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)'
        ctx.lineWidth = 1

        for (let i = 0; i <= rayCount; i++) {
            const angle = (Math.PI / 2) * (i / rayCount) - 0.05
            const x2 = originX + Math.cos(angle) * maxRadius
            const y2 = originY - Math.sin(angle) * maxRadius
            ctx.beginPath()
            ctx.moveTo(originX, originY)
            ctx.lineTo(x2, y2)
            ctx.stroke()
        }

        // Radar faint concentric distance arcs
        const arcSteps = 4
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)'
        for (let a = 1; a <= arcSteps; a++) {
            const r = (chartWidth * a) / arcSteps
            ctx.beginPath()
            ctx.arc(originX, originY, r, -Math.PI / 2, 0)
            ctx.stroke()
        }
        ctx.restore()

        const isFlying = (phaseRef.current === 'running' || phaseRef.current === 'crashed' || isCrashed) && (curElapsed > 0 || isCrashed)

        if (isFlying) {
            // Adaptive sample points along exponential curve
            const numPoints = Math.max(2, Math.min(180, Math.floor(curElapsed * 16)))
            const points = new Array(numPoints + 1)

            for (let i = 0; i <= numPoints; i++) {
                const ptTime = curElapsed > 0 ? (i / numPoints) * curElapsed : 0
                const ptMult = Math.max(1.00, Math.pow(Math.E, CRASH_GROWTH_RATE * ptTime))
                const x = timeToX(ptTime)
                const y = Math.max(padding.top, multiplierToY(ptMult))
                points[i] = { x, y }
            }

            const endX = timeToX(curElapsed)
            const endY = multiplierToY(curMult)

            // 2. Glowing Area Fill under the red curve
            const fillGradient = ctx.createLinearGradient(originX, originY, endX, endY)
            if (isCrashed) {
                fillGradient.addColorStop(0, 'rgba(225, 29, 72, 0.02)')
                fillGradient.addColorStop(0.4, 'rgba(225, 29, 72, 0.15)')
                fillGradient.addColorStop(1, 'rgba(225, 29, 72, 0.35)')
            } else {
                fillGradient.addColorStop(0, 'rgba(225, 29, 72, 0.03)')
                fillGradient.addColorStop(0.5, 'rgba(225, 29, 72, 0.22)')
                fillGradient.addColorStop(1, 'rgba(244, 63, 94, 0.50)')
            }

            ctx.beginPath()
            ctx.moveTo(originX, originY)
            for (let i = 0; i <= numPoints; i++) {
                ctx.lineTo(points[i].x, points[i].y)
            }
            ctx.lineTo(endX, originY)
            ctx.closePath()
            ctx.fillStyle = fillGradient
            ctx.fill()

            // 3. Neon Red Outer Glow Path
            ctx.beginPath()
            ctx.moveTo(points[0].x, points[0].y)
            for (let i = 1; i <= numPoints; i++) {
                ctx.lineTo(points[i].x, points[i].y)
            }
            ctx.strokeStyle = isCrashed ? 'rgba(225, 29, 72, 0.3)' : 'rgba(244, 63, 94, 0.35)'
            ctx.lineWidth = isMobile ? 8 : 12
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.shadowColor = '#e11d48'
            ctx.shadowBlur = 14
            ctx.stroke()
            ctx.shadowBlur = 0

            // 4. Sharp High-Definition Red Core Flight Line
            const lineGradient = ctx.createLinearGradient(originX, 0, endX, 0)
            if (isCrashed) {
                lineGradient.addColorStop(0, '#991b1b')
                lineGradient.addColorStop(1, '#e11d48')
            } else {
                lineGradient.addColorStop(0, '#be123c')
                lineGradient.addColorStop(0.5, '#e11d48')
                lineGradient.addColorStop(1, '#ff4d6d')
            }

            ctx.beginPath()
            ctx.moveTo(points[0].x, points[0].y)
            for (let i = 1; i <= numPoints; i++) {
                ctx.lineTo(points[i].x, points[i].y)
            }
            ctx.strokeStyle = lineGradient
            ctx.lineWidth = isMobile ? 3.5 : 4.5
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.stroke()

            // 5. Plane Tangent Angle along curve
            let angle = -0.65 // Default upward incline
            if (curElapsed > 0.001) {
                const prevDt = Math.min(0.04, curElapsed * 0.1)
                const prevTime = Math.max(0, curElapsed - prevDt)
                const prevX = timeToX(prevTime)
                const prevMult = Math.max(1.00, Math.pow(Math.E, CRASH_GROWTH_RATE * prevTime))
                const prevY = multiplierToY(prevMult)
                const dx = Math.max(0.0001, endX - prevX)
                const dy = endY - prevY
                angle = Math.atan2(dy, dx)
            }

            // 6. Position Aviator Plane via high-performance GPU translate3d
            if (planeContainerRef.current) {
                if (!isCrashed) {
                    planeContainerRef.current.style.display = 'block'
                    planeContainerRef.current.style.transform = `translate3d(${endX}px, ${endY}px, 0) translate(-30%, -50%) rotate(${angle}rad)`
                    planeContainerRef.current.style.opacity = '1'
                } else {
                    // Crashed: Plane zooms off the screen to the top right
                    planeContainerRef.current.style.transform = `translate3d(${endX + 160}px, ${endY - 140}px, 0) translate(-30%, -50%) rotate(${angle - 0.3}rad)`
                    planeContainerRef.current.style.opacity = '0'
                    planeContainerRef.current.style.transition = 'transform 0.8s ease-out, opacity 0.6s ease-out'
                }
            }

            // 7. Update Center Multiplier Display
            if (multiplierNumberRef.current) {
                const safeMult = (typeof curMult === 'number' && isFinite(curMult) && curMult >= 1.0)
                    ? Math.min(1000.0, curMult)
                    : 1.00
                multiplierNumberRef.current.textContent = `${safeMult.toFixed(2)}x`
            }
            if (centerCardRef.current) {
                if (isCrashed) {
                    centerCardRef.current.classList.add('crashed')
                    if (flewAwayRef.current) flewAwayRef.current.style.display = 'block'
                } else {
                    centerCardRef.current.classList.remove('crashed')
                    if (flewAwayRef.current) flewAwayRef.current.style.display = 'none'
                }
            }
        } else {
            // IDLE or WAITING / READY state: Plane parked at bottom-left runway
            if (planeContainerRef.current) {
                planeContainerRef.current.style.display = 'block'
                planeContainerRef.current.style.transition = 'none'
                planeContainerRef.current.style.opacity = '1'
                const parkX = originX + (isMobile ? 18 : 28)
                const parkY = originY - (isMobile ? 14 : 20)
                planeContainerRef.current.style.transform = `translate3d(${parkX}px, ${parkY}px, 0) translate(-30%, -50%) rotate(-0.35rad)`
            }

            if (multiplierNumberRef.current) {
                multiplierNumberRef.current.textContent = '1.00x'
            }
            if (centerCardRef.current) {
                centerCardRef.current.classList.remove('crashed')
            }
            if (flewAwayRef.current) {
                flewAwayRef.current.style.display = 'none'
            }
        }
    }, [])

    // Pause animation when tab is hidden (e.g. mobile lock) and reset clock on wake-up
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                if (animFrameRef.current) {
                    cancelAnimationFrame(animFrameRef.current)
                    animFrameRef.current = null
                }
            } else {
                maxElapsedRef.current = 0
                if (phase === 'running') {
                    const safeM = Math.min(1000.0, Math.max(1.0, multiplier || 1.0))
                    const estimatedSecs = Math.log(safeM) / CRASH_GROWTH_RATE
                    activeFlightStartRef.current = Date.now() - estimatedSecs * 1000
                }
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [phase, multiplier])

    // Re-anchor to authoritative server multiplier if client drifted (e.g. background tab)
    useEffect(() => {
        if (phase === 'running' && multiplier && multiplier >= 1.0) {
            const safeM = Math.min(1000.0, multiplier)
            const serverElapsed = Math.log(safeM) / CRASH_GROWTH_RATE
            const expectedAnchor = Date.now() - serverElapsed * 1000
            if (!activeFlightStartRef.current || Math.abs(activeFlightStartRef.current - expectedAnchor) > 1500) {
                activeFlightStartRef.current = expectedAnchor
                maxElapsedRef.current = Math.min(50, serverElapsed)
            }
        }
    }, [multiplier, phase])

    // 60fps/120fps flight animation loop with strict bounds check
    useEffect(() => {
        if (phase === 'running') {
            milestonesCrossedRef.current = { 5: false, 10: false, 50: false }
            let anchorTime = flightStartTime
            if (!anchorTime) {
                const safeM = Math.min(1000.0, Math.max(1.0, multiplier || 1.0))
                const estimatedSecs = Math.log(safeM) / CRASH_GROWTH_RATE
                anchorTime = Date.now() - estimatedSecs * 1000
            }
            activeFlightStartRef.current = anchorTime
            maxElapsedRef.current = 0

            const loop = () => {
                const now = Date.now()
                const rawElapsed = Math.max(0, (now - activeFlightStartRef.current) / 1000)

                // Safety timeout: Maximum possible flight duration is 50 seconds (1000x takes 43.1s)
                // If rawElapsed exceeds 55s or anchor time is older than 60s, client desynced (e.g. phone was locked/asleep)
                if (rawElapsed > 55 || (now - activeFlightStartRef.current) > 60000) {
                    animFrameRef.current = null
                    return
                }

                const curElapsed = Math.min(50, Math.max(maxElapsedRef.current, rawElapsed))
                maxElapsedRef.current = curElapsed

                const curMult = Math.min(1000.0, Math.max(1.00, Math.pow(Math.E, CRASH_GROWTH_RATE * curElapsed)))

                // Multiplayer Sound Atmosphere: subtle jet engine sound acceleration as multiplier crosses 5x, 10x, and 50x
                if (curMult >= 5.0 && !milestonesCrossedRef.current[5]) {
                    milestonesCrossedRef.current[5] = true
                    casinoAudio.playJetAcceleration?.(5)
                    triggerMilestoneFlash(5)
                }
                if (curMult >= 10.0 && !milestonesCrossedRef.current[10]) {
                    milestonesCrossedRef.current[10] = true
                    casinoAudio.playJetAcceleration?.(10)
                    triggerMilestoneFlash(10)
                }
                if (curMult >= 50.0 && !milestonesCrossedRef.current[50]) {
                    milestonesCrossedRef.current[50] = true
                    casinoAudio.playJetAcceleration?.(50)
                    triggerMilestoneFlash(50)
                }

                drawScene(curElapsed, curMult, false)

                animFrameRef.current = requestAnimationFrame(loop)
            }

            animFrameRef.current = requestAnimationFrame(loop)

            return () => {
                if (animFrameRef.current) {
                    cancelAnimationFrame(animFrameRef.current)
                    animFrameRef.current = null
                }
            }
        } else if (phase === 'crashed') {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current)
                animFrameRef.current = null
            }
            activeFlightStartRef.current = null
            maxElapsedRef.current = 0
            const rawCrashMult = typeof multiplier === 'number' && multiplier >= 1.0 ? multiplier : (lastRenderedRef.current.multiplier || 1.00)
            const crashMult = Math.min(1000.0, Math.max(1.00, rawCrashMult))
            const crashElapsed = crashMult > 1.0 ? Math.min(50, Math.log(crashMult) / CRASH_GROWTH_RATE) : 0
            drawScene(crashElapsed, crashMult, true)
        } else {
            // idle or waiting
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current)
                animFrameRef.current = null
            }
            activeFlightStartRef.current = null
            maxElapsedRef.current = 0
            drawScene(0, 1.00, false)
        }
    }, [phase, flightStartTime, drawScene, multiplier])

    // ResizeObserver for canvas
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const handleResize = (entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect
                if (width > 0 && height > 0) {
                    const dpr = window.devicePixelRatio || 1
                    canvas.width = width * dpr
                    canvas.height = height * dpr
                    canvasSizeRef.current = { width, height, dpr }

                    if (phaseRef.current === 'running' && activeFlightStartRef.current) {
                        const curElapsed = Math.max(0, (Date.now() - activeFlightStartRef.current) / 1000)
                        const curMult = Math.max(1.00, Math.pow(Math.E, CRASH_GROWTH_RATE * curElapsed))
                        drawScene(curElapsed, curMult, false)
                    } else if (phaseRef.current === 'crashed') {
                        const crashMult = multiplier > 1.0 ? multiplier : lastRenderedRef.current.multiplier
                        const crashElapsed = Math.log(Math.max(1.0, crashMult)) / CRASH_GROWTH_RATE
                        drawScene(crashElapsed, crashMult, true)
                    } else {
                        drawScene(0, 1.00, false)
                    }
                }
            }
        }

        const observer = new ResizeObserver(handleResize)
        observer.observe(canvas)

        const rect = canvas.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
            const dpr = window.devicePixelRatio || 1
            canvas.width = rect.width * dpr
            canvas.height = rect.height * dpr
            canvasSizeRef.current = { width: rect.width, height: rect.height, dpr }
            drawScene(0, 1.00, false)
        }

        return () => observer.disconnect()
    }, [drawScene, multiplier])

    const isWaiting = phase === 'waiting'
    const isRunning = phase === 'running'
    const isCrashed = phase === 'crashed'

    return (
        <div className="aviator-chart-arena">
            <canvas ref={canvasRef} className="aviator-canvas" />

            {/* Jet Engine Acceleration Sonic Flash Pulse */}
            <div ref={milestoneFlashRef} className="aviator-sonic-pulse" />

            {/* Aviator Red Propeller Plane Element */}
            <div
                ref={planeContainerRef}
                className="aviator-plane-anchor"
                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 10 }}
            >
                <AviatorPlane isSpinning={isRunning || isWaiting} />
            </div>

            {/* Center Multiplier Display */}
            <div className="aviator-center-hud" ref={centerCardRef}>
                {isCrashed && (
                    <div ref={flewAwayRef} className="aviator-flew-away-text">
                        FLEW AWAY!
                    </div>
                )}

                <div
                    ref={multiplierNumberRef}
                    className={`aviator-multiplier-val ${isCrashed ? 'crashed-val' : ''}`}
                >
                    {isCrashed
                        ? `${Math.min(1000.0, Math.max(1.0, multiplier || 1.00)).toFixed(2)}x`
                        : (isRunning && lastRenderedRef.current.multiplier > 1.0
                            ? `${Math.min(1000.0, Math.max(1.0, lastRenderedRef.current.multiplier)).toFixed(2)}x`
                            : `${Math.min(1000.0, Math.max(1.0, multiplier || 1.00)).toFixed(2)}x`)}
                </div>

                {/* Waiting Countdown bar */}
                {isWaiting && (
                    <div className="aviator-waiting-box">
                        <div className="waiting-title">WAITING FOR NEXT ROUND</div>
                        <div className="waiting-bar-track">
                            <div
                                className="waiting-bar-progress"
                                style={{ width: `${Math.min(100, Math.max(0, (countdown / 6) * 100))}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* In-Canvas Active Players Online Badge (bottom-right, exactly like screenshot) */}
            <div className="aviator-in-canvas-players-badge">
                <div className="avatar-stack">
                    <span className="mini-avatar avatar-1">✈️</span>
                    <span className="mini-avatar avatar-2">👤</span>
                    <span className="mini-avatar avatar-3">🟢</span>
                </div>
                <span className="players-count-num">
                    {Number(onlinePlayersCount || 1385).toLocaleString()}
                </span>
            </div>
        </div>
    )
}

export default React.memo(GameChart, (prevProps, nextProps) => {
    if (prevProps.phase !== nextProps.phase) return false
    if (nextProps.phase === 'waiting' && prevProps.countdown !== nextProps.countdown) return false
    if (prevProps.flightStartTime !== nextProps.flightStartTime) return false
    if (nextProps.phase === 'crashed' && prevProps.multiplier !== nextProps.multiplier) return false
    if (prevProps.onlinePlayersCount !== nextProps.onlinePlayersCount) return false
    if (nextProps.phase === 'running') return true
    return false
})
