import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Client } = require('../backend/node_modules/ssh2')

const conn = new Client()

conn.on('ready', () => {
    console.log('✓ Connected to VPS. Inspecting performance architecture...\n')
    const cmd = `
        echo "=== 1. NGINX SITES CONFIGURATION ==="
        cat /etc/nginx/sites-available/* 2>/dev/null || cat /etc/nginx/conf.d/* 2>/dev/null
        echo ""
        echo "=== 2. NGINX GZIP & HTTP OPTIMIZATIONS ==="
        grep -E "gzip|keepalive|worker" /etc/nginx/nginx.conf 2>/dev/null || true
        echo ""
        echo "=== 3. REDIS PERFORMANCE STATS ==="
        redis-cli info stats | grep -E "total_connections_received|total_commands_processed|instantaneous_ops_per_sec|rejected_connections"
        redis-cli info memory | grep -E "used_memory_human|used_memory_peak_human|maxmemory_human"
        echo ""
        echo "=== 4. PM2 DETAILED CLUSTER RUNTIME ==="
        pm2 prettylist
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
