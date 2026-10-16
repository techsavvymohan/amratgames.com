# 👑 AmratGames.com — Backend Architecture & Services

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.19-lightgrey?style=for-the-badge&logo=express)](https://expressjs.com)
[![WebSocket](https://img.shields.io/badge/WebSocket-ws%208.18-blue?style=for-the-badge)](https://github.com/websockets/ws)
[![Tests Passing](https://img.shields.io/badge/Tests-54%2F54%20Passing-brightgreen?style=for-the-badge)](https://amratgames.com)

The **AmratGames.com** backend is an enterprise-grade casino engine built with **Node.js**, **Express.js**, **WebSockets**, and **HMAC-SHA256 Cryptographic PRNG**. It powers all game logic, real-time multiplayer duels, bankroll risk management, automated settlements, anti-fraud defenses, and the autonomous **Floor Activity Bot Engine**.

---

## 🚀 Server Architecture Overview

- **Port**: `5000` (configurable via `PORT` in `.env`)
- **Protocols**: REST API (`/api/*`) + Full-Duplex WebSockets (`/ws`)
- **Database / State**: Atomic file-backed JSON state engine with in-memory indexes and Redis clustering support
- **Fairness Engine**: Cryptographic HMAC-SHA256 outcome commitment and evaluation
- **Authentication**: 100% In-House Zero-API-Key OTP Engine with bcrypt password security

---

## 🤖 Floor Activity Engine & Autonomous Bots (`FloorActivityEngine.js`)

To guarantee a vibrant, high-energy gaming floor 24 hours a day, the backend operates an autonomous **Floor Activity Engine**:

### 1. Bot Personas (`BOT_PERSONAS`)
8 distinct bot personas with persistent user records, VIP loyalty ranks, and custom avatars:
- `Aryan_King` (Gold VIP)
- `Rohit_Trader` (Platinum VIP)
- `SimranBets` (Silver VIP)
- `CryptoRaja` (Gold VIP)
- `Priya_99` (Bronze VIP)
- `Kabir_HighRoller` (Diamond VIP)
- `Vicky_Gamer` (Silver VIP)
- `Aarav_Luck` (Gold VIP)

### 2. PvP Market Maker Liquidity
- Continuously maintains at least **3 open bot challenges** across varied stake tiers (`₹50`, `₹100`, `₹250`, `₹500`, `₹1,000`, `₹2,500`, `₹5,000`).
- Prunes stale bot challenges (>10 minutes) to keep lobby timestamps fresh and active.

### 3. Automated Human Matchmaker
- When a human player creates a 1v1 PvP challenge and waits for **longer than 20 seconds**, the Floor Activity Engine automatically assigns an available bot persona to accept the challenge.
- Duels resolve instantly with Provably Fair cryptographic outcomes, paying 97% to the winner and reserving 3% house rake.

### 4. Live Betting Feed Simulator
- Generates periodic, organic betting tickets across all casino originals (Crash, Plinko, Mines, Limbo, Coin Toss).
- Simulates realistic multipliers and win/loss ratios to provide social proof on the platform.

### 5. Community Chat Banter
- Broadcasts natural casino chatter, emoji reactions, and congratulatory messages during major player wins.

---

## 🏛️ The 5 Core Architectural Pillars

### 🔹 Pillar 1: Cryptographic Integrity & In-House OTP
- **HMAC-SHA256 Fairness**: Generates a 64-char hex server seed, hashes it with SHA-256 before game rounds, and combines it with player client seeds and sequential nonces.
- **In-House OTP Engine**: 100% self-hosted OTP dispatch, rate-limited resend cooldowns (60s), anti-brute-force lockout (5 attempts), and intent-scoped authorization.

### 🔹 Pillar 2: Dynamic Bankroll Risk Management
- **Win Cap Protection**: Dynamically limits single-round payouts based on liquid house vault reserves.
- **Max Profit Ceilings**: Prevents house bankruptcy on extreme statistical outlier runs (e.g. 10,000× multipliers).
- **Bet Sizer Guardrails**: Restricts outsized wagers on high-volatility targets.

### 🔹 Pillar 3: Automated Settlement Rails
- **Deterministic Crypto Ingress**: Generates deterministic deposit addresses and memo tags for Bitcoin (`BTC`) and Tether (`USDT`).
- **Automated Webhook Replay Protection**: Verifies cryptographic signatures, prevents duplicate transaction replay, and credits balances instantly.
- **1-Click Fast Manual UPI Cashier**: Supports instant manual verification with deep-linking (PhonePe, GPay, Paytm) and dynamic QR codes.

### 🔹 Pillar 4: Social Arcade 1v1 PvP Duels Arena
- Real-time multiplayer coin toss duels.
- Zero financial risk for the house: the house extracts a transparent **3% rake** on each completed pot.
- State-synchronized WebSocket broadcast to all connected duel participants.

### 🔹 Pillar 5: Multi-Tier Viral Affiliate Tree & Liquidity Vault
- **Viral Referral Hierarchy**:
  - **Tier 1 (Direct)**: **0.30%** of referred turnover.
  - **Tier 2 (Sub-Affiliate)**: **0.10%** of turnover.
  - **Tier 3 (Extended)**: **0.05%** of turnover.
- **"Be the House" Liquidity Vault**:
  - Community players deposit capital into the house bankroll.
  - Vault shares earn proportional yields from casino house edges and PvP rakes.
  - Supports unstaking and yield settlement.

---

## 🛡️ Anti-Fraud & Anti-Sybil Sentinel (`AntiFraudService.js`)

- **Device Fingerprinting**: Collects canvas hash, audio fingerprint, screen metrics, and user agent to identify multi-accounting.
- **IP Collision Detection**: Flags multiple user accounts sharing identical IP subnets within short time windows.
- **Risk Scoring Heuristics**: Elevates risk score for anomalous withdrawal velocities or suspicious arbitrage patterns.

---

## 📡 REST API Endpoints Overview

| Route Prefix | Method | Description |
| :--- | :--- | :--- |
| `/api/auth/register` | `POST` | Register new account with password |
| `/api/auth/login` | `POST` | Authenticate with email/phone & password |
| `/api/auth/otp/send` | `POST` | Request 6-digit In-House verification OTP |
| `/api/auth/otp/verify` | `POST` | Verify OTP and authenticate session |
| `/api/games/bet` | `POST` | Execute server-authoritative provably fair bet |
| `/api/games/provably-fair/seed` | `GET` | Retrieve active server seed hash and client seed |
| `/api/games/provably-fair/rotate` | `POST` | Reveal current server seed and generate fresh seed |
| `/api/wallet/balance` | `GET` | Get real-time balance across INR, BTC, USDT |
| `/api/wallet/deposit/upi` | `POST` | Initialize UPI deposit with dynamic QR code |
| `/api/wallet/deposit/crypto` | `POST` | Generate deterministic crypto deposit address |
| `/api/wallet/withdraw` | `POST` | Request automated or manual UPI/Crypto payout |
| `/api/pvp/duels` | `GET` | Retrieve open and resolved PvP duels |
| `/api/pvp/create` | `POST` | Create a new 1v1 PvP challenge |
| `/api/pvp/join` | `POST` | Accept and execute an open PvP challenge |
| `/api/vault/stats` | `GET` | Get total liquidity, APY, and user stake |
| `/api/vault/stake` | `POST` | Deposit funds into "Be the House" vault |
| `/api/vault/unstake` | `POST` | Withdraw staked liquidity and accrued yield |
| `/api/affiliates/stats` | `GET` | Get 3-tier commission balance and tree statistics |
| `/api/affiliates/claim` | `POST` | Claim accrued affiliate commission |
| `/api/admin/metrics` | `GET` | Master admin platform analytics and financial ledger |
| `/api/admin/users` | `GET` | Search and manage user accounts and balances |
| `/api/admin/payouts` | `GET` / `POST` | Review and execute pending player payouts |

---

## 🧪 Testing Suite (54/54 CI Tests)

The backend features a comprehensive automated testing suite covering all 5 Pillars, Provably Fair calculations, Anti-Fraud heuristics, and Floor Bot mechanics:

```bash
# Run the complete test suite
npm test
```

### Key Test Coverage:
1. `ProvablyFair HMAC-SHA256`: Outcome verification across all games.
2. `Modular OtpAuthEngine`: Phone normalization, cooldown throttling, brute-force locking, and bypass verification.
3. `Multiplayer Crash Room`: Trajectory synchronization and cashout triggers.
4. `Pillar 2 Bankroll Risk`: Dynamic win caps and bet sizer limits.
5. `Pillar 3 Crypto Rails`: Deterministic address generation, auto payouts, and webhook idempotency.
6. `Pillar 4 PvP Duels`: Stake locking, 3% rake extraction, and duel cancellation refunds.
7. `Pillar 5 Affiliates & Vault`: 3-tier turnover calculations and vault staking yield settlement.
8. `Floor Activity Engine`: Bot persona persistence, PvP market maker liquidity, and auto-matching.

---

## 💻 Development Commands

```bash
# Install dependencies
npm install

# Start backend server in development mode (with nodemon)
npm run dev

# Start backend server in production mode
npm start

# Run test suite
npm test
```

&copy; 2026 **AmratGames.com**. All Rights Reserved.
