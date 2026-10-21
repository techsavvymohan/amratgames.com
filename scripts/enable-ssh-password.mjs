import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { Client } = require('../backend/node_modules/ssh2')

const conn = new Client()
conn.on('ready', () => {
    console.log('✓ Connected to VPS. Updating sshd configuration...')
    const cmd = `
        sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/g' /etc/ssh/sshd_config.d/*.conf 2>/dev/null || true
        sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/g' /etc/ssh/sshd_config 2>/dev/null || true
        sshd -t && systemctl reload ssh || systemctl reload sshd
        echo "✓ SSH configuration reloaded. Current PasswordAuthentication setting:"
        grep -E 'PasswordAuthentication' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/* 2>/dev/null || true
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
