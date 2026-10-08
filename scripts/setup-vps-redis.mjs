import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Client } = require('../backend/node_modules/ssh2')

const conn = new Client()

console.log('👑 Connecting to VPS to install & configure Redis...')

conn.on('ready', () => {
    console.log('✓ Connected to VPS. Installing redis-server...\n')
    const cmd = `
        DEBIAN_FRONTEND=noninteractive apt-get update -y && \
        DEBIAN_FRONTEND=noninteractive apt-get install -y redis-server && \
        systemctl enable --now redis-server && \
        systemctl status redis-server --no-pager && \
        redis-cli ping
    `

    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('Exec error:', err)
            conn.end()
            process.exit(1)
        }
        stream.on('data', (d) => process.stdout.write(d))
        stream.stderr.on('data', (d) => process.stderr.write(d))
        stream.on('close', (code) => {
            console.log(`\nRedis setup script exited with code ${code}`)
            conn.end()
            process.exit(code === 0 ? 0 : 1)
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
