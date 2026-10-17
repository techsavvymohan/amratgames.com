import { provablyFairCore } from '../core/ProvablyFairCore.js'
import { AntiExploit } from '../core/AntiExploit.js'
import { bankrollRisk } from '../../services/BankrollRiskService.js'

/**
 * Limbo Multiplier Engine (Server-Authoritative)
 * Calibrated with Anti-Exploit Jitter & Cryptographic Unpredictability
 */
export class LimboEngine {
    static evaluate({ betAmount, targetMultiplier, clientSeed, nonce, userId, userBets = [] }) {
        const target = Math.max(1.01, Math.min(parseFloat(targetMultiplier) || 2.0, 1000000.0))
        const { hash, floatVal, roundEntropy } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        const totalBet = parseFloat(betAmount) || 0
        const { consecutiveWins, isMartingale, penaltyFactor } = AntiExploit.analyzeUserPattern({
            userBets,
            gameKey: 'limbo',
            currentBet: totalBet
        })

        // Standard 5% instant bust house edge, dynamically adjusted if martingale doubling or streak detected
        let bustChance = 0.05
        let baseRtp = 95.0

        if (isMartingale) {
            bustChance = 0.09
            baseRtp = 91.0
        } else if (consecutiveWins >= 2) {
            bustChance = 0.08
            baseRtp = 92.5
        }

        let roll = 1.00
        if (floatVal >= bustChance) {
            roll = Math.floor((baseRtp / (1 - floatVal))) / 100
        }
        roll = Math.max(1.00, Math.min(roll, 1000000.0))

        const won = roll >= target
        const rawPayout = won ? parseFloat((totalBet * target).toFixed(2)) : 0

        const capped = won ? bankrollRisk.enforceWinCap({
            betAmount: totalBet,
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
            hash,
            roundEntropy
        }
    }
}

export default LimboEngine
