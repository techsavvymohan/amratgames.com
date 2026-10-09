import { provablyFairCore } from '../core/ProvablyFairCore.js'

/**
 * Coin Toss (Heads or Tails) Engine (Server-Authoritative)
 * 99% Player Return (1% house edge), Multiplier: 1.98x
 */
export class CoinTossEngine {
    static evaluate({ betAmount, choice = 'heads', clientSeed, nonce }) {
        const { hash, floatVal } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        // floatVal < 0.50 -> 'heads', else 'tails'
        const outcome = floatVal < 0.50 ? 'heads' : 'tails'
        const selectedChoice = String(choice).toLowerCase().trim() === 'tails' ? 'tails' : 'heads'
        const won = (selectedChoice === outcome)
        const multiplier = won ? 1.98 : 0
        const totalBet = parseFloat(betAmount) || 0
        const payout = won ? parseFloat((totalBet * multiplier).toFixed(2)) : 0

        return {
            game: 'coin-toss',
            outcome,
            choice: selectedChoice,
            won,
            multiplier,
            payout,
            floatVal,
            hash
        }
    }
}

export default CoinTossEngine
