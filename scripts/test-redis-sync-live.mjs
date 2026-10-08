import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Client } = require('../backend/node_modules/ssh2')

const conn = new Client()

conn.on('ready', () => {
    console.log('✓ Connected to VPS. Testing Redis Pub/Sub cross-worker synchronization...\n')
    const cmd = `
        echo "=== 1. REDIS CLI PUB/SUB SUBSCRIPTION & PUBLISH TEST ==="
        redis-cli publish amrat:chat '{"type":"CHAT_MESSAGE","payload":{"id":"test-redis-sync-123","user":"SystemAudit","text":"Redis Pub/Sub Sync Verification","time":"2026-10-08T08:17:00.000Z"},"_senderWorker":"test_cli"}'
        
        echo ""
        echo "=== 2. QUERY LIVE CHAT MESSAGES FROM API (CLUSTER INSTANCE) ==="
        curl -s http://127.0.0.1:3001/api/chat/messages | head -c 300
        echo ""

        echo ""
        echo "=== 3. CHECK INSTANCE LOGS FOR REDIS EVENT INGESTION ==="
        tail -n 15 /root/.pm2/logs/amratgames-backend-out-0.log
        tail -n 15 /root/.pm2/logs/amratgames-backend-out-1.log
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
