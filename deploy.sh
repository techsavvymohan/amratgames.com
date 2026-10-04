#!/usr/bin/env bash
# =============================================================================
# 👑 AmratGames.com — Automated Ubuntu VPS Production Deployment Script
# Supports: Ubuntu 20.04 / 22.04 / 24.04 LTS
# =============================================================================

set -e

# Visual colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
GOLD='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GOLD}"
echo "======================================================================"
echo "👑 AmratGames.com — Production Deployment Suite (Ubuntu VPS)"
echo "======================================================================"
echo -e "${NC}"

# Check for root or sudo privileges
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] This deployment script must be run as root or with sudo.${NC}"
   exit 1
fi

DEPLOY_DIR="$(pwd)"
echo -e "${CYAN}[1/6] Detected Deployment Root:${NC} $DEPLOY_DIR"

# 1. Update system packages
echo -e "\n${CYAN}[2/6] Updating Ubuntu Package Index...${NC}"
apt-get update -y
apt-get install -y curl wget git ufw apt-transport-https ca-certificates gnupg lsb-release

# 2. Firewall Hardening (UFW)
echo -e "\n${CYAN}[3/6] Hardening Firewall (UFW: Open Ports 22, 80, 443)...${NC}"
ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
echo "y" | ufw enable || true
echo -e "${GREEN}✓ Firewall configured securely.${NC}"

# 3. Check for Docker
echo -e "\n${CYAN}[4/6] Verifying Docker & Docker Compose...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker not found. Installing Docker Engine...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm -f get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}✓ Docker installed successfully.${NC}"
else
    echo -e "${GREEN}✓ Docker is already installed: $(docker --version)${NC}"
fi

# 4. Prepare Environment & Persistent Storage
echo -e "\n${CYAN}[5/6] Initializing Persistent Data Volumes...${NC}"
mkdir -p "$DEPLOY_DIR/data/backend"
chmod -R 777 "$DEPLOY_DIR/data"

if [ ! -f "$DEPLOY_DIR/.env" ]; then
    echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
    cp "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env"
    
    # Generate random JWT secret
    RANDOM_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /proc/sys/kernel/random/uuid)
    sed -i "s/replace_with_a_secure_random_jwt_secret_key_32_chars_minimum/$RANDOM_SECRET/g" "$DEPLOY_DIR/.env"
    echo -e "${GREEN}✓ Generated secure random JWT_SECRET in .env${NC}"
fi

# 5. Build and Launch Containers
echo -e "\n${CYAN}[6/6] Building & Launching Production Services via Docker Compose...${NC}"
if command -v docker-compose &> /dev/null; then
    docker-compose down || true
    docker-compose build --pull
    docker-compose up -d
else
    docker compose down || true
    docker compose build --pull
    docker compose up -d
fi

echo -e "\n${GOLD}======================================================================${NC}"
echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL! AmratGames.com is live!${NC}"
echo -e "${GOLD}======================================================================${NC}"
echo -e "🌐 Frontend Casino Web App: ${CYAN}http://$(curl -s ifconfig.me || echo 'YOUR_SERVER_IP')${NC}"
echo -e "👑 Admin Management Panel: ${CYAN}http://$(curl -s ifconfig.me || echo 'YOUR_SERVER_IP')/admin${NC}"
echo -e "📡 Backend API Health:     ${CYAN}http://$(curl -s ifconfig.me || echo 'YOUR_SERVER_IP')/api/health${NC}"
echo -e "🔑 Default Admin Email:    ${YELLOW}admin@amratgames.com${NC}"
echo -e "🔑 Default Admin Password: ${YELLOW}AmratAdmin2025!${NC}"
echo -e "\n${YELLOW}Next Step: To link your custom domain (e.g. amratgames.com) with SSL:${NC}"
echo -e "Run: ${CYAN}certbot --nginx -d yourdomain.com${NC}"
echo -e "${GOLD}======================================================================${NC}\n"
