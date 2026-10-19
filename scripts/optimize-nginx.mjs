import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Client } = require('../backend/node_modules/ssh2')

const conn = new Client()

const optimizedNginxConfig = `
upstream amrat_backend_cluster {
    server 127.0.0.1:3001;
    keepalive 64;
}

upstream youpi_api_cluster {
    server 127.0.0.1:6100;
    keepalive 32;
}

upstream youpi_checkout_cluster {
    server 127.0.0.1:7000;
    keepalive 32;
}

upstream youpi_admin_cluster {
    server 127.0.0.1:6001;
    keepalive 32;
}

server {
    server_name amratgames.com www.amratgames.com 103.216.168.84;

    root /var/www/amratgames.com/frontend/dist;
    index index.html;

    # Security & Integrity Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # High-Performance Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/x-javascript
        application/xml
        application/xml+rss
        image/svg+xml;

    # ── YouPI-PG Sovereign UPI Payment Gateway Reverse Proxy ──
    # Customer Checkout UI (/checkout/:id)
    location ^~ /checkout/ {
        proxy_pass http://youpi_checkout_cluster/checkout/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # Checkout Client SDK Script (/youpi.js)
    location = /youpi.js {
        proxy_pass http://youpi_checkout_cluster/youpi.js;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Dynamic QR and Banking App Icons (/icons/*)
    location ^~ /icons/ {
        proxy_pass http://youpi_checkout_cluster/icons/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 1d;
    }

    # Gateway REST API & Checkout State Polling (/api/v1/*)
    location ^~ /api/v1/ {
        proxy_pass http://youpi_api_cluster/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
    }

    # Merchant Admin Dashboard & Observer Hub (/youpi-admin/*)
    location ^~ /youpi-admin/ {
        proxy_pass http://youpi_admin_cluster/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static Assets Long-Term Caching (1 Year Immutable)
    location ~* \\.(?:css|js|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|webp)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # SPA Routing Fallback (Prevent stale browser caching of index.html)
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
    }

    # High-Throughput API Reverse Proxy with Keep-Alive Pooling
    location /api/ {
        proxy_pass http://amrat_backend_cluster;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering on;
        proxy_buffers 16 16k;
        proxy_buffer_size 16k;
    }

    # Low-Latency WebSocket Reverse Proxy
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

    # SSL Configuration (HTTP/2 Enabled)
    listen [::]:443 ssl http2 ipv6only=on; # managed by Certbot
    listen 443 ssl http2; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/amratgames.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/amratgames.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = www.amratgames.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    if ($host = amratgames.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    listen [::]:80;
    server_name amratgames.com www.amratgames.com 103.216.168.84;
    return 301 https://$host$request_uri;
}
`

conn.on('ready', () => {
    console.log('✓ Connected to VPS. Applying high-performance Nginx configuration...\n')
    
    const b64 = Buffer.from(optimizedNginxConfig).toString('base64')
    const updateCmd = `
        cp /etc/nginx/sites-available/amratgames.com /etc/nginx/sites-available/amratgames.com.bak 2>/dev/null || true
        echo "${b64}" | base64 -d > /etc/nginx/sites-available/amratgames.com
        nginx -t
        systemctl reload nginx
        echo "✓ Nginx reloaded successfully with HTTP/2 and Keepalive connection pool!"
    `

    conn.exec(updateCmd, (err, stream) => {
        if (err) {
            console.error('Exec error:', err)
            conn.end()
            process.exit(1)
        }
        stream.on('data', d => process.stdout.write(d))
        stream.stderr.on('data', d => process.stderr.write(d))
        stream.on('close', (code) => {
            console.log(`Command exited with code ${code}`)
            conn.end()
            process.exit(code || 0)
        })
    })
})

conn.on('keyboard-interactive', (name, instr, lang, prompts, finish) => {
    finish(['Hj@KvB8*hDQv$j!Z'])
})

conn.connect({
    host: '103.216.168.84',
    port: 22,
    username: 'root',
    password: 'Hj@KvB8*hDQv$j!Z',
    tryKeyboard: true
})
