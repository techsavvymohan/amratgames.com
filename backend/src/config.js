import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../')
const backendDir = path.resolve(__dirname, '../')

// Load .env candidates in order of specificity
const envCandidates = [
    process.env.ENV_FILE,                                 // Custom specified file
    path.resolve(process.cwd(), '.env.local'),            // Local overrides in CWD
    path.resolve(process.cwd(), '.env'),                  // CWD .env
    path.resolve(backendDir, '.env'),                     // backend/.env
    path.resolve(rootDir, '.env'),                        // Root workspace .env
].filter(Boolean)

for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath })
        break
    }
}

// Fallback general dotenv call
dotenv.config()

export const CONFIG = {
    // 1. Application & Server Settings
    NODE_ENV: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV !== 'production',
    PORT: parseInt(process.env.PORT, 10) || 3001,
    HOST: process.env.HOST || '0.0.0.0',
    CORS_ORIGIN: process.env.CORS_ORIGIN
        ? (process.env.CORS_ORIGIN.includes(',') ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : process.env.CORS_ORIGIN)
        : '*',

    // 2. Security & JWT
    JWT_SECRET: process.env.JWT_SECRET || 'amrat-games-super-secret-jwt-key-2025-crypto-inr',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    ADMIN_API_KEY: process.env.ADMIN_API_KEY || 'amrat_internal_secret_admin_key_2025',

    // 3. Default Master Admin Account
    ADMIN_DEFAULT_EMAIL: process.env.ADMIN_EMAIL || 'admin@amratgames.com',
    ADMIN_DEFAULT_PHONE: process.env.ADMIN_PHONE || '9876500001',
    ADMIN_DEFAULT_PASSWORD: process.env.ADMIN_PASSWORD || 'AdminPassword123!',
    ADMIN_DEFAULT_NAME: process.env.ADMIN_NAME || 'Amrat Royal Admin',

    // 4. Database & Storage Paths
    DATA_DIR: process.env.DATA_DIR
        ? (path.isAbsolute(process.env.DATA_DIR) ? process.env.DATA_DIR : path.resolve(backendDir, process.env.DATA_DIR))
        : path.resolve(backendDir, './data'),
    DB_FILE: process.env.DB_FILE || 'amratgames_db.json',
    REDIS_URL: process.env.REDIS_URL || null,

    // Supabase PostgreSQL Integration
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '',
    USE_SUPABASE: process.env.USE_SUPABASE === 'true' || Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY)),

    // 5. SMS & OTP Verification Gateway
    SMS_GATEWAY_PROVIDER: process.env.SMS_GATEWAY_PROVIDER || 'mock',
    SMS_GATEWAY_API_KEY: process.env.TWOFACTOR_API_KEY || process.env.SMS_GATEWAY_API_KEY || '',
    SMS_GATEWAY_SENDER_ID: process.env.SMS_GATEWAY_SENDER_ID || 'AMRATG',
    TWOFACTOR_TEMPLATE: process.env.TWOFACTOR_TEMPLATE || 'OTP1',
    DEMO_OTP_BYPASS_ENABLED: (process.env.NODE_ENV === 'production')
        ? (process.env.DEMO_OTP_BYPASS_ENABLED === 'true')
        : (process.env.DEMO_OTP_BYPASS_ENABLED !== 'false'),
    DEMO_OTP_CODE: process.env.DEMO_OTP_CODE || '777777',

    // Official Support & Outgoing Email Dispatcher
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'support@amratgames.com',
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
    SMTP_SECURE: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    SMTP_USER: process.env.SMTP_USER || 'support@amratgames.com',
    SMTP_PASS: process.env.SMTP_PASS || '',
    SMTP_FROM: process.env.SMTP_FROM || 'AmratGames Support <support@amratgames.com>',

    // 6. Indian Payments & UPI (INR)
    UPI_MERCHANT_VPA: process.env.UPI_MERCHANT_VPA || 'amratgames@upi',
    UPI_MERCHANT_NAME: process.env.UPI_MERCHANT_NAME || 'AmratGames India',
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',

    // 7. Crypto Cold Storage Vaults
    CRYPTO_RECEIVER_BTC: process.env.CRYPTO_RECEIVER_BTC || 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    CRYPTO_RECEIVER_USDT: process.env.CRYPTO_RECEIVER_USDT || '0x71C8360f3E10D5371b3722133D141C0E500C7D52',
    DODO_PAYMENTS_API_KEY: process.env.DODO_PAYMENTS_API_KEY || '',
    DODO_PAYMENTS_WEBHOOK_SECRET: process.env.DODO_PAYMENTS_WEBHOOK_SECRET || '',

    // 8. Token Economy & Odds
    TOKEN_NAME: process.env.TOKEN_NAME || 'Amrat Royal Token',
    TOKEN_SYMBOL: process.env.TOKEN_SYMBOL || 'AMRAT',
    TOKEN_INITIAL_TREASURY: parseFloat(process.env.TOKEN_INITIAL_TREASURY) || 100000000,
    TOKEN_DECIMALS: parseInt(process.env.TOKEN_DECIMALS, 10) || 2,
    DEFAULT_RTP: parseFloat(process.env.DEFAULT_RTP) || 99.00,
    HOUSE_EDGE: parseFloat(process.env.HOUSE_EDGE) || 1.00,
    MIN_BET_INR: parseFloat(process.env.MIN_BET_INR) || 10,
    MAX_BET_INR: parseFloat(process.env.MAX_BET_INR) || 200000,
}

