import { provablyFairCore } from '../core/ProvablyFairCore.js'
import { AntiExploit } from '../core/AntiExploit.js'

/**
 * Coin Toss (Heads or Tails) Engine (Server-Authoritative)
 * Calibrated for Casino Profitability & Anti-Exploit Protection
 * Multiplier: 1.95x, Base Win Rate: ~47.5%
 */
export class CoinTossEngine {
    static evaluate({ betAmount, choice = 'heads', clientSeed, nonce, userId, userBets = [] }) {
        const { hash, floatVal, roundEntropy } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        const selectedChoice = String(choice).toLowerCase().trim() === 'tails' ? 'tails' : 'heads'
        const oppositeChoice = selectedChoice === 'heads' ? 'tails' : 'heads'
        const totalBet = parseFloat(betAmount) || 0

        // 1. Base Win Threshold (47.5% player win probability = ~5% house edge at 1.95x)
        let winThreshold = 0.475

        // 2. Anti-Martingale & Streak Safeguard
        const { consecutiveWins, isMartingale } = AntiExploit.analyzeUserPattern({
            userBets,
            gameKey: 'cointoss',
            currentBet: totalBet
        })
        if (isMartingale) {
            // Anti-martingale penalty: prevents mathematical doubling exploit
            winThreshold = 0.420
        } else if (consecutiveWins >= 2) {
            // Streak breaker: tightens win rate on consecutive runs
            winThreshold = 0.430
        }

        // 3. Determine Outcome
        const won = floatVal < winThreshold
        const outcome = won ? selectedChoice : oppositeChoice
        const multiplier = won ? 1.95 : 0
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
            roundEntropy
        }
    }
}

export default CoinTossEngine

