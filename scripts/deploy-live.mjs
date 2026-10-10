import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();
const localBundlePath = path.resolve('update_bundle.tar.gz');
const remoteBundlePath = '/var/www/amratgames.com/update_bundle.tar.gz';

conn.on('ready', () => {
    console.log('✓ Connected to VPS (103.216.168.84).');
    console.log('Uploading update_bundle.tar.gz via SFTP...');

    conn.sftp((err, sftp) => {
        if (err) {
            console.error('SFTP error:', err);
            conn.end();
            process.exit(1);
        }

        sftp.fastPut(localBundlePath, remoteBundlePath, {}, (uploadErr) => {
            if (uploadErr) {
                console.error('Upload error:', uploadErr);
                conn.end();
                process.exit(1);
            }

            console.log('✓ Bundle uploaded successfully. Extracting on remote server...\n');

            const cmd = `
                cd /var/www/amratgames.com
                tar -xzf /var/www/amratgames.com/update_bundle.tar.gz
                rm -f /var/www/amratgames.com/update_bundle.tar.gz
                
                echo "✓ Extracted updated frontend and backend."
                echo "Reloading Nginx..."
                nginx -t && systemctl reload nginx
                
                echo "Reloading PM2 cluster..."
                cd /var/www/amratgames.com
                pm2 reload ecosystem.config.cjs --update-env || true
                
                echo "Checking health endpoint..."
                curl -s http://127.0.0.1:3001/api/health
                echo ""
                echo "✓ PRODUCTION DEPLOYMENT FINISHED!"
            `;

            conn.exec(cmd, (execErr, stream) => {
                if (execErr) {
                    console.error('Exec error:', execErr);
                    conn.end();
                    process.exit(1);
                }

                stream.on('data', (d) => process.stdout.write(d));
                stream.stderr.on('data', (d) => process.stderr.write(d));
                stream.on('close', (code) => {
                    console.log(`\nRemote process exited with code ${code}`);
                    conn.end();
                    // Clean up local tar
                    try { fs.unlinkSync(localBundlePath); } catch {}
                    process.exit(code || 0);
                });
            });
        });
    });
});

conn.on('keyboard-interactive', (name, instr, lang, prompts, finish) => {
    finish(['Hj@KvB8*hDQv$j!Z']);
});

conn.on('error', (err) => {
    console.error('Connection error:', err.message);
    process.exit(1);
});

conn.connect({
    host: '103.216.168.84',
    port: 22,
    username: 'root',
    password: 'Hj@KvB8*hDQv$j!Z',
    tryKeyboard: true,
    readyTimeout: 60000,
    keepaliveInterval: 10000
});
