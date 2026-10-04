#!/usr/bin/env node
import { emailService } from './src/services/EmailService.js'
import { CONFIG } from './src/config.js'

const command = process.argv[2] || 'status'
const targetEmail = process.argv[3]

async function run() {
    console.log('═══════════════════════════════════════════════════════════')
    console.log('   AMRATGAMES.COM — SPACEMAIL SMTP DIAGNOSTIC CLI')
    console.log('═══════════════════════════════════════════════════════════\n')

    console.log(`Support Email: ${CONFIG.SUPPORT_EMAIL}`)
    console.log(`SMTP Host:     ${CONFIG.SMTP_HOST || '(Not set in .env)'}`)
    console.log(`SMTP Port:     ${CONFIG.SMTP_PORT} (${CONFIG.SMTP_SECURE ? 'SSL' : 'TLS'})`)
    console.log(`SMTP User:     ${CONFIG.SMTP_USER || '(Not set in .env)'}`)
    console.log(`SMTP Password: ${CONFIG.SMTP_PASS ? 'Present (Configured)' : '(Not set in .env)'}`)
    console.log(`From Sender:   ${CONFIG.SMTP_FROM}\n`)

    if (command === 'status') {
        console.log('▶ Testing Spacemail SMTP Handshake...')
        const result = await emailService.verifyConnection()
        if (result.ok) {
            console.log(`\n✓ SUCCESS: ${result.message}`)
            if (result.latencyMs) console.log(`  Roundtrip Handshake: ${result.latencyMs}ms`)
            console.log('\n💡 Ready to dispatch real OTP verification emails to inboxes!')
            console.log('   Test delivery by running: node backend/smtp-cli.js send your-email@gmail.com')
        } else {
            console.log(`\n✗ FAILED: ${result.message}`)
            if (result.configured === false) {
                console.log('\n💡 TO CONFIGURE SPACEMAIL:')
                console.log('   1. Open .env')
                console.log('   2. Set SMTP_HOST=mail.spacemail.com')
                console.log('   3. Set SMTP_PORT=465')
                console.log('   4. Set SMTP_SECURE=true')
                console.log('   5. Set SMTP_USER=support@amratgames.com')
                console.log('   6. Set SMTP_PASS=your-spacemail-password')
            }
        }
    } else if (command === 'send') {
        if (!targetEmail) {
            console.error('✗ Error: Please provide recipient email: node backend/smtp-cli.js send <email>')
            process.exit(1)
        }

        console.log(`▶ Sending Test Royal OTP Verification Email to: ${targetEmail}...`)
        const testOtp = Math.floor(100000 + Math.random() * 900000).toString()
        const result = await emailService.sendOtpEmail({
            to: targetEmail,
            otp: testOtp,
            username: 'Valued Player'
        })

        if (result.success) {
            console.log('\n✓ SUCCESS: Royal verification email dispatched successfully!')
            if (result.messageId) console.log(`  Message ID: ${result.messageId}`)
            if (result.simulated) console.log('  (Simulated locally because SMTP_PASS is not set in .env)')
            console.log(`  Test OTP Code: ${testOtp}`)
        } else {
            console.error(`\n✗ Delivery failed: ${result.error}`)
            process.exit(1)
        }
    } else {
        console.log(`Unknown command: "${command}". Available commands: status, send <email>`)
    }

    console.log('\n═══════════════════════════════════════════════════════════')
}

run().catch(err => {
    console.error('Fatal CLI Error:', err)
    process.exit(1)
})
