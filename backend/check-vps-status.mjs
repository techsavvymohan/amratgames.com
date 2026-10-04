import { Client } from 'ssh2'

const conn = new Client()
conn.on('keyboard-interactive', (n, i, l, p, f) => f(['Hj@KvB8*hDQv$j!Z']))
.on('ready', () => {
    conn.exec('pstree -p 1117 2>/dev/null || pgrep -P 1117 -a; ps aux --sort=-%cpu | head -n 8', (err, stream) => {
        stream.pipe(process.stdout)
        stream.on('close', () => conn.end())
    })
}).connect({
    host: '103.216.168.84',
    port: 22,
    username: 'root',
    password: 'Hj@KvB8*hDQv$j!Z',
    tryKeyboard: true
})
