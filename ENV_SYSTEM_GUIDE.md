# 👑 AmratGames.com — Environment Variable (.env) Architecture & Operational Guide

This document specifies the centralized environment variable architecture implemented for **AmratGames.com**, designed for secure local development, continuous integration, and production **Ubuntu VPS (Nginx + PM2 + Docker)** deployment.

---

## 1. System Topology & Separation of Concerns

The project employs a three-tier environment configuration:

```text
amratgames.com/
│
├── .env.example              # [Master Template] Complete system variable blueprint
├── .env                      # [Master Config] Root-level deployment variables
│
├── scripts/
│   └── setup-env.js          # [Provisioning CLI] Cryptographic secret generator & sync
│
├── backend/
│   ├── .env.example          # [Backend Template] Node.js, WebSocket & Bot Engine config
│   ├── .env                  # [Backend Config] Active server variables
│   └── src/
│       ├── config.js         # Multi-candidate path resolver & validation engine
│       └── server.js         # Service bootstrapping with masked config diagnostics
│
└── frontend/
    ├── .env.example          # [Frontend Template] Vite browser bundle variables
    ├── .env                  # [Frontend Config] Active client-side variables
    └── src/
        └── services/api.js   # Uses import.meta.env.VITE_API_URL
```

> [!IMPORTANT]
> **Strict Secret Isolation**:
> Sensitive credentials (`JWT_SECRET`, `ADMIN_PASSWORD`, database keys, SMTP secrets, and crypto receivers) **only** exist in backend/root `.env` files.
> The frontend browser bundle only exposes variables prefixed with `VITE_`. Backend secrets are never bundled or transmitted to the client.

---

## 2. Configuration Breakdown

### 2.1 Backend / Server Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | Set to `production` on Ubuntu VPS to enforce security guards |
| `PORT` | `5000` | Express & WebSocket HTTP listening port (proxied via Vite / Nginx) |
| `HOST` | `0.0.0.0` | Bind IP (`0.0.0.0` binds all interfaces, suitable for VPS) |
| `CORS_ORIGIN` | `*` / `http://localhost:5173` | Allowed CORS origins for browser AJAX & WebSockets |
| `DATA_DIR` | `./data` | File-system path where JSON database and state persist |
| `DB_FILE` | `amratgames_db.json` | Database filename |
| `REDIS_URL` | *(optional)* | Redis connection string for multi-instance clusters and pub/sub |
| `SUPABASE_URL` | *(optional)* | Supabase PostgreSQL cloud endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | *(optional)* | Supabase backend service role key |
| `JWT_SECRET` | *(64-char crypto hex)* | 256-bit cryptographically secure token signing key |
| `JWT_EXPIRES_IN` | `7d` | Player session duration |
| `ADMIN_API_KEY` | *(crypto hex)* | Internal microservice admin authentication key |
| `ADMIN_DEFAULT_EMAIL` | `admin@amratgames.com`| Master Admin Portal root login |
| `ADMIN_DEFAULT_PASSWORD` | *(Secure passphrase)* | Master Admin Portal root password |
| `ADMIN_DEFAULT_PHONE` | `9876500001` | Master Admin Mobile Number |
| `SMS_GATEWAY_PROVIDER` | `frozen` | SMS Gateway (`frozen` for in-house email/dev, `mock`, `msg91`, `fast2sms`) |
| `OTP_EXPIRY_MINUTES` | `5` | Minutes before an OTP code expires |
| `OTP_RESEND_COOLDOWN_SECONDS` | `60` | Cooldown period between OTP resend requests |
| `OTP_MAX_ATTEMPTS` | `5` | Maximum failed verification attempts before OTP burn |
| `DEMO_OTP_BYPASS_ENABLED` | `true` | Allows instant QA login via bypass code (`false` in production) |
| `DEMO_OTP_CODE` | `777777` | Universal bypass verification OTP for rapid testing |
| `SUPPORT_EMAIL` | `support@amratgames.com` | Primary outgoing email address |
| `SMTP_HOST` | *(SMTP Server)* | SMTP host for OTP and transaction emails |
| `SMTP_PORT` | `587` | SMTP port (`587` for STARTTLS, `465` for SSL) |
| `SMTP_USER` | `support@amratgames.com` | SMTP username |
| `SMTP_PASS` | *(Password)* | SMTP password |
| `UPI_MERCHANT_VPA` | `amratgames@upi` | Indian Virtual Payment Address for instant deposits |
| `UPI_MERCHANT_NAME` | `AmratGames India` | Merchant display title on PhonePe / GPay / Paytm |
| `CRYPTO_RECEIVER_BTC` | *(BTC Address)* | Primary cold storage Bitcoin deposit address |
| `CRYPTO_RECEIVER_USDT` | *(ERC20/TRC20)* | Primary cold storage Tether USDT deposit address |
| `DEFAULT_RTP` | `99.00` | Default Return-To-Player casino percentage |
| `HOUSE_EDGE` | `1.00` | Mathematical house edge percentage |
| `MIN_BET_INR` | `10` | Platform minimum bet limit in INR |
| `MAX_BET_INR` | `200000` | Platform maximum bet limit in INR |
| `TOKEN_SYMBOL` | `AMRAT` | Native gaming token ticker |

### 2.2 Frontend (Vite) Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `/api` | Base REST API URL (proxied locally to `http://localhost:5000/api`) |
| `VITE_WS_URL` | `ws://localhost:5000/ws` | Live WebSocket endpoint (Bets, PvP, Chat, Ticker) |
| `VITE_APP_NAME` | `AmratGames.com` | Brand title displayed across the app |
| `VITE_DEFAULT_CURRENCY` | `INR` | Default player display currency (`INR`, `BTC`, `USDT`, `AMRAT`) |
| `VITE_UPI_ID` | `amratgames@upi` | UPI ID rendered in QR modal and payment links |

---

## 3. Dynamic Multi-Path Resolution (`backend/src/config.js`)

To ensure reliability across varied deployment models (running from root, running inside `backend/`, Docker containers, or PM2 ecosystem), `config.js` searches candidate paths in order:

1. `process.env.ENV_FILE` (Custom manual override)
2. `path.resolve(process.cwd(), '.env.local')`
3. `path.resolve(process.cwd(), '.env')`
4. `path.resolve(backendDir, '.env')`
5. `path.resolve(rootDir, '.env')`

---

## 4. Automated Provisioning Tool

A built-in generator script is available to create all required `.env` files automatically and generate a fresh 256-bit cryptographically secure secret:

```bash
# Generate missing .env files
npm run setup:env

# Force regenerate with fresh secrets
npm run setup:env -- --force
```

---

## 5. Production VPS Deployment Checklist

When deploying to Ubuntu VPS (`103.216.168.84`):

1. **Clone Repository & Run Setup**:
   ```bash
   git clone https://github.com/techsavvymohan/amratgames.com.git /var/www/amratgames.com
   cd /var/www/amratgames.com
   npm run setup:env
   ```
2. **Update Production Settings in `.env`**:
   - Set `NODE_ENV=production`
   - Set `CORS_ORIGIN=https://amratgames.com`
   - Set `DEMO_OTP_BYPASS_ENABLED=false`
   - Set strong custom `ADMIN_PASSWORD` and `ADMIN_API_KEY`
   - Configure live SMTP credentials for `support@amratgames.com`
3. **Build Frontend**:
   ```bash
   cd frontend
   npm run build
   ```
4. **Launch Backend with PM2**:
   ```bash
   cd ../backend
   pm2 start src/server.js --name amratgames-backend -i max
   pm2 save
   ```

&copy; 2026 **AmratGames.com**. All Rights Reserved.
