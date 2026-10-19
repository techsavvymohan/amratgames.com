#!/usr/bin/env bash
# =============================================================================
# 👑 YouPI-PG Gateway — Linux VPS Deployment & Management Script
# Location on VPS: /var/www/gateway-service/youpi-pg
# =============================================================================

set -e

# Visual colors
RED='\033[0;31m'
GREEN='\033[0;32m'
GOLD='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

GATEWAY_DIR="/var/www/gateway-service/youpi-pg"

echo -e "${GOLD}======================================================================${NC}"
echo -e "${GOLD}🚀 YouPI-PG Sovereign UPI Payment Gateway — Deployment & Sync${NC}"
echo -e "${GOLD}======================================================================${NC}"

if [ ! -d "$GATEWAY_DIR" ]; then
    echo -e "${RED}[ERROR] Gateway directory $GATEWAY_DIR does not exist!${NC}"
    exit 1
fi

cd "$GATEWAY_DIR"

# Ensure PATH includes Node.js and PM2
export PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/root/.local/share/pnpm:/root/.nvm/versions/node/$(ls /root/.nvm/versions/node 2>/dev/null | tail -n 1)/bin"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
fi

echo -e "${CYAN}[1/4] Verifying Node.js & PM2 environment...${NC}"
echo "      Node: $(node -v 2>/dev/null || echo 'not found')"
echo "      PM2:  $(pm2 -v 2>/dev/null || echo 'not found')"

echo -e "\n${CYAN}[2/4] Installing dependencies...${NC}"
npm install --omit=dev --no-audit --no-fund

echo -e "\n${CYAN}[3/4] Synchronizing receiving VPA & webhook secret from .env into SQLite...${NC}"
node scripts/sync-merchant-vpa.js

echo -e "\n${CYAN}[4/4] Starting/Reloading PM2 microservices...${NC}"
if pm2 describe youpi-payment-api > /dev/null 2>&1; then
    echo "      Reloading existing PM2 cluster..."
    pm2 reload ecosystem.config.cjs --update-env
else
    echo "      Starting new PM2 cluster..."
    pm2 start ecosystem.config.cjs
fi
pm2 save

echo -e "\n${CYAN}[Verifying] Probing local endpoints...${NC}"
curl -s http://127.0.0.1:6100/api/v1/health || true
echo ""
curl -s http://127.0.0.1:7000/health || true
echo ""

echo -e "\n${GOLD}======================================================================${NC}"
echo -e "${GREEN}✅ YOUPI-PG GATEWAY IS ACTIVE ON VPS!${NC}"
echo -e "${GOLD}======================================================================${NC}"
