import crypto from 'node:crypto'
import { BaseRepository } from './BaseRepository.js'
import { CONFIG } from '../config.js'
import { bankrollRisk } from '../services/BankrollRiskService.js'
import { isFakeOrDemoUser } from '../admin-panel/utils/userFilter.js'

/**
 * 🎲 BetRepository
 * Manages atomic bet settlement under exclusive user mutex locks, historical bet rolls, and platform statistics.
 */
export class BetRepository extends BaseRepository {
    async executeAtomicBet({ userId, currency = 'INR', betAmount, game, gameName, evaluator }) {
        return this.withLock(userId, async () => {
            const user = this.db.findUserById(userId)
            if (!user) throw new Error('User account not found')
            if (!user.balances) user.balances = { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 }

            const currentBal = user.balances[currency] || 0
            if (betAmount > currentBal + 0.0001) {
                const err = new Error(`Insufficient ${currency} balance to place bet`)
                err.code = 'INSUFFICIENT_BALANCE'
                err.status = 400
                throw err
            }

            // 1. Deduct bet amount immediately under exclusive lock
            const curr = String(currency || 'INR').toUpperCase()
            const precision = curr === 'BTC' ? 8 : (curr === 'USDT' ? 4 : 2)
            const balanceAfterDeduct = Math.max(0, parseFloat((currentBal - betAmount).toFixed(precision)))
            user.balances[currency] = balanceAfterDeduct
            if (curr === 'INR') {
                user.totalWagered = parseFloat(((user.totalWagered || 0) + betAmount).toFixed(2))
            } else if (curr === 'USDT') {
                user.totalWagered = parseFloat(((user.totalWagered || 0) + (betAmount * 90.0)).toFixed(2))
            } else if (curr === 'BTC') {
                user.totalWagered = parseFloat(((user.totalWagered || 0) + (betAmount * 8500000.0)).toFixed(2))
            }
            this.db.accumulateWagerRewards(user, betAmount, currency)

            // 2. Evaluate Provably Fair outcome
            const evaluation = await evaluator()
            const won = Boolean(evaluation.won)
            let multiplier = evaluation.multiplier || 0
            let payout = evaluation.payout || 0

            // Apply Dynamic Bankroll Max Win Cap (Pillar 2)
            if (payout > 0) {
                const capped = bankrollRisk.enforceWinCap({
                    betAmount,
                    multiplier,
                    rawPayout: payout,
                    currency
                })
                payout = capped.payout
                multiplier = capped.multiplier
                evaluation.wasCapped = capped.wasCapped
                evaluation.maxProfitCap = capped.maxProfitCap
            }
            const profit = parseFloat((payout - betAmount).toFixed(precision))

            // 3. Credit payout whenever there is a return (including partial returns)
            if (payout > 0) {
                user.balances[currency] = parseFloat((user.balances[currency] + payout).toFixed(precision))
            }
            const finalBal = user.balances[currency]

            // 4. Record transaction in atomic ledger
            const tx = {
                id: 'tx_bet_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
                userId: user.id,
                username: user.username,
                type: payout >= betAmount ? 'win' : 'bet',
                currency,
                amount: profit,
                balanceAfter: finalBal,
                note: `Bet on ${gameName} (${won ? `Won ${multiplier}x` : payout > 0 ? `Returned ${multiplier}x` : 'Lost'})`,
                timestamp: new Date().toISOString()
            }
            this.data.transactions.unshift(tx)
            if (this.data.transactions.length > 5000) {
                this.data.transactions = this.data.transactions.slice(0, 5000)
            }

            // 5. Record bet in historical roll
            const betRecord = {
                id: 'bet_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
                userId: user.id,
                username: user.username,
                game,
                gameName,
                currency,
                betAmount,
                multiplier,
                payout,
                profit,
                won,
                hash: evaluation.hash || crypto.randomBytes(16).toString('hex'),
                serverSeedHash: evaluation.serverSeedHash || null,
                clientSeed: evaluation.clientSeed || null,
                nonce: evaluation.nonce || null,
                timestamp: new Date().toISOString()
            }
            this.data.bets.unshift(betRecord)
            if (this.data.bets.length > 500) {
                this.data.bets = this.data.bets.slice(0, 500)
            }

            this.db.updateTreasurySupply()
            this.persist()

            this.enqueueOutbox('syncUser', user)
            this.enqueueOutbox('syncTransaction', tx)
            this.enqueueOutbox('syncBet', betRecord)

            return {
                user,
                bet: betRecord,
                evaluation,
                won,
                multiplier,
                payout,
                balanceAfterDeduct,
                balancesAfterDeduct: { ...user.balances, [currency]: balanceAfterDeduct },
                finalBal,
                balances: user.balances
            }
        })
    }

