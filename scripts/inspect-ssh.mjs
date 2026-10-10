import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { Client } = require('../backend/node_modules/ssh2')

const conn = new Client()
conn.on('ready', () => {
    const cmd = `
        echo "=== /root/.ssh DIRECTORY ==="
        ls -la /root/.ssh 2>/dev/null || echo "Directory /root/.ssh does not exist"
        echo ""
        echo "=== AUTHORIZED KEYS ==="
        if [ -f /root/.ssh/authorized_keys ]; then
            cat /root/.ssh/authorized_keys
        else
            echo "No authorized_keys file!"
        fi
        echo "=== IMAGES ON VPS ==="
        ls -la /var/www/amratgames.com/frontend/dist/images/coin-toss/ 2>/dev/null || echo "Directory does not exist!"
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
