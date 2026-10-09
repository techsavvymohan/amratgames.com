import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Client } = require('../backend/node_modules/ssh2')

const conn = new Client()

conn.on('ready', () => {
    console.log('✓ Connected to VPS. Benchmarking live performance...\n')
    const cmd = `
        echo "=== 1. API RESPONSE TIME & COMPRESSION (CURL WITH GZIP) ==="
        curl -s -I -H "Accept-Encoding: gzip" http://127.0.0.1:3001/api/health
        echo ""
        
        echo "=== 2. LOCAL API LATENCY (3 PROBES) ==="
        for i in 1 2 3; do
            curl -o /dev/null -s -w "Probe $i: HTTP %{http_code} | Total time: %{time_total}s | Connect: %{time_connect}s | TTFB: %{time_starttransfer}s\n" http://127.0.0.1:3001/api/health
        done
        echo ""

        echo "=== 3. NGINX HTTPS HTTP/2 & ASSET CACHING HEADERS ==="
        curl -s -I https://amratgames.com/index.html | head -n 12
        echo ""

        echo "=== 4. PM2 CLUSTER WORKER HEALTH ==="
        pm2 list
        echo ""

        echo "=== 5. REDIS CACHE STATS ==="
        redis-cli keys "cache:*"
        echo ""
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
