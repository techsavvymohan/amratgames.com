import { provablyFairCore } from '../core/ProvablyFairCore.js'

// Official Plinko Payout Matrices (Rows 8 to 16, Risk: low, medium, high)
export const PLINKO_PAYOUTS = {
    8: {
        low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
        medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
        high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    },
    9: {
        low: [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6],
        medium: [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18],
        high: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43],
    },
    10: {
        low: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9],
        medium: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
        high: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
    },
    11: {
        low: [8.4, 3, 1.9, 1.3, 1, 0.7, 0.7, 1, 1.3, 1.9, 3, 8.4],
        medium: [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24],
        high: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
    },
    12: {
        low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
        medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
        high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    },
    13: {
        low: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3, 4, 8.1],
        medium: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43],
        high: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260],
    },
    14: {
        low: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
        medium: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58],
        high: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
    },
    15: {
        low: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 2, 3, 8, 15],
        medium: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88],
        high: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
    },
    16: {
        low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
        medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
        high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
    },
}

export class PlinkoEngine {
    static evaluate({ betAmount, rows = 16, risk = 'medium', clientSeed, nonce }) {
        const numRows = Math.max(8, Math.min(parseInt(rows, 10) || 16, 16))
        const riskLevel = ['low', 'medium', 'high'].includes(risk) ? risk : 'medium'
        const { hash } = provablyFairCore.generateHmacFloat(clientSeed, nonce)

        const path = []
        let rightBounces = 0

        for (let i = 0; i < numRows; i++) {
            const chunk = hash.substr(i * 4, 4) || '7fff'
            const val = parseInt(chunk, 16)
            const direction = (val % 2 === 1) ? 1 : 0
            path.push(direction)
            if (direction === 1) rightBounces++
        }

        const binIndex = rightBounces
        const matrix = PLINKO_PAYOUTS[numRows]?.[riskLevel] || PLINKO_PAYOUTS[16].medium
        const multiplier = matrix[binIndex] || 0.5
        const payout = parseFloat((betAmount * multiplier).toFixed(2))
        const won = multiplier >= 1.0

        return {
            game: 'plinko',
            rows: numRows,
            risk: riskLevel,
            path,
            binIndex,
            multiplier,
            payout,
            won,
            hash
        }
    }
}

export default PlinkoEngine
