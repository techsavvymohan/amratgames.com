import express from 'express'
import crypto from 'node:crypto'
import { db } from '../db/db.js'
import { authenticate } from '../middleware/auth.js'
import { broadcastEvent } from '../websocket.js'
import { gameEngine, PLINKO_PAYOUTS } from '../services/GameEngine.js'
import { checkGameMaintenance } from '../middleware/circuitBreaker.js'
import { crashRoomService } from '../services/CrashRoomService.js'

const router = express.Router()

// Enforce per-game kill switch check
router.use(checkGameMaintenance)

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

// POST /api/games/provably-fair/verify
router.post('/provably-fair/verify', (req, res) => {
    try {
        const { serverSeed, clientSeed = 'amrat-player', nonce = 1, game = 'limbo', rows = 16, risk = 'medium', minesCount = 3 } = req.body
        if (!serverSeed) {
            return res.status(400).json({ success: false, error: 'serverSeed is required for provably fair verification' })
        }

        const cleanClientSeed = String(clientSeed).trim()
        const cleanNonce = parseInt(nonce, 10) || 1
        const serverSeedSha256 = crypto.createHash('sha256').update(serverSeed).digest('hex')

        const message = `${cleanClientSeed}:${cleanNonce}`
        const hmac = crypto.createHmac('sha256', serverSeed)
        hmac.update(message)
        const hash = hmac.digest('hex')

        const intVal = parseInt(hash.slice(0, 8), 16)
        const floatVal = intVal / 0x100000000

        let result = {}
        const gameType = String(game).toLowerCase()

        if (gameType === 'limbo') {
            let roll = 1.00
            if (floatVal >= 0.01) {
                roll = Math.floor((99 / (1 - floatVal))) / 100
            }
            roll = Math.max(1.00, Math.min(roll, 1000000.0))
            result = { game: 'limbo', roll, floatVal }
        } else if (gameType === 'crash') {
            let crashPoint = 1.00
            if (floatVal >= 0.01) {
                crashPoint = Math.floor((99 / (1 - floatVal))) / 100
            }
            crashPoint = Math.max(1.00, Math.min(crashPoint, 1000.0))
            result = { game: 'crash', crashPoint, floatVal }
        } else if (gameType === 'plinko') {
            const numRows = Math.max(8, Math.min(parseInt(rows, 10) || 16, 16))
            const riskLevel = ['low', 'medium', 'high'].includes(risk) ? risk : 'medium'
            const path = []
            let rightBounces = 0
            for (let i = 0; i < numRows; i++) {
                const chunk = hash.substr(i * 4, 4) || '7fff'
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
            const tiles = Array.from({ length: 25 }, (_, i) => i)
            for (let i = 24; i > 0; i--) {
                const byteOffset = (24 - i) % 32
                const randByte = parseInt(hash.slice(byteOffset * 2, byteOffset * 2 + 2), 16)
                const j = randByte % (i + 1);
                [tiles[i], tiles[j]] = [tiles[j], tiles[i]]
            }
            const count = Math.max(1, Math.min(parseInt(minesCount, 10) || 3, 24))
            result = {
                game: 'mines',
                minesCount: count,
                mineIndices: tiles.slice(0, count)
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
                bets: reqBody.bets,
                clientSeed,
                nonce
            })
            break
        }

        case 'color-match': {
            evaluation = gameEngine.evaluateColorMatch({
                betAmount: parsedAmount,
                choice: choice || reqBody.selectedColor || 'green',
                bets: reqBody.bets,
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
// GET /api/games/mines/active
router.get('/mines/active', authenticate, (req, res) => {
    try {
        const effectiveUserId = req.user ? req.user.id : (req.headers['x-guest-session'] || 'guest_demo')
        const activeRound = gameEngine.getActiveMinesRound(effectiveUserId)
        res.json({ success: true, activeRound })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/games/mines/start
router.post('/mines/start', authenticate, async (req, res) => {
    try {
        const { betAmount, minesCount = 3, currency = 'INR', clientSeed } = req.body
        const parsedAmount = parseFloat(betAmount)

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid bet amount is required' })
        }
        if (parsedAmount > 50000) {
            return res.status(400).json({ success: false, error: 'Maximum bet limit is ₹50,000' })
        }

        const effectiveUserId = req.user ? req.user.id : (req.headers['x-guest-session'] || 'guest_demo')

        if (req.user) {
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
            return res.json({
                success: true,
                ...session,
                balances: updatedUser.balances
            })
        } else {
            // Guest demo session
            const session = gameEngine.startMinesRound({
                userId: effectiveUserId,
                currency,
                betAmount: parsedAmount,
                minesCount,
                clientSeed: clientSeed || 'guest_seed'
            })
            return res.json({
                success: true,
                ...session,
                balances: null
            })
        }
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

// POST /api/games/mines/reveal
router.post('/mines/reveal', authenticate, async (req, res) => {
    try {
        const { roundId, tileIndex } = req.body
        if (!roundId || tileIndex === undefined) {
            return res.status(400).json({ success: false, error: 'roundId and tileIndex are required' })
        }

        const effectiveUserId = req.user ? req.user.id : (req.headers['x-guest-session'] || 'guest_demo')

        if (req.user) {
            const result = await db.withUserLock(req.user.id, async () => {
                const revealResult = gameEngine.revealMinesTile({
                    userId: req.user.id,
                    roundId,
                    tileIndex
                })

                // If player hit a mine or auto-won, log the round in DB
                const currency = revealResult.currency || 'INR'
                const betAmount = revealResult.betAmount || 0

                if (revealResult.hitMine) {
                    db.recordBet({
                        userId: req.user.id,
                        username: req.user.username,
                        game: 'mines',
                        gameName: 'Mines',
                        currency,
                        betAmount,
                        multiplier: 0,
                        payout: 0,
                        profit: -betAmount,
                        won: false,
                        hash: crypto.randomBytes(16).toString('hex')
                    })
                } else if (revealResult.autoWin && revealResult.payout > 0) {
                    db.updateUserBalance(req.user.id, currency, revealResult.payout, `Mines Auto Win (${revealResult.currentMultiplier}x)`)
                    const betRecord = db.recordBet({
                        userId: req.user.id,
                        username: req.user.username,
                        game: 'mines',
                        gameName: 'Mines',
                        currency,
                        betAmount,
                        multiplier: revealResult.currentMultiplier,
                        payout: revealResult.payout,
                        profit: revealResult.payout - betAmount,
                        won: true,
                        hash: crypto.randomBytes(16).toString('hex')
                    })
                    broadcastEvent('NEW_BET', betRecord)
                }

                return revealResult
            })

            const user = db.findUserById(req.user.id)
            return res.json({
                success: true,
                ...result,
                balances: user.balances
            })
        } else {
            // Guest demo reveal
            const result = gameEngine.revealMinesTile({
                userId: effectiveUserId,
                roundId,
                tileIndex
            })
            return res.json({
                success: true,
                ...result,
                balances: null
            })
        }
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

// POST /api/games/mines/cashout
router.post('/mines/cashout', authenticate, async (req, res) => {
    try {
        const { roundId } = req.body
        if (!roundId) {
            return res.status(400).json({ success: false, error: 'roundId is required' })
        }

        const effectiveUserId = req.user ? req.user.id : (req.headers['x-guest-session'] || 'guest_demo')

        if (req.user) {
            const result = await db.withUserLock(req.user.id, async () => {
                const cashoutResult = gameEngine.cashoutMines({
                    userId: req.user.id,
                    roundId
                })

                // Credit legitimate winnings
                const currency = cashoutResult.currency || 'INR'
                const betAmount = cashoutResult.betAmount || 0

                db.updateUserBalance(req.user.id, currency, cashoutResult.payout, `Mines Cashout (${cashoutResult.multiplier}x)`)

                const betRecord = db.recordBet({
                    userId: req.user.id,
                    username: req.user.username,
                    game: 'mines',
                    gameName: 'Mines',
                    currency,
                    betAmount,
                    multiplier: cashoutResult.multiplier,
                    payout: cashoutResult.payout,
                    profit: cashoutResult.payout - betAmount,
                    won: true,
                    hash: crypto.randomBytes(16).toString('hex')
                })

                broadcastEvent('NEW_BET', betRecord)
                return cashoutResult
            })

            const user = db.findUserById(req.user.id)
            return res.json({
                success: true,
                ...result,
                balances: user.balances
            })
        } else {
            // Guest demo cashout
            const result = gameEngine.cashoutMines({
                userId: effectiveUserId,
                roundId
            })
            return res.json({
                success: true,
                ...result,
                balances: null
            })
        }
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

// ── 3. Server-Authoritative Crash Game Routes ───────────────
// GET /api/games/crash/active
router.get('/crash/active', authenticate, (req, res) => {
    try {
        const effectiveUserId = req.user ? req.user.id : (req.headers['x-guest-session'] || 'guest_demo')
        const activeRound = gameEngine.getActiveCrashRound(effectiveUserId)
        res.json({ success: true, activeRound })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/games/crash/start
router.post('/crash/start', authenticate, async (req, res) => {
    try {
        const { betAmount, currency = 'INR', autoCashout, clientSeed } = req.body
        const parsedAmount = parseFloat(betAmount)

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid bet amount is required' })
        }
        if (parsedAmount > 50000) {
            return res.status(400).json({ success: false, error: 'Maximum bet limit is ₹50,000' })
        }

        const effectiveUserId = req.user ? req.user.id : (req.headers['x-guest-session'] || 'guest_demo')

        if (req.user) {
            const session = await db.withUserLock(req.user.id, async () => {
                const user = db.findUserById(req.user.id)
                const currentBal = user.balances?.[currency] || 0
                if (parsedAmount > currentBal + 0.0001) {
                    const err = new Error(`Insufficient ${currency} balance`)
                    err.status = 400
                    throw err
                }

                // Deduct bet amount immediately upon flight launch under lock
                db.updateUserBalance(user.id, currency, -parsedAmount, 'Crash Bet (Launch)')

                return gameEngine.startCrashRound({
                    userId: user.id,
                    currency,
                    betAmount: parsedAmount,
                    autoCashout,
                    clientSeed: clientSeed || user.id
                })
            })

            const updatedUser = db.findUserById(req.user.id)
            return res.json({
                success: true,
                ...session,
                balances: updatedUser.balances
            })
        } else {
            // Guest demo session
            const session = gameEngine.startCrashRound({
                userId: effectiveUserId,
                currency,
                betAmount: parsedAmount,
                autoCashout,
                clientSeed: clientSeed || 'guest_seed'
            })
            return res.json({
                success: true,
                ...session,
                balances: null
            })
        }
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message })
    }
})

// POST /api/games/crash/cashout
router.post('/crash/cashout', authenticate, async (req, res) => {
    try {
        const { roundId, multiplier } = req.body
        if (!roundId || !multiplier) {
            return res.status(400).json({ success: false, error: 'roundId and multiplier are required' })
        }

        const effectiveUserId = req.user ? req.user.id : (req.headers['x-guest-session'] || 'guest_demo')

        if (req.user) {
            const result = await db.withUserLock(req.user.id, async () => {
                const cashoutResult = gameEngine.cashoutCrash({
                    userId: req.user.id,
                    roundId,
                    multiplier
                })

                const currency = cashoutResult.currency || 'INR'
                const betAmount = cashoutResult.betAmount || 0

                if (cashoutResult.won && cashoutResult.payout > 0) {
                    db.updateUserBalance(req.user.id, currency, cashoutResult.payout, `Crash Cashout (${cashoutResult.multiplier}x)`)
                    const betRecord = db.recordBet({
                        userId: req.user.id,
                        username: req.user.username,
                        game: 'crash',
                        gameName: 'Crash 1000x',
                        currency,
                        betAmount,
                        multiplier: cashoutResult.multiplier,
                        payout: cashoutResult.payout,
                        profit: cashoutResult.payout - betAmount,
                        won: true,
                        hash: cashoutResult.hash
                    })
                    broadcastEvent('NEW_BET', betRecord)
                } else {
                    const betRecord = db.recordBet({
                        userId: req.user.id,
                        username: req.user.username,
                        game: 'crash',
                        gameName: 'Crash 1000x',
                        currency,
                        betAmount,
                        multiplier: 0,
                        payout: 0,
                        profit: -betAmount,
                        won: false,
                        hash: cashoutResult.hash
                    })
                    broadcastEvent('NEW_BET', betRecord)
                }

                return cashoutResult
            })

            const user = db.findUserById(req.user.id)
            return res.json({
                success: true,
                ...result,
                balances: user.balances
            })
        } else {
            const result = gameEngine.cashoutCrash({
                userId: effectiveUserId,
                roundId,
                multiplier
            })
            return res.json({
                success: true,
                ...result,
                balances: null
            })
        }
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

// POST /api/games/crash/bust
router.post('/crash/bust', authenticate, async (req, res) => {
    try {
        const { roundId } = req.body
        if (!roundId) {
            return res.status(400).json({ success: false, error: 'roundId is required' })
        }

        const effectiveUserId = req.user ? req.user.id : (req.headers['x-guest-session'] || 'guest_demo')

        if (req.user) {
            const result = await db.withUserLock(req.user.id, async () => {
                const bustResult = gameEngine.bustCrash({
                    userId: req.user.id,
                    roundId
                })

                if (!bustResult.alreadyClosed) {
                    const currency = bustResult.currency || 'INR'
                    const betAmount = bustResult.betAmount || 0

                    const betRecord = db.recordBet({
                        userId: req.user.id,
                        username: req.user.username,
                        game: 'crash',
                        gameName: 'Crash 1000x',
                        currency,
                        betAmount,
                        multiplier: 0,
                        payout: 0,
                        profit: -betAmount,
                        won: false,
                        hash: bustResult.hash || crypto.randomBytes(16).toString('hex')
                    })
                    broadcastEvent('NEW_BET', betRecord)
                }

                return bustResult
            })

            const user = db.findUserById(req.user.id)
            return res.json({
                success: true,
                ...result,
                balances: user.balances
            })
        } else {
            const result = gameEngine.bustCrash({
                userId: effectiveUserId,
                roundId
            })
            return res.json({
                success: true,
                ...result,
                balances: null
            })
        }
    } catch (err) {
        res.status(400).json({ success: false, error: err.message })
    }
})

// ── 2B. Synchronized Multiplayer Crash Room Endpoints ────────
// GET /api/games/crash/room/state
router.get('/crash/room/state', (req, res) => {
    try {
        res.json({
            success: true,
            room: crashRoomService.getState()
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/games/crash/room/bet
router.post('/crash/room/bet', authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required to join multiplayer room bets' })
        }
        const { betAmount, autoCashout, currency = 'INR' } = req.body
        const result = await crashRoomService.placeBet({
            userId: req.user.id,
            username: req.user.username,
            betAmount,
            autoCashout,
            currency
        })
        res.json({
            success: true,
            ...result
        })
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message, code: err.code })
    }
})

// POST /api/games/crash/room/cashout
router.post('/crash/room/cashout', authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required to cashout' })
        }
        const result = await crashRoomService.cashoutPlayer({
            userId: req.user.id
        })
        res.json({
            success: true,
            ...result
        })
    } catch (err) {
        res.status(err.status || 400).json({ success: false, error: err.message, code: err.code })
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
