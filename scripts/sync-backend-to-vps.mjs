import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const require = createRequire(path.join(rootDir, 'backend', 'package.json'));
const { Client } = require('ssh2');

const filesToSync = [
    'backend/src/admin-panel/controllers/AdminController.js',
    'backend/src/admin-panel/routes/admin.routes.js',
    'backend/src/gateways/PaymentGatewayManager.js',
    'backend/src/repositories/BetRepository.js',
    'backend/src/routes/__root.tsx',
    'backend/src/routes/index.tsx',
    'backend/src/routes/api-explorer.tsx',
    'backend/src/components/Header.tsx',
    'backend/src/components/Footer.tsx',
    'backend/public/manifest.json'
];

const conn = new Client();

conn.on('ready', () => {
    console.log('[✓] Connected to VPS via SSH');
    conn.sftp((err, sftp) => {
        if (err) {
            console.error('SFTP Error:', err);
            conn.end();
            process.exit(1);
        }

        let completed = 0;
        for (const relPath of filesToSync) {
            const localFile = path.join(rootDir, relPath);
            const remoteFile = `/var/www/amratgames.com/${relPath.replace(/\\/g, '/')}`;

            console.log(`[Uploading] ${relPath} -> ${remoteFile}`);
            sftp.fastPut(localFile, remoteFile, (putErr) => {
                if (putErr) {
                    console.error(`Error uploading ${relPath}:`, putErr);
                    conn.end();
                    process.exit(1);
                }
                completed++;
                if (completed === filesToSync.length) {
                    console.log('[✓] All modified backend files uploaded successfully.');
                    
                    conn.exec('pm2 reload amratgames-backend && pm2 status', (execErr, stream) => {
                        if (execErr) {
                            console.error('Exec error:', execErr);
                            conn.end();
                            process.exit(1);
                        }
                        stream.on('data', d => process.stdout.write(d));
                        stream.stderr.on('data', d => process.stderr.write(d));
                        stream.on('close', (code) => {
                            console.log(`\n[✓] amratgames-backend reloaded (exit code ${code})`);
                            conn.end();
                            process.exit(0);
                        });
                    });
                }
            });
        }
    });
});

conn.on('keyboard-interactive', (name, instr, lang, prompts, finish) => {
    finish(['Hj@KvB8*hDQv$j!Z']);
});

conn.connect({
    host: '103.216.168.84',
    port: 22,
    username: 'root',
    password: 'Hj@KvB8*hDQv$j!Z',
    tryKeyboard: true
});
