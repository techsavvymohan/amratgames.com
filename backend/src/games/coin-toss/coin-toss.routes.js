import express from 'express'
import crypto from 'node:crypto'
import { db } from '../../db/db.js'
import { authenticate } from '../../middleware/auth.js'
import { broadcastEvent } from '../../websocket.js'
import { provablyFairCore } from '../core/ProvablyFairCore.js'
import { CoinTossEngine } from './coin-toss.engine.js'

const router = express.Router()

// POST /api/games/coin-toss/flip
router.post('/flip', authenticate, async (req, res) => {
    try {
        const { betAmount, choice = 'heads', currency = 'INR', clientSeed = 'coin-player' } = req.body
        const parsedAmount = parseFloat(betAmount)
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid bet amount is required' })
        }
        if (parsedAmount > 50000) {
            return res.status(400).json({ success: false, error: 'Maximum bet limit is ₹50,000 per round' })
        }

        const selectedChoice = String(choice).toLowerCase().trim() === 'tails' ? 'tails' : 'heads'

        if (!req.user) {
            return res.status(401).json({
                success: false,
                code: 'AUTH_REQUIRED',
                error: 'Please sign up or sign in to play Coin Toss on AmratGames'
            })
        }

        const betResult = await db.executeAtomicBet({
            userId: req.user.id,
            currency,
            betAmount: parsedAmount,
            game: 'coin-toss',
            gameName: 'Royal Coin Toss',
            evaluator: async () => {
                const nonce = provablyFairCore.getNextNonce(req.user.id)
                const userBets = db.getUserBets ? db.getUserBets(req.user.id, 10) : []
                return CoinTossEngine.evaluate({
                    betAmount: parsedAmount,
                    choice: selectedChoice,
                    clientSeed,
                    nonce,
                    userId: req.user.id,
                    userBets
                })
            }
        })

        broadcastEvent('NEW_BET', betResult.bet)

        return res.json({
            success: true,
            outcome: betResult.evaluation.outcome,
            won: betResult.won,
            multiplier: betResult.multiplier,
            payout: betResult.payout,
            bet: betResult.bet,
            evaluation: betResult.evaluation,
            balances: betResult.balances
        })
    } catch (err) {
        const statusCode = err.status || (err.code === 'INSUFFICIENT_BALANCE' ? 400 : 500)
        res.status(statusCode).json({ success: false, error: err.message })
    }
})

export default router
