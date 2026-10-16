# 👑 AmratGames.com — India's Premier Provably Fair Crypto & INR (₹) Casino Platform

[![Node.js CI](https://img.shields.io/badge/Node.js-v18%2B-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Vite v5](https://img.shields.io/badge/Vite-v5.4.21-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![RTP 99.00% Verified](https://img.shields.io/badge/RTP-99.00%25%20Verified-gold?style=for-the-badge)](https://amratgames.com)
[![Direct INR & Crypto](https://img.shields.io/badge/Currencies-%E2%82%B9%20INR%20%C2%B7%20%E2%82%BF%20BTC%20%C2%B7%20%E2%82%AE%20USDT-26a17b?style=for-the-badge)](https://amratgames.com)
[![100% Provably Fair](https://img.shields.io/badge/Fairness-HMAC--SHA256-blue?style=for-the-badge)](https://amratgames.com)
[![18+ Responsible Gaming](https://img.shields.io/badge/Age-18%2B%20Only-red?style=for-the-badge)](https://amratgames.com)

**AmratGames.com** is a high-performance, enterprise-grade digital casino and social arcade gaming platform engineered with **React 18**, **Vite**, **HTML5 Canvas**, **Phaser 3**, **Express.js**, and **WebSockets**. Tailored specifically for Indian and global players, it delivers direct **Indian Rupee (₹ INR)** and **Crypto (₿ BTC, ₮ USDT)** gaming with zero foreign exchange fees, instant UPI settlements, autonomous floor bot market-makers, and mathematically proven **99.00% RTP** odds.

---

## 🌟 Key Highlights & Platform Features

- **Zero Dollar ($) Policy**: No USD marks or hidden currency conversion fees. Players wager directly in **₹ INR**, **₿ Bitcoin**, or **₮ Tether USDT**.
- **Instant Indian Payments**: Native support for **UPI (PhonePe, Google Pay, Paytm, BHIM, CRED)**, dynamic QR code generation, NetBanking, IMPS, and 1-Click Fast Manual UPI cashouts.
- **7 Provably Fair Casino Originals**: Crash, Plinko, Mines, Limbo, Dragon Tiger, Color Match, and Coin Toss (with 1v1 PvP Arena).
- **Floor Activity Engine & Bot Personas**: Autonomous market-maker liquidity bots keep PvP duels active 24/7, auto-match waiting human challenges, generate real-time live bet feeds, and foster organic chat community banter.
- **Social Arcade 1v1 PvP Duels Arena**: Player-vs-Player Coin Toss with zero house risk and a transparent 3% house rake.
- **"Be the House" Liquidity Staking Vault**: Community players stake funds into the platform liquidity pool to earn passive yields derived from platform turnover and house rake.
- **Multi-Tier Viral Affiliate Hierarchy**: 3-tier commission distribution (Tier 1: 0.30%, Tier 2: 0.10%, Tier 3: 0.05% of turnover).
- **In-House OTP Auth Engine**: 100% standalone, zero-API-key OTP generation, cooldown throttling, anti-brute-force lockout, and intent-scoped authentication.
- **Pillar 2 Bankroll Risk Management**: Dynamic single-round win caps, max profit ceilings, and adaptive bet sizer guardrails protect house liquidity against catastrophic runs.
- **Automated Crypto Settlement**: Deterministic deposit addresses and instant risk-qualified payouts.
- **Anti-Fraud & Anti-Sybil Sentinel**: Multi-account collision detection, device fingerprinting, and risk heuristics.
- **Full Admin Control Panel**: Live financial metrics, scrollable user manager, game RTP toggles, dispute resolution, and audit logs.
- **Mobile-First Responsive Layouts**: Split-level mobile interface with game canvas on top and control panels below, optimized for Jio and Airtel 5G.

---

## 🎮 The Complete 7-Game Casino Suite

| Game | Engine / Technology | RTP | Max Multiplier | Key Mechanics & Features |
| :--- | :--- | :--- | :--- | :--- |
| **Crash** | HTML5 Canvas + requestAnimationFrame | **99.00%** | **1,000×** | Real-time exponential flight curve, automated cashout at target multiplier, and live community multiplayer room. |
| **Plinko** | Custom HTML5 Canvas Physics Engine | **99.00%** | **1,000×** | 8 to 16 pin rows, Low/Medium/High risk tiers, and 4 ball classes (*Standard 1×, Emerald 5×, Ruby 10×, Sapphire 20×*). |
| **Mines** | React Virtual DOM + Fisher-Yates Shuffle | **99.00%** | **5,000×** | 5×5 diamond minefield, 1–24 configurable mines, dynamic profit step counters, and instant cashout. |
| **Limbo** | High-Frequency PRNG Core | **99.00%** | **10,000×** | Instant target multiplier prediction game with ultra-fast turbo spins and configurable win chances. |
| **Dragon Tiger** | Standard Asian 52-Card PRNG Engine | **99.00%** | **11×** | Lightning-fast card duel; wager on Dragon (1:1), Tiger (1:1), or Tie (11:1) with live streak indicators. |
| **Color Match** | 3-Zone Segmented Color Wheel | **99.00%** | **9×** | Vibrant prediction wheel with Red (2×), Green (2×), and Violet (9×) payout zones. |
| **Coin Toss** | True 3D CSS Canvas + WebSockets | **99.00%** | **1.98×** | Authentic 3D gold coin assets, physical landing shockwaves, win streak indicators, and **1v1 PvP Duels Arena**. |

---

## 🏛️ System Architecture

```text
                                  [ User Browser / Mobile PWA ]
                                                │
                        ┌───────────────────────┴───────────────────────┐
                        ▼                                               ▼
              Frontend Application                            Backend Engine Studio
              Port 5173 / Vercel Edge                         Port 5000 / PM2 Node.js
        ─────────────────────────────────────           ─────────────────────────────────────
        • React 18 + Vite SPA Build                     • Express.js + WebSocket Server
        • 8 Provably Fair Originals                     • 5 Enterprise Architectural Pillars
        • 1v1 PvP Duels Arena Client                    • Floor Activity Engine & Bot Personas
        • "Be the House" Staking Dashboard              • Dynamic Bankroll Risk Management
        • 3-Tier Viral Affiliate Tree UI                • In-House Zero-API-Key OTP Auth Engine
        • 1-Click Fast Manual UPI Cashier               • Anti-Fraud & Anti-Sybil Sentinel
        • Provably Fair Verifier Modal                  • Automated Crypto & UPI Settlement
        • Web Audio FX & Haptic Feedback                • Full Admin Control Panel & Ledger
```

---

## 🤖 The Floor Activity Engine & Bot System

To ensure a vibrant, dynamic casino atmosphere 24 hours a day, the platform features a dedicated **Floor Activity Engine** (`FloorActivityEngine.js`):

1. **Bot Personas**: 8 pre-seeded realistic player personas (`Aryan_King`, `Rohit_Trader`, `SimranBets`, `CryptoRaja`, `Priya_99`, `Kabir_HighRoller`, `Vicky_Gamer`, `Aarav_Luck`) with persistent balances, VIP tiers, and avatars.
2. **PvP Market Maker Liquidity**: Automatically seeds and maintains open challenges across stake tiers (₹50, ₹100, ₹250, ₹500, ₹1,000, ₹2,500, ₹5,000) so human players always have opponents available. Stale bot duels (>10 minutes) are pruned to keep the lobby fresh.
3. **Automated Matchmaker**: If a human player creates an open PvP challenge and waits longer than 20 seconds without an opponent, a bot persona automatically accepts the duel with cryptographic Provably Fair resolution.
4. **Live Bets Feed Generator**: Broadcasts realistic live betting tickets and wins across all casino originals to inspire platform engagement.
5. **Community Chat Banter**: Generates organic casino chat banter and congratulatory messages during big multiplier wins.

---

## 🏛️ The 5 Enterprise Architectural Pillars

```text
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   AMRATGAMES 5-PILLAR ARCHITECTURE                                │
├─────────────────────────┬─────────────────────────┬─────────────────────────┬─────────────────────┤
│   Pillar 1: Integrity   │    Pillar 2: Risk       │  Pillar 3: Settlement   │  Pillars 4 & 5:     │
│                         │                         │                         │  Social & Viral     │
├─────────────────────────┼─────────────────────────┼─────────────────────────┼─────────────────────┤
│ • HMAC-SHA256 Fairness  │ • Bankroll Win Caps     │ • Deterministic Crypto  │ • 1v1 PvP Duels     │
│ • In-House OTP Engine   │ • Max Profit Ceilings   │ • Instant Auto Payouts  │ • 3% Zero-Risk Rake │
│ • Anti-Brute-Force      │ • Bet Sizer Guardrails  │ • 1-Click UPI Cashier   │ • 3-Tier Affiliates │
│ • Intent-Scoped Auth    │ • Liquidity Reserves    │ • Replay Attack Defense │ • "Be the House"    │
└─────────────────────────┴─────────────────────────┴─────────────────────────┴─────────────────────┘
```

---

## 🔒 Cryptographic Provable Fairness

Every wager on AmratGames is bound to cryptographic randomness that cannot be manipulated:

1. **Server Seed**: A cryptographically secure 64-character hex string generated on the server and committed to the player as a SHA-256 hash **before** the round starts.
2. **Client Seed**: A player-controlled seed phrase that can be customized at any time.
3. **Nonce**: A sequential counter tracking rounds played with the current seed pair.
4. **Outcome Formula**:
   $$\text{Outcome} = \text{HMAC-SHA256}(\text{ServerSeed}, \text{ClientSeed} : \text{Nonce})$$
5. **Audit Calculator**: Players can open the **Fairness** modal in any game, inspect the hash, rotate their server seed, and independently verify past outcomes.

---

## 💻 Local Development Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Package Manager**: `npm` or `pnpm`

### Installation & Launch

```bash
# 1. Clone the repository
git clone https://github.com/techsavvymohan/amratgames.com.git
cd amratgames.com

# 2. Setup Environment Variables
npm run setup:env

# 3. Start Backend Server (Port 5000)
cd backend
npm install
npm run dev

# 4. In a separate terminal, Start Frontend Client (Port 5173)
cd ../frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to play.

### Automated Test Suite (54/54 CI Tests)
```bash
# Run all backend unit and integration tests
cd backend
npm test
```

---

## 📁 Repository Structure

```text
amratgames.com/
├── frontend/                     # React 18 + Vite Casino Web Application
│   ├── public/                   # Static assets, logos, favicon, PWA manifest
│   │   ├── amrat-logo.png        # Official AmratGames Royal Logo
│   │   └── images/               # Game artwork & 3D coin assets
│   ├── src/
│   │   ├── components/           # Reusable UI components & modals
│   │   │   ├── Admin/            # Full Admin Management Panel
│   │   │   ├── Affiliate/        # 3-Tier Viral Affiliate Dashboard
│   │   │   ├── Cashier/          # Manual UPI & Crypto Cashier
│   │   │   ├── Header.jsx        # Navigation, Logo & Currency Switcher
│   │   │   ├── ProvablyFair/     # HMAC-SHA256 Verification Modal
│   │   │   └── Vault/            # "Be the House" Liquidity Vault UI
│   │   ├── games/                # Active Casino Game Implementations
│   │   │   ├── coin-toss/        # 3D Coin Toss & PvP Duels Arena
│   │   │   ├── color-match/      # Color Match Wheel Game
│   │   │   ├── crash/            # Real-Time Crash Canvas & Multiplayer
│   │   │   ├── dragon-tiger/     # Dragon Tiger 2-Card Game
│   │   │   ├── limbo/            # High-Speed Multiplier Limbo
│   │   │   ├── mines/            # 5x5 Mines Diamond Grid
│   │   │   └── plinko/           # Custom Physics Pegboard
│   │   ├── context/              # Auth, Wallet, WebSocket & Theme State
│   │   └── utils/                # Audio Engine, UPI Intent, Provably Fair Math
│   ├── package.json
│   ├── vercel.json               # SPA route redirects
│   └── vite.config.js            # Build pipeline & backend proxy rules
├── backend/                      # Express.js + WebSocket Server
│   ├── src/
│   │   ├── routes/               # Express REST route handlers
│   │   │   ├── admin.routes.js   # Admin portal management & metrics
│   │   │   ├── auth.routes.js    # In-House OTP Login & Registration
│   │   │   ├── games.routes.js   # Bet execution & Provably Fair math
│   │   │   ├── pvp.routes.js     # 1v1 PvP Duels Arena matchmaking
│   │   │   ├── vault.routes.js   # "Be the House" Staking & Yields
│   │   │   └── wallet.routes.js  # UPI & Crypto deposit/withdrawal rails
│   │   ├── services/             # Core Business Logic Engines
│   │   │   ├── AntiFraudService.js   # Anti-Sybil & device fingerprinting
│   │   │   ├── BankrollRiskService.js# Dynamic win caps & bet sizing
│   │   │   ├── ChatService.js        # Live chat broadcast & VIP badges
│   │   │   ├── FloorActivityEngine.js# Bot Personas, PvP Market Maker & Feed
│   │   │   ├── ProvablyFairService.js# Cryptographic seed management
│   │   │   └── PvPService.js         # Real-time duel state & rake extraction
│   │   ├── modules/
│   │   │   └── otp-auth-engine/  # 100% In-House Zero-API-Key OTP Module
│   │   └── server.js             # HTTP & WebSocket bootstrapping
│   ├── package.json
│   └── test/                     # 54 Integration & Fairness Test Suites
├── CICD_SETUP_GUIDE.md           # VPS deployment & GitHub Actions guide
├── ENV_SYSTEM_GUIDE.md           # Environment variables architecture
├── ecosystem.config.cjs          # PM2 production process configuration
├── package.json                  # Root monorepo scripts
└── README.md                     # Master platform documentation
```

---

## 🛡️ Responsible Gaming & Compliance

- **18+ Age Restriction**: AmratGames is strictly intended for adult players (18+) of legal gaming age.
- **Free Practice Mode**: Every player receives an instant, refillable **₹10,000 virtual balance** to test betting algorithms and game rules completely risk-free.
- **Mathematical Transparency**: All game algorithms, RTP odds (99.00%), and house edges are published and cryptographically verifiable.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

&copy; 2026 **AmratGames.com**. All Rights Reserved.
