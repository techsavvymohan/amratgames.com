import https from 'node:https'

const BASE_URL = 'https://amratgames.com'
const agent = new https.Agent({ rejectUnauthorized: false })

async function api(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        agent,
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    })
    const text = await res.text()
    try {
        return { status: res.status, data: JSON.parse(text) }
    } catch {
        return { status: res.status, raw: text }
    }
}

async function runAudit() {
    console.log('====================================================')
    console.log('🔍 AMRAT GAMES PLATFORM DEEP AUDIT BATTERY')
    console.log(`🌐 Target: ${BASE_URL}`)
    console.log('====================================================\n')

    const testUser = `audit_${Date.now().toString(36)}`
    const testEmail = `${testUser}@audit-test.com`
    const testPass = 'AuditSecure123!'
    let userToken = null
    let adminToken = null

    // 1. Health & Status Check
    console.log('--- 1. Health Endpoints ---')
    const health = await api('/api/health')
    console.log('Health:', health.status, health.data)
    const supHealth = await api('/api/health/supabase')
    console.log('Supabase Health:', supHealth.status, supHealth.data?.ok ? 'CONNECTED' : supHealth.data)

    // 2. Registration & ₹100 Welcome Bonus
    console.log('\n--- 2. User Registration & ₹100 Welcome Bonus ---')
    const regRes = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            username: testUser,
            email: testEmail,
            password: testPass
        })
    })
    console.log('Register status:', regRes.status, regRes.data?.message)
    if (regRes.data?.token) {
        userToken = regRes.data.token
        console.log('User created:', regRes.data.user?.username, 'INR Balance:', regRes.data.user?.balances?.INR)
        if (regRes.data.user?.balances?.INR === 100) {
            console.log('✅ Welcome Bonus: Exactly ₹100 credited')
        } else {
            console.log('❌ Welcome Bonus Mismatch:', regRes.data.user?.balances)
        }
    } else {
        console.log('❌ Register failed:', regRes.data)
    }

    // 3. Wallet Balance & Withdrawal Rules (₹300 min deposit enforcement)
    console.log('\n--- 3. Wallet Rules & ₹300 Min Deposit Enforcement ---')
    const balRes = await api('/api/wallet/balance', {
        headers: { Authorization: `Bearer ${userToken}` }
    })
    console.log('Initial Wallet state:', balRes.data)

    // Attempt withdrawal with 0 deposit
    const w1 = await api('/api/wallet/withdraw', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ currency: 'INR', amount: 50, payoutDestination: 'test@upi' })
    })
    console.log('Withdraw without deposit (Expect 400 rejection):', w1.status, w1.data?.error)
    if (w1.status === 400 && w1.data?.code === 'MINIMUM_DEPOSIT_REQUIRED') {
        console.log('✅ PASS: Withdrawal blocked because totalDeposited < 300')
    } else {
        console.log('❌ FAIL: Withdrawal rule bypass or unexpected response!')
    }

    // Deposit ₹100 (still less than 300)
    console.log('\nDepositing ₹100...')
    const dep1 = await api('/api/wallet/deposit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ currency: 'INR', amount: 100, paymentMethod: 'UPI' })
    })
    console.log('Deposit ₹100 result:', dep1.status, 'totalDeposited:', dep1.data?.totalDeposited, 'canWithdraw:', dep1.data?.canWithdraw)

    // Attempt withdrawal with ₹100 deposit (still should reject)
    const w2 = await api('/api/wallet/withdraw', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ currency: 'INR', amount: 50, payoutDestination: 'test@upi' })
    })
    console.log('Withdraw with ₹100 deposit (Expect 400 rejection):', w2.status, w2.data?.error)
    if (w2.status === 400 && w2.data?.code === 'MINIMUM_DEPOSIT_REQUIRED') {
        console.log('✅ PASS: Withdrawal still blocked (₹100 < ₹300)')
    } else {
        console.log('❌ FAIL: Withdrawal should have been blocked!')
    }

    // Deposit ₹200 more (total ₹300)
    console.log('\nDepositing ₹200 more (Total ₹300)...')
    const dep2 = await api('/api/wallet/deposit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ currency: 'INR', amount: 200, paymentMethod: 'UPI' })
    })
    console.log('Deposit ₹200 result:', dep2.status, 'totalDeposited:', dep2.data?.totalDeposited, 'canWithdraw:', dep2.data?.canWithdraw)

    // Now attempt withdrawal (should succeed)
    const w3 = await api('/api/wallet/withdraw', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ currency: 'INR', amount: 50, payoutDestination: 'test@upi' })
    })
    console.log('Withdraw with ₹300 deposit (Expect 200 success):', w3.status, w3.data?.message, 'New Bal:', w3.data?.balances?.INR)
    if (w3.status === 200 && w3.data?.success) {
        console.log('✅ PASS: Withdrawal unlocked upon reaching ₹300 deposit requirement')
    } else {
        console.log('❌ FAIL: Withdrawal failed even with ₹300 deposit!')
    }

    // Attempt withdrawal exceeding balance
    const w4 = await api('/api/wallet/withdraw', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ currency: 'INR', amount: 999999, payoutDestination: 'test@upi' })
    })
    console.log('Withdraw exceeding balance (Expect 400 rejection):', w4.status, w4.data?.error)

    // 4. Game Bet Endpoint Auditing
    console.log('\n--- 4. Game Bet Endpoint Checks ---')
    // Normal bet
    const b1 = await api('/api/games/bet', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({
            game: 'crash',
            gameName: 'Crash 1000x',
            currency: 'INR',
            betAmount: 10,
            multiplier: 1.5,
            won: true
        })
    })
    console.log('Normal bet placement:', b1.status, 'New Bal:', b1.data?.balances?.INR)

    // Negative bet
    const bNeg = await api('/api/games/bet', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({
            game: 'crash',
            betAmount: -50,
            won: false
        })
    })
    console.log('Negative bet (Expect 400 rejection):', bNeg.status, bNeg.data?.error)

    // Bet exceeding balance
    const bOver = await api('/api/games/bet', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({
            game: 'crash',
            betAmount: 999999,
            won: false
        })
    })
    console.log('Bet exceeding balance (Expect 400 rejection):', bOver.status, bOver.data?.error)

    // Client-side arbitrary win injection test
    const bExploit = await api('/api/games/bet', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({
            game: 'crash',
            betAmount: 10,
            multiplier: 9999,
            won: true
        })
    })
    console.log('Arbitrary win injection (Did server blindly honor 9999x?):', bExploit.status, 'Payout:', bExploit.data?.bet?.payout, 'Balances:', bExploit.data?.balances)

    // 5. Recent Bets / Demo Data Check
    console.log('\n--- 5. Recent Bets & Demo Data Check ---')
    const recentBets = await api('/api/games/recent?limit=10')
    console.log('Recent bets count:', recentBets.data?.bets?.length)
    const simulatedFound = recentBets.data?.bets?.filter(b => b.userId?.startsWith('sim_') || ['rohit_777', 'priya_crypto', 'vikram_dice', 'neha_lucky', 'kabir_whale'].includes(b.username))
    if (simulatedFound?.length > 0) {
        console.log(`⚠️ DEMO DATA DETECTED: Found ${simulatedFound.length} simulated bets in recent bets feed:`, simulatedFound.map(b => b.username))
    } else {
        console.log('✅ Clean: No simulated players in recent bets')
    }

    // 6. Security & Admin Guard
    console.log('\n--- 6. Security & Authorization Checks ---')
    // Standard user accessing /api/admin/users
    const unauthAdmin = await api('/api/admin/users', {
        headers: { Authorization: `Bearer ${userToken}` }
    })
    console.log('Player accessing admin route (Expect 403 Forbidden):', unauthAdmin.status, unauthAdmin.data?.error)
    if (unauthAdmin.status === 403) {
        console.log('✅ PASS: Admin route properly protected with 403 Forbidden')
    } else {
        console.log('❌ SECURITY VULNERABILITY: Non-admin accessed admin API!')
    }

    // Unauthenticated accessing /api/wallet/balance
    const noAuthWallet = await api('/api/wallet/balance')
    console.log('Unauthenticated wallet check (Expect 401 Unauthorized):', noAuthWallet.status, noAuthWallet.data?.error)

    console.log('\n====================================================')
    console.log('🏁 AUDIT COMPLETE')
    console.log('====================================================')
}

runAudit().catch(console.error)
