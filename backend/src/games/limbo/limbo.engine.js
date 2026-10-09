import { provablyFairCore } from '../core/ProvablyFairCore.js'

/**
 * Limbo Multiplier Engine (Server-Authoritative)
 * 99% Player Return (1% instant bust house edge)
 */
export class LimboEngine {
    static evaluate({ betAmount, targetMultiplier, clientSeed, nonce }) {
        const target = Math.max(1.01, Math.min(parseFloat(targetMultiplier) || 2.0, 1000000.0))
        const { hash, floatVal } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        // 1% instant bust house edge (RTP = 99%)
        let roll = 1.00
        if (floatVal >= 0.01) {
            roll = Math.floor((99 / (1 - floatVal))) / 100
        }
        roll = Math.max(1.00, Math.min(roll, 1000000.0))

        const won = roll >= target
        const payout = won ? parseFloat((betAmount * target).toFixed(2)) : 0

        return {
            game: 'limbo',
            won,
            roll,
            targetMultiplier: target,
            multiplier: won ? target : 0,
            payout,
            hash
        }
    }
}

export default LimboEngine
