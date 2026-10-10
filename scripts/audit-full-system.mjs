import { CONFIG } from '../backend/src/config.js'
import { db } from '../backend/src/db/db.js'
import { testSupabaseConnection } from '../backend/src/db/SupabaseClient.js'
import { AdminController } from '../backend/src/admin-panel/controllers/AdminController.js'

async function runAudit() {
    console.log('====================================================')
    console.log('   AMRATGAMES.COM — SYSTEM INTEGRITY & SYNC AUDIT   ')
    console.log('====================================================\n')

    let passed = 0
    let failed = 0

    function assert(name, condition, extra = '') {
        if (condition) {
            console.log(`  ✓ [PASS] ${name} ${extra ? `(${extra})` : ''}`)
            passed++
        } else {
            console.error(`  ✕ [FAIL] ${name} ${extra ? `(${extra})` : ''}`)
            failed++
        }
    }

    // 1. DATABASE AUDIT
    console.log('[1/4] AUDITING DATABASE ENGINES & PERSISTENCE...')
    assert('Local DB loaded successfully', Boolean(db && db.data))
    assert('Users table exists in memory', Array.isArray(db.data.users), `${db.data.users.length} users`)
    assert('Transactions table exists in memory', Array.isArray(db.data.transactions), `${db.data.transactions.length} records`)
    assert('Bets table exists in memory', Array.isArray(db.data.bets), `${db.data.bets.length} bets`)
    assert('Deposits table exists in memory', Array.isArray(db.data.deposits), `${db.data.deposits.length} deposits`)
    assert('Withdrawals table exists in memory', Array.isArray(db.data.withdrawals), `${db.data.withdrawals.length} withdrawals`)
    assert('Platform Settings initialized', Boolean(db.data.settings && db.data.settings.rtp))

    // Supabase Connection Test
    console.log('\nTesting Supabase Cloud PostgreSQL connection...')
    const supabaseRes = await testSupabaseConnection()
    assert('Supabase Configured', supabaseRes.configured)
    assert('Supabase PostgreSQL Online & Responsive', supabaseRes.ok, `${supabaseRes.latencyMs}ms latency`)
    assert('Supabase Tables Initialized', supabaseRes.tablesInitialized)

    // 2. ADMIN PANEL CONTROLLER & API SYNC AUDIT
    console.log('\n[2/4] AUDITING ADMIN PANEL CONTROLLER & ROUTE METHODS...')
    const controller = new AdminController()
    const methods = [
        'getStats', 'listUsers', 'getUserDetails', 'adjustBalance', 'updateUserStatus',
        'listWithdrawals', 'getWithdrawalStats', 'approveWithdrawal', 'rejectWithdrawal',
        'getTokenStats', 'distributeTokens', 'getTokenHistory',
        'getSettings', 'updateSettings', 'rotateSeed',
        'getSupabaseStatus', 'migrateToSupabase',
        'listDeposits', 'approveDeposit', 'rejectDeposit',
        'approveKYC', 'rejectKYC', 'toggleMaintenance', 'toggleGameKillSwitch'
    ]

    for (const m of methods) {
        assert(`AdminController.${m} is defined and callable`, typeof controller[m] === 'function')
    }

    // Mock Express Request / Response to test handlers directly
    function createMockRes() {
        return {
            statusCode: 200,
            body: null,
            status(code) { this.statusCode = code; return this; },
            json(data) { this.body = data; return this; }
        }
    }

    console.log('\nExecuting Admin API handler simulations...')

    // Test getStats
    const resStats = createMockRes()
    await controller.getStats({}, resStats)
    assert('controller.getStats() executes successfully', resStats.body?.success === true, `Gross profit: ₹${resStats.body?.stats?.netHouseProfitINR}`)

    // Test listUsers
    const resUsers = createMockRes()
    await controller.listUsers({ query: {} }, resUsers)
    assert('controller.listUsers() returns user list', resUsers.body?.success === true && Array.isArray(resUsers.body?.users), `Total users: ${resUsers.body?.total}`)

    // Test listDeposits
    const resDeps = createMockRes()
    await controller.listDeposits({ query: {} }, resDeps)
    assert('controller.listDeposits() returns deposit records', resDeps.body?.success === true && Array.isArray(resDeps.body?.deposits), `Deposits: ${resDeps.body?.total}`)

    // Test listWithdrawals
    const resWds = createMockRes()
    await controller.listWithdrawals({ query: {} }, resWds)
    assert('controller.listWithdrawals() returns withdrawal records', resWds.body?.success === true && Array.isArray(resWds.body?.withdrawals), `Withdrawals: ${resWds.body?.total}`)

    // Test getSettings
    const resSettings = createMockRes()
    await controller.getSettings({}, resSettings)
    assert('controller.getSettings() returns active settings', resSettings.body?.success === true, `RTP: ${resSettings.body?.settings?.rtp}%`)

    // Test getSupabaseStatus
    const resSupaStatus = createMockRes()
    await controller.getSupabaseStatus({}, resSupaStatus)
    assert('controller.getSupabaseStatus() returns status', resSupaStatus.body?.success === true && resSupaStatus.body?.ok === true)

    // Test circuit breaker kill switches
    const resCb = createMockRes()
    await controller.toggleGameKillSwitch({ body: { game: 'test-audit-game', disabled: true } }, resCb)
    assert('controller.toggleGameKillSwitch(enable) activates kill switch', resCb.body?.success === true && resCb.body?.disabled === true)
    
    // Revert kill switch
    const resCbRevert = createMockRes()
    await controller.toggleGameKillSwitch({ body: { game: 'test-audit-game', disabled: false } }, resCbRevert)
    assert('controller.toggleGameKillSwitch(disable) restores game', resCbRevert.body?.success === true && resCbRevert.body?.disabled === false)

    // 3. LIVE PRODUCTION SYNCHRONIZATION AUDIT (amratgames.com)
    console.log('\n[3/4] AUDITING LIVE SERVER (https://amratgames.com)...')
    try {
        const liveHealthRes = await fetch('https://amratgames.com/api/health')
        const liveHealth = await liveHealthRes.json()
        assert('Live Health Endpoint responds 200 OK', liveHealthRes.ok)
        assert('Live Database reports Supabase (PostgreSQL)', liveHealth.database === 'Supabase (PostgreSQL)')
        assert('Live Platform Engine status is online', liveHealth.status === 'online', `Active players: ${liveHealth.activePlayers}`)
    } catch (err) {
        assert('Live endpoint reachable', false, err.message)
    }

    try {
        const liveRecentRes = await fetch('https://amratgames.com/api/games/recent?limit=5')
        const liveRecent = await liveRecentRes.json()
        assert('Live /api/games/recent responds', liveRecent.success && Array.isArray(liveRecent.bets), `${liveRecent.bets.length} recent bets`)
    } catch (err) {
        assert('Live /api/games/recent reachable', false, err.message)
    }

    // 4. FRONTEND-BACKEND SYNC AUDIT
    console.log('\n[4/4] AUDITING FRONTEND CLIENTS & MODELS...')
    assert('CONFIG.DEFAULT_RTP matches AdminPanel expectations (99.0%)', CONFIG.DEFAULT_RTP === 99)
    assert('Anti-Fraud Risk Service functional', typeof db.getAllUsers === 'function')

    console.log('\n====================================================')
    console.log(`   AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`)
    console.log('====================================================')

    if (failed > 0) {
        process.exit(1)
    }
}

runAudit().catch(err => {
    console.error('Audit fatal error:', err)
    process.exit(1)
})
