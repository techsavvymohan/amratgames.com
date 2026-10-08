// =============================================================================
// 👑 AmratGames.com — Platform Circuit Breaker & Emergency Kill Switch
// Protects player balances and treasury liabilities during anomalies or maintenance
// =============================================================================

import { db } from '../db/db.js'

export function checkPlatformMaintenance(req, res, next) {
    const isMaintenance = Boolean(db.data.settings?.maintenanceMode)
    if (isMaintenance && req.user?.role !== 'admin') {
        return res.status(503).json({
            success: false,
            error: 'AmratGames is currently undergoing scheduled platform maintenance. Real-money betting and transactions are temporarily paused for player security.',
            code: 'PLATFORM_MAINTENANCE'
        })
    }
    next()
}

export function checkGameMaintenance(req, res, next) {
    const game = req.body?.game || req.params?.game || (req.path ? req.path.split('/')[1] : null)
    const disabledGames = db.data.settings?.disabledGames || []

    if (game && disabledGames.includes(game) && req.user?.role !== 'admin') {
        return res.status(503).json({
            success: false,
            error: `The ${game} game is temporarily undergoing maintenance. Please enjoy our other Provably Fair games.`,
            code: 'GAME_MAINTENANCE'
        })
    }
    next()
}
