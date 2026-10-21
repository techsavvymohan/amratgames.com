import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Client } = require('../backend/node_modules/ssh2')

const conn = new Client()

conn.on('ready', () => {
    console.log('✓ Connected to VPS. Verifying cluster logs and health...\n')
    const cmd = `
        sleep 2
        echo "=== 1. PM2 PROCESS LIST ==="
        pm2 list
        echo ""
        echo "=== 2. HTTP HEALTH CHECK ==="
        curl -s http://127.0.0.1:3001/api/health
        echo ""
        echo ""
        echo "=== 3. BACKEND INSTANCE 0 LOGS ==="
        tail -n 25 /root/.pm2/logs/amratgames-backend-out-0.log
        echo ""
        echo "=== 4. BACKEND INSTANCE 1 LOGS ==="
        tail -n 25 /root/.pm2/logs/amratgames-backend-out-1.log
        echo ""
        echo "=== 5. BACKEND ERROR LOGS ==="
        tail -n 15 /root/.pm2/logs/amratgames-backend-error-0.log || true
        tail -n 15 /root/.pm2/logs/amratgames-backend-error-1.log || true
    `

    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('Exec error:', err)
            conn.end()
            process.exit(1)
        }
        stream.on('data', (d) => process.stdout.write(d))
        stream.stderr.on('data', (d) => process.stderr.write(d))
        stream.on('close', () => {
            conn.end()
            process.exit(0)
        })
    })
})

conn.on('keyboard-interactive', (name, instr, lang, prompts, finish) => {
    finish([process.env.VPS_PASSWORD || ''])
})

conn.connect({
    host: '103.216.168.84',
    port: 22,
    username: 'root',
    password: process.env.VPS_PASSWORD || '',
    tryKeyboard: true
})
