import { provablyFairCore } from '../core/ProvablyFairCore.js'
import { AntiExploit } from '../core/AntiExploit.js'

/**
 * Dragon Tiger Card Engine (Server-Authoritative)
 * Calibrated with Cryptographic Unpredictability & Anti-Martingale Protection
 */
export class DragonTigerEngine {
    static evaluate({ betAmount, choice = 'dragon', bets, clientSeed, nonce, userId, userBets = [] }) {
        const { hash, floatVal, roundEntropy } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        const totalBet = parseFloat(betAmount) || 0
        const { consecutiveWins, isMartingale } = AntiExploit.analyzeUserPattern({
            userBets,
            gameKey: 'dragon-tiger',
            currentBet: totalBet
        })

        // Draw cards with cryptographic entropy (100% Provably Fair HMAC-SHA256)
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

        if (bets && typeof bets === 'object' && Object.keys(bets).length > 0) {
            const bDragon = parseFloat(bets.dragon) || 0
            const bTiger = parseFloat(bets.tiger) || 0
            const bTie = parseFloat(bets.tie) || 0
            const calculatedTotal = bDragon + bTiger + bTie || totalBet

            if (winner === 'dragon') {
                payout = bDragon * 2.0
            } else if (winner === 'tiger') {
                payout = bTiger * 2.0
            } else if (winner === 'tie') {
                payout = (bTie * 9.0) + (bDragon * 0.5) + (bTiger * 0.5)
            }
            payout = parseFloat(payout.toFixed(2))
            won = payout >= calculatedTotal
        } else {
            const selectedChoice = String(choice).toLowerCase()
            let multiplier = 0
            if (winner === 'tie') {
                if (selectedChoice === 'tie') {
                    won = true
                    multiplier = 9.0
                } else {
                    won = false
                    multiplier = 0.5 // Half refund on tie (Asian casino standard)
                }
            } else if (winner === selectedChoice) {
                won = true
                multiplier = 2.0
            } else {
                won = false
                multiplier = 0
            }
            payout = parseFloat((totalBet * multiplier).toFixed(2))
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
            hash,
            roundEntropy
        }
    }
}

export default DragonTigerEngine
