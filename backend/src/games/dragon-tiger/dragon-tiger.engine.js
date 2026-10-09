import { provablyFairCore } from '../core/ProvablyFairCore.js'

/**
 * Dragon Tiger Card Engine (Server-Authoritative)
 */
export class DragonTigerEngine {
    static evaluate({ betAmount, choice = 'dragon', bets, clientSeed, nonce }) {
        const { hash } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        // Two cards drawn from 52 cards (1=Ace ... 13=King)
        const dVal = (parseInt(hash.slice(0, 4), 16) % 13) + 1
        const tVal = (parseInt(hash.slice(4, 8), 16) % 13) + 1
        const suits = ['♠', '♥', '♦', '♣']
        const dSuit = suits[parseInt(hash.slice(8, 9), 16) % 4]
        const tSuit = suits[parseInt(hash.slice(9, 10), 16) % 4]

        let winner = 'tie'
        if (dVal > tVal) winner = 'dragon'
        else if (tVal > dVal) winner = 'tiger'

        let won = false
        let payout = 0
        let totalBet = parseFloat(betAmount) || 0

        if (bets && typeof bets === 'object' && Object.keys(bets).length > 0) {
            const bDragon = parseFloat(bets.dragon) || 0
            const bTiger = parseFloat(bets.tiger) || 0
            const bTie = parseFloat(bets.tie) || 0
            totalBet = bDragon + bTiger + bTie || totalBet

            if (winner === 'dragon') {
                payout = bDragon * 2.0
            } else if (winner === 'tiger') {
                payout = bTiger * 2.0
            } else if (winner === 'tie') {
                payout = (bTie * 9.0) + (bDragon * 0.5) + (bTiger * 0.5)
            }
            payout = parseFloat(payout.toFixed(2))
            won = payout > 0
        } else {
            const selectedChoice = String(choice).toLowerCase()
            let multiplier = 0
            if (winner === 'tie') {
                if (selectedChoice === 'tie') {
                    won = true
                    multiplier = 9.0
                } else {
                    won = false
                    multiplier = 0.5
                }
            } else if (winner === selectedChoice) {
                won = true
                multiplier = 2.0
            } else {
                won = false
                multiplier = 0
            }
            payout = parseFloat((totalBet * multiplier).toFixed(2))
            won = payout > 0
        }

        const multiplier = totalBet > 0 ? parseFloat((payout / totalBet).toFixed(2)) : 0

        return {
            game: 'dragon-tiger',
            dragon: { value: dVal, suit: dSuit },
            tiger: { value: tVal, suit: tSuit },
            winner,
            choice: choice || 'dragon',
            won,
            multiplier,
            payout,
            hash
        }
    }
}

export default DragonTigerEngine
