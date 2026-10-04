import { createClient } from '@supabase/supabase-js'
import { CONFIG } from '../config.js'

let supabaseInstance = null

/**
 * Get or initialize Supabase Client instance
 */
export function getSupabaseClient() {
    if (supabaseInstance) return supabaseInstance

    const url = CONFIG.SUPABASE_URL
    const key = CONFIG.SUPABASE_SERVICE_ROLE_KEY || CONFIG.SUPABASE_ANON_KEY

    if (!url || !key) {
        return null
    }

    try {
        supabaseInstance = createClient(url, key, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
            db: {
                schema: 'public'
            }
        })
        return supabaseInstance
    } catch (err) {
        console.error('[SUPABASE] Failed to initialize client:', err.message)
        return null
    }
}

/**
 * Returns whether Supabase credentials are configured
 */
export function isSupabaseConfigured() {
    return Boolean(CONFIG.SUPABASE_URL && (CONFIG.SUPABASE_SERVICE_ROLE_KEY || CONFIG.SUPABASE_ANON_KEY))
}

/**
 * Test connectivity with Supabase PostgreSQL cloud instance
 */
export async function testSupabaseConnection() {
    if (!isSupabaseConfigured()) {
        return {
            ok: false,
            configured: false,
            message: 'Supabase credentials not configured in .env (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY required)'
        }
    }

    const client = getSupabaseClient()
    if (!client) {
        return {
            ok: false,
            configured: true,
            message: 'Failed to create Supabase client'
        }
    }

    const start = Date.now()
    try {
        // Query platform_settings table or auth to verify connectivity
        const { data, error } = await client
            .from('platform_settings')
            .select('id, rtp, house_edge')
            .limit(1)

        const latencyMs = Date.now() - start

        if (error) {
            // Check if error is because tables don't exist yet
            if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('schema cache')) {
                return {
                    ok: true,
                    configured: true,
                    tablesInitialized: false,
                    latencyMs,
                    message: 'Connected to Supabase PostgreSQL! Tables not yet created. Run supabase-schema.sql in Supabase SQL Editor.'
                }
            }
            return {
                ok: false,
                configured: true,
                latencyMs,
                error: error.message,
                code: error.code,
                message: `Supabase query error: ${error.message}`
            }
        }

        return {
            ok: true,
            configured: true,
            tablesInitialized: true,
            latencyMs,
            data,
            message: `Successfully connected to Supabase PostgreSQL (${latencyMs}ms)!`
        }
    } catch (err) {
        return {
            ok: false,
            configured: true,
            latencyMs: Date.now() - start,
            message: `Connection error: ${err.message}`
        }
    }
}
