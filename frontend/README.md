# 👑 AmratGames.com — Frontend Client Application

[![React 18](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![Vite v5](https://img.shields.io/badge/Vite-v5.4.21-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-v5-1890FF?style=for-the-badge&logo=antdesign)](https://ant.design)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com)
[![RTP 99.00% Verified](https://img.shields.io/badge/RTP-99.00%25%20Verified-gold?style=for-the-badge)](https://amratgames.com)

The active gaming web application for **AmratGames.com**, engineered with **React 18**, **Vite**, **Ant Design**, **HTML5 Canvas**, and **Tailwind CSS**. It delivers an ultra-premium, dark-mode obsidian & royal gold casino user interface optimized for desktop and mobile viewports.

---

## 🎮 The 8 Playable Casino Originals

1. **Crash**: Real-time trajectory curve rendered on HTML5 Canvas with smooth 60fps animations, automated target cashout, twin-betting controls, and live community bets ticker.
2. **Plinko**: Physics pegboard with 8–16 rows, Low/Medium/High risk volatility, and special multiplier ball classes (*Standard 1×, Emerald 5×, Ruby 10×, Sapphire 20×*).
3. **Mines**: 5×5 diamond minefield with 1–24 configurable mines, Fisher-Yates shuffle randomness, live multiplier counter, and instant cashout.
4. **Limbo**: High-speed multiplier prediction game with instant spin resolution, visual target meter, and win chance adjustment.
5. **Dragon Tiger**: High-speed Asian casino card battle with Dragon (1:1), Tiger (1:1), and Tie (11:1) betting options and roadmaps.
6. **Color Match**: Rapid color wheel game with Red (2×), Green (2×), and Violet (9×) segments.
7. **Coin Toss (Solo vs House & 1v1 PvP Duels Arena)**:
   - Interactive 3D physical coin with milled edge cylinder reeding and mouse parallax tilt.
   - Physical landing shockwaves on the pedestal floor.
   - Hot win streak banner notifications.
   - **1v1 PvP Duels Arena**: Real-time multiplayer lobby where players challenge each other or take on automated floor liquidity bots.

---

## 🌟 Player Features & Indian Localization

- **Zero Dollar ($) Policy**: 100% direct **₹ INR**, **₿ Bitcoin**, and **₮ Tether USDT** gaming with zero currency conversion markups.
- **Instant Indian Payments**: Native support for **UPI (PhonePe, Google Pay, Paytm, BHIM, CRED)**, dynamic QR code modal, NetBanking, and IMPS.
- **1-Click Fast Manual UPI Cashout**: Deep-linking cashier for instant settlement with admin verification.
- **₹10,000 Virtual Practice Balance**: Risk-free testing balance refillable at any time.
- **Web Audio FX Engine (`casinoAudio.js`)**: Synthetic Web Audio API sounds for coin flips, chips, wins, losses, and clicks with global mute toggle.
- **Provably Fair Verifier Modal**: In-game HMAC-SHA256 outcome verification tool and server seed rotation dialog.
- **Multi-Tier Viral Affiliate Dashboard**: Real-time visualization of 3-tier referral hierarchy, commissions ledger, and 1-click claim button.
- **"Be the House" Liquidity Vault UI**: Deposit funds into the house bankroll, track live APY, and claim passive platform revenue yields.

---

## 📱 Mobile-First Responsive Layout Architecture

Every game on AmratGames is engineered with a **split-level mobile interface**:
- **Game Stage on Top**: The visual canvas, 3D coin, or arcade runner sits in the upper viewport with compact dimensions so players always see the action.
- **Betting Controls Below**: Bet inputs, prediction pickers, quick-bet chip presets, and action buttons are anchored in the lower thumb-friendly zone.
- **Zero Viewport Clipping**: Fluid vertical flex containers ensure headers, buttons, and streak notifications fit natively on both standard Android/iOS screens (390px) and large desktop monitors (1920px+).

---

## 📁 Frontend Directory Structure

```text
frontend/
├── public/                       # Static public assets
│   ├── amrat-logo.png            # Official 3D Royal Gold crown logo
│   ├── favicon.ico
│   ├── manifest.json             # PWA Web Manifest
│   └── images/coin-toss/         # True minted Heads and Tails coin textures
├── src/
│   ├── components/               # Global components and dialogs
│   │   ├── Admin/                # Full Admin Dashboard (metrics, users, games, ledger)
│   │   ├── Affiliate/            # Multi-Tier Viral Affiliate Dashboard
│   │   ├── AuthModal/            # 2-Tab Sign In & Register modal with In-House OTP
│   │   ├── Cashier/              # Manual UPI Payout & Crypto Ingress dialogs
│   │   ├── GameHistory/          # Live round history drawer
│   │   ├── Header.jsx            # Top Navigation, Wallet Balance, Currency Switcher
│   │   ├── ProvablyFair/         # Interactive HMAC-SHA256 Verifier Modal
│   │   ├── Sidebar.jsx           # Slide-out casino game navigation drawer
│   │   └── Vault/                # "Be the House" Liquidity Staking Dashboard
│   ├── context/                  # Global React contexts
│   │   ├── AuthContext.jsx       # User authentication & token state
│   │   ├── ThemeContext.jsx      # Royal gold obsidian theme tokens
│   │   ├── WalletContext.jsx     # Multi-currency ledger & game bet execution
│   │   └── WebSocketContext.jsx  # Live WebSockets connection management
│   ├── games/                    # Casino Game implementations
│   │   ├── coin-toss/            # 3D Coin Toss, CoinParticles, PvP Duels Arena
│   │   ├── color-match/          # Color Match Wheel
│   │   ├── crash/                # Exponential trajectory Canvas Crash
│   │   ├── dragon-tiger/         # 2-Card Asian Duel
│   │   ├── limbo/                # Multiplier Target Limbo
│   │   ├── mines/                # 5x5 Diamond Minefield
│   │   └── plinko/               # Multi-row Physics Pegboard
│   ├── pages/                    # Route pages
│   │   ├── HomePage.jsx          # Casino lobby, originals showcase, and Indian FAQs
│   │   └── ProfilePage.jsx       # User profile, VIP loyalty status, security
│   ├── utils/                    # Core utilities
│   │   ├── casinoAudio.js        # Web Audio API sound synthesizer
│   │   ├── upiIntent.js          # UPI Deep-Link generator for mobile payment apps
│   │   └── ProvablyFair.js       # Client-side cryptographic verifier
│   ├── App.jsx                   # Master application router & layout shell
│   ├── main.jsx                  # React 18 DOM root mount
│   └── index.css                 # Master Tailwind and Royal Gold theme variables
├── package.json
├── vercel.json                   # Vercel SPA route rewrite rules
└── vite.config.js                # Vite build pipeline & backend reverse proxy
```

---

## 💻 Development & Build Commands

```bash
# Install frontend dependencies
npm install

# Start Vite dev server on http://localhost:5173
npm run dev

# Compile production bundle into dist/
npm run build

# Preview production build locally
npm run preview
```

---

## 🚀 Deployment (Vercel Ready)

The frontend includes `vercel.json` configured for SPA routing. When deployed to Vercel, it builds automatically via Vite with all client-side routes handled seamlessly.

&copy; 2026 **AmratGames.com**. All Rights Reserved.
