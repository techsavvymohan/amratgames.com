import React, { useRef, useEffect, useMemo, useCallback } from 'react'
import { Tag, Typography, Badge } from 'antd'
import { WifiOutlined } from '@ant-design/icons'

const { Text, Title } = Typography

export const CRASH_GROWTH_RATE = 0.16

function GameChart({ phase, multiplier = 1.00, elapsedTime = 0, countdown = 0, flightStartTime = null }) {
    const canvasRef = useRef(null)
    const rocketRef = useRef(null)
    const exhaustRef = useRef(null)
    const explosionRef = useRef(null)
    const explosionTimeoutRef = useRef(null)
    const multiplierTextRef = useRef(null)
    const multiplierNumberRef = useRef(null)
    const totalTimeTextRef = useRef(null)

    // Canvas size & device pixel ratio
    const canvasSizeRef = useRef({ width: 0, height: 0, dpr: 1 })

    // Animation & synchronization refs
    const animFrameRef = useRef(null)
    const activeFlightStartRef = useRef(null)
    const maxElapsedRef = useRef(0)
    const lastRenderedRef = useRef({ elapsed: 0, multiplier: 1.00 })
    const phaseRef = useRef(phase)
    phaseRef.current = phase

    // Multiplier color palette helper
    const getMultiplierColor = useCallback((val, currentPhase = phaseRef.current) => {
        if (currentPhase === 'crashed') return '#ed4245'
        if (val >= 10) return '#35d06f'
        if (val >= 5) return '#ffc107'
        if (val >= 2) return '#f7931a'
        return '#ffffff'
    }, [])

    // Dynamic scaling for both axes (throttled by milestone steps to prevent React churn)
    const maxTime = useMemo(() => {
        return Math.max(elapsedTime + 2, 8)
    }, [Math.floor(elapsedTime / 2)])

    const maxMultiplier = useMemo(() => {
        return Math.max(multiplier * 1.3, 2)
    }, [Math.floor(multiplier * 2)])

    // Y-axis labels
    const yAxisLabels = useMemo(() => {
        const roundedMax = Math.round(maxMultiplier * 10) / 10
        const labels = []
        const steps = 5
        for (let i = steps; i >= 0; i--) {
            const value = 1 + ((roundedMax - 1) * i / steps)
            labels.push(value.toFixed(1))
        }
        return labels
    }, [maxMultiplier])

    // X-axis labels
    const xAxisLabels = useMemo(() => {
        const roundedMax = Math.ceil(maxTime)
        const labels = []
        const step = Math.ceil(roundedMax / 4)
        for (let i = step; i <= roundedMax; i += step) {
            labels.push(i)
        }
        return labels
    }, [maxTime])

    // Core scene renderer — renders at native 60fps/120fps with sub-pixel precision
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
            ? { left: 40, right: 16, top: 25, bottom: 35 }
            : { left: 60, right: 30, top: 50, bottom: 60 }

        const chartWidth = Math.max(10, width - padding.left - padding.right)
        const chartHeight = Math.max(10, height - padding.top - padding.bottom)

        // Dynamic chart bounds
        const maxT = Math.max(curElapsed + 2, 8)
        const maxM = Math.max(curMult * 1.3, 2)

        const timeToX = (time) => padding.left + (time / maxT) * chartWidth
        const multiplierToY = (m) => {
            const normalized = (m - 1) / (maxM - 1)
            return height - padding.bottom - normalized * chartHeight
        }

        // 1. Grid lines (single stroke path)
        ctx.strokeStyle = 'rgba(47, 69, 83, 0.25)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 6])
        ctx.beginPath()

        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (chartHeight * i / 5)
            ctx.moveTo(padding.left, y)
            ctx.lineTo(width - padding.right, y)
        }
        for (let i = 0; i <= 4; i++) {
            const x = padding.left + (chartWidth * i / 4)
            ctx.moveTo(x, padding.top)
            ctx.lineTo(x, height - padding.bottom)
        }
        ctx.stroke()
        ctx.setLineDash([])

        const isFlying = (phaseRef.current === 'running' || phaseRef.current === 'crashed' || isCrashed) && (curElapsed > 0 || isCrashed)

        if (isFlying) {
            // Adaptive sample points along exponential curve
            const numPoints = Math.max(1, Math.min(180, Math.floor(curElapsed * 15)))
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

            // 2. Glowing Area Fill under curve
            const fillGradient = ctx.createLinearGradient(
                padding.left, height - padding.bottom,
                endX, endY
            )

            if (isCrashed) {
                fillGradient.addColorStop(0, 'rgba(237, 66, 69, 0.02)')
                fillGradient.addColorStop(0.5, 'rgba(237, 66, 69, 0.25)')
                fillGradient.addColorStop(1, 'rgba(237, 66, 69, 0.50)')
            } else {
                fillGradient.addColorStop(0, 'rgba(255, 165, 0, 0.02)')
                fillGradient.addColorStop(0.3, 'rgba(255, 165, 0, 0.15)')
                fillGradient.addColorStop(0.6, 'rgba(255, 180, 50, 0.35)')
                fillGradient.addColorStop(1, 'rgba(255, 200, 80, 0.60)')
            }

            ctx.beginPath()
            ctx.moveTo(padding.left, height - padding.bottom)
            for (let i = 0; i <= numPoints; i++) {
                ctx.lineTo(points[i].x, points[i].y)
            }
            ctx.lineTo(endX, height - padding.bottom)
            ctx.closePath()
            ctx.fillStyle = fillGradient
            ctx.fill()

            // 3. Wide Neon Outer Glow Stroke
            const lineColor = isCrashed ? '#ed4245' : '#f7931a'
            ctx.beginPath()
            ctx.moveTo(points[0].x, points[0].y)
            for (let i = 1; i <= numPoints; i++) {
                ctx.lineTo(points[i].x, points[i].y)
            }
            ctx.strokeStyle = isCrashed ? 'rgba(237, 66, 69, 0.25)' : 'rgba(247, 147, 26, 0.25)'
            ctx.lineWidth = isMobile ? 8 : 12
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.shadowColor = lineColor
            ctx.shadowBlur = 10
            ctx.stroke()
            ctx.shadowBlur = 0

            // 4. Sharp High-Definition Gradient Core Line
            const lineGradient = ctx.createLinearGradient(padding.left, 0, endX, 0)
            if (isCrashed) {
                lineGradient.addColorStop(0, '#f7931a')
                lineGradient.addColorStop(0.7, '#ed4245')
                lineGradient.addColorStop(1, '#ed4245')
            } else {
                lineGradient.addColorStop(0, '#f7931a')
                lineGradient.addColorStop(0.5, '#ffaa33')
                lineGradient.addColorStop(0.8, '#ffcc66')
                lineGradient.addColorStop(1, '#ffffff')
            }

            ctx.beginPath()
            ctx.moveTo(points[0].x, points[0].y)
            for (let i = 1; i <= numPoints; i++) {
                ctx.lineTo(points[i].x, points[i].y)
            }
            ctx.strokeStyle = lineGradient
            ctx.lineWidth = isMobile ? 3 : 4
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.stroke()

            // 5. Continuous Mathematical Tangent Angle along curve (zero discrete step jitter)
            let angle = -0.785398 // Default ~ -45deg
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

            // 6. Direct GPU Transform Updates (translate3d, zero reflow)
            if (rocketRef.current) {
                if (!isCrashed) {
                    rocketRef.current.style.display = 'block'
                    rocketRef.current.style.transform = `translate3d(${endX}px, ${endY}px, 0) translate(-50%, -50%) rotate(${angle}rad) rotate(90deg)`
                } else {
                    rocketRef.current.style.display = 'none'
                }
            }

            if (exhaustRef.current) {
                if (!isCrashed) {
                    exhaustRef.current.style.display = 'block'
                    const exhaustOffset = isMobile ? 55 : 85
                    exhaustRef.current.style.transform = `translate3d(${endX}px, ${endY}px, 0) translate(-50%, -50%) rotate(${angle}rad) rotate(90deg) translate(0px, ${exhaustOffset}px)`
                } else {
                    exhaustRef.current.style.display = 'none'
                }
            }

            if (explosionRef.current) {
                if (isCrashed) {
                    if (explosionRef.current.style.display !== 'block') {
                        explosionRef.current.style.display = 'block'
                        explosionRef.current.style.transform = `translate3d(${endX}px, ${endY}px, 0) translate(-50%, -50%)`
                        explosionRef.current.src = '/images/explosions/normal_explosion.gif'
                        if (explosionTimeoutRef.current) clearTimeout(explosionTimeoutRef.current)
                        explosionTimeoutRef.current = setTimeout(() => {
                            if (explosionRef.current) explosionRef.current.style.display = 'none'
                        }, 1400)
                    }
                } else {
                    explosionRef.current.style.display = 'none'
                    if (explosionTimeoutRef.current) {
                        clearTimeout(explosionTimeoutRef.current)
                        explosionTimeoutRef.current = null
                    }
                }
            }

            // 7. Microsecond-Accurate HUD Elements
            if (multiplierNumberRef.current) {
                multiplierNumberRef.current.textContent = curMult.toFixed(2)
            }
            if (multiplierTextRef.current) {
                const clr = isCrashed ? '#ed4245' : getMultiplierColor(curMult, isCrashed ? 'crashed' : 'running')
                multiplierTextRef.current.style.color = clr
                multiplierTextRef.current.style.textShadow = `0 0 40px ${clr}50, 0 0 80px ${clr}30`
            }
            if (totalTimeTextRef.current) {
                totalTimeTextRef.current.textContent = `Total ${Math.floor(curElapsed)}s`
            }
        } else {
            // IDLE or WAITING / READY state: Plane is PARKED on the launchpad at 1.00x!
            const startX = padding.left
            const startY = height - padding.bottom

            // Runway glowing dot
            ctx.beginPath()
            ctx.arc(startX, startY, isMobile ? 5 : 7, 0, Math.PI * 2)
            ctx.fillStyle = '#f7931a'
            ctx.shadowColor = '#f7931a'
            ctx.shadowBlur = 10
            ctx.fill()
            ctx.shadowBlur = 0

            if (rocketRef.current) {
                rocketRef.current.style.display = 'block'
                const parkX = startX + (isMobile ? 12 : 20)
                const parkY = startY - (isMobile ? 12 : 20)
                rocketRef.current.style.transform = `translate3d(${parkX}px, ${parkY}px, 0) translate(-50%, -50%) rotate(-45deg)`
            }
            if (exhaustRef.current) exhaustRef.current.style.display = 'none'
            if (explosionRef.current) explosionRef.current.style.display = 'none'

            if (multiplierNumberRef.current) {
                multiplierNumberRef.current.textContent = '1.00'
            }
            if (multiplierTextRef.current) {
                multiplierTextRef.current.style.color = '#ffffff'
                multiplierTextRef.current.style.textShadow = '0 0 40px rgba(255,255,255,0.3)'
            }
            if (totalTimeTextRef.current) {
                totalTimeTextRef.current.textContent = 'Total 0s'
            }
        }
    }, [getMultiplierColor])

    // High-performance 60fps/120fps flight animation loop (rock-solid, monotonic)
    useEffect(() => {
        if (phase === 'running') {
            // Resolve anchor start time
            let anchorTime = flightStartTime
            if (!anchorTime) {
                const estimatedSecs = Math.log(Math.max(1.0, multiplier)) / CRASH_GROWTH_RATE
                anchorTime = Date.now() - estimatedSecs * 1000
            }
            activeFlightStartRef.current = anchorTime
            maxElapsedRef.current = 0

            const loop = () => {
                const now = Date.now()
                const rawElapsed = Math.max(0, (now - activeFlightStartRef.current) / 1000)
                // STRICT MONOTONICITY: Elapsed flight time can NEVER decrease!
                const curElapsed = Math.max(maxElapsedRef.current, rawElapsed)
                maxElapsedRef.current = curElapsed

                const curMult = Math.max(1.00, Math.pow(Math.E, CRASH_GROWTH_RATE * curElapsed))

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
            const crashMult = typeof multiplier === 'number' && multiplier >= 1.0 ? multiplier : (lastRenderedRef.current.multiplier || 1.00)
            const crashElapsed = crashMult > 1.0 ? Math.log(crashMult) / CRASH_GROWTH_RATE : 0
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
    }, [phase, flightStartTime, drawScene])

    // Persistent single-instance ResizeObserver (never rebuilt on animation ticks)
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
    }, [drawScene])

    const getStatusText = () => {
        if (phase === 'idle') return 'Ready to Launch'
        if (phase === 'waiting') return `Starting in ${countdown.toFixed(1)}s`
        if (phase === 'crashed') return `Crashed @${multiplier.toFixed(2)}×`
        return null
    }

    return (
        <div className="chart-container-antd" style={{ position: 'relative' }}>
            <canvas ref={canvasRef} className="crash-canvas" />

            {/* In-game Overlay Assets */}
            <img
                ref={rocketRef}
                src="/images/spaceship.png"
                alt="Rocket"
                className="crash-rocket-img"
            />
            <img
                ref={exhaustRef}
                src="/images/exhaust/exhaust02_preview.gif"
                alt="Exhaust"
                className="crash-exhaust-img"
            />
            <img
                ref={explosionRef}
                src="/images/explosions/normal_explosion.gif"
                alt="Explosion"
                className="crash-explosion-img"
            />

            {/* Y Axis Labels */}
            <div className="y-axis-antd">
                {yAxisLabels.map((label, i) => (
                    <Text key={i} className="axis-label" type="secondary">
                        {label}×
                    </Text>
                ))}
            </div>

            {/* X Axis Labels */}
            <div className="x-axis-antd">
                {xAxisLabels.map(label => (
                    <Text key={label} type="secondary" className="x-label">
                        {label}s
                    </Text>
                ))}
                <Text type="secondary" className="total-time-antd">
                    <span ref={totalTimeTextRef}>Total {Math.floor(elapsedTime)}s</span>
                </Text>
            </div>

            {/* Multiplier Display */}
            <div className={`multiplier-container ${phase === 'crashed' ? 'crashed' : ''}`}>
                <Title
                    ref={multiplierTextRef}
                    level={1}
                    className="multiplier-title"
                    style={{
                        color: getMultiplierColor(multiplier, phase),
                        margin: 0,
                        fontWeight: 800,
                        letterSpacing: '-2px',
                        textShadow: `0 0 40px ${getMultiplierColor(multiplier, phase)}50, 0 0 80px ${getMultiplierColor(multiplier, phase)}30`,
                        transition: 'color 0.2s ease',
                        fontFamily: "'Inter', -apple-system, sans-serif"
                    }}
                >
                    <span ref={multiplierNumberRef}>
                        {phase === 'running' && lastRenderedRef.current.multiplier > 1.0
                            ? lastRenderedRef.current.multiplier.toFixed(2)
                            : multiplier.toFixed(2)}
                    </span>
                    <span className="multiplier-suffix">×</span>
                </Title>
            </div>

            {/* Status Message */}
            {(phase === 'idle' || phase === 'waiting' || phase === 'crashed') && (
                <div className="status-container">
                    <Tag
                        color={phase === 'crashed' ? 'error' : (phase === 'idle' ? 'processing' : 'warning')}
                        className="status-tag"
                        style={{
                            fontSize: 14,
                            padding: '6px 20px',
                            borderRadius: 24,
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase'
                        }}
                    >
                        {getStatusText()}
                    </Tag>
                </div>
            )}

            {/* Network Status */}
            <div className="network-indicator">
                <Badge status="success" />
                <WifiOutlined style={{ color: 'var(--success)', marginRight: 4 }} />
                <Text type="secondary" style={{ fontSize: 11 }}>Connected</Text>
            </div>
        </div>
    )
}

export default React.memo(GameChart, (prevProps, nextProps) => {
    // If phase changes, always re-render
    if (prevProps.phase !== nextProps.phase) return false
    // If waiting countdown changes, re-render HUD
    if (nextProps.phase === 'waiting' && prevProps.countdown !== nextProps.countdown) return false
    // If new flight anchor time initialized, re-render
    if (prevProps.flightStartTime !== nextProps.flightStartTime) return false
    // If crashed multiplier updates, re-render
    if (nextProps.phase === 'crashed' && prevProps.multiplier !== nextProps.multiplier) return false
    // While actively flying, RAF manages canvas, rocket, exhaust, and HUD DOM updates directly at 60-120fps.
    // Suppressing 10Hz React DOM re-renders completely eliminates visual text and transform stutter.
    if (nextProps.phase === 'running') return true
    return false
})
