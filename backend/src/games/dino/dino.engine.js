import { CrashEngine, crashEngine } from '../crash/crash.engine.js'

/**
 * Dino Runner Engine (Server-Authoritative)
 * Evaluates jumping and obstacle run multipliers
 */
export class DinoEngine {
    static evaluate(params) {
        const result = crashEngine.evaluate(params)
        return {
            game: 'dino',
            ...result
        }
    }
}

export default DinoEngine
