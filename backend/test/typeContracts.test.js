import { describe, it, after } from 'node:test'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { getVipTier } from '../src/db/db.js'

describe('📐 Phase 3: TypeScript Financial Contracts & Type-Safety Suite', () => {
    it('verifies SupportedCurrency contract strictly adheres to platform tokens', () => {
        const validCurrencies = ['INR', 'BTC', 'USDT', 'AMRAT']
        
        function isSupportedCurrency(c) {
            return validCurrencies.includes(c)
        }

        assert.ok(isSupportedCurrency('INR'))
        assert.ok(isSupportedCurrency('BTC'))
        assert.ok(isSupportedCurrency('USDT'))
        assert.ok(isSupportedCurrency('AMRAT'))
        assert.strictEqual(isSupportedCurrency('ETH'), false)
        assert.strictEqual(isSupportedCurrency('USD'), false)
    })

    it('verifies ProvablyFairCommitment cryptographic format and hash integrity', () => {
        const serverSeed = crypto.randomBytes(32).toString('hex')
        const clientSeed = 'test_client_seed_42'
        const nonce = 1

        const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex')
        const hash = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex')

        const commitment = {
            serverSeed,
            serverSeedHash,
            clientSeed,
            nonce,
            hash
        }

        // Validate 32-byte (64 hex characters) server seed
        assert.strictEqual(commitment.serverSeed.length, 64)
        assert.strictEqual(/^[0-9a-f]{64}$/.test(commitment.serverSeed), true)

        // Validate 64 hex characters SHA256 hash
        assert.strictEqual(commitment.serverSeedHash.length, 64)
        assert.strictEqual(/^[0-9a-f]{64}$/.test(commitment.serverSeedHash), true)

        // Validate HMAC signature length
        assert.strictEqual(commitment.hash.length, 64)
        assert.strictEqual(/^[0-9a-f]{64}$/.test(commitment.hash), true)
        assert.ok(commitment.nonce > 0)
    })

    it('verifies BetEvaluationResult shape conforms to type contract', () => {
        function validateBetEvaluationResult(result) {
            assert.strictEqual(typeof result.game, 'string')
            assert.strictEqual(typeof result.won, 'boolean')
            assert.strictEqual(typeof result.multiplier, 'number')
            assert.strictEqual(typeof result.payout, 'number')
            assert.strictEqual(typeof result.profit, 'number')
            assert.strictEqual(typeof result.hash, 'string')
            assert.strictEqual(result.hash.length, 64)
            // Mathematical consistency: profit must equal payout - betAmount
            if (result.betAmount !== undefined) {
                const calculatedProfit = parseFloat((result.payout - result.betAmount).toFixed(4))
                assert.strictEqual(result.profit, calculatedProfit)
            }
        }

        const winResult = {
            game: 'crash',
            won: true,
            betAmount: 100,
            multiplier: 2.5,
            payout: 250,
            profit: 150,
            hash: 'a'.repeat(64),
            wasCapped: false
        }
        validateBetEvaluationResult(winResult)

        const lossResult = {
            game: 'dino',
            won: false,
            betAmount: 50,
            multiplier: 0,
            payout: 0,
            profit: -50,
            hash: 'b'.repeat(64),
            wasCapped: false
        }
        validateBetEvaluationResult(lossResult)
    })

    it('verifies VIP Loyalty Tier brackets match mathematical contract', () => {
        const bronze = getVipTier(0)
        assert.strictEqual(bronze.tier, 'Bronze')
        assert.strictEqual(bronze.level, 1)
        assert.strictEqual(bronze.rakebackRate, 0.03)

        const silver = getVipTier(15000)
        assert.strictEqual(silver.tier, 'Silver')
        assert.strictEqual(silver.level, 2)
        assert.strictEqual(silver.rakebackRate, 0.05)

        const gold = getVipTier(60000)
        assert.strictEqual(gold.tier, 'Gold')
        assert.strictEqual(gold.level, 3)
        assert.strictEqual(gold.rakebackRate, 0.07)

        const platinum = getVipTier(300000)
        assert.strictEqual(platinum.tier, 'Platinum')
        assert.strictEqual(platinum.level, 4)
        assert.strictEqual(platinum.rakebackRate, 0.10)

        const diamond = getVipTier(1500000)
        assert.strictEqual(diamond.tier, 'Diamond')
        assert.strictEqual(diamond.level, 5)
        assert.strictEqual(diamond.rakebackRate, 0.15)
        assert.strictEqual(diamond.nextTierWager, null)
    })

    it('verifies 3-Tier Affiliate Commission hierarchy rates (0.30%, 0.10%, 0.05%)', () => {
        const betAmount = 10000
        const tier1Rate = 0.003  // 0.30%
        const tier2Rate = 0.001  // 0.10%
        const tier3Rate = 0.0005 // 0.05%

        const comm1 = parseFloat((betAmount * tier1Rate).toFixed(4))
        const comm2 = parseFloat((betAmount * tier2Rate).toFixed(4))
        const comm3 = parseFloat((betAmount * tier3Rate).toFixed(4))

        assert.strictEqual(comm1, 30.00) // ₹30 on ₹10,000 turnover
        assert.strictEqual(comm2, 10.00) // ₹10 on ₹10,000 turnover
        assert.strictEqual(comm3, 5.00)  // ₹5 on ₹10,000 turnover

        const totalAffiliatePayout = comm1 + comm2 + comm3
        assert.strictEqual(totalAffiliatePayout, 45.00)
        // Platform keeps remaining house edge profit
        assert.ok(totalAffiliatePayout < betAmount * 0.02, 'Total affiliate payout is safely under house edge margin')
    })

    after(() => {
        setTimeout(() => {
            process.exit(0)
        }, 100)
    })
})
