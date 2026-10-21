import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { db } from '../src/db/db.js'
import { gameEngine } from '../src/services/GameEngine.js'
import { pvpService } from '../src/services/PvPService.js'

describe('🛡️ Platform Audit & Integrity Verification Suite', () => {
    it('verifies AMRAT wagers are strictly excluded from real INR rakeback, turnover, and affiliate commissions', async () => {
        const referrer = db.createUser({
            username: 'agent_safe_' + Date.now(),
            email: `agent_safe_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player'
        })

        const player = db.createUser({
            username: 'amrat_spinner_' + Date.now(),
            email: `amrat_spin_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player',
            referredBy: referrer.referralCode
        })

        player.balances.AMRAT = 50000
        const initialTotalWagered = player.totalWagered || 0

        // Bet with AMRAT virtual demo tokens
        await db.executeAtomicBet({
            userId: player.id,
            currency: 'AMRAT',
            betAmount: 10000,
            game: 'limbo',
            gameName: 'Limbo',
            evaluator: async () => ({ won: false, multiplier: 0, payout: 0 })
        })

        const updatedPlayer = db.findUserById(player.id)
        const updatedReferrer = db.findUserById(referrer.id)

        // 1. AML deposit rollover must NOT be cheated by AMRAT
        assert.equal(updatedPlayer.totalWagered, initialTotalWagered, 'AMRAT bets must not count towards AML deposit turnover')

        // 2. Real INR rakeback must NOT be generated from AMRAT
        assert.equal(updatedPlayer.unclaimedRakeback, 0, 'AMRAT bets must not generate INR rakeback')

        // 3. Real affiliate commission must NOT be extracted from AMRAT
        assert.equal(updatedReferrer.affiliateStats.unclaimedEarnings, 0, 'AMRAT bets must not generate affiliate commissions')
    })

    it('verifies BTC wagers preserve full 8-decimal Satoshi precision without truncation', () => {
        const btcUser = db.createUser({
            username: 'btc_precision_' + Date.now(),
            email: `btc_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player'
        })

        btcUser.balances.BTC = 0.00100000 // 100,000 sats

        // Deduct 1,234 Satoshis
        const delta = -0.00001234
        const result = db.updateUserBalance(btcUser.id, 'BTC', delta, 'Micro Bitcoin Bet')

        assert.equal(result.user.balances.BTC, 0.00098766, 'BTC balance must accurately reflect Satoshis at 8 decimal places')

        // Withdraw 5,000 Satoshis
        const wdResult = db.requestWithdrawal({
            userId: btcUser.id,
            currency: 'BTC',
            amount: 0.00005000,
            payoutMethod: 'Crypto',
            payoutDestination: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
        })

        assert.equal(wdResult.user.balances.BTC, 0.00093766, 'BTC withdrawal must preserve full 8-decimal precision')
    })

    it('verifies empty or missing UTR deposits are strictly rejected', () => {
        const depositor = db.createUser({
            username: 'utr_strict_' + Date.now(),
            email: `utr_strict_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player'
        })

        // Missing UTR
        assert.throws(() => {
            db.requestDeposit({
                userId: depositor.id,
                currency: 'INR',
                amount: 500,
                paymentMethod: 'UPI',
                utrNumber: ''
            })
        }, /valid 12-digit UPI UTR/)

        // Too short UTR
        assert.throws(() => {
            db.requestDeposit({
                userId: depositor.id,
                currency: 'INR',
                amount: 500,
                paymentMethod: 'UPI',
                utrNumber: '123'
            })
        }, /valid 12-digit UPI UTR/)
    })

    it('verifies Dragon Tiger cards strictly match HMAC-SHA256 outcome without card swapping', () => {
        const clientSeed = 'provably-fair-audit-seed'
        const nonce = 42

        const result = gameEngine.evaluateDragonTiger({
            betAmount: 500,
            choice: 'dragon',
            clientSeed,
            nonce,
            userBets: [{ won: true }, { won: true }, { won: true }] // Simulate 3-win streak
        })

        // Recompute expected cards directly from canonical HMAC-SHA256
        const serverSeed = gameEngine.getServerSeed()
        const hmac = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex')
        const expectedDVal = (parseInt(hmac.slice(0, 4), 16) % 13) + 1
        const expectedTVal = (parseInt(hmac.slice(4, 8), 16) % 13) + 1

        assert.equal(result.hash, hmac, 'Result hash must strictly match HMAC hash')
        assert.equal(result.dragon.value, expectedDVal, 'Dragon card value must strictly match HMAC hash')
        assert.equal(result.tiger.value, expectedTVal, 'Tiger card value must strictly match HMAC hash')
    })

    it('verifies Coin Toss outcome strictly derives from cryptographic floatVal', () => {
        const result = gameEngine.evaluateCoinToss({
            betAmount: 100,
            choice: 'heads',
            clientSeed: 'coin-audit-seed',
            nonce: 10
        })

        const expectedOutcome = (result.floatVal < 0.50) ? 'heads' : 'tails'
        assert.equal(result.outcome, expectedOutcome, 'Coin outcome must be 100% deterministic from floatVal')
        assert.equal(result.won, result.choice === expectedOutcome)
    })

    it('verifies Limbo roll strictly honors 98.00% RTP mathematical curve', () => {
        const result = gameEngine.evaluateLimbo({
            betAmount: 100,
            targetMultiplier: 2.0,
            clientSeed: 'limbo-audit-seed',
            nonce: 7
        })

        const intVal = parseInt(result.hash.slice(0, 8), 16)
        const floatVal = intVal / 0x100000000

        let expectedRoll = 1.00
        if (floatVal >= 0.02) {
            expectedRoll = Math.floor((98.0 / (1 - floatVal))) / 100
        }
        expectedRoll = Math.max(1.00, Math.min(expectedRoll, 1000000.0))

        assert.equal(result.roll, expectedRoll, 'Limbo roll must strictly match 98% RTP mathematical curve')
    })

    it('verifies BTC withdrawal rejection preserves full 8-decimal Satoshi precision on refund', () => {
        const btcUser = db.createUser({
            username: 'btc_refund_' + Date.now(),
            email: `btc_refund_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player'
        })

        btcUser.balances.BTC = 0.00543219

        const wdResult = db.requestWithdrawal({
            userId: btcUser.id,
            currency: 'BTC',
            amount: 0.00543219,
            payoutMethod: 'Crypto',
            payoutDestination: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
        })

        assert.equal(wdResult.user.balances.BTC, 0)

        // Reject withdrawal and refund
        const rejectResult = db.rejectWithdrawal(wdResult.withdrawal.id, {
            adminUsername: 'admin',
            rejectionReason: 'Invalid crypto address'
        })

        assert.equal(rejectResult.user.balances.BTC, 0.00543219, 'BTC balance must restore all 8 Satoshi decimals on rejection refund')
    })

    it('verifies approved crypto deposits properly accumulate totalDeposited in INR equivalent', () => {
        const cryptoUser = db.createUser({
            username: 'usdt_depositor_' + Date.now(),
            email: `usdt_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player'
        })

        const initialTotal = cryptoUser.totalDeposited || 0

        // Create deposit request for 100 USDT
        const { deposit } = db.requestDeposit({
            userId: cryptoUser.id,
            currency: 'USDT',
            amount: 100,
            paymentMethod: 'CRYPTO_TRC20',
            utrNumber: 'TX_USDT_' + Date.now()
        })

        // Admin approves deposit
        const approval = db.approveDeposit(deposit.id, { adminUsername: 'admin' })

        // 100 USDT * ₹90 = ₹9,000 INR equivalent added to totalDeposited
        assert.equal(approval.user.totalDeposited, initialTotal + 9000, 'USDT deposits must convert to INR equivalent for withdrawal threshold')
    })

    it('verifies PvP Bitcoin duels preserve full 8-decimal Satoshi precision without truncation', async () => {
        const creator = db.createUser({
            username: 'pvp_btc_creator_' + Date.now(),
            email: `pvp_btc_1_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player'
        })
        const opponent = db.createUser({
            username: 'pvp_btc_challenger_' + Date.now(),
            email: `pvp_btc_2_${Date.now()}@test.com`,
            passwordHash: 'dummy',
            role: 'player'
        })

        creator.balances.BTC = 0.005
        opponent.balances.BTC = 0.005

        // Create duel with 0.001 BTC
        const createRes = await pvpService.createDuel({
            userId: creator.id,
            stake: 0.001,
            choice: 'heads',
            currency: 'BTC'
        })

        assert.equal(createRes.duel.stake, 0.001)
        assert.equal(createRes.duel.totalPot, 0.002)
        assert.equal(createRes.duel.houseRakeAmount, 0.00008) // 0.002 * 0.04
        assert.equal(createRes.duel.winnerPayout, 0.00192) // 0.002 - 0.00008

        // Join and resolve duel
        const joinRes = await pvpService.joinDuel({
            duelId: createRes.duel.id,
            userId: opponent.id
        })

        assert.equal(joinRes.duel.status, 'resolved')
        assert.equal(joinRes.duel.winnerPayout, 0.00192, 'Winner payout must preserve 8-decimal Satoshi precision')
        assert.ok((creator.totalWagered || 0) > 0 || (opponent.totalWagered || 0) > 0, 'Turnover in INR equivalent must be recorded')
    })

    // Clean exit for node test runner when Redis is not running locally
    after(() => {
        setTimeout(() => process.exit(0), 100).unref()
    })
})
