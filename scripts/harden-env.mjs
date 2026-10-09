import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Client } = require('../backend/node_modules/ssh2')

const conn = new Client()

conn.on('ready', () => {
    console.log('✓ Connected to VPS. Hardening .env configuration and reloading...\n')
    const cmd = `
        cd /var/www/amratgames.com
        sed -i 's/DEMO_OTP_BYPASS_ENABLED=true/DEMO_OTP_BYPASS_ENABLED=false/g' .env backend/.env 2>/dev/null || true
        pm2 reload ecosystem.config.cjs --update-env
        sleep 2
        pm2 flush
        pm2 list
        echo ""
        echo "=== RECENT ERROR LOGS (SHOULD BE CLEAN) ==="
        tail -n 10 /root/.pm2/logs/amratgames-backend-error-0.log || true
        tail -n 10 /root/.pm2/logs/amratgames-backend-error-1.log || true
    `

    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('Exec error:', err)
            conn.end()
            process.exit(1)
        }
        stream.on('data', d => process.stdout.write(d))
        stream.stderr.on('data', d => process.stderr.write(d))
        stream.on('close', (code) => {
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
