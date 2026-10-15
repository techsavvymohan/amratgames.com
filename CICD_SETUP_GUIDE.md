# 👑 AmratGames.com — CI/CD Pipeline Setup & Operational Guide

This document details the automated **Continuous Integration (CI)** and **Continuous Deployment (CD)** pipelines configured for **AmratGames.com** using GitHub Actions, PM2, and Nginx on Ubuntu VPS (`103.216.168.84`).

---

## 1. Architecture Overview

```text
                      [ Developer Push / Pull Request ]
                                      │
                 ┌────────────────────┴────────────────────┐
                 ▼                                         ▼
         [ Feature / PR Branch ]                     [ main Branch ]
                 │                                         │
        .github/workflows/ci.yml                  .github/workflows/deploy.yml
                 │                                         │
         ┌───────┴───────┐                         ┌───────┴───────┐
         ▼               ▼                         ▼               ▼
   Quality & Tests  Build Checks             CI Gatekeeper   Zero-Downtime VPS Deploy
   • 54 Backend CI  • Vite build             • Unit tests    • SSH to 103.216.168.84
   • HMAC Fairness  • Syntax check           • Build check   • Git reset origin/main
   • Floor Activity • Docker test                            • npm install & build
   • 5 Pillars CI                                            • PM2 zero-downtime reload
                                                             • Nginx test & reload
                                                             • Live /api/health smoke check
```

---

## 2. GitHub Secrets Configuration

To enable automated deployments to your Ubuntu VPS, configure the following secrets in your GitHub repository:

👉 **Go to**: `GitHub Repository` ➔ **Settings** ➔ **Secrets and variables** ➔ **Actions** ➔ **New repository secret**

| Secret Name | Value | Required | Description |
| :--- | :--- | :--- | :--- |
| `VPS_HOST` | `103.216.168.84` | **Yes** | Your VPS Public IP Address |
| `VPS_USERNAME` | `root` | **Yes** | SSH Username (defaults to `root`) |
| `VPS_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY----- ...` | **Yes** | The **private** SSH key authorized on your VPS |
| `VPS_PORT` | `22` | Optional | SSH Port (defaults to `22`) |

---

## 3. SSH Key Authorization on VPS

If you haven't already added your GitHub deployment SSH key to the VPS, run these commands on the VPS:

### Step 1: Check existing authorized keys on VPS
```bash
cat ~/.ssh/authorized_keys
```

### Step 2: (If creating a new dedicated deployment key)
Generate an ED25519 key pair:
```bash
ssh-keygen -t ed25519 -C "github-actions-deploy@amratgames.com" -f ~/.ssh/amratgames_deploy
```

- Add the **Public Key** (`~/.ssh/amratgames_deploy.pub`) to the VPS:
  ```bash
  echo "YOUR_PUBLIC_KEY_CONTENT" >> ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  ```
- Copy the **Private Key** (`~/.ssh/amratgames_deploy`) and paste it into GitHub Secret: `VPS_SSH_KEY`.

---

## 4. Pipeline Details

### 🧪 1. Continuous Integration (`.github/workflows/ci.yml`)
- **Triggers**: Every Pull Request to `main`/`dev`, pushes to non-main branches, or manual `workflow_dispatch`.
- **Jobs**:
  1. `automated-tests`:
     - Executes 54 backend unit and integration test suites:
       - Cryptographic Provably Fair HMAC-SHA256 outcome formulas.
       - Modular In-House OTP Auth Engine and brute-force defenses.
       - Pillar 2 Bankroll Risk Management & Win Caps.
       - Pillar 3 Crypto Settlement & Fast UPI Ingress.
       - Pillar 4 PvP Duels Arena & 3% House Rake.
       - Pillar 5 Multi-Tier Viral Affiliates & Liquidity Vault.
       - Floor Activity Engine bot personas, market makers, and matchmakers.
       - Anti-Sybil Sentinel device and IP collision heuristics.
  2. `build-validation`: Builds production Vite bundle (`npm run build`) and verifies bundle output without errors.

### 🚀 2. Continuous Deployment (`.github/workflows/deploy.yml`)
- **Triggers**: Automatically on every push/merge to `main`, or manual trigger.
- **Workflow Steps**:
  1. **Pre-Deployment CI Gate**: Ensures all 54 tests pass before deploying.
  2. **SSH Zero-Downtime Deployment**: Executes deployment script on `/var/www/amratgames.com`:
     - Syncs repository to latest `main` commit.
     - Runs dependency installation (`npm install`).
     - Compiles production frontend bundle.
     - Performs zero-downtime PM2 reload (`pm2 reload amratgames-backend`).
     - Validates and reloads Nginx.
     - Polls `/api/health` until HTTP 200 is confirmed.
  3. **Live Smoke Test & Summary**: Validates external HTTP connectivity and posts a rich summary report.

---

## 5. Local Commands Reference

```bash
# Run all backend unit & integration tests (54 suites)
cd backend
npm test

# Build production frontend bundle
cd ../frontend
npm run build

# Start local backend dev server
cd ../backend
npm run dev

# Start local frontend dev server
cd ../frontend
npm run dev
```

&copy; 2026 **AmratGames.com**. All Rights Reserved.
