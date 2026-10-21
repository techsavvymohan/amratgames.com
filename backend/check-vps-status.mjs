import { Client } from 'ssh2'

const vpsPass = process.env.VPS_PASSWORD || ''
if (!vpsPass && !process.env.VPS_SSH_KEY) {
    console.error('[ERROR] VPS_PASSWORD environment variable is required.')
    process.exit(1)
}

const conn = new Client()
conn.on('keyboard-interactive', (n, i, l, p, f) => f([vpsPass]))
.on('ready', () => {
    conn.exec('pstree -p 1117 2>/dev/null || pgrep -P 1117 -a; ps aux --sort=-%cpu | head -n 8', (err, stream) => {
        stream.pipe(process.stdout)
        stream.on('close', () => conn.end())
    })
}).connect({
    host: process.env.VPS_HOST || '103.216.168.84',
    port: Number(process.env.VPS_PORT || 22),
    username: process.env.VPS_USERNAME || 'root',
    password: vpsPass,
    tryKeyboard: true
})
