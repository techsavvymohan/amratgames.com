import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

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

const frontendDist = path.resolve(projectRoot, 'frontend', 'dist');
const localTarPath = path.resolve(projectRoot, 'frontend_dist.tar.gz');
const remoteDestDir = '/var/www/amratgames.com/frontend/dist';
const remoteTarPath = '/tmp/frontend_dist.tar.gz';

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║   🚀 DEPLOYING CLOUDINARY FRONTEND BUNDLE TO PRODUCTION VPS   ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log(`Target VPS: ${VPS_USER}@${VPS_HOST}:${remoteDestDir}\n`);

// 1. Package frontend dist
console.log('[1/4] Packaging frontend/dist into compressed bundle...');
if (fs.existsSync(localTarPath)) {
    try { fs.unlinkSync(localTarPath); } catch {}
}

execSync(`tar -czf "${localTarPath}" -C "${frontendDist}" .`, { stdio: 'inherit' });
const stats = fs.statSync(localTarPath);
console.log(`[✓] Bundle packaged: ${(stats.size / 1024).toFixed(1)} KB\n`);

// 2. Connect via SSH
console.log('[2/4] Connecting to VPS via SSH & SFTP...');
const conn = new Client();

function cleanup() {
    try { if (fs.existsSync(localTarPath)) fs.unlinkSync(localTarPath); } catch {}
}

conn.on('ready', () => {
    console.log('[✓] SSH connection established.');
    console.log('[3/4] Uploading frontend_dist.tar.gz via SFTP...');

    conn.sftp((sftpErr, sftp) => {
        if (sftpErr) {
            console.error('[ERROR] SFTP initialization failed:', sftpErr.message);
            cleanup();
            conn.end();
            process.exit(1);
        }

        sftp.fastPut(localTarPath, remoteTarPath, {}, (uploadErr) => {
            if (uploadErr) {
                console.error('[ERROR] SFTP upload failed:', uploadErr.message);
                cleanup();
                conn.end();
                process.exit(1);
            }

            console.log('[✓] Upload completed. Extracting on remote server...\n');

            const remoteCommands = [
                `mkdir -p "${remoteDestDir}"`,
                `tar -xzf "${remoteTarPath}" -C "${remoteDestDir}"`,
                `rm -f "${remoteTarPath}"`,
                `cd /var/www/amratgames.com && git pull origin main`,
                `nginx -t && systemctl reload nginx`,
                `pm2 reload amratgames-backend 2>/dev/null || true`,
                `echo "Deployment finished successfully."`
            ].join(' && ');

            console.log('[4/4] Executing remote deployment script...');
            conn.exec(remoteCommands, (execErr, stream) => {
                if (execErr) {
                    console.error('[ERROR] Execution failed:', execErr.message);
                    cleanup();
                    conn.end();
                    process.exit(1);
                }

                stream.on('data', (data) => process.stdout.write(data));
                stream.stderr.on('data', (data) => process.stderr.write(data));

                stream.on('close', (code) => {
                    cleanup();
                    conn.end();
                    if (code === 0) {
                        console.log('\n✨ PRODUCTION DEPLOYMENT SUCCEEDED (Exit Code: 0)');
                        process.exit(0);
                    } else {
                        console.error(`\n❌ Deployment failed with code ${code}`);
                        process.exit(code || 1);
                    }
                });
            });
        });
    });
});

conn.on('keyboard-interactive', (name, instr, lang, prompts, finish) => {
    finish([VPS_PASS]);
});

conn.on('error', (err) => {
    console.error('[ERROR] SSH connection error:', err.message);
    cleanup();
    process.exit(1);
});

conn.connect({
    host: VPS_HOST,
    port: VPS_PORT,
    username: VPS_USER,
    password: VPS_PASS,
    tryKeyboard: true,
    readyTimeout: 60000,
    keepaliveInterval: 10000
});
