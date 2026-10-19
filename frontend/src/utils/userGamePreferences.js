// 👑 AmratGames.com — User Game Preferences & Tracking Engine
// Persistent management for Favourites, Recently Played Games, and Quests

const FAVOURITES_KEY = 'amrat_favourites'
const RECENT_GAMES_KEY = 'amrat_recent_games'

const DEFAULT_FAVOURITES = ['crash', 'coin-toss', 'mines']

/**
 * Get the list of favorited game IDs
 * @returns {string[]}
 */
export function getFavourites() {
    try {
        const raw = localStorage.getItem(FAVOURITES_KEY)
        if (!raw) return DEFAULT_FAVOURITES
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : DEFAULT_FAVOURITES
    } catch {
        return DEFAULT_FAVOURITES
    }
}

/**
 * Check if a game is favorited
 * @param {string} gameId
 * @returns {boolean}
 */
export function isFavourite(gameId) {
    if (!gameId) return false
    const favs = getFavourites()
    return favs.includes(gameId)
}

/**
 * Toggle favourite status for a game
 * @param {string} gameId
 * @returns {boolean} New favourite status
 */
export function toggleFavourite(gameId) {
    if (!gameId) return false
    try {
        const current = getFavourites()
        let updated
        let isNowFav = false

        if (current.includes(gameId)) {
            updated = current.filter(id => id !== gameId)
            isNowFav = false
        } else {
            updated = [...current, gameId]
            isNowFav = true
        }

        localStorage.setItem(FAVOURITES_KEY, JSON.stringify(updated))
        window.dispatchEvent(new CustomEvent('amrat_favourites_changed', { detail: { favourites: updated, toggledId: gameId, isFavourite: isNowFav } }))
        return isNowFav
    } catch {
        return false
    }
}

/**
 * Get recently played games with timestamps
 * @returns {Array<{ gameId: string, timestamp: number }>}
 */
export function getRecentGames() {
    try {
        const raw = localStorage.getItem(RECENT_GAMES_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

/**
 * Record a game session / visit
 * @param {string} gameId
 */
export function recordGamePlay(gameId) {
    if (!gameId) return
    // Normalize path or ID e.g. '/crash' -> 'crash'
    const cleanId = gameId.replace(/^\//, '').trim()
    if (!cleanId) return

    try {
        const recents = getRecentGames()
        const filtered = recents.filter(item => item.gameId !== cleanId)
        const updated = [{ gameId: cleanId, timestamp: Date.now() }, ...filtered].slice(0, 10)
        localStorage.setItem(RECENT_GAMES_KEY, JSON.stringify(updated))
        window.dispatchEvent(new CustomEvent('amrat_recent_games_changed', { detail: { recentGames: updated } }))
    } catch {}
}
