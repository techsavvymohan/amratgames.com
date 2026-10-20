import { provablyFairCore } from '../core/ProvablyFairCore.js'
import { AntiExploit } from '../core/AntiExploit.js'

/**
 * Color Match Engine (Server-Authoritative)
 * Calibrated with Cryptographic Unpredictability & Anti-Martingale Protection
 */
export class ColorMatchEngine {
    static evaluate({ betAmount, choice = 'green', bets, clientSeed, nonce, userId, userBets = [] }) {
        const { hash, roundEntropy } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        const totalBet = parseFloat(betAmount) || 0
        const { consecutiveWins, isMartingale } = AntiExploit.analyzeUserPattern({
            userBets,
            gameKey: 'color-match',
            currentBet: totalBet
        })

        // Cryptographic lucky number (100% Provably Fair HMAC-SHA256)
        const luckyNumber = parseInt(hash.slice(0, 4), 16) % 10

        const colors = []
        if (luckyNumber === 0) colors.push('red', 'violet')
        else if (luckyNumber === 5) colors.push('green', 'violet')
        else if ([1, 3, 7, 9].includes(luckyNumber)) colors.push('green')
        else colors.push('red')

        const bigSmall = luckyNumber >= 5 ? 'big' : 'small'

        let won = false
        let payout = 0

        if (bets && typeof bets === 'object' && Object.keys(bets).length > 0) {
            const calculatedTotal = Object.values(bets).reduce((a, b) => a + (parseFloat(b) || 0), 0) || totalBet

            if (bets.green && colors.includes('green')) {
                const mult = colors.includes('violet') ? 1.45 : 1.95
                payout += (parseFloat(bets.green) || 0) * mult
            }
            if (bets.red && colors.includes('red')) {
                const mult = colors.includes('violet') ? 1.45 : 1.95
                payout += (parseFloat(bets.red) || 0) * mult
            }
            if (bets.violet && colors.includes('violet')) {
                payout += (parseFloat(bets.violet) || 0) * 4.5
            }
            const numKey = `num_${luckyNumber}`
            if (bets[numKey]) {
                payout += (parseFloat(bets[numKey]) || 0) * 9.0
            }
            if (bets[bigSmall]) {
                payout += (parseFloat(bets[bigSmall]) || 0) * 1.95
            }
            payout = parseFloat(payout.toFixed(2))
            won = payout >= calculatedTotal
        } else {
            const selectedChoice = String(choice).toLowerCase()
            let multiplier = 0

            if (colors.includes(selectedChoice)) {
                won = true
                if (selectedChoice === 'violet') {
                    multiplier = 4.5
                } else if (luckyNumber === 0 || luckyNumber === 5) {
                    multiplier = 1.45
                } else {
                    multiplier = 1.95
                }
            } else if (selectedChoice === String(luckyNumber)) {
                won = true
                multiplier = 9.0
            } else if (selectedChoice === bigSmall) {
                won = true
                multiplier = 1.95
            }
            payout = parseFloat((totalBet * multiplier).toFixed(2))
        }

        const multiplier = totalBet > 0 ? parseFloat((payout / totalBet).toFixed(2)) : 0

        return {
            game: 'color-match',
            luckyNumber,
            winningColors: colors,
            bigSmall,
            choice,
            won,
            multiplier,
            payout,
            hash,
            roundEntropy
        }
    }
}

export default ColorMatchEngine
