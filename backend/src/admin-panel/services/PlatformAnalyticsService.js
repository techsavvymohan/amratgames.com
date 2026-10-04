import { db } from '../../db/db.js'

/**
 * PlatformAnalyticsService — Computes platform-wide metrics & GGR
 */
export class PlatformAnalyticsService {
    constructor(database = db) {
        this.db = database
    }

    getOverview() {
        return this.db.getPlatformStats()
    }
}
