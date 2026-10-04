#!/usr/bin/env node
/**
 * AmratGames.com - Automated Environment Setup Utility
 * 
 * Safely copies .env.example templates to .env for root, backend, and frontend
 * and generates a cryptographically secure 64-character JWT secret.
 * 
 * Usage:
 *   node scripts/setup-env.js
 *   node scripts/setup-env.js --force   # Overwrite existing .env files
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

const isForce = process.argv.includes('--force')

console.log('\n======================================================')
console.log('⚡ AmratGames.com Environment Provisioning Engine')
console.log('======================================================')

// 1. Generate 64-character crypto secure secret
const secureJwtSecret = crypto.randomBytes(32).toString('hex')

const ENV_TARGETS = [
    {
        name: 'Master / Root Environment',
        example: path.join(ROOT_DIR, '.env.example'),
        target: path.join(ROOT_DIR, '.env'),
        injectJwt: true
    },
    {
        name: 'Backend Microservice Environment',
        example: path.join(ROOT_DIR, 'backend', '.env.example'),
        target: path.join(ROOT_DIR, 'backend', '.env'),
        injectJwt: true
    },
    {
        name: 'Frontend Client Environment (Vite)',
        example: path.join(ROOT_DIR, 'frontend', '.env.example'),
        target: path.join(ROOT_DIR, 'frontend', '.env'),
        injectJwt: false
    }
]

let filesConfigured = 0

for (const item of ENV_TARGETS) {
    const exists = fs.existsSync(item.target)
    
    if (exists && !isForce) {
        console.log(`✅ [EXISTS]  ${item.name}: ${path.relative(ROOT_DIR, item.target)}`)
        continue
    }

    if (!fs.existsSync(item.example)) {
        console.error(`❌ [MISSING] Template not found: ${path.relative(ROOT_DIR, item.example)}`)
        continue
    }

    let content = fs.readFileSync(item.example, 'utf-8')

    // If target needs JWT secret injected, replace the placeholder
    if (item.injectJwt) {
        content = content.replace(
            /JWT_SECRET=([^\r\n]*)/,
            `JWT_SECRET=${secureJwtSecret}`
        )
    }

    fs.writeFileSync(item.target, content, 'utf-8')
    console.log(`✨ [CREATED] ${item.name} -> ${path.relative(ROOT_DIR, item.target)}`)
    filesConfigured++
}

console.log('------------------------------------------------------')
if (filesConfigured > 0) {
    console.log(`🔑 Generated 256-bit cryptographically secure JWT_SECRET:`)
    console.log(`   ${secureJwtSecret.slice(0, 8)}...${secureJwtSecret.slice(-6)} (Saved to .env)`)
}
console.log('✅ Environment system ready for local development & production!')
console.log('💡 To force re-generation with new secrets: npm run setup:env -- --force')
console.log('======================================================\n')
