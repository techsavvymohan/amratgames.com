import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

async function run() {
    const { isFakeOrDemoUser } = await import('../backend/src/admin-panel/utils/userFilter.js')
    const dbPath = path.resolve(rootDir, 'backend/data/amratgames_db.json')

    if (!fs.existsSync(dbPath)) {
        console.log('[Sanitizer] No local amratgames_db.json found. Skipping.')
        return
    }

    try {
        const raw = fs.readFileSync(dbPath, 'utf8')
        const db = JSON.parse(raw)
        const before = db.users?.length || 0

        const realUsers = (db.users || []).filter(u => !isFakeOrDemoUser(u))
        const realIds = new Set(realUsers.map(u => u.id))

        db.users = realUsers
        db.transactions = (db.transactions || []).filter(t => realIds.has(t.userId))
        db.deposits = (db.deposits || []).filter(d => realIds.has(d.userId))
        db.withdrawals = (db.withdrawals || []).filter(w => realIds.has(w.userId))
        db.bets = (db.bets || []).filter(b => realIds.has(b.userId))

        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8')
        console.log(`[Sanitizer] Pruned demo/fake data: users ${before} -> ${realUsers.length}, cleaned file size: ${fs.statSync(dbPath).size} bytes.`)
    } catch (err) {
        console.warn('[Sanitizer] Notice while cleaning db:', err.message)
    }
}

run()
