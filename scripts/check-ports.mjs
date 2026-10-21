import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
    const cmd = `
        echo "=== SS -TLPN ==="
        ss -tlpn
        echo "=== CURL 3000 & 3001 ==="
        curl -s http://127.0.0.1:3000/api/health || echo "Port 3000 failed"
        echo ""
        curl -s http://127.0.0.1:3001/api/health || echo "Port 3001 failed"
        echo ""
        echo "=== PM2 LOGS RECENT ==="
        pm2 logs --lines 15 --nostream
    `;
    conn.exec(cmd, (err, stream) => {
        if (err) { console.error(err); process.exit(1); }
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', () => { conn.end(); process.exit(0); });
    });
});
conn.connect({
    host: '103.216.168.84',
    port: 22,
    username: 'root',
    password: process.env.VPS_PASSWORD || '',
    tryKeyboard: true
});
