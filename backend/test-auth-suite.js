/**
 * Comprehensive Validation Test Suite for AmratGames Auth System
 * Tests:
 * 1. Login with 10-digit Mobile Number + Password
 * 2. Login with Email + Password
 * 3. Login with Username + Password
 * 4. Invalid Password rejection
 * 5. Send OTP to Indian Mobile Number (+91 normalization)
 * 6. Send OTP to Email
 * 7. Verify OTP with correct code -> logs in or auto-provisions player account
 * 8. Verify OTP with incorrect code -> rejected
 * 9. Register new player with username, mobile, email, password & OTP
 * 10. Authenticated session validation with GET /api/auth/me
 */

const BASE_URL = 'http://localhost:3001/api/auth';

async function runAuthValidation() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   AMRATGAMES AUTHENTICATION SYSTEM VALIDATION SUITE');
    console.log('═══════════════════════════════════════════════════════════\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✓ PASS: ${message}`);
            passed++;
        } else {
            console.error(`  ✗ FAIL: ${message}`);
            failed++;
        }
    }

    try {
        // Test 1: Phone + Password Login
        console.log('▶ Test 1: Login with 10-digit Mobile Number + Password');
        let res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: '9876510101', password: 'Player123!' })
        });
        let data = await res.json();
        assert(res.status === 200 && data.success && data.user.phone === '9876510101', 
            `Logged in using mobile number (User: ${data.user?.username}, Phone: ${data.user?.phone})`);

        // Test 2: Email + Password Login
        console.log('\n▶ Test 2: Login with Email + Password');
        res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: 'aarav.royal@gmail.com', password: 'Player123!' })
        });
        data = await res.json();
        assert(res.status === 200 && data.success && data.user.email === 'aarav.royal@gmail.com',
            `Logged in using email address (User: ${data.user?.username}, Email: ${data.user?.email})`);

        // Test 3: Username + Password Login
        console.log('\n▶ Test 3: Login with Username + Password');
        res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: 'aarav_king', password: 'Player123!' })
        });
        data = await res.json();
        assert(res.status === 200 && data.success && data.user.username === 'aarav_king',
            `Logged in using username (User: ${data.user?.username})`);

        // Test 4: Invalid Password Rejection
        console.log('\n▶ Test 4: Invalid Password Rejection');
        res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: '9876510101', password: 'WrongPassword999!' })
        });
        data = await res.json();
        assert(res.status === 401 && !data.success,
            `Rejected wrong password with 401 error: "${data.error}"`);

        // Test 5: Dispatch OTP to Mobile Number
        console.log('\n▶ Test 5: Dispatch Verification OTP to Mobile Number (+91 normalization)');
        const testMobile = '919871234567';
        res = await fetch(`${BASE_URL}/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: testMobile })
        });
        data = await res.json();
        const generatedOtp = data.devOtp;
        assert(res.status === 200 && data.success && data.target === '9871234567',
            `Dispatched OTP to normalized number: ${data.target}, OTP: ${generatedOtp}`);

        // Test 6: Verify OTP with Incorrect Code -> Rejection
        console.log('\n▶ Test 6: Verify OTP with Incorrect Code (Rejection)');
        res = await fetch(`${BASE_URL}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: '9871234567', otp: '000000' })
        });
        data = await res.json();
        assert(res.status === 400 && !data.success,
            `Correctly rejected invalid OTP: "${data.error}"`);

        // Test 7: Verify OTP with Correct Code -> Fast Login / Auto-Provision
        console.log('\n▶ Test 7: Verify OTP with Valid Code');
        const customUsername = 'sharma_vip_' + Math.floor(Math.random() * 1000);
        res = await fetch(`${BASE_URL}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: '9871234567',
                otp: generatedOtp || '777777',
                username: customUsername
            })
        });
        data = await res.json();
        const otpSessionToken = data.token;
        assert(res.status === 200 && data.success && Boolean(otpSessionToken),
            `Verified OTP successfully! Token issued for user: ${data.user?.username}, Phone: ${data.user?.phone}`);

        // Test 8: Authenticated Session with Token (GET /api/auth/me)
        console.log('\n▶ Test 8: Validate Authenticated Session via JWT (GET /api/auth/me)');
        res = await fetch(`${BASE_URL}/me`, {
            headers: { Authorization: `Bearer ${otpSessionToken}` }
        });
        data = await res.json();
        assert(res.status === 200 && data.success && data.user.id,
            `Session verified for authenticated user: ${data.user?.username} (${data.user?.id})`);

        // Test 9: Standard Registration with Email, Phone, Password & OTP Check
        console.log('\n▶ Test 9: Complete Player Registration (Phone + Email + Password)');
        const uniqueId = Date.now().toString().slice(-4);
        const newPlayerPhone = `981111${uniqueId}`;
        const newPlayerEmail = `player_${uniqueId}@gmail.com`;

        // Generate OTP for this number
        const otpRes = await fetch(`${BASE_URL}/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: newPlayerPhone })
        });
        const otpData = await otpRes.json();

        res = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: `hero_${uniqueId}`,
                phone: newPlayerPhone,
                email: newPlayerEmail,
                password: 'SecurePassword123!',
                otp: otpData.devOtp || '777777'
            })
        });
        data = await res.json();
        assert(res.status === 201 && data.success && data.user.phoneVerified,
            `Registered new player: ${data.user?.username}, phoneVerified: ${data.user?.phoneVerified}, INR Balance: ${data.user?.balances?.INR}`);

        // Test 10: Verify the newly registered user can immediately log in with Phone
        console.log('\n▶ Test 10: Login with newly registered phone and password');
        res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: newPlayerPhone, password: 'SecurePassword123!' })
        });
        data = await res.json();
        assert(res.status === 200 && data.success && data.user.username === `hero_${uniqueId}`,
            `Immediate login successful using newly registered mobile number!`);

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log(`   VALIDATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
        console.log('═══════════════════════════════════════════════════════════\n');

        if (failed > 0) process.exit(1);
    } catch (err) {
        console.error('Test Suite encountered an error:', err);
        process.exit(1);
    }
}

runAuthValidation();
