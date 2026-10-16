import { provablyFairCore } from '../core/ProvablyFairCore.js'

/**
 * Coin Toss (Heads or Tails) Engine (Server-Authoritative)
 * 96% Player Return (4% house edge), Multiplier: 1.96x
 */
export class CoinTossEngine {
    static evaluate({ betAmount, choice = 'heads', clientSeed, nonce }) {
        const { hash, floatVal } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        // floatVal < 0.50 -> 'heads', else 'tails'
        const outcome = floatVal < 0.50 ? 'heads' : 'tails'
        const selectedChoice = String(choice).toLowerCase().trim() === 'tails' ? 'tails' : 'heads'
        const won = (selectedChoice === outcome)
        const multiplier = won ? 1.96 : 0
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
