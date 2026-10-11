# 📱 Modular OTP Auth Engine (Standalone & Portable)

A blazing-fast, zero-bloat, production-ready **OTP Authentication & Verification Engine** built for Indian SaaS and Gaming platforms.

Zero external auth dependencies (no Firebase, no Auth0). You own 100% of your user database, sessions, and security.

---

## 🚀 Features

- ⚡ **2Factor.in Integration**: Fastest Indian telecom SMPP delivery (2-4 seconds).
- 🔄 **Pluggable SMS Providers**: `2factor`, `fast2sms`, or `mock` (for local development & testing).
- 🛡️ **Anti-Brute Force Protection**: Automatically burns OTP after 5 wrong attempts.
- ⏱️ **Resend Throttling**: Built-in 60s cooldown prevents rapid SMS spam.
- 💾 **Dual Storage**: Zero-dependency In-Memory Store (with TTL cleaner) or clustered Redis Store.
- 🧪 **Master QA Code**: Configurable demo bypass (`777777`) for testing and CI/CD.
- 📦 **100% Portable**: Just copy this folder into **any** other SaaS project!

---

## 📂 Folder Structure

```text
otp-auth-engine/
├── index.js                  # Main export facade
├── OtpAuthEngine.js          # Core logic (generate, send, verify, cooldown)
├── storage/
│   ├── MemoryOtpStore.js     # Default in-memory store with auto TTL cleanup
│   └── RedisOtpStore.js      # Redis store for multi-server clusters
├── providers/
│   ├── BaseSmsProvider.js    # Provider interface
│   ├── TwoFactorSmsProvider.js # 2Factor.in high-speed Indian SMS
│   ├── Fast2SmsProvider.js   # Fast2SMS alternative
│   ├── MockSmsProvider.js    # Console mock for local dev & testing
│   └── index.js              # Provider factory
├── routes/
│   └── expressRouter.js      # Mountable Express router
├── utils/
│   ├── phoneValidator.js     # Indian mobile validator & normalizer (+91)
│   └── cryptoOtp.js          # Cryptographic secure random OTP generator
└── README.md
```

---

## 🛠️ How to use in ANY other SaaS in 3 Steps

### Step 1: Copy this folder
Simply copy the `otp-auth-engine/` folder into your new project's `src/` or `modules/` directory.

### Step 2: Set your Environment Variables (.env)
```env
# Choose provider: '2factor' | 'fast2sms' | 'mock'
SMS_GATEWAY_PROVIDER=2factor

# Your 2Factor API Key (get free trial credits at https://2factor.in)
TWOFACTOR_API_KEY=your_api_key_here
```

### Step 3: Mount into Express (or use directly in your code)

#### Method A: Mount as an Express Route
```javascript
import express from 'express'
import { createOtpAuthEngine, createOtpRouter } from './modules/otp-auth-engine/index.js'

const app = express()
app.use(express.json())

const otpEngine = createOtpAuthEngine({
    provider: '2factor', // or 'mock' in dev
    apiKey: process.env.TWOFACTOR_API_KEY,
    resendCooldownSec: 60,
    maxAttempts: 5
})

// Mount the ready-made router
app.use('/api/auth/otp', createOtpRouter(otpEngine, {
    onUserVerified: async (phone, req) => {
        // Look up or create user in your database, then return JWT token
        return {
            token: 'your_signed_jwt_token',
            user: { phone }
        }
    }
}))

app.listen(3000)
```

#### Method B: Programmatic Usage (Call anywhere in your backend)
```javascript
import { createOtpAuthEngine } from './modules/otp-auth-engine/index.js'

const otpEngine = createOtpAuthEngine({ provider: '2factor' })

// 1. Send OTP
const sendResult = await otpEngine.sendOtp('9876543210')
// Output: { success: true, phone: '9876543210', formattedPhone: '+919876543210', expiresAt: 1770000000 }

// 2. Verify OTP
const verifyResult = await otpEngine.verifyOtp('9876543210', '123456')
// Output: { valid: true, phone: '9876543210' }
```

---

## 🧪 Testing with Mock Mode
In development or staging without consuming SMS balance:
```javascript
const devEngine = createOtpAuthEngine({
    provider: 'mock',
    masterBypassCode: '777777',
    enableBypass: true
})
```
When `provider: 'mock'` is set, the OTP is printed directly in your terminal, and entering `777777` will instantly verify!
