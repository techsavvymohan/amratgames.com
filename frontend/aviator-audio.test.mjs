import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import casinoAudio from './src/utils/casinoAudio.js'

test('casinoAudio exposes playJetAcceleration and playCrash methods', () => {
    assert.equal(typeof casinoAudio.playJetAcceleration, 'function')
    assert.equal(typeof casinoAudio.playCrash, 'function')

    // Safe execution in node environment without window.AudioContext
    assert.doesNotThrow(() => casinoAudio.playJetAcceleration(5))
    assert.doesNotThrow(() => casinoAudio.playJetAcceleration(10))
    assert.doesNotThrow(() => casinoAudio.playJetAcceleration(50))
    assert.doesNotThrow(() => casinoAudio.playCrash())
})

test('GameChart.jsx triggers jet engine acceleration at 5x, 10x, and 50x milestones', async () => {
    const code = await readFile(new URL('./src/games/crash/GameChart.jsx', import.meta.url), 'utf8')

    assert.match(code, /casinoAudio\.playJetAcceleration\?\.\(5\)/)
    assert.match(code, /casinoAudio\.playJetAcceleration\?\.\(10\)/)
    assert.match(code, /casinoAudio\.playJetAcceleration\?\.\(50\)/)
    assert.match(code, /aviator-sonic-pulse/)
})

test('CrashGame.css defines pulse animations for 5x, 10x, and 50x milestones', async () => {
    const css = await readFile(new URL('./src/games/crash/CrashGame.css', import.meta.url), 'utf8')

    assert.match(css, /\.aviator-sonic-pulse\.pulse-5x/)
    assert.match(css, /\.aviator-sonic-pulse\.pulse-10x/)
    assert.match(css, /\.aviator-sonic-pulse\.pulse-50x/)
    assert.match(css, /@keyframes aviatorSonicPulse5x/)
    assert.match(css, /@keyframes aviatorSonicPulse10x/)
    assert.match(css, /@keyframes aviatorSonicPulse50x/)
})
