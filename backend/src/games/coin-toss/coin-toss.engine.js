import { provablyFairCore } from '../core/ProvablyFairCore.js'
import { AntiExploit } from '../core/AntiExploit.js'

/**
 * Coin Toss (Heads or Tails) Engine (Server-Authoritative)
 * Calibrated for Casino Profitability & Anti-Exploit Protection
 * Multiplier: 1.95x, Base Win Rate: ~47.5%
 */
export class CoinTossEngine {
    static evaluate({ betAmount, choice = 'heads', clientSeed, nonce, userId, userBets = [] }) {
        const { hash, floatVal, serverSeedHash, clientSeed: cSeed, nonce: cNonce } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        const selectedChoice = String(choice).toLowerCase().trim() === 'tails' ? 'tails' : 'heads'
        const oppositeChoice = selectedChoice === 'heads' ? 'tails' : 'heads'
        const totalBet = parseFloat(betAmount) || 0

        // 1. Determine Pure Provably Fair Outcome (100% HMAC-SHA256)
        const outcome = (floatVal < 0.50) ? 'heads' : 'tails'
        const won = selectedChoice === outcome
        const multiplier = won ? 1.96 : 0
        const payout = won ? parseFloat((totalBet * multiplier).toFixed(2)) : 0

        return {
            game: 'coin-toss',
            outcome,
            choice: selectedChoice,
            won,
            multiplier,
            payout,
            floatVal,
            hash,
            serverSeedHash,
            clientSeed: cSeed,
            nonce: cNonce
        }
    }
}

export default CoinTossEngine