/**
 * Validate configuration and warn if critical variables are using weak defaults in production
 */
export function validateConfig() {
    const warnings = []

    if (CONFIG.isProduction) {
        if (CONFIG.JWT_SECRET.includes('super-secret') || CONFIG.JWT_SECRET.length < 32) {
            warnings.push('CRITICAL: JWT_SECRET is using a weak default or is under 32 characters in production!')
        }
        if (CONFIG.DEMO_OTP_BYPASS_ENABLED) {
            warnings.push('WARNING: DEMO_OTP_BYPASS_ENABLED is set to true in production mode. Set to false for live users.')
        }
        if (CONFIG.ADMIN_DEFAULT_PASSWORD === 'AdminPassword123!' || CONFIG.ADMIN_DEFAULT_PASSWORD === 'AmratAdmin2025!') {
            warnings.push('WARNING: Default admin password is being used in production. Change ADMIN_PASSWORD in .env!')
        }
    }

    if (warnings.length > 0) {
        console.warn('\n⚠️  [CONFIGURATION WARNINGS]')
        warnings.forEach(w => console.warn(`   • ${w}`))
        console.warn('')
    }

    return warnings
}

/**
 * Print safe masked configuration summary
 */
export function logConfigSummary() {
    const mask = (str, visible = 4) => {
        if (!str || str.length <= visible) return '••••'
        return str.slice(0, visible) + '••••' + str.slice(-2)
    }

    console.log(`\n======================================================`)
    console.log(`👑 AmratGames.com Gaming & Casino Backend Engine 2.0`)
    console.log(`======================================================`)
    console.log(`⚙️  Environment:         ${CONFIG.NODE_ENV.toUpperCase()}`)
    console.log(`🌐 Server Host & Port:   http://${CONFIG.HOST}:${CONFIG.PORT}`)
    console.log(`📂 Primary Database:     ${CONFIG.USE_SUPABASE ? 'SUPABASE (PostgreSQL Cloud)' : 'LOCAL JSON DB (' + CONFIG.DATA_DIR + '/' + CONFIG.DB_FILE + ')'}`)
    if (CONFIG.USE_SUPABASE) {
        console.log(`⚡ Supabase URL:         ${CONFIG.SUPABASE_URL || 'NOT SET'}`)
    }
    console.log(`🛡️  Admin Account:        ${CONFIG.ADMIN_DEFAULT_EMAIL} (Phone: +91 ${CONFIG.ADMIN_DEFAULT_PHONE})`)
    console.log(`📧 Support Email:        ${CONFIG.SUPPORT_EMAIL} (Sender: ${CONFIG.SMTP_FROM})`)
    console.log(`🔑 JWT Secret:           ${mask(CONFIG.JWT_SECRET)} (${CONFIG.JWT_EXPIRES_IN})`)
    console.log(`📲 SMS Provider:         ${CONFIG.SMS_GATEWAY_PROVIDER.toUpperCase()} (Demo Bypass: ${CONFIG.DEMO_OTP_BYPASS_ENABLED ? 'ENABLED [' + CONFIG.DEMO_OTP_CODE + ']' : 'DISABLED'})`)
    console.log(`🇮🇳 UPI Merchant:         ${CONFIG.UPI_MERCHANT_VPA} (${CONFIG.UPI_MERCHANT_NAME})`)
    console.log(`💎 Platform Token:       $${CONFIG.TOKEN_SYMBOL} (${CONFIG.TOKEN_NAME})`)
    console.log(`🎲 Default Casino Odds:  RTP ${CONFIG.DEFAULT_RTP}% | House Edge ${CONFIG.HOUSE_EDGE}%`)
    console.log(`======================================================\n`)
}
