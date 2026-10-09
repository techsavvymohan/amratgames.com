/**
 * ═══════════════════════════════════════════════════════════════════════
 * 👑 AmratGames.com — Server-Side Authoritative Game Engine Service
 * ═══════════════════════════════════════════════════════════════════════
 * Modular Facade delegating each game's server-authoritative evaluation
 * and session state to dedicated, isolated game modules in `backend/src/games/`.
 */

import { provablyFairCore } from '../games/core/ProvablyFairCore.js'
import { LimboEngine } from '../games/limbo/index.js'
import { CrashEngine, crashEngine } from '../games/crash/index.js'
import { PlinkoEngine, PLINKO_PAYOUTS } from '../games/plinko/index.js'
import { DragonTigerEngine } from '../games/dragon-tiger/index.js'
import { ColorMatchEngine } from '../games/color-match/index.js'
import { MinesEngine, minesEngine } from '../games/mines/index.js'
import { CoinTossEngine } from '../games/coin-toss/index.js'
import { DinoEngine } from '../games/dino/index.js'

export { PLINKO_PAYOUTS }

class GameEngineService {
    constructor() {
        // Expose shared state maps for backwards compatibility
        this.activeMinesRounds = minesEngine.activeMinesRounds
        this.activeCrashRounds = crashEngine.activeCrashRounds
        this.userNonces = provablyFairCore.userNonces
    }

    // Cryptographic Entropy Helpers
    getServerSeed() {
        return provablyFairCore.getServerSeed()
    }

    getNextNonce(userId = 'guest') {
        return provablyFairCore.getNextNonce(userId)
    }

    generateHmacFloat(clientSeed = 'amrat-player', nonce = 1, serverSeedOverride = null) {
        return provablyFairCore.generateHmacFloat(clientSeed, nonce, serverSeedOverride)
    }

    // Game Evaluators
    evaluateLimbo(params) {
        return LimboEngine.evaluate(params)
    }

    evaluateCrash(params) {
        return crashEngine.evaluate(params)
    }

    evaluatePlinko(params) {
        return PlinkoEngine.evaluate(params)
    }

    evaluateDragonTiger(params) {
        return DragonTigerEngine.evaluate(params)
    }

    evaluateColorMatch(params) {
        return ColorMatchEngine.evaluate(params)
    }

    evaluateCoinToss(params) {
        return CoinTossEngine.evaluate(params)
    }

    evaluateDino(params) {
        return DinoEngine.evaluate(params)
    }

    // Mines Lifecycle
    calculateMinesMultiplier(minesCount, gemsRevealed) {
        return minesEngine.calculateMultiplier(minesCount, gemsRevealed)
    }

    startMinesRound(params) {
        return minesEngine.startRound(params)
    }

    revealMinesTile(params) {
        return minesEngine.revealTile(params)
    }

    cashoutMines(params) {
        return minesEngine.cashout(params)
    }

    getActiveMinesRound(userId) {
        return minesEngine.getActiveRound(userId)
    }

    // Crash Lifecycle
    startCrashRound(params) {
        return crashEngine.startRound(params)
    }

    cashoutCrash(params) {
        return crashEngine.cashout(params)
    }

    bustCrash(params) {
        return crashEngine.bust(params)
    }

    getActiveCrashRound(userId) {
        return crashEngine.getActiveRound(userId)
    }
}

export const gameEngine = new GameEngineService()
export default gameEngine
