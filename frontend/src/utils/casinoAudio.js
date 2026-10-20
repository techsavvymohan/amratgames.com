/**
 * AmratGames Provably Fair Casino Audio & Haptics Engine
 * Built with Web Audio API for zero-latency, high-fidelity sound synthesis
 * No external audio files or buffering required. Full mobile haptics support.
 */

class CasinoAudioEngine {
    constructor() {
        this.ctx = null
        this.masterGain = null
        this.isMuted = false
        this.hasUserInteracted = false

        try {
            const savedMute = localStorage.getItem('amrat_audio_muted')
            this.isMuted = savedMute === 'true'
        } catch {
            this.isMuted = false
        }

        // Auto-resume existing suspended context on genuine user interaction (click / touchend / keydown)
        if (typeof window !== 'undefined') {
            const resumeIfSuspended = () => {
                if (this.ctx && this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {})
                }
            }
            window.addEventListener('click', resumeIfSuspended, { passive: true })
            window.addEventListener('touchend', resumeIfSuspended, { passive: true })
            window.addEventListener('keydown', resumeIfSuspended, { passive: true })
        }
    }

    initContext() {
        if (!this.ctx && typeof window !== 'undefined') {
            const AudioCtx = window.AudioContext || window.webkitAudioContext
            if (AudioCtx) {
                try {
                    this.ctx = new AudioCtx()
                    this.masterGain = this.ctx.createGain()
                    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.45, this.ctx.currentTime)
                    this.masterGain.connect(this.ctx.destination)
                } catch {
                    return null
                }
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {})
        }
        return this.ctx
    }

    toggleMute() {
        this.isMuted = !this.isMuted
        try {
            localStorage.setItem('amrat_audio_muted', this.isMuted.toString())
        } catch { /* ignore */ }

        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.45, this.ctx.currentTime)
        }
        return this.isMuted
    }

    setMuted(muted) {
        this.isMuted = Boolean(muted)
        try {
            localStorage.setItem('amrat_audio_muted', this.isMuted.toString())
        } catch { /* ignore */ }

        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.45, this.ctx.currentTime)
        }
    }

    getMuted() {
        return this.isMuted
    }

    vibrate(pattern = [20]) {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
                navigator.vibrate(pattern)
            } catch { /* ignore */ }
        }
    }

    // ── Individual Casino Sound FX ──────────────────────────────────────────

    /**
     * Tactile casino chip click or bet placement sound
     */
    playChip() {
        if (this.isMuted) return
        const ctx = this.initContext()
        if (!ctx) return

        this.vibrate([10])
        const now = ctx.currentTime

        // Crisp snap
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(800, now)
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.05)

        gain.gain.setValueAtTime(0.18, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)

        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start(now)
        osc.stop(now + 0.05)
    }

    /**
     * Bet confirmed sound
     */
    playBet() {
        if (this.isMuted) return
        const ctx = this.initContext()
        if (!ctx) return

        this.vibrate([15])
        const now = ctx.currentTime

        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(440, now)
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08)

        gain.gain.setValueAtTime(0.2, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start(now)
        osc.stop(now + 0.1)
    }

    /**
     * Crystal gem chime with rising pitch as more gems are uncovered (Mines)
     * @param {number} level - 1-based index of gems uncovered in current round
     */
    playGem(level = 1) {
        if (this.isMuted) return
        const ctx = this.initContext()
        if (!ctx) return

        this.vibrate([15, 20])
        const now = ctx.currentTime

        // Musical scale for progressive anticipation: C5, D5, E5, G5, A5, C6, D6, E6, G6, A6...
        const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51, 1567.98, 1760.00]
        const baseFreq = scale[Math.min(Math.max(0, level - 1), scale.length - 1)]

        // Fundamental
        const osc1 = ctx.createOscillator()
        const gain1 = ctx.createGain()
        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(baseFreq, now)

        // Shimmering crystalline overtone
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.type = 'triangle'
        osc2.frequency.setValueAtTime(baseFreq * 2.76, now) // Inharmonic chime bell ratio

        gain1.gain.setValueAtTime(0.25, now)
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

        gain2.gain.setValueAtTime(0.12, now)
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

        osc1.connect(gain1)
        gain1.connect(this.masterGain)
        osc2.connect(gain2)
        gain2.connect(this.masterGain)

        osc1.start(now)
        osc2.start(now)
        osc1.stop(now + 0.36)
        osc2.stop(now + 0.23)
    }

    /**
     * Deep impactful explosion (Mine bust / Crash rocket detonation)
     */
    playExplosion() {
        if (this.isMuted) return
        const ctx = this.initContext()
        if (!ctx) return

        this.vibrate([80, 50, 80])
        const now = ctx.currentTime

        // 1. Low bass punch
        const osc = ctx.createOscillator()
        const oscGain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(140, now)
        osc.frequency.exponentialRampToValueAtTime(32, now + 0.35)

        oscGain.gain.setValueAtTime(0.35, now)
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
        osc.connect(oscGain)
        oscGain.connect(this.masterGain)
        osc.start(now)
        osc.stop(now + 0.46)

        // 2. White noise burst with lowpass filter
        const bufferSize = ctx.sampleRate * 0.4
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1
        }

        const noise = ctx.createBufferSource()
        noise.buffer = buffer

        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(800, now)
        filter.frequency.exponentialRampToValueAtTime(60, now + 0.4)

        const noiseGain = ctx.createGain()
        noiseGain.gain.setValueAtTime(0.3, now)
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

        noise.connect(filter)
        filter.connect(noiseGain)
        noiseGain.connect(this.masterGain)
        noise.start(now)
        noise.stop(now + 0.41)
    }

    /**
     * Cash Out ding (Register chime + gold coins)
     */
    playCashout() {
        if (this.isMuted) return
        const ctx = this.initContext()
        if (!ctx) return

        this.vibrate([30, 40, 50])
        const now = ctx.currentTime

        // Dual high register bell (E6 + G#6)
        const notes = [1318.51, 1661.22]
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(freq, now + idx * 0.04)

            gain.gain.setValueAtTime(0.22, now + idx * 0.04)
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.5)

            osc.connect(gain)
            gain.connect(this.masterGain)
            osc.start(now + idx * 0.04)
            osc.stop(now + idx * 0.04 + 0.51)
        })

        // Coin clinks cascade
        const coinPitches = [2093.00, 2489.02, 2793.83, 3135.96]
        coinPitches.forEach((pitch, i) => {
            const coinOsc = ctx.createOscillator()
            const coinGain = ctx.createGain()
            const delay = 0.12 + i * 0.06

            coinOsc.type = 'triangle'
            coinOsc.frequency.setValueAtTime(pitch, now + delay)

            coinGain.gain.setValueAtTime(0.12, now + delay)
            coinGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15)

            coinOsc.connect(coinGain)
            coinGain.connect(this.masterGain)
            coinOsc.start(now + delay)
            coinOsc.stop(now + delay + 0.16)
        })
    }

    /**
     * Joyful win fanfare
     */
    playWin() {
        if (this.isMuted) return
        const ctx = this.initContext()
        if (!ctx) return

        this.vibrate([25, 40, 35])
        const now = ctx.currentTime

        // C-E-G-C ascending triad
        const chord = [523.25, 659.25, 783.99, 1046.50]
        chord.forEach((freq, i) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            const time = now + i * 0.08

            osc.type = 'triangle'
            osc.frequency.setValueAtTime(freq, time)

            gain.gain.setValueAtTime(0.2, time)
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35)

            osc.connect(gain)
            gain.connect(this.masterGain)
            osc.start(time)
            osc.stop(time + 0.36)
        })
    }

    /**
     * Grand Big Win celebratory fanfare
     */
    playBigWin() {
        if (this.isMuted) return
        const ctx = this.initContext()
        if (!ctx) return

        this.vibrate([50, 40, 50, 40, 80])
        const now = ctx.currentTime

        const melody = [
            { f: 523.25, d: 0.1 },  // C5
            { f: 659.25, d: 0.1 },  // E5
            { f: 783.99, d: 0.1 },  // G5
            { f: 1046.50, d: 0.18 }, // C6
            { f: 880.00, d: 0.1 },  // A5
            { f: 1046.50, d: 0.35 } // C6
        ]

        let offset = 0
        melody.forEach(note => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            const t = now + offset

            osc.type = 'square'
            osc.frequency.setValueAtTime(note.f, t)

            gain.gain.setValueAtTime(0.16, t)
            gain.gain.exponentialRampToValueAtTime(0.001, t + note.d + 0.1)

            // Warm lowpass filter to soften square wave
            const f = ctx.createBiquadFilter()
            f.type = 'lowpass'
            f.frequency.setValueAtTime(2200, t)

            osc.connect(f)
            f.connect(gain)
            gain.connect(this.masterGain)
            osc.start(t)
            osc.stop(t + note.d + 0.11)

            offset += note.d
        })
    }

    /**
     * Subdued round loss thud
     */
    playLoss() {
        if (this.isMuted) return
        const ctx = this.initContext()
        if (!ctx) return

        this.vibrate([40])
        const now = ctx.currentTime

        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(180, now)
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.25)

        gain.gain.setValueAtTime(0.2, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start(now)
        osc.stop(now + 0.26)
    }

    /**
     * Plinko peg bounce tick
     */
    playPegBounce() {
        if (this.isMuted) return
        const ctx = this.initContext()
        if (!ctx) return

        const now = ctx.currentTime
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        // Randomized micro-pitch for organic pin physics
        const freq = 1200 + Math.random() * 600
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now)

        gain.gain.setValueAtTime(0.08, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035)

        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start(now)
        osc.stop(now + 0.04)
    }

    /**
     * Plinko bin landing
     * @param {number} mult - Multiplier of the bin landed in
     */
    playBinLand(mult = 1) {
        if (this.isMuted) return
        const ctx = this.initContext()
        if (!ctx) return

        this.vibrate([15])
        const now = ctx.currentTime

        const base = mult >= 10 ? 880 : (mult >= 2 ? 660 : 440)
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(base, now)
        osc.frequency.exponentialRampToValueAtTime(base * 1.5, now + 0.15)

        gain.gain.setValueAtTime(0.2, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start(now)
        osc.stop(now + 0.21)
    }

    /**
     * Card swoosh / deal sound for Dragon Tiger
     */
    playCardDeal() {
        if (this.isMuted) return
        const ctx = this.initContext()
        if (!ctx) return

        this.vibrate([10])
        const now = ctx.currentTime

        // Short noise swoosh
        const bufferSize = ctx.sampleRate * 0.07
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
        }

        const source = ctx.createBufferSource()
        source.buffer = buffer

        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(2400, now)
        filter.Q.setValueAtTime(3, now)

        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0.14, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)

        source.connect(filter)
        filter.connect(gain)
        gain.connect(this.masterGain)
        source.start(now)
        source.stop(now + 0.075)
    }

    /**
     * Tick sound for wheel, clock, or countdown
     */
    playTick() {
        if (this.isMuted) return
        const ctx = this.initContext()
        if (!ctx) return

        const now = ctx.currentTime
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(1000, now)

        gain.gain.setValueAtTime(0.06, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02)

        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start(now)
        osc.stop(now + 0.025)
    }

    /**
     * Rapid spinning whirr & whoosh for coin flip
     */
    playCoinFlip() {
        if (this.isMuted) return
        const ctx = this.initContext()
        if (!ctx) return

        this.vibrate([15, 10, 15])
        const now = ctx.currentTime

        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(320, now)
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.12)
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.25)

        gain.gain.setValueAtTime(0.18, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26)

        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start(now)
        osc.stop(now + 0.27)
    }

    /**
     * Crisp high-metallic ringing clink of a heavy gold coin landing and bouncing
     */
    playCoinLand() {
        if (this.isMuted) return
        const ctx = this.initContext()
        if (!ctx) return

        this.vibrate([25, 15])
        const now = ctx.currentTime

        // Primary metallic clink (bell harmonics: 2850Hz & 4220Hz)
        const freqs = [2850, 4220, 5600]
        freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(freq, now)
            osc.frequency.exponentialRampToValueAtTime(freq * 0.95, now + 0.3)

            const vol = i === 0 ? 0.28 : 0.14
            gain.gain.setValueAtTime(vol, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28 + i * 0.05)

            osc.connect(gain)
            gain.connect(this.masterGain)
            osc.start(now)
            osc.stop(now + 0.35)
        })

        // Secondary micro-bounce clink
        setTimeout(() => {
            if (this.isMuted || !this.ctx) return
            const bounceNow = this.ctx.currentTime
            const bounceOsc = this.ctx.createOscillator()
            const bounceGain = this.ctx.createGain()
            bounceOsc.type = 'triangle'
            bounceOsc.frequency.setValueAtTime(3100, bounceNow)

            bounceGain.gain.setValueAtTime(0.12, bounceNow)
            bounceGain.gain.exponentialRampToValueAtTime(0.001, bounceNow + 0.15)

            bounceOsc.connect(bounceGain)
            bounceGain.connect(this.masterGain)
            bounceOsc.start(bounceNow)
            bounceOsc.stop(bounceNow + 0.16)
        }, 110)
    }

    /**
     * Subtle jet engine sound acceleration as multiplier crosses 5x, 10x, and 50x milestones in Aviator
     * @param {number} level - 5, 10, or 50 multiplier milestone
     */
    playJetAcceleration(level = 5) {
        if (this.isMuted) return
        const ctx = this.initContext()
        if (!ctx) return

        const now = ctx.currentTime

        if (level >= 50) {
            // ── 50x: Hypersonic Afterburner Surge & Sonic Boom Overtones ──
            this.vibrate([50, 30, 50, 30])

            // 1. Deep Sub-Bass Thruster Rumble (85Hz -> 260Hz)
            const subOsc = ctx.createOscillator()
            const subGain = ctx.createGain()
            subOsc.type = 'sawtooth'
            subOsc.frequency.setValueAtTime(85, now)
            subOsc.frequency.exponentialRampToValueAtTime(260, now + 0.9)
            subGain.gain.setValueAtTime(0.22, now)
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1)

            const subFilter = ctx.createBiquadFilter()
            subFilter.type = 'lowpass'
            subFilter.frequency.setValueAtTime(320, now)
            subFilter.frequency.exponentialRampToValueAtTime(550, now + 0.8)

            subOsc.connect(subFilter)
            subFilter.connect(subGain)
            subGain.connect(this.masterGain)
            subOsc.start(now)
            subOsc.stop(now + 1.12)

            // 2. High-Altitude Turbine Whine (580Hz -> 1450Hz)
            const whineOsc = ctx.createOscillator()
            const whineGain = ctx.createGain()
            whineOsc.type = 'sine'
            whineOsc.frequency.setValueAtTime(580, now)
            whineOsc.frequency.exponentialRampToValueAtTime(1450, now + 0.85)
            whineGain.gain.setValueAtTime(0.14, now)
            whineGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95)

            whineOsc.connect(whineGain)
            whineGain.connect(this.masterGain)
            whineOsc.start(now)
            whineOsc.stop(now + 0.96)

            // 3. Supersonic Atmospheric Air Rush (Filtered White Noise Swept)
            this._synthesizeAirWhoosh(ctx, now, {
                duration: 0.95,
                startFreq: 600,
                endFreq: 2200,
                volume: 0.18
            })

            // 4. Golden Milestone Chime (1046.5Hz / C6 + 1318.5Hz / E6)
            this._playToneChime(ctx, now + 0.08, [1046.5, 1318.51, 1567.98], 0.16)

        } else if (level >= 10) {
            // ── 10x: Double-Digit High-Speed Turbine Acceleration ──
            this.vibrate([35, 25, 35])

            // 1. Dual Harmonized Turbine Surge (220Hz -> 480Hz)
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'triangle'
            osc.frequency.setValueAtTime(220, now)
            osc.frequency.exponentialRampToValueAtTime(490, now + 0.75)
            gain.gain.setValueAtTime(0.18, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8)

            const filter = ctx.createBiquadFilter()
            filter.type = 'bandpass'
            filter.frequency.setValueAtTime(450, now)
            filter.frequency.exponentialRampToValueAtTime(950, now + 0.7)
            filter.Q.value = 1.8

            osc.connect(filter)
            filter.connect(gain)
            gain.connect(this.masterGain)
            osc.start(now)
            osc.stop(now + 0.82)

            // 2. Air stream acceleration whoosh
            this._synthesizeAirWhoosh(ctx, now, {
                duration: 0.75,
                startFreq: 450,
                endFreq: 1400,
                volume: 0.14
            })

            // 3. Crisp Milestone Harmonic (880Hz / A5 + 1108.7Hz / C#6)
            this._playToneChime(ctx, now + 0.05, [880.0, 1108.73], 0.13)

        } else {
            // ── 5x: Initial Altitude Spool-Up & Climb Acceleration ──
            this.vibrate([25, 20])

            // 1. Turbine Spool-Up (160Hz -> 340Hz)
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'triangle'
            osc.frequency.setValueAtTime(160, now)
            osc.frequency.exponentialRampToValueAtTime(340, now + 0.6)
            gain.gain.setValueAtTime(0.15, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65)

            const filter = ctx.createBiquadFilter()
            filter.type = 'bandpass'
            filter.frequency.setValueAtTime(320, now)
            filter.frequency.exponentialRampToValueAtTime(700, now + 0.55)
            filter.Q.value = 1.4

            osc.connect(filter)
            filter.connect(gain)
            gain.connect(this.masterGain)
            osc.start(now)
            osc.stop(now + 0.67)

            // 2. Subtle air whoosh
            this._synthesizeAirWhoosh(ctx, now, {
                duration: 0.6,
                startFreq: 350,
                endFreq: 850,
                volume: 0.11
            })

            // 3. Gentle harmonic bell (659.25Hz / E5)
            this._playToneChime(ctx, now + 0.04, [659.25], 0.11)
        }
    }

    /**
     * White-noise synthesized air whoosh with bandpass frequency ramp
     */
    _synthesizeAirWhoosh(ctx, startTime, { duration = 0.6, startFreq = 400, endFreq = 1200, volume = 0.12 } = {}) {
        const bufferSize = Math.floor(ctx.sampleRate * duration)
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1
        }

        const noise = ctx.createBufferSource()
        noise.buffer = buffer

        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(startFreq, startTime)
        filter.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration * 0.8)
        filter.Q.value = 2.0

        const gain = ctx.createGain()
        gain.gain.setValueAtTime(volume, startTime)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

        noise.connect(filter)
        filter.connect(gain)
        gain.connect(this.masterGain)
        noise.start(startTime)
        noise.stop(startTime + duration + 0.01)
    }

    /**
     * Subtle milestone musical chime triad or harmonic
     */
    _playToneChime(ctx, startTime, freqs = [880], volume = 0.12) {
        freqs.forEach((freq, idx) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(freq, startTime + idx * 0.02)
            gain.gain.setValueAtTime(volume, startTime + idx * 0.02)
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + idx * 0.02 + 0.35)

            osc.connect(gain)
            gain.connect(this.masterGain)
            osc.start(startTime + idx * 0.02)
            osc.stop(startTime + idx * 0.02 + 0.36)
        })
    }

    /**
     * Aviator Crash / Explosion
     */
    playCrash() {
        return this.playExplosion()
    }
}

export const casinoAudio = new CasinoAudioEngine()
export default casinoAudio
