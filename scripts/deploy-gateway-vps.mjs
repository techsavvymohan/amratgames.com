import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const gatewaySourceDir = path.resolve(projectRoot, '../gateway-service/youpi-pg');

const require = createRequire(import.meta.url);
const { Client } = require('../backend/node_modules/ssh2');

const VPS_HOST = process.env.VPS_HOST || '103.216.168.84';
const VPS_PORT = Number(process.env.VPS_PORT || 22);
const VPS_USER = process.env.VPS_USERNAME || 'root';
const VPS_PASS = process.env.VPS_PASSWORD || '';
if (!VPS_PASS && !process.env.VPS_SSH_KEY) {
  console.error('[ERROR] VPS_PASSWORD or VPS_SSH_KEY environment variable is required.');
  process.exit(1);
}

const localTarPath = path.resolve(projectRoot, 'gateway_deploy_bundle.tar.gz');
const remoteDestDir = '/var/www/gateway-service/youpi-pg';
const remoteTarPath = '/tmp/gateway_deploy_bundle.tar.gz';

console.log('======================================================================');
console.log('🚀 YOUPI-PG PAYMENT GATEWAY — PRODUCTION VPS DEPLOYMENT');
console.log(`Target VPS: ${VPS_USER}@${VPS_HOST}:${remoteDestDir}`);
console.log('======================================================================\n');

// Step 1: Pack lightweight source tarball (excluding node_modules, git, heavy mp4/gif demos)
console.log('[1/5] Creating lightweight gateway bundle from:', gatewaySourceDir);
try {
  if (fs.existsSync(localTarPath)) {
    fs.unlinkSync(localTarPath);
  }

  // Use system tar with strict exclusions to ensure tiny 2MB payload
  execSync(
    `tar -czf "${localTarPath}" --exclude="node_modules" --exclude=".git" --exclude="*.mp4" --exclude="*.gif" --exclude="data/test_*" -C "${gatewaySourceDir}" .`,
    { stdio: 'inherit' }
  );

  const stats = fs.statSync(localTarPath);
  console.log(`[✓] Gateway bundle created: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);
} catch (err) {
  console.error('[ERROR] Failed to package gateway bundle:', err.message);
  process.exit(1);
}

// Step 2: Connect via SSH
console.log(`[2/5] Connecting to VPS (${VPS_HOST})...`);
const conn = new Client();

conn.on('ready', () => {
  console.log('[✓] SSH connection established. Starting SFTP upload...');

  conn.sftp((sftpErr, sftp) => {
    if (sftpErr) {
      console.error('[ERROR] SFTP initialization failed:', sftpErr.message);
      conn.end();
      cleanupLocalTar();
      process.exit(1);
    }

    console.log(`[3/5] Uploading ${localTarPath} -> ${remoteTarPath}...`);
    sftp.fastPut(localTarPath, remoteTarPath, {}, (uploadErr) => {
      if (uploadErr) {
        console.error('[ERROR] File upload failed:', uploadErr.message);
        conn.end();
        cleanupLocalTar();
        process.exit(1);
      }

      console.log('[✓] Gateway bundle uploaded successfully.\n');
      console.log('[4/5] Executing remote installation & PM2 orchestration on VPS:');

      // Step 3: Remote extraction, dependency install, DB sync, and PM2 start
      const remoteScript = `
        set -e
        export PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/root/.local/share/pnpm:/root/.nvm/versions/node/$(ls /root/.nvm/versions/node 2>/dev/null | tail -n 1)/bin"
        if [ -s "$HOME/.nvm/nvm.sh" ]; then
          source "$HOME/.nvm/nvm.sh"
        fi

        echo "▶ Setting up directory structure at ${remoteDestDir}..."
        mkdir -p "${remoteDestDir}"
        mkdir -p "${remoteDestDir}/data"
        mkdir -p "${remoteDestDir}/logs"

        echo "▶ Extracting gateway bundle..."
        tar -xzf "${remoteTarPath}" -C "${remoteDestDir}"
        rm -f "${remoteTarPath}"

        cd "${remoteDestDir}"

        echo "▶ Ensuring proper permissions..."
        chmod +x start.sh scripts/*.js 2>/dev/null || true

        echo "▶ Installing Node.js production dependencies..."
        npm install --omit=dev --no-audit --no-fund

        echo "▶ Synchronizing Merchant receiving account & dynamic VPA into SQLite DB..."
        node scripts/sync-merchant-vpa.js

        echo "▶ Orchestrating PM2 microservices (youpi-payment-api, youpi-checkout-portal, youpi-merchant-admin)..."
        if pm2 describe youpi-payment-api > /dev/null 2>&1; then
          echo "  - Reloading existing PM2 cluster with updated environment..."
          pm2 reload ecosystem.config.cjs --update-env
        else
          echo "  - Starting new PM2 cluster..."
          pm2 start ecosystem.config.cjs
        fi
        pm2 save

        echo ""
        echo "▶ Verifying gateway internal health endpoints..."
        sleep 2
        curl -s http://127.0.0.1:6100/api/v1/health || echo "[-] Warning: API health check timed out"
        echo ""
        curl -s http://127.0.0.1:7000/health || echo "[-] Warning: Checkout health check timed out"
        echo ""
      `;

      conn.exec(remoteScript, (execErr, stream) => {
        if (execErr) {
          console.error('[ERROR] Remote execution failed:', execErr.message);
          conn.end();
          cleanupLocalTar();
          process.exit(1);
        }

        stream.on('data', (d) => process.stdout.write(d));
        stream.stderr.on('data', (d) => process.stderr.write(d));

        stream.on('close', (code) => {
          console.log('\n======================================================================');
          if (code === 0) {
            console.log('✅ YOUPI-PG PAYMENT GATEWAY DEPLOYED SUCCESSFULLY TO VPS!');
            console.log('• Payment API Core:       http://127.0.0.1:6100 (Internal)');
            console.log('• Customer Checkout:      http://127.0.0.1:7000 (Internal / Nginx proxied)');
            console.log('• Merchant Admin:         http://127.0.0.1:6001 (Internal)');
            console.log('• Active Receiving VPA:   shanviientrrprisee@ybl');
          } else {
            console.error(`[ERROR] Remote execution exited with code ${code}`);
          }
          console.log('======================================================================\n');
          conn.end();
          cleanupLocalTar();
          process.exit(code || 0);
        });
      });
    });
  });
});

conn.on('keyboard-interactive', (name, instr, lang, prompts, finish) => {
  finish([VPS_PASS]);
});

conn.on('error', (err) => {
  console.error('[ERROR] Connection error:', err.message);
  cleanupLocalTar();
  process.exit(1);
});

function cleanupLocalTar() {
  try {
    if (fs.existsSync(localTarPath)) {
      fs.unlinkSync(localTarPath);
    }
  } catch {}
}

conn.connect({
  host: VPS_HOST,
  port: VPS_PORT,
  username: VPS_USER,
  password: VPS_PASS,
  tryKeyboard: true,
  readyTimeout: 60000,
  keepaliveInterval: 10000
});
