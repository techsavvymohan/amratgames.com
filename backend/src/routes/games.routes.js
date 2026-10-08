import express from 'express'
import crypto from 'node:crypto'
import { db } from '../db/db.js'
import { authenticate } from '../middleware/auth.js'
import { broadcastEvent } from '../websocket.js'
import { gameEngine } from '../services/GameEngine.js'

const router = express.Router()

// ── 1. Public Info & Seed Endpoints ─────────────────────────
// GET /api/games/recent
router.get('/recent', (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 20
        const bets = db.getRecentBets(limit)
        res.json({ success: true, bets })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// GET /api/games/provably-fair/seed
router.get('/provably-fair/seed', (req, res) => {
    try {
        res.json({
            success: true,
            serverSeedHash: db.data.settings?.serverSeedHash,
            rtp: db.data.settings?.rtp || 99.0,
            houseEdge: db.data.settings?.houseEdge || 1.0,
            announcement: db.data.settings?.activeAnnouncements
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// Helper for evaluating server-authoritative outcomes
function evaluateGameRound({
    game,
    parsedAmount,
    targetMultiplier,
    rows,
    risk,
    choice,
    claimedMultiplier,
    minesCount,
    hits,
    clientSeed,
    nonce,
    reqBody
}) {
    let evaluation = null

    switch (game.toLowerCase()) {
        case 'limbo': {
            evaluation = gameEngine.evaluateLimbo({
                betAmount: parsedAmount,
                targetMultiplier: targetMultiplier || reqBody.multiplier || 2.0,
                clientSeed,
                nonce
            })
            break
        }

        case 'plinko': {
            evaluation = gameEngine.evaluatePlinko({
                betAmount: parsedAmount,
                rows: rows || 16,
                risk: risk || 'medium',
                clientSeed,
                nonce
            })
            break
        }

        case 'dragon-tiger': {
            evaluation = gameEngine.evaluateDragonTiger({
                betAmount: parsedAmount,
                choice: choice || reqBody.betType || 'dragon',
                clientSeed,
                nonce
            })
            break
        }

        case 'color-match': {
            evaluation = gameEngine.evaluateColorMatch({
                betAmount: parsedAmount,
                choice: choice || reqBody.selectedColor || 'green',
                clientSeed,
                nonce
            })
            break
        }

        case 'crash':
        case 'dino': {
            evaluation = gameEngine.evaluateCrash({
                claimedMultiplier: claimedMultiplier || reqBody.multiplier,
                clientSeed,
                nonce,
                autoCashout: reqBody.autoCashout
            })
            evaluation.payout = evaluation.won ? parseFloat((parsedAmount * evaluation.multiplier).toFixed(2)) : 0
            break
        }

        case 'mines': {
            const count = Math.max(1, Math.min(parseInt(minesCount, 10) || 3, 24))
            const numHits = Math.max(0, Math.min(parseInt(hits, 10) || 1, 25 - count))
            const verifiedMult = gameEngine.calculateMinesMultiplier(count, numHits)
            const clientWon = Boolean(reqBody.won)
            const safeWon = clientWon && numHits > 0
            const safeMult = safeWon ? verifiedMult : 0
            const payout = safeWon ? parseFloat((parsedAmount * safeMult).toFixed(2)) : 0

            evaluation = {
                won: safeWon,
                multiplier: safeMult,
                payout,
                hash: crypto.randomBytes(16).toString('hex')
            }
            break
        }

        default: {
            const { floatVal, hash } = gameEngine.generateHmacFloat(clientSeed, nonce)
            const won = floatVal < 0.495
            const multiplier = won ? 2.0 : 0
            const payout = won ? parseFloat((parsedAmount * 2.0).toFixed(2)) : 0
            evaluation = { won, multiplier, payout, hash }
            break
        }
    }

    return evaluation
}

// ── 2. Server-Authoritative Mines Game Routes ───────────────
// POST /api/games/mines/start
router.post('/mines/start', authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' })
        }

        const { betAmount, minesCount = 3, currency = 'INR', clientSeed } = req.body
        const parsedAmount = parseFloat(betAmount)

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid bet amount is required' })
        }
        if (parsedAmount > 50000) {
            return res.status(400).json({ success: false, error: 'Maximum bet limit is ₹50,000' })
        }

        const session = await db.withUserLock(req.user.id, async () => {
            const user = db.findUserById(req.user.id)
            const currentBal = user.balances?.[currency] || 0
            if (parsedAmount > currentBal + 0.0001) {
                const err = new Error(`Insufficient ${currency} balance`)
                err.status = 400
                throw err
            }

            // Deduct bet amount immediately upon round start under lock
            db.updateUserBalance(user.id, currency, -parsedAmount, `Mines Bet (${minesCount} mines)`)

            return gameEngine.startMinesRound({
                userId: user.id,
                currency,
                betAmount: parsedAmount,
                minesCount,
                clientSeed: clientSeed || user.id
            })
        })

        const updatedUser = db.findUserById(req.user.id)

        res.json({
            success: true,
            ...session,
            balances: updatedUser.balances
        })
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

// POST /api/games/mines/reveal
router.post('/mines/reveal', authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' })
        }

        const { roundId, tileIndex } = req.body
        if (!roundId || tileIndex === undefined) {
            return res.status(400).json({ success: false, error: 'roundId and tileIndex are required' })
        }

        const result = await db.withUserLock(req.user.id, async () => {
            const revealResult = gameEngine.revealMinesTile({
                userId: req.user.id,
                roundId,
                tileIndex
            })

            // If player hit a mine or auto-won, log the round in DB
            if (revealResult.hitMine) {
                db.recordBet({
                    userId: req.user.id,
                    username: req.user.username,
                    game: 'mines',
                    gameName: 'Mines',
                    currency: 'INR',
                    betAmount: 0,
                    multiplier: 0,
                    payout: 0,
                    profit: 0,
                    won: false,
                    hash: crypto.randomBytes(16).toString('hex')
                })
            } else if (revealResult.autoWin && revealResult.payout > 0) {
                db.updateUserBalance(req.user.id, 'INR', revealResult.payout, `Mines Auto Win (${revealResult.currentMultiplier}x)`)
                const betRecord = db.recordBet({
                    userId: req.user.id,
                    username: req.user.username,
                    game: 'mines',
                    gameName: 'Mines',
                    currency: 'INR',
                    betAmount: 0,
                    multiplier: revealResult.currentMultiplier,
                    payout: revealResult.payout,
                    profit: revealResult.payout,
                    won: true,
                    hash: crypto.randomBytes(16).toString('hex')
                })
                broadcastEvent('NEW_BET', betRecord)
            }

            return revealResult
        })

        const user = db.findUserById(req.user.id)

        res.json({
            success: true,
            ...result,
            balances: user.balances
        })
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

// POST /api/games/mines/cashout
router.post('/mines/cashout', authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' })
        }

        const { roundId } = req.body
        if (!roundId) {
            return res.status(400).json({ success: false, error: 'roundId is required' })
        }

        const result = await db.withUserLock(req.user.id, async () => {
            const cashoutResult = gameEngine.cashoutMines({
                userId: req.user.id,
                roundId
            })

            // Credit legitimate winnings
            db.updateUserBalance(req.user.id, 'INR', cashoutResult.payout, `Mines Cashout (${cashoutResult.multiplier}x)`)

            const betRecord = db.recordBet({
                userId: req.user.id,
                username: req.user.username,
                game: 'mines',
                gameName: 'Mines',
                currency: 'INR',
                betAmount: 0,
                multiplier: cashoutResult.multiplier,
                payout: cashoutResult.payout,
                profit: cashoutResult.payout,
                won: true,
                hash: crypto.randomBytes(16).toString('hex')
            })

            broadcastEvent('NEW_BET', betRecord)
            return cashoutResult
        })

        const user = db.findUserById(req.user.id)

        res.json({
            success: true,
            ...result,
            balances: user.balances
        })
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

// ── 3. Universal Server-Authoritative Bet Processor ─────────
// POST /api/games/bet
router.post('/bet', authenticate, async (req, res) => {
    try {
        const {
            game = 'crash',
            gameName = 'Game',
            currency = 'INR',
            betAmount,
            clientSeed = 'player-seed-2026',
            targetMultiplier,
            rows,
            risk,
            choice,
            claimedMultiplier,
            minesCount,
            hits
        } = req.body

        const parsedAmount = parseFloat(betAmount)
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid bet amount is required' })
        }
        if (parsedAmount > 50000) {
            return res.status(400).json({ success: false, error: 'Maximum bet limit is ₹50,000 per round' })
        }

        if (req.user) {
            // Atomic wager & settlement under exclusive user lock
            const betResult = await db.executeAtomicBet({
                userId: req.user.id,
                currency,
                betAmount: parsedAmount,
                game,
                gameName,
                evaluator: async () => {
                    const nonce = gameEngine.getNextNonce(req.user.id)
                    return evaluateGameRound({
                        game,
                        parsedAmount,
                        targetMultiplier,
                        rows,
                        risk,
                        choice,
                        claimedMultiplier,
                        minesCount,
                        hits,
                        clientSeed,
                        nonce,
                        reqBody: req.body
                    })
                }
            })

            broadcastEvent('NEW_BET', betResult.bet)

            return res.json({
                success: true,
                bet: betResult.bet,
                evaluation: betResult.evaluation,
                won: betResult.won,
                payout: betResult.payout,
                multiplier: betResult.multiplier,
                balances: betResult.balances
            })
        } else {
            // Guest player demo simulation
            const nonce = gameEngine.getNextNonce('guest')
            const evaluation = evaluateGameRound({
                game,
                parsedAmount,
                targetMultiplier,
                rows,
                risk,
                choice,
                claimedMultiplier,
                minesCount,
                hits,
                clientSeed,
                nonce,
                reqBody: req.body
            })

            const payout = evaluation.payout || 0
            const won = Boolean(evaluation.won)
            const finalMultiplier = evaluation.multiplier || 0
            const profit = payout - parsedAmount

            const betRecord = db.recordBet({
                userId: null,
                username: 'Player_' + crypto.randomBytes(2).toString('hex'),
                game,
                gameName,
                currency,
                betAmount: parsedAmount,
                multiplier: finalMultiplier,
                payout,
                profit,
                won,
                hash: evaluation.hash || crypto.randomBytes(16).toString('hex')
            })

            broadcastEvent('NEW_BET', betRecord)

            return res.json({
                success: true,
                bet: betRecord,
                evaluation,
                won,
                payout,
                multiplier: finalMultiplier,
                balances: null
            })
        }
    } catch (err) {
        const statusCode = err.status || (err.code === 'INSUFFICIENT_BALANCE' ? 400 : 500)
        res.status(statusCode).json({ success: false, error: err.message })
    }
})

export default router
