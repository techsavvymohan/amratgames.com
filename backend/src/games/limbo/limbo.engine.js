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

        // 100% Provably Fair HMAC-SHA256 outcome (98.00% RTP with 2% instant bust)
        let roll = 1.00
        if (floatVal >= 0.02) {
            roll = Math.floor((98.0 / (1 - floatVal))) / 100
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
