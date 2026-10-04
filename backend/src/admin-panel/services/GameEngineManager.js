import { db } from '../../db/db.js'

/**
 * GameEngineManager — Manages platform odds, provably fair seed entropy, and maintenance
 */
export class GameEngineManager {
    constructor(database = db) {
        this.db = database
    }

    getSettings() {
        return this.db.data.settings
    }

    updateSettings(updates = {}) {
        return this.db.updateSettings(updates)
    }

    rotateSeed() {
        return this.db.rotateServerSeed()
    }
}