    recordBet(betData) {
        const bet = {
            id: 'bet_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            timestamp: new Date().toISOString(),
            ...betData
        }
        this.data.bets.unshift(bet)
        if (this.data.bets.length > 500) {
            this.data.bets = this.data.bets.slice(0, 500)
        }
        this.persist()

        this.enqueueOutbox('syncBet', bet)

        return bet
    }

    getRecentBets(limit = 25) {
        const real = this.data.bets || []
        const simulated = this.data.simulatedBets || []
        return [...real, ...simulated]
            .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
            .slice(0, limit)
    }

    getUserBets(userId, limit = 50) {
        return this.data.bets.filter(b => b.userId === userId).slice(0, limit)
    }

    getUserTransactions(userId, limit = 50) {
        if (!this.data.transactions) this.data.transactions = []
        return this.data.transactions.filter(t => t.userId === userId).slice(0, limit)
    }

    getPlatformStats() {
        const realUsers = (this.data.users || []).filter(u => !isFakeOrDemoUser(u))
        const totalUsers = realUsers.length
        const activeUsers = realUsers.filter(u => !u.isBanned).length
        const totalBetsCount = this.data.bets.length

        let totalWageredINR = 0
        let totalPayoutINR = 0

        for (const b of this.data.bets) {
            let multiplier = 1
            if (b.currency === 'USDT') multiplier = 90.0
            if (b.currency === 'BTC') multiplier = 8500000.0
            if (b.currency === 'AMRAT') multiplier = 0 // Virtual token excluded from fiat/crypto accounting

            totalWageredINR += (b.betAmount || 0) * multiplier
            totalPayoutINR += (b.payout || 0) * multiplier
        }

        const netHouseProfitINR = totalWageredINR - totalPayoutINR
        const ggr = totalWageredINR > 0 ? ((netHouseProfitINR / totalWageredINR) * 100).toFixed(2) : '1.00'

        const allCompletedDeposits = (this.data.deposits || []).filter(d => d.status === 'completed')
        const automatedDeposits = allCompletedDeposits.filter(d =>
            (d.paymentMethod && d.paymentMethod.includes('YOUPI')) ||
            (d.approvedBy && d.approvedBy.includes('WEBHOOK'))
        )
        const automatedDepositsAmount = automatedDeposits.reduce((sum, d) => sum + (d.amount || 0), 0)
        const manualDepositsAmount = allCompletedDeposits
            .filter(d => !(d.paymentMethod && d.paymentMethod.includes('YOUPI')) && !(d.approvedBy && d.approvedBy.includes('WEBHOOK')))
            .reduce((sum, d) => sum + (d.amount || 0), 0)

        return {
            totalUsers,
            activeUsers,
            totalBetsCount,
            totalWageredApproxINR: Math.round(totalWageredINR),
            totalPayoutApproxINR: Math.round(totalPayoutINR),
            netHouseProfitINR: Math.round(netHouseProfitINR),
            ggrPercentage: ggr,
            settings: this.data.settings,
            treasury: this.data.settings.tokenTreasury,
            recentAirdropsCount: (this.data.airdrops || []).length,
            withdrawalStats: this.db.getWithdrawalStats(),
            gatewayStats: {
                automatedDepositsAmount: Math.round(automatedDepositsAmount),
                automatedDepositsCount: automatedDeposits.length,
                manualDepositsAmount: Math.round(manualDepositsAmount)
            }
        }
    }

    rotateServerSeed() {
        const oldSeed = this.data.settings.currentServerSeed
        const newSeed = crypto.randomBytes(32).toString('hex')
        const newHash = crypto.createHash('sha256').update(newSeed).digest('hex')

        this.data.settings.currentServerSeed = newSeed
        this.data.settings.serverSeedHash = newHash
        this.persist()

        this.enqueueOutbox('syncSettings', this.data.settings)

        return {
            revealedPreviousSeed: oldSeed,
            newServerSeedHash: newHash
        }
    }

    updateSettings(newSettings) {
        this.data.settings = { ...this.data.settings, ...newSettings }
        this.persist()

        this.enqueueOutbox('syncSettings', this.data.settings)

        return this.data.settings
    }
}

export default BetRepository
