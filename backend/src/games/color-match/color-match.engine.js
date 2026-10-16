import { provablyFairCore } from '../core/ProvablyFairCore.js'

/**
 * Color Match Engine (Server-Authoritative)
 */
export class ColorMatchEngine {
    static evaluate({ betAmount, choice = 'green', bets, clientSeed, nonce }) {
        const { hash } = provablyFairCore.generateHmacFloat(clientSeed, nonce)
        const luckyNumber = parseInt(hash.slice(0, 4), 16) % 10

        const colors = []
        if (luckyNumber === 0) colors.push('red', 'violet')
        else if (luckyNumber === 5) colors.push('green', 'violet')
        else if ([1, 3, 7, 9].includes(luckyNumber)) colors.push('green')
        else colors.push('red')

        const bigSmall = luckyNumber >= 5 ? 'big' : 'small'

        let won = false
        let payout = 0
        let totalBet = parseFloat(betAmount) || 0

        if (bets && typeof bets === 'object' && Object.keys(bets).length > 0) {
            totalBet = Object.values(bets).reduce((a, b) => a + (parseFloat(b) || 0), 0) || totalBet

            if (bets.green && colors.includes('green')) {
                const mult = colors.includes('violet') ? 1.5 : 2.0
                payout += (parseFloat(bets.green) || 0) * mult
            }
            if (bets.red && colors.includes('red')) {
                const mult = colors.includes('violet') ? 1.5 : 2.0
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
                payout += (parseFloat(bets[bigSmall]) || 0) * 2.0
            }
            payout = parseFloat(payout.toFixed(2))
            won = payout >= totalBet
        } else {
            const selectedChoice = String(choice).toLowerCase()
            let multiplier = 0

            if (colors.includes(selectedChoice)) {
                won = true
                if (selectedChoice === 'violet') {
                    multiplier = 4.5
                } else if (luckyNumber === 0 || luckyNumber === 5) {
                    multiplier = 1.5
                } else {
                    multiplier = 2.0
                }
            } else if (selectedChoice === String(luckyNumber)) {
                won = true
                multiplier = 9.0
            } else if (selectedChoice === bigSmall) {
                won = true
                multiplier = 2.0
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
            hash
        }
    }
}

export default ColorMatchEngine
