import { provablyFairCore } from '../core/ProvablyFairCore.js'
import { bankrollRisk } from '../../services/BankrollRiskService.js'

/**
 * Limbo Multiplier Engine (Server-Authoritative)
 * 96% Player Return (4% instant bust house edge)
 */
export class LimboEngine {
    static evaluate({ betAmount, targetMultiplier, clientSeed, nonce }) {
        const target = Math.max(1.01, Math.min(parseFloat(targetMultiplier) || 2.0, 1000000.0))
        const { hash, floatVal } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        // 4% instant bust house edge (Standard Casino RTP = 96.00%)
        let roll = 1.00
        if (floatVal >= 0.04) {
            roll = Math.floor((96 / (1 - floatVal))) / 100
        }
        roll = Math.max(1.00, Math.min(roll, 1000000.0))

        const won = roll >= target
        const rawPayout = won ? parseFloat((betAmount * target).toFixed(2)) : 0

        const capped = won ? bankrollRisk.enforceWinCap({
            betAmount,
            multiplier: target,
            rawPayout,
            currency: 'INR'
        }) : { payout: 0, multiplier: 0, wasCapped: false }

        return {
            game: 'limbo',
            won,
            roll,
            targetMultiplier: target,
            multiplier: won ? capped.multiplier : 0,
            payout: capped.payout,
            wasCapped: capped.wasCapped,
            hash
        }
    }
}

export default LimboEngine
