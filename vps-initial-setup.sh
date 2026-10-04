#!/usr/bin/env bash
# ======================================================
# AmratGames.com Ubuntu VPS Initial Server Setup
# Run this on your Ubuntu VPS (103.216.168.84)
# ======================================================
set -e

echo "======================================================"
echo "👑 AmratGames.com Production Server Setup"
echo "======================================================"

# 1. Update system packages
apt update && apt upgrade -y
apt install -y curl git ufw nginx build-essential certbot python3-certbot-nginx

# 2. Install Node.js 22 LTS & pnpm & PM2
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pnpm pm2

# 3. Setup Firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 4. Clone AmratGames Repository
mkdir -p /var/www/amratgames.com
if [ ! -d "/var/www/amratgames.com/.git" ]; then
    git clone https://github.com/techsavvymohan/amratgames.com.git /var/www/amratgames.com
fi

cd /var/www/amratgames.com
git fetch origin main
git reset --hard origin/main

# 5. Install & Build
pnpm install
pnpm --filter ./frontend build

# 6. Authorize Deployment SSH Key
mkdir -p ~/.ssh
grep -q "admin@amratgames.com" ~/.ssh/authorized_keys 2>/dev/null || echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMWMgyrtC0irJucN/WHj/AOxFhSuYabiacuUBwvB47qO admin@amratgames.com" >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys

# 7. Setup Production .env if missing
if [ ! -f "/var/www/amratgames.com/.env" ]; then
    cp /var/www/amratgames.com/.env.example /var/www/amratgames.com/.env
    echo "NODE_ENV=production" >> /var/www/amratgames.com/.env
    echo "PORT=3001" >> /var/www/amratgames.com/.env
fi

# 8. Setup PM2 Daemon
pm2 start backend/src/server.js --name "amratgames-backend" 2>/dev/null || pm2 restart amratgames-backend
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# 9. Configure Nginx Virtual Host
cat << 'EOF' > /etc/nginx/sites-available/amratgames.com
server {
    listen 80;
    listen [::]:80;
    server_name amratgames.com www.amratgames.com 103.216.168.84;

    root /var/www/amratgames.com/frontend/dist;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Frontend Single Page App (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend REST API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend WebSocket Feed
    location /ws {
        proxy_pass http://127.0.0.1:3001/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/amratgames.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "======================================================"
echo "✓ AMRATGAMES.COM PRODUCTION SETUP COMPLETE!"
echo "🌐 Frontend: http://103.216.168.84 or http://amratgames.com"
echo "⚡ Backend:  http://103.216.168.84/api/health"
echo "📡 WebSocket: ws://103.216.168.84/ws"
echo "======================================================"
