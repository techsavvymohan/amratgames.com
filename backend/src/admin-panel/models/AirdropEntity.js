/**
 * AirdropEntity — Domain model for token distributions & audit history
 */
export class AirdropEntity {
    constructor(data = {}) {
        this.id = data.id || ('airdrop_' + Date.now().toString(36))
        this.campaign = data.campaign || 'Platform Token Grant'
        this.adminId = data.adminId || ''
        this.adminUsername = data.adminUsername || 'admin'
        this.token = data.token || 'AMRAT'
        this.amountPerUser = parseFloat(data.amountPerUser) || 0
        this.recipientCount = parseInt(data.recipientCount, 10) || 0
        this.totalAmount = parseFloat(data.totalAmount) || (this.amountPerUser * this.recipientCount)
        this.targetGroup = data.targetGroup || 'all_players'
        this.note = data.note || ''
        this.timestamp = data.timestamp || new Date().toISOString()
    }

    calculateTotal() {
        return parseFloat((this.amountPerUser * this.recipientCount).toFixed(4))
    }

    toJSON() {
        return {
            id: this.id,
            campaign: this.campaign,
            adminId: this.adminId,
            adminUsername: this.adminUsername,
            token: this.token,
            amountPerUser: this.amountPerUser,
            recipientCount: this.recipientCount,
            totalAmount: this.totalAmount,
            targetGroup: this.targetGroup,
            note: this.note,
            timestamp: this.timestamp
        }
    }
}
