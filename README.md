# 👑 AmratGames.com — India's Premier Provably Fair Crypto & INR (₹) Casino

[![Vercel Deploy Ready](https://img.shields.io/badge/Vercel-Deploy%20Ready-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![RTP 99.00% Verified](https://img.shields.io/badge/RTP-99.00%25%20Verified-gold?style=for-the-badge)](https://amratgames.com)
[![Direct INR & Crypto](https://img.shields.io/badge/Currencies-%E2%82%B9%20INR%20%C2%B7%20%E2%82%BF%20BTC%20%C2%B7%20%E2%82%AE%20USDT-26a17b?style=for-the-badge)](https://amratgames.com)
[![100% Provably Fair](https://img.shields.io/badge/Fairness-HMAC--SHA256-blue?style=for-the-badge)](https://amratgames.com)
[![18+ Responsible Gaming](https://img.shields.io/badge/Age-18%2B%20Only-red?style=for-the-badge)](https://amratgames.com)

**AmratGames.com** is a high-performance, provably fair digital casino platform engineered with React 18, Vite, Canvas, Phaser 3 arcade physics, and a backend GraphQL studio. Tailored specifically for Indian and global players, it delivers direct **Indian Rupee (₹ INR)** and **Crypto (₿ BTC, ₮ USDT)** gaming with zero foreign exchange fees, instant UPI settlements, and mathematically proven 99.00% RTP odds.

---

## 🌟 Key Highlights

- **Zero Dollar ($) Policy**: No USD marks or hidden currency conversion fees anywhere. Players wager directly in **₹ INR**, **₿ Bitcoin**, or **₮ Tether USDT**.
- **Instant Indian Payments**: Native support for **UPI (Google Pay, PhonePe, Paytm, BHIM)**, **NetBanking**, and **IMPS**, alongside high-speed crypto blockchain confirmation.
- **₹10,000 Free Virtual Practice Wallet**: Instant refillable virtual INR balance allowing risk-free gameplay and betting system testing.
- **100% Cryptographic Provable Fairness**: Industry-standard **HMAC-SHA256** seed commitment with an interactive in-game audit calculator.
- **Luxury Royal Gold Aesthetics**: Deep obsidian black palette (`#08080c`) accented by radiant 24k gold gradients (`#f5af19`, `#d49110`) and glassmorphic panels.
- **Indian 5G & Mobile First**: Ultra-responsive touch sliding bet sheets, adaptive canvas scaling, and sub-10ms latency optimized for Jio and Airtel 5G.
- **Vercel Deploy Ready**: Pre-configured `vercel.json` with SPA routing, clean URLs, and monorepo build scripts.

---

## 🎮 The Original Game Suite

| Game | Engine / Technology | RTP | Max Multiplier | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Crash** | HTML5 Canvas + requestAnimationFrame | **99.00%** | **1,000×** | Real-time exponential trajectory, auto cashout at target multiplier, and live community bets feed. |
| **Plinko** | Custom HTML5 Canvas Physics Engine | **99.00%** | **1,000×** | 8 to 16 pin rows, Low/Medium/High volatility, and special ball tiers (*Emerald 5×*, *Ruby 10×*, *Sapphire 20×*). |
| **Mines** | React Virtual DOM + Cryptographic Shuffle | **99.00%** | **5,000×** | 5×5 diamond minefield, 1–24 configurable mines using Fisher-Yates shuffle with live cashout profit. |
| **Dino Run** | Phaser 3 Arcade Engine | **99.00%** | **100×** | Real-time retro arcade hurdle jumping runner with risk multipliers per jump. |

---

## 🏛️ System Architecture

```
                                  [ User Browser / PWA ]
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    ▼                                               ▼
          Frontend Application                            Backend Engine Studio
           e:\Amrat_Games\frontend                         e:\Amrat_Games\backend
     (Port 5173 / Vercel Edge Server)                 (Port 3001 / Nitro Server)
    ─────────────────────────────────────           ─────────────────────────────────────
    • React 18 + Vite + Phaser 3                    • TanStack Start / Nitro SSR & Engine
    • 4 Playable Originals (Crash/Plinko/Mines/Dino)• 9 GraphQL Casino Endpoints
    • Dynamic Currency Switcher (₹ / ₿ / ₮)          • Multi-language Code Generator
    • Shared Local Wallet & Virtual Refills         • Slot Math Simulation Engine
    • Provably Fair Verification Modal              • Proxy Route Integration (/api)
    • Ant Design + Tailwind CSS v4                  • Royal Gold Theme Tokens
```

---

## 🔒 Cryptographic Provable Fairness

Every wager on AmratGames is bound to cryptographic randomness that cannot be altered or predetermined:

1. **Server Seed**: A cryptographically secure 64-character hex string generated on the server and committed to the player as a SHA-256 hash **before** the round starts.
2. **Client Seed**: A player-controlled seed phrase that can be edited at any time, ensuring the platform cannot influence game entropy.
3. **Nonce**: A sequential counter tracking rounds played with the current seed pair.
4. **Verification Formula**:
   $$\text{Outcome} = \text{HMAC-SHA256}(\text{ServerSeed}, \text{ClientSeed} : \text{Nonce})$$
5. **Audit Calculator**: Players can open the **Fairness** modal at the bottom of any game, rotate their server seed to reveal the plain-text secret, and verify past outcomes independently.

---

## 🚀 Vercel Deployment Guide

This project is 100% Vercel deploy ready out of the box.

### Option A: Direct Repository Deployment (Recommended)
1. Push this repository to GitHub:
   ```bash
   git push -u origin main
   ```
2. Log into [Vercel](https://vercel.com) and click **Add New Project**.
3. Import the `amratgames.com` repository (`https://github.com/techsavvymohan/amratgames.com`).
4. Vercel will automatically detect the root `vercel.json` and build the application using:
   - **Framework Preset**: `Vite`
   - **Build Command**: `cd frontend && pnpm install && pnpm run build`
   - **Output Directory**: `frontend/dist`
5. Click **Deploy**. Your casino will be live on Vercel with instant HTTPS and global edge CDN!

### Option B: Deploying with Root Directory set to `frontend`
If you prefer setting the Vercel **Root Directory** setting to `frontend`:
1. In Vercel Project Settings ➔ **General** ➔ **Root Directory**, set to `frontend`.
2. The included `frontend/vercel.json` will handle SPA rewrites automatically.
3. Deploy!

---

## 💻 Local Development Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Package Manager**: `pnpm` (recommended) or `npm`

### Installation & Launch
```bash
# 1. Clone the repository
git clone https://github.com/techsavvymohan/amratgames.com.git
cd amratgames.com

# 2. Install workspace dependencies
pnpm install

# 3. Start the Frontend Casino (Port 5173)
pnpm --filter ./frontend dev

# 4. (Optional) Start the Backend Engine & GraphQL Studio (Port 3001)
pnpm --filter ./backend dev
```

Open [http://localhost:5173](http://localhost:5173) to play.

---

## 📁 Repository Structure

```text
amratgames.com/
├── frontend/                     # Active Casino Games Web Application
│   ├── public/                   # Static assets, sitemap.xml, robots.txt, logo
│   │   ├── amrat-logo.png        # 3D Royal Gold Crown & Spade logo emblem
│   │   ├── favicon.ico
│   │   ├── manifest.json         # PWA Manifest
│   │   ├── robots.txt            # Search & AI Bot Crawl Directives
│   │   └── sitemap.xml           # SEO Sitemap
│   ├── src/
│   │   ├── components/
│   │   │   ├── CrashGame/        # Crash canvas & betting panel
│   │   │   ├── DinoGame/         # Phaser 3 runner wrapper & arcade scenes
│   │   │   ├── MinesGame/        # 5x5 minefield & cashout mechanics
│   │   │   ├── PlinkoGame/       # Physics canvas board & risk tiers
│   │   │   ├── Header.jsx        # Navigation, Royal Logo & Currency Switcher
│   │   │   ├── Sidebar.jsx       # Side drawer navigation
│   │   │   └── MobileBetSheet.jsx# Touch-optimized mobile betting sheet
│   │   ├── context/
│   │   │   ├── ThemeContext.jsx  # Royal gold palette manager
│   │   │   └── WalletContext.jsx # Multi-currency INR/BTC/USDT ledger
│   │   ├── pages/
│   │   │   └── HomePage.jsx      # Lobby, Originals grid, Indian FAQs & EEAT
│   │   ├── utils/
│   │   │   └── ProvablyFair.js   # HMAC-SHA256 mathematical fairness engine
│   │   └── index.html            # Indian SEO, GEO, AEO & Schema JSON-LD
│   ├── package.json
│   ├── vercel.json               # Frontend-specific Vercel SPA routing
│   └── vite.config.js            # Vite build pipeline & proxy rules
├── backend/                      # Backend Telemetry & GraphQL Studio
│   ├── src/
│   │   └── routes/
│   │       ├── api-explorer.tsx  # Amrat Royal GraphQL Studio
│   │       └── __root.tsx        # Shell & Navigation
│   ├── package.json
│   └── app.config.ts
├── .gitignore                    # Production build & node_modules exclusion
├── package.json                  # Root monorepo workspace scripts
├── pnpm-workspace.yaml           # pnpm multi-package configuration
├── vercel.json                   # Root Vercel deployment specification
└── README.md                     # Comprehensive platform documentation
```

---

## 🛡️ Responsible Gaming & Disclaimer

- **18+ Only**: AmratGames is strictly designed for adults of legal gaming age (18+) in India and respective international jurisdictions.
- **Risk-Free Practice**: Players can test all betting algorithms and odds completely risk-free using the instant refillable ₹10,000 virtual balance.
- **Transparency**: All game mathematics, RTP percentages (99.00%), and house edges are published and auditable.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

&copy; 2026 **AmratGames.com**. All Rights Reserved.
