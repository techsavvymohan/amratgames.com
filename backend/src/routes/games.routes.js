import express from 'express'
import crypto from 'node:crypto'
import { db } from '../db/db.js'
import { authenticate } from '../middleware/auth.js'
import { broadcastEvent } from '../websocket.js'
import { gameEngine, PLINKO_PAYOUTS } from '../services/GameEngine.js'
import { checkGameMaintenance } from '../middleware/circuitBreaker.js'
import { minesRoutes } from '../games/mines/index.js'
import { crashRoutes } from '../games/crash/index.js'
import { coinTossRoutes } from '../games/coin-toss/index.js'
import { bankrollRisk } from '../services/BankrollRiskService.js'

const router = express.Router()

// Enforce per-game kill switch check
router.use(checkGameMaintenance)

// ── Mount Isolated Game Routers ──────────────────────────────
router.use('/mines', minesRoutes)
router.use('/crash', crashRoutes)
router.use('/aviator', crashRoutes)
router.use('/coin-toss', coinTossRoutes)

// ── 1. Public Info & Seed Endpoints ─────────────────────────
// GET /api/games/recent
router.get('/recent', (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 20
        const game = req.query.game ? String(req.query.game).toLowerCase().trim() : null
        let bets = db.getRecentBets(100)
        if (game) {
            const target = game.replace(/[^a-z0-9]/g, '')
            bets = bets.filter(b => {
                const bg = String(b.game || b.gameName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                return bg.includes(target) || target.includes(bg)
            })
        }
        res.json({ success: true, bets: bets.slice(0, limit) })
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
            rtp: db.data.settings?.rtp || 98.0,
            houseEdge: db.data.settings?.houseEdge || 2.0,
            announcement: db.data.settings?.activeAnnouncements
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/games/provably-fair/verify
router.post('/provably-fair/verify', (req, res) => {
    try {
        const { serverSeed, clientSeed = 'amrat-player', nonce = 1, roundEntropy, game = 'limbo', rows = 16, risk = 'medium', minesCount = 3 } = req.body
        if (!serverSeed) {
            return res.status(400).json({ success: false, error: 'serverSeed is required for provably fair verification' })
        }

        const gameType = String(game || '').toLowerCase()
        const cleanClientSeed = String(clientSeed || 'amrat-player').trim()
        const cleanNonce = parseInt(nonce, 10) || 1
        const serverSeedSha256 = crypto.createHash('sha256').update(serverSeed).digest('hex')

        let isMultiplayerCrash = (gameType === 'crash-multiplayer' || gameType === 'crash_room') || (Boolean(req.body.roundId) && String(req.body.roundId).startsWith('room_'))
        let message = `${cleanClientSeed}:${cleanNonce}`
        if (isMultiplayerCrash) {
            const roundId = req.body.roundId || 'room_default'
            const mpClientSeed = cleanClientSeed || 'amrat_multiplayer_public'
            message = `${roundId}:${mpClientSeed}`
        }

        const hmac = crypto.createHmac('sha256', serverSeed)
        hmac.update(message)
        const hash = hmac.digest('hex')

        let floatVal = 0
        if (isMultiplayerCrash) {
            const hexSub = hash.slice(0, 13)
            const intVal = parseInt(hexSub, 16)
            floatVal = intVal / Math.pow(2, 52)
        } else {
            const intVal = parseInt(hash.slice(0, 8), 16)
            floatVal = intVal / 0x100000000
        }

        let result = {}

        if (gameType === 'limbo') {
            let roll = 1.00
            if (floatVal >= 0.02) {
                roll = Math.floor((98.0 / (1 - floatVal))) / 100
            }
            roll = Math.max(1.00, Math.min(roll, 1000000.0))
            result = { game: 'limbo', roll, floatVal }
        } else if (gameType === 'crash' || gameType === 'aviator' || isMultiplayerCrash) {
            let crashPoint = 1.00
            if (floatVal >= 0.02) {
                crashPoint = Math.floor((98.0 / (1 - floatVal))) / 100
            }
            crashPoint = Math.max(1.00, Math.min(crashPoint, 1000.0))
            result = { game: isMultiplayerCrash ? 'crash-multiplayer' : 'crash', crashPoint, floatVal }
        } else if (gameType === 'plinko') {
            const numRows = Math.max(8, Math.min(parseInt(rows, 10) || 16, 16))
            const riskLevel = ['low', 'medium', 'high'].includes(risk) ? risk : 'medium'
            const path = []
            let rightBounces = 0
            for (let i = 0; i < numRows; i++) {
                const chunk = hash.slice(i * 4, (i + 1) * 4) || '7fff'
                const direction = (parseInt(chunk, 16) % 2 === 1) ? 1 : 0
                path.push(direction)
                if (direction === 1) rightBounces++
            }
            const matrix = PLINKO_PAYOUTS[numRows]?.[riskLevel] || PLINKO_PAYOUTS[16].medium
            result = {
                game: 'plinko',
                rows: numRows,
                risk: riskLevel,
                binIndex: rightBounces,
                multiplier: matrix[rightBounces] || 0.5,
                path
            }
        } else if (gameType === 'dragon-tiger') {
            const dVal = (parseInt(hash.slice(0, 4), 16) % 13) + 1
            const tVal = (parseInt(hash.slice(4, 8), 16) % 13) + 1
            const suits = ['♠', '♥', '♦', '♣']
            const dSuit = suits[parseInt(hash.slice(8, 9), 16) % 4]
            const tSuit = suits[parseInt(hash.slice(9, 10), 16) % 4]
            let winner = 'tie'
            if (dVal > tVal) winner = 'dragon'
            else if (tVal > dVal) winner = 'tiger'
            result = {
                game: 'dragon-tiger',
                dragon: { value: dVal, suit: dSuit },
                tiger: { value: tVal, suit: tSuit },
                winner
            }
        } else if (gameType === 'color-match') {
            const luckyNumber = parseInt(hash.slice(0, 4), 16) % 10
            const colors = []
            if (luckyNumber === 0) colors.push('red', 'violet')
            else if (luckyNumber === 5) colors.push('green', 'violet')
            else if ([1, 3, 7, 9].includes(luckyNumber)) colors.push('green')
            else colors.push('red')
            result = {
                game: 'color-match',
                luckyNumber,
                winningColors: colors,
                bigSmall: luckyNumber >= 5 ? 'big' : 'small'
            }
        } else if (gameType === 'mines') {
            const entropyHash = crypto.createHmac('sha512', serverSeed)
                .update(`${cleanClientSeed}:${cleanNonce}`)
                .digest('hex')

            const tiles = Array.from({ length: 25 }, (_, i) => i)
            for (let i = 24; i > 0; i--) {
                const offset = (24 - i) * 4
                const intVal = parseInt(entropyHash.slice(offset, offset + 4), 16)
                const j = Math.floor((intVal / 0x10000) * (i + 1))
                const swapIdx = Math.min(j, i)
                ;[tiles[i], tiles[swapIdx]] = [tiles[swapIdx], tiles[i]]
            }
            const count = Math.max(1, Math.min(parseInt(minesCount, 10) || 3, 24))
            result = {
                game: 'mines',
                minesCount: count,
                mineIndices: tiles.slice(0, count).sort((a, b) => a - b)
            }
        } else if (gameType === 'coin-toss' || gameType === 'cointoss' || gameType === 'coinflip') {
            const outcome = floatVal < 0.50 ? 'heads' : 'tails'
            result = {
                game: 'coin-toss',
                outcome,
                floatVal,
                multiplier: 1.96
            }
        } else {
            result = { game: gameType, floatVal, hash }
        }

        res.json({
            success: true,
            serverSeed,
            serverSeedSha256,
            clientSeed: cleanClientSeed,
            nonce: cleanNonce,
            hmacMessage: message,
            hmacHash: hash,
            outcome: result
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// Helper for evaluating server-authoritative outcomes
function evaluateGameRound({
    game,
    parsedAmount,
    currency = 'INR',
    targetMultiplier,
    rows,
    risk,
    choice,
    claimedMultiplier,
    minesCount,
    hits,
    clientSeed,
    nonce,
    userId,
    userBets,
    reqBody
}) {
    let evaluation = null

    switch (game.toLowerCase()) {
        case 'limbo': {
            evaluation = gameEngine.evaluateLimbo({
                betAmount: parsedAmount,
                targetMultiplier: targetMultiplier || reqBody.multiplier || 2.0,
                currency,
                clientSeed,
                nonce,
                userId,
                userBets
            })
            break
        }

        case 'plinko': {
            evaluation = gameEngine.evaluatePlinko({
                betAmount: parsedAmount,
                rows: rows || reqBody.rows || 16,
                risk: risk || reqBody.risk || 'medium',
                currency,
                clientSeed,
                nonce,
                userId,
                userBets
            })
            break
        }

        case 'dragon-tiger': {
            evaluation = gameEngine.evaluateDragonTiger({
                betAmount: parsedAmount,
                choice: choice || reqBody.choice || 'dragon',
                bets: reqBody.bets,
                clientSeed,
                nonce,
                userId,
                userBets
            })
            break
        }

        case 'color-match': {
            evaluation = gameEngine.evaluateColorMatch({
                betAmount: parsedAmount,
                choice: choice || reqBody.choice || 'green',
                bets: reqBody.bets,
                clientSeed,
                nonce,
                userId,
                userBets
            })
            break
        }

        case 'crash': {
            evaluation = gameEngine.evaluateCrash({
                claimedMultiplier: claimedMultiplier || reqBody.multiplier,
                clientSeed,
                nonce,
                autoCashout: reqBody.autoCashout,
                userId,
                userBets
            })
            const precision = bankrollRisk.getCurrencyDecimals(currency)
            evaluation.payout = evaluation.won ? parseFloat((parsedAmount * evaluation.multiplier).toFixed(precision)) : 0
            break
        }

        case 'mines': {
            const err = new Error('Mines bets must be placed via the server-authoritative session routes at /api/games/mines/*')
            err.status = 400
            throw err
        }

        case 'coin-toss':
        case 'cointoss':
        case 'coinflip':
        case 'coin-flip': {
            evaluation = gameEngine.evaluateCoinToss({
                betAmount: parsedAmount,
                choice: choice || reqBody.choice || reqBody.side || 'heads',
                clientSeed,
                nonce,
                userId,
                userBets
            })
            break
        }

        default: {
            const { floatVal, hash } = gameEngine.generateHmacFloat(clientSeed, nonce)
            const won = floatVal < 0.495
            const multiplier = won ? 2.0 : 0
            const precision = bankrollRisk.getCurrencyDecimals(currency)
            const payout = won ? parseFloat((parsedAmount * 2.0).toFixed(precision)) : 0
            evaluation = { won, multiplier, payout, hash }
            break
        }
    }

    return evaluation
}

// ── 2. Universal Server-Authoritative Bet Processor ─────────
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
        const targetMult = targetMultiplier || req.body.multiplier || claimedMultiplier || 1.0
        const riskCheck = bankrollRisk.validateBetRisk({
            betAmount: parsedAmount,
            targetMultiplier: targetMult,
            currency,
            game
        })
        if (!riskCheck.valid) {
            return res.status(400).json({ success: false, error: riskCheck.error })
        }

        if (!req.user) {
            return res.status(401).json({
                success: false,
                code: 'AUTH_REQUIRED',
                error: 'Please sign up or sign in to play and place bets on AmratGames'
            })
        }

        // Atomic wager & settlement under exclusive user lock
        const betResult = await db.executeAtomicBet({
            userId: req.user.id,
            currency,
            betAmount: parsedAmount,
            game,
            gameName,
            evaluator: async () => {
                const nonce = gameEngine.getNextNonce(req.user.id)
                const userBets = db.getUserBets ? db.getUserBets(req.user.id, 10) : []
                return evaluateGameRound({
                    game,
                    parsedAmount,
                    currency,
                    targetMultiplier,
                    rows,
                    risk,
                    choice,
                    claimedMultiplier,
                    minesCount,
                    hits,
                    clientSeed,
                    nonce,
                    userId: req.user.id,
                    userBets,
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
            balanceAfterDeduct: betResult.balanceAfterDeduct,
            balancesAfterDeduct: betResult.balancesAfterDeduct,
            finalBal: betResult.finalBal,
            balances: betResult.balances
        })
    } catch (err) {
        const statusCode = err.status || (err.code === 'INSUFFICIENT_BALANCE' ? 400 : 500)
        res.status(statusCode).json({ success: false, error: err.message })
    }
})

export default router
