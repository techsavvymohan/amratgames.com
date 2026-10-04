# AmratGames.com — Environment Variable (.env) Architecture & Operational Guide

This document specifies the centralized environment variable architecture implemented for **AmratGames.com**, designed for secure local development and seamless **Ubuntu VPS (Nginx + PM2 + Docker)** deployment.

---

## 1. System Topology & Separation of Concerns

The project employs a three-tier environment configuration:

```
amratgames.com/
│
├── .env.example              # [Master Template] Complete system variable blueprint
├── .env                      # [Master Config] Root-level deployment variables
│
├── scripts/
│   └── setup-env.js          # [Provisioning CLI] Cryptographic secret generator & sync
│
├── backend/
│   ├── .env.example          # [Backend Template] Node.js & WebSocket service config
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
> Sensitive credentials (`JWT_SECRET`, `ADMIN_PASSWORD`, SMS provider tokens, crypto cold storage keys) **only** exist in backend/root `.env` files.
> The frontend bundle only exposes variables prefixed with `VITE_` (per Vite specifications). Backend secrets are never bundled or transmitted to the client.

---

## 2. Configuration Breakdown

### 2.1 Backend / Server Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | Set to `production` on Ubuntu VPS to enforce security guards |
| `PORT` | `3001` | Express & WebSocket HTTP listening port |
| `HOST` | `0.0.0.0` | Bind IP (`0.0.0.0` binds all interfaces, suitable for VPS) |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origins for browser AJAX & WebSockets |
| `DATA_DIR` | `./data` | File-system path where JSON database and state persist |
| `DB_FILE` | `amratgames_db.json` | Database filename |
| `JWT_SECRET` | *(64-char crypto hex)* | 256-bit cryptographically secure token signing key |
| `JWT_EXPIRES_IN` | `7d` | Player session duration |
| `ADMIN_DEFAULT_EMAIL` | `admin@amratgames.com`| Master Admin Portal root login |
| `ADMIN_DEFAULT_PASSWORD` | *(Secure passphrase)* | Master Admin Portal root password |
| `ADMIN_DEFAULT_PHONE` | `9876500001` | Master Admin Mobile Number |
| `SMS_GATEWAY_PROVIDER` | `mock` | SMS Dispatcher (`mock`, `msg91`, `fast2sms`, `twilio`) |
| `DEMO_OTP_BYPASS_ENABLED` | `true` | Allows instant QA login via bypass code (`false` in production) |
| `DEMO_OTP_CODE` | `777777` | Universal bypass verification OTP for fast testing |
| `UPI_MERCHANT_VPA` | `amratgames@upi` | Indian Virtual Payment Address for instant deposits |
| `UPI_MERCHANT_NAME` | `AmratGames India` | Merchant display title on PhonePe / GPay / Paytm |
| `DEFAULT_RTP` | `99.0` | Default Return-To-Player casino percentage |
| `HOUSE_EDGE` | `1.0` | House edge percentage |
| `TOKEN_SYMBOL` | `AMRAT` | Native gaming token ticker |

### 2.2 Frontend (Vite) Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:3001/api` | Base REST API URL |
| `VITE_WS_URL` | `ws://localhost:3001/ws` | Live WebSocket endpoint (Bets, Chat, Ticker) |
| `VITE_APP_NAME` | `AmratGames.com` | Brand title displayed across the app |
| `VITE_DEFAULT_CURRENCY` | `INR` | Default player display currency (`INR`, `USDT`, `AMRAT`) |
| `VITE_UPI_ID` | `amratgames@upi` | UPI ID rendered in QR modal for deposits |

---

## 3. Dynamic Multi-Path Resolution (`backend/src/config.js`)

To ensure reliability across varied deployment models (running from root, running inside `backend/`, Docker containers, or PM2 ecosystem), `config.js` searches candidate paths in order:

1. `process.env.ENV_FILE` (Custom manual override)
2. `path.resolve(process.cwd(), '.env.local')`
3. `path.resolve(process.cwd(), '.env')`
4. `path.resolve(__dirname, '../.env')`
5. `path.resolve(__dirname, '../../.env')`

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

## 5. Ubuntu VPS Production Checklist

When deploying to Ubuntu VPS:

1. **Clone Repository & Run Setup**:
   ```bash
   git clone <repo-url> /var/www/amratgames.com
   cd /var/www/amratgames.com
   npm run setup:env
   ```
2. **Update Production Settings in `.env`**:
   - Set `NODE_ENV=production`
   - Set `CLIENT_ORIGIN=https://amratgames.com`
   - Set `DEMO_OTP_BYPASS_ENABLED=false`
   - Set strong custom `ADMIN_PASSWORD`
   - Configure real SMS API credentials (`MSG91_AUTH_KEY` or `FAST2SMS_API_KEY`)
3. **Build Frontend**:
   ```bash
   pnpm run build
   ```
4. **Launch Backend with PM2**:
   ```bash
   pm2 start backend/src/server.js --name amrat-backend -i max
   pm2 save
   ```
