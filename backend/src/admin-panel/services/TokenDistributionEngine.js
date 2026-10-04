import { db } from '../../db/db.js'
import { AirdropEntity } from '../models/AirdropEntity.js'

/**
 * TokenDistributionEngine — OOP Service managing platform tokenomics & airdrops
 */
export class TokenDistributionEngine {
    constructor(database = db) {
        this.db = database
    }

    /**
     * Get platform treasury vault statistics
     */
    getTreasuryStats() {
        this.db.updateTreasurySupply()
        return {
            treasury: this.db.data.settings.tokenTreasury,
            recentAirdrops: (this.db.data.airdrops || []).slice(0, 15)
        }
    }

    /**
     * Execute a token distribution / airdrop
     */
    distribute({ adminId, adminUsername, token = 'AMRAT', amount, targetGroup = 'all_players', targetUserId = null, campaign, note }) {
        const parsedAmount = parseFloat(amount)
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            throw new Error('A positive distribution amount is required')
        }

        const result = this.db.distributeTokens({
            adminId,
            adminUsername,
            token,
            amount: parsedAmount,
            targetGroup,
            targetUserId,
            campaign: campaign || 'Royal Platform Airdrop',
            note: note || 'Admin Token Distribution'
        })

        const airdrop = new AirdropEntity(result.airdrop)

        return {
            airdrop: airdrop.toJSON(),
            recipientsCount: result.recipientsCount,
            totalDistributed: result.totalDistributed
        }
    }

    /**
     * Get full distribution history ledger
     */
    getHistory() {
        const raw = this.db.data.airdrops || []
        return raw.map(a => new AirdropEntity(a).toJSON())
    }
}
