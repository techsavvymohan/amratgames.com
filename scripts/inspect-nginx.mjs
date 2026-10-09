import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Client } = require('../backend/node_modules/ssh2')

const conn = new Client()

conn.on('ready', () => {
    console.log('✓ Connected to VPS. Inspecting Nginx configuration...\n')
    const cmd = `
        echo "=== NGINX SITES ENABLED ==="
        ls -la /etc/nginx/sites-enabled/
        echo ""
        echo "=== SITE CONFIG CONTENT ==="
        cat /etc/nginx/sites-enabled/* 2>/dev/null
        echo ""
        echo "=== NGINX MAIN CONF (HTTP BLOCK) ==="
        cat /etc/nginx/nginx.conf
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
