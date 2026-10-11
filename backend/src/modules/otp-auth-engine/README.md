# 🛡️ In-House Modular OTP Auth Engine (100% Standalone & Zero API Key)

A blazing-fast, zero-bloat, production-ready **In-House OTP Authentication & Verification Engine** designed for Indian SaaS and Gaming platforms.

**Zero external API keys required. Zero third-party telecom subscriptions. You own 100% of your OTP generation, validation, rate limiting, and sessions.**

---

## 🚀 Key Advantages

- 🛡️ **100% In-House & Self-Contained**: Runs directly on your server. Zero external API key dependencies.
- ⚡ **Zero Telecom Cost**: No need to buy telecom credits or register for DLT SMS routes.
- 🔒 **Cryptographic 6-Digit OTP Generator**: Built with Node.js native `crypto.randomInt` (non-guessable).
- 🛡️ **Anti-Brute Force Protection**: Automatically destroys and invalidates the OTP after 5 wrong attempts.
- ⏱️ **Resend Cooldown Throttling**: 60-second cooldown timer prevents users or bots from spamming OTP requests.
- 💾 **Dual Storage**: Zero-dependency In-Memory Store (with automatic background TTL cleanup) or clustered Redis Store.
- 🧪 **Master QA Code (`777777`)**: Built-in developer bypass code for staging, automated tests, and local demo.
- 📦 **100% Portable**: Just copy this folder into **any** other SaaS project!

---

## 📂 Folder Structure

```text
otp-auth-engine/
├── index.js                  # Main export facade (One-line import)
├── OtpAuthEngine.js          # Core engine (Generate, verify, cooldown, brute-force lock)
├── storage/
│   ├── MemoryOtpStore.js     # Default zero-dependency in-memory store with auto TTL cleanup
│   └── RedisOtpStore.js      # Redis store for multi-server clusters
├── providers/
│   ├── InHouseOtpProvider.js # ⭐️ Default In-House Provider (100% Free, Zero API Key)
│   ├── BaseSmsProvider.js    # Provider interface
│   ├── TwoFactorSmsProvider.js # Optional external 2Factor gateway (if ever desired)
│   ├── Fast2SmsProvider.js   # Optional external Fast2SMS gateway
│   ├── MockSmsProvider.js    # Silent mock provider for automated unit tests
│   └── index.js              # Provider factory
├── routes/
│   └── expressRouter.js      # Mountable Express router
├── utils/
│   ├── phoneValidator.js     # Indian mobile validator & normalizer (+91, 10 digits)
│   └── cryptoOtp.js          # Cryptographic secure random OTP generator
└── README.md
```

---

## 🛠️ How to use in ANY other SaaS (Zero Configuration Needed)

### Method 1: Programmatic Usage (Just 3 Lines of Code)
```javascript
import { createOtpAuthEngine } from './otp-auth-engine/index.js'

// Initializes with 100% In-House provider by default (Zero API Key needed!)
const otpEngine = createOtpAuthEngine({
    resendCooldownSec: 60,
    maxAttempts: 5
})

// 1. Send / Dispatch OTP
const send = await otpEngine.sendOtp('9876543210')
// Output: { success: true, phone: '9876543210', formattedPhone: '+919876543210', expiresAt: 1770000000 }

// 2. Verify OTP
const verify = await otpEngine.verifyOtp('9876543210', '123456')
// Output: { valid: true, phone: '9876543210' }
```

### Method 2: Mount into Express
```javascript
import express from 'express'
import { createOtpAuthEngine, createOtpRouter } from './otp-auth-engine/index.js'

const app = express()
app.use(express.json())

const otpEngine = createOtpAuthEngine()

// Mount the ready-made router
app.use('/api/otp', createOtpRouter(otpEngine, {
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
