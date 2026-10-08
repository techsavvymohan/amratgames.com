import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Client } = require('../backend/node_modules/ssh2')

const conn = new Client()

conn.on('ready', () => {
    console.log('✓ Connected to VPS. Switching PM2 to multi-instance cluster mode...\n')
    const cmd = `
        cd /var/www/amratgames.com
        echo "=== Reloading ecosystem with PM2 cluster mode ==="
        pm2 delete amratgames-backend || true
        pm2 start ecosystem.config.cjs
        pm2 save
        echo ""
        echo "=== PM2 STATUS ==="
        pm2 list
        echo ""
        echo "=== RECENT BACKEND LOGS ==="
        pm2 logs amratgames-backend --lines 40 --nostream
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
    finish(['Hj@KvB8*hDQv$j!Z'])
})

conn.connect({
    host: '103.216.168.84',
    port: 22,
    username: 'root',
    password: 'Hj@KvB8*hDQv$j!Z',
    tryKeyboard: true
})
