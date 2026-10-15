import { useEffect, useRef } from 'react'

/**
 * High-performance HTML5 Canvas particle system for Coin Toss:
 * - Flipping golden sparkle trails
 * - Landing impact shockwave ripples (subtle, clean, and positioned at coin base)
 * - Grand win celebration coin fountains & star confetti
 */
export default function CoinParticles({
    isFlipping,
    landingTrigger,
    winTrigger
}) {
    const canvasRef = useRef(null)
    const animRef = useRef(null)
    const particlesRef = useRef([])
    const shockwavesRef = useRef([])
    const isFlippingRef = useRef(isFlipping)

    useEffect(() => {
        isFlippingRef.current = isFlipping
    }, [isFlipping])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let width = (canvas.width = canvas.offsetWidth || 400)
        let height = (canvas.height = canvas.offsetHeight || 380)

        const handleResize = () => {
            if (!canvas) return
            width = canvas.width = canvas.offsetWidth || 400
            height = canvas.height = canvas.offsetHeight || 380
        }
        window.addEventListener('resize', handleResize)

        const loop = () => {
            ctx.clearRect(0, 0, width, height)

            // 1. Draw & Update Shockwaves
            for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
                const sw = shockwavesRef.current[i]
                sw.radius += sw.speed
                sw.alpha -= 0.04

                if (sw.alpha <= 0) {
                    shockwavesRef.current.splice(i, 1)
                    continue
                }

                ctx.save()
                ctx.beginPath()
                ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2)
                ctx.strokeStyle = `rgba(245, 158, 11, ${Math.max(0, sw.alpha)})`
                ctx.lineWidth = sw.lineWidth
                ctx.shadowColor = '#f59e0b'
                ctx.shadowBlur = 8
                ctx.stroke()
                ctx.restore()
            }

            // 2. Draw & Update Particles
            for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                const p = particlesRef.current[i]
                p.x += p.vx
                p.y += p.vy
                p.vy += p.gravity || 0.12
                p.rotation += p.rotSpeed || 0.05
                p.life++

                const progress = p.life / p.maxLife
                const alpha = Math.max(0, 1 - progress)

                if (p.life >= p.maxLife) {
                    particlesRef.current.splice(i, 1)
                    continue
                }

                ctx.save()
                ctx.translate(p.x, p.y)
                ctx.rotate(p.rotation)
                ctx.globalAlpha = alpha

                if (p.type === 'coin') {
                    // Mini golden celebratory coin
                    ctx.fillStyle = p.color
                    ctx.beginPath()
                    ctx.ellipse(0, 0, p.size, p.size * Math.cos(p.rotation), 0, 0, Math.PI * 2)
                    ctx.fill()
                    ctx.strokeStyle = '#fef08a'
                    ctx.lineWidth = 1.2
                    ctx.stroke()
                } else if (p.type === 'star') {
                    // 4-point sparkle star
                    ctx.fillStyle = p.color
                    ctx.beginPath()
                    const s = p.size
                    ctx.moveTo(0, -s)
                    ctx.quadraticCurveTo(0, 0, s, 0)
                    ctx.quadraticCurveTo(0, 0, 0, s)
                    ctx.quadraticCurveTo(0, 0, -s, 0)
                    ctx.quadraticCurveTo(0, 0, 0, -s)
                    ctx.fill()
                } else {
                    // Shimmer circular sparkle
                    ctx.fillStyle = p.color
                    ctx.shadowColor = p.color
                    ctx.shadowBlur = 8
                    ctx.beginPath()
                    ctx.arc(0, 0, p.size, 0, Math.PI * 2)
                    ctx.fill()
                }

                ctx.restore()
            }

            // Continuous emission if flipping
            if (isFlippingRef.current && Math.random() < 0.7) {
                const centerX = width / 2
                const centerY = height / 2 - 30
                particlesRef.current.push({
                    x: centerX + (Math.random() - 0.5) * 80,
                    y: centerY + (Math.random() - 0.5) * 60,
                    vx: (Math.random() - 0.5) * 2.5,
                    vy: (Math.random() - 0.5) * 2.5 - 1.2,
                    gravity: -0.02,
                    size: Math.random() * 3 + 1.5,
                    color: Math.random() > 0.4 ? '#fcd34d' : '#ffffff',
                    type: 'sparkle',
                    life: 0,
                    maxLife: 25 + Math.random() * 20,
                    rotation: 0,
                    rotSpeed: 0
                })
            }

            animRef.current = requestAnimationFrame(loop)
        }

        animRef.current = requestAnimationFrame(loop)

        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current)
            window.removeEventListener('resize', handleResize)
        }
    }, [])

    // Trigger Impact Ripple on Landing
    useEffect(() => {
        if (!landingTrigger) return
        const canvas = canvasRef.current
        if (!canvas) return
        const centerX = (canvas.width || 400) / 2
        // Position at coin base (near floor shadow), not down in the result badge area
        const centerY = (canvas.height || 380) / 2 + 20

        // Single clean shockwave ripple (replaces any previous shockwaves)
        shockwavesRef.current = [
            { x: centerX, y: centerY, radius: 10, speed: 4, alpha: 0.55, lineWidth: 2 },
            { x: centerX, y: centerY, radius: 5, speed: 2.4, alpha: 0.35, lineWidth: 1.5 }
        ]

        // Impact spark dust
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2
            const speed = Math.random() * 3.5 + 1
            particlesRef.current.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * (speed * 0.4) - 1,
                gravity: 0.15,
                size: Math.random() * 2 + 1,
                color: Math.random() > 0.5 ? '#f59e0b' : '#fbbf24',
                type: 'sparkle',
                life: 0,
                maxLife: 25,
                rotation: 0,
                rotSpeed: 0
            })
        }
    }, [landingTrigger])

    // Trigger Win Celebration Fountain
    useEffect(() => {
        if (!winTrigger) return
        const canvas = canvasRef.current
        if (!canvas) return
        const centerX = (canvas.width || 400) / 2
        const centerY = (canvas.height || 380) / 2 - 20

        const goldPalette = ['#f59e0b', '#fbbf24', '#fde047', '#34d399', '#ffffff']

        // 1. Mini golden spinning coins erupting upwards
        for (let i = 0; i < 24; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5
            const speed = Math.random() * 7 + 4
            particlesRef.current.push({
                x: centerX + (Math.random() - 0.5) * 30,
                y: centerY + 20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 0.28,
                size: Math.random() * 5 + 3,
                color: '#f59e0b',
                type: 'coin',
                life: 0,
                maxLife: 50 + Math.random() * 20,
                rotation: Math.random() * Math.PI,
                rotSpeed: Math.random() * 0.3 - 0.15
            })
        }

        // 2. Star sparkles
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2
            const speed = Math.random() * 5 + 2
            particlesRef.current.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.5,
                gravity: 0.16,
                size: Math.random() * 3.5 + 1.5,
                color: goldPalette[Math.floor(Math.random() * goldPalette.length)],
                type: 'star',
                life: 0,
                maxLife: 45 + Math.random() * 15,
                rotation: Math.random() * Math.PI,
                rotSpeed: Math.random() * 0.2 - 0.1
            })
        }
    }, [winTrigger])

    return <canvas ref={canvasRef} className="coin-particles-canvas" />
}
