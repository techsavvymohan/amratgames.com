import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Client } = require('../backend/node_modules/ssh2')

const conn = new Client()

conn.on('ready', () => {
    console.log('✓ Connected to VPS. Running diagnostic inspection...\n')
    const cmd = `
        echo "=== 1. DISK PERSISTENCE AUDIT ==="
        ls -lh /var/www/amratgames.com/backend/data/
        echo ""
        echo "=== 2. DATABASE FILE INTEGRITY ==="
        stat /var/www/amratgames.com/backend/data/amratgames_db.json
        echo ""
        node -e '
            const fs = require("fs");
            const dbPath = "/var/www/amratgames.com/backend/data/amratgames_db.json";
            if (!fs.existsSync(dbPath)) {
                console.error("ERROR: DB file not found on disk!");
                process.exit(1);
            }
            const data = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
            console.log("Database Stats On Disk:");
            console.log("  Users Count:         ", data.users ? data.users.length : 0);
            console.log("  Transactions Count:  ", data.transactions ? data.transactions.length : 0);
            console.log("  Bets Count:          ", data.bets ? data.bets.length : 0);
            console.log("  Deposits Count:      ", data.deposits ? data.deposits.length : 0);
            console.log("  Withdrawals Count:   ", data.withdrawals ? data.withdrawals.length : 0);
            console.log("  Airdrops Count:      ", data.airdrops ? data.airdrops.length : 0);
            console.log("  Settings RTP:        ", data.settings ? data.settings.rtp : "N/A");
            console.log("  Server Seed Hash:    ", data.settings ? data.settings.serverSeedHash : "N/A");
            console.log("  Sample User Balances:", data.users && data.users[0] ? { username: data.users[0].username, balances: data.users[0].balances } : "none");
        '
        echo ""
        echo "=== 3. REDIS SERVICE CHECK ==="
        which redis-server redis-cli || echo "Redis binaries not found in PATH"
        systemctl status redis --no-pager 2>/dev/null || systemctl status redis-server --no-pager 2>/dev/null || echo "Redis service not running"
        redis-cli ping 2>/dev/null || echo "Redis ping failed / not listening"
        echo ""
        echo "=== 4. PM2 PROCESS & MEMORY USAGE ==="
        pm2 list
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
