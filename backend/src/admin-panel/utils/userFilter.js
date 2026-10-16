/**
 * 🛡️ AmratGames — User Sanitization & Classification Helper
 * Identifies and isolates automated testing runners, simulated bot personas,
 * and demo/qa accounts from the Production Admin Panel and Platform Analytics.
 */

export function isFakeOrDemoUser(u) {
    if (!u) return false

    // Explicit flags
    if (u.isBot === true || u.isMarketMaker === true || u.isDemo === true) return true

    // Identifier heuristics
    const id = String(u.id || '').toLowerCase()
    if (
        id.startsWith('usr_bot_') ||
        id.startsWith('usr_demo_') ||
        id.startsWith('sim_') ||
        id.startsWith('usr_sim_') ||
        id.startsWith('usr_play_')
    ) {
        return true
    }

    // Username heuristics
    const username = String(u.username || '').toLowerCase()
    if (
        username.includes('bot') ||
        username.includes('tester') ||
        username.includes('test_') ||
        username.startsWith('test') ||
        username.startsWith('hero_') ||
        username.startsWith('sim_') ||
        username.startsWith('demo_') ||
        username.endsWith('_demo') ||
        username === 'guest_demo' ||
        username.includes('concurrency') ||
        username.includes('sybil') ||
        username.includes('pipe_user') ||
        username.includes('audit_') ||
        username === 'player_0101' ||
        username.startsWith('sharma_vip_')
    ) {
        return true
    }

    // Email heuristics
    const email = String(u.email || '').toLowerCase()
    if (
        email.endsWith('@amratgames.internal') ||
        email.endsWith('@test.com') ||
        email.endsWith('@audit-test.com') ||
        email.includes('bot@') ||
        email.includes('_tester') ||
        email.includes('test.amratgames.com') ||
        email.includes('trashmail.com') ||
        email.includes('example.com')
    ) {
        return true
    }

    return false
}
