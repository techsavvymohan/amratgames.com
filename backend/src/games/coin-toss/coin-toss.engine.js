import { provablyFairCore } from '../core/ProvablyFairCore.js'

/**
 * Coin Toss (Heads or Tails) Engine (Server-Authoritative)
 * Calibrated for Casino Profitability & Anti-Exploit Protection
 * Multiplier: 1.95x, Base Win Rate: ~47.5%
 */
export class CoinTossEngine {
    static evaluate({ betAmount, choice = 'heads', clientSeed, nonce, userId, userBets = [] }) {
        const { hash, floatVal } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        const selectedChoice = String(choice).toLowerCase().trim() === 'tails' ? 'tails' : 'heads'
        const oppositeChoice = selectedChoice === 'heads' ? 'tails' : 'heads'
        const totalBet = parseFloat(betAmount) || 0

        // 1. Base Win Threshold (47.5% player win probability = ~5% house edge)
        let winThreshold = 0.475

        // 2. Anti-Martingale & Streak Safeguard
        // Check user's recent coin toss history if available to prevent martingale doubling exploits
        if (Array.isArray(userBets) && userBets.length > 0) {
            const coinBets = userBets.filter(b => {
                const g = String(b.game || b.gameName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                return g.includes('cointoss') || g.includes('coinflip')
            })

            // Count consecutive wins
            let consecutiveWins = 0
            for (const b of coinBets) {
                if (b.won) consecutiveWins++
                else break
            }

            // Detect Martingale escalation (doubled or multiplied bet following a loss)
            const lastBet = coinBets[0]
            const isMartingaleEscalation = lastBet && !lastBet.won && totalBet >= (lastBet.betAmount * 1.7)

            if (consecutiveWins >= 2) {
                // Streak breaker: tightens win rate on consecutive runs
                winThreshold = 0.430
            } else if (isMartingaleEscalation) {
                // Anti-martingale penalty: prevents mathematical doubling exploit
                winThreshold = 0.420
            }
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
            hash
        }
    }
}

export default CoinTossEngine

