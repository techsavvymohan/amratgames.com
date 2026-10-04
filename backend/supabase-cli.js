#!/usr/bin/env node
import { testSupabaseConnection, isSupabaseConfigured } from './src/db/SupabaseClient.js'
import { db } from './src/db/db.js'
import { CONFIG } from './src/config.js'

const command = process.argv[2] || 'status'

async function run() {
    console.log('═══════════════════════════════════════════════════════════')
    console.log('   AMRATGAMES.COM — SUPABASE POSTGRESQL ENGINE CLI')
    console.log('═══════════════════════════════════════════════════════════\n')

    console.log(`Configured URL:  ${CONFIG.SUPABASE_URL || '(Not set in .env)'}`)
    console.log(`Configured Key:  ${CONFIG.SUPABASE_SERVICE_ROLE_KEY ? 'Present (Service Role)' : (CONFIG.SUPABASE_ANON_KEY ? 'Present (Anon)' : '(Not set in .env)')}`)
    console.log(`Database Mode:   ${CONFIG.USE_SUPABASE ? 'SUPABASE' : 'LOCAL JSON DB'}\n`)

    if (command === 'status') {
        console.log('▶ Testing Supabase Connection...')
        const result = await testSupabaseConnection()
        if (result.ok) {
            console.log(`\n✓ SUCCESS: ${result.message}`)
            if (result.latencyMs) console.log(`  Roundtrip Latency: ${result.latencyMs}ms`)
            if (result.tablesInitialized === false) {
                console.log('\n⚠️  ACTION REQUIRED:')
                console.log('   Please run backend/src/db/supabase-schema.sql in your Supabase SQL Editor.')
            }
        } else {
            console.log(`\n✗ FAILED: ${result.message}`)
            if (result.configured === false) {
                console.log('\n💡 TO CONFIGURE SUPABASE:')
                console.log('   1. Open .env')
                console.log('   2. Set SUPABASE_URL=https://your-project.supabase.co')
                console.log('   3. Set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key')
                console.log('   4. Set USE_SUPABASE=true')
            }
        }
    } else if (command === 'migrate') {
        console.log('▶ Running One-Click Migration to Supabase...')
        if (!isSupabaseConfigured()) {
            console.error('\n✗ Error: Supabase credentials not set in .env. Cannot migrate.')
            process.exit(1)
        }

        try {
            const report = await db.migrateToSupabase()
            console.log('\n✓ Migration Report:')
            console.log(`  • Users Migrated:        ${report.usersMigrated}`)
            console.log(`  • Bets Migrated:         ${report.betsMigrated}`)
            console.log(`  • Transactions Migrated: ${report.transactionsMigrated}`)
            console.log(`  • Airdrops Migrated:     ${report.airdropsMigrated}`)
            console.log(`  • Settings Migrated:     ${report.settingsMigrated ? 'YES' : 'NO'}`)
            if (report.errors?.length > 0) {
                console.log('\n⚠️  Encountered Errors:')
                report.errors.forEach(e => console.log(`   - ${e}`))
            }
        } catch (err) {
            console.error(`\n✗ Migration failed: ${err.message}`)
            process.exit(1)
        }
    } else {
        console.log(`Unknown command: "${command}". Available commands: status, migrate`)
    }
    console.log('\n═══════════════════════════════════════════════════════════')
}

run().catch(err => {
    console.error('Fatal CLI Error:', err)
    process.exit(1)
})
