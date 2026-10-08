#!/usr/bin/env bash
# =============================================================================
# 👑 AmratGames.com — Zero-Downtime VPS Deployment Script
# Target: Ubuntu VPS (/var/www/amratgames.com)
# Stack: Node.js 22 LTS, pnpm, PM2, Nginx
# =============================================================================

set -e

# Visual colors
RED='\033[0;31m'
GREEN='\033[0;32m'
GOLD='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GOLD}======================================================================${NC}"
echo -e "${GOLD}👑 AmratGames.com — Production Deployment In Progress${NC}"
echo -e "${GOLD}======================================================================${NC}"

# 1. Resolve Application Directory
APP_DIR="/var/www/amratgames.com"
if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}[ERROR] Application directory $APP_DIR does not exist!${NC}"
    exit 1
fi
cd "$APP_DIR"
echo -e "${CYAN}[1/7] Working directory:${NC} $(pwd)"

# 2. Ensure PATH includes Node.js, pnpm, pm2, and nvm if present
export PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/root/.local/share/pnpm:/root/.nvm/versions/node/$(ls /root/.nvm/versions/node 2>/dev/null | tail -n 1)/bin"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
fi

echo -e "${CYAN}[2/7] Verifying toolchain:${NC}"
echo "      Node:  $(node -v 2>/dev/null || echo 'not found')"
echo "      pnpm:  $(pnpm -v 2>/dev/null || echo 'not found')"
echo "      PM2:   $(pm2 -v 2>/dev/null || echo 'not found')"

# 3. Pull Latest Code from GitHub
echo -e "\n${CYAN}[3/7] Fetching latest production commits from origin/main...${NC}"
git fetch origin main
git reset --hard origin/main

COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B | head -n 1)
echo -e "${GREEN}✓ Synced to commit: ${COMMIT_HASH} - \"${COMMIT_MSG}\"${NC}"

# 4. Install Dependencies
echo -e "\n${CYAN}[4/7] Installing production dependencies with pnpm...${NC}"
pnpm install --frozen-lockfile

# 5. Build Frontend Assets
echo -e "\n${CYAN}[5/7] Building high-performance Vite frontend bundle...${NC}"
pnpm --filter ./frontend build
echo -e "${GREEN}✓ Frontend built successfully.${NC}"

# 6. Graceful PM2 Backend Reload
echo -e "\n${CYAN}[6/7] Reloading backend cluster via PM2...${NC}"
if pm2 describe amratgames-backend > /dev/null 2>&1; then
    pm2 reload ecosystem.config.cjs --update-env
elif pm2 describe amrat-backend > /dev/null 2>&1; then
    pm2 reload amrat-backend --update-env
else
    pm2 start ecosystem.config.cjs
fi
pm2 save

# 7. Validate Nginx and Reload
echo -e "\n${CYAN}[7/7] Validating and reloading Nginx reverse proxy...${NC}"
if command -v nginx > /dev/null 2>&1; then
    nginx -t
    systemctl reload nginx
    echo -e "${GREEN}✓ Nginx reloaded cleanly.${NC}"
fi

# 8. Automated API Health Check
echo -e "\n${CYAN}[Verifying] Polling backend health endpoint (http://127.0.0.1:3001/api/health)...${NC}"
HEALTH_PASSED=false
for i in {1..10}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health || true)
    if [ "$HTTP_CODE" = "200" ]; then
        HEALTH_PASSED=true
        break
    fi
    echo "      Attempt $i/10: Backend status $HTTP_CODE, waiting 2s..."
    sleep 2
done

if [ "$HEALTH_PASSED" = true ]; then
    echo -e "${GREEN}✓ Backend health check passed (HTTP 200)!${NC}"
else
    echo -e "${RED}[ERROR] Backend health check failed after 10 attempts! Checking PM2 logs:${NC}"
    pm2 logs amratgames-backend --lines 20 --nostream || true
    exit 1
fi

echo -e "\n${GOLD}======================================================================${NC}"
echo -e "${GREEN}🚀 PRODUCTION DEPLOYMENT COMPLETE FOR COMMIT ${COMMIT_HASH}!${NC}"
echo -e "${GOLD}======================================================================${NC}"
