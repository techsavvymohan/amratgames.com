import { getSupabaseClient, isSupabaseConfigured } from './SupabaseClient.js'

/**
 * SupabaseSyncService — Bridges AmratGames OOP Database with Supabase Cloud
 */
export class SupabaseSyncService {
    constructor() {
        this.client = getSupabaseClient()
    }

    getClient() {
        if (!this.client) this.client = getSupabaseClient()
        return this.client
    }

    /**
     * Persist or update user in Supabase
     */
    async syncUser(user) {
        const client = this.getClient()
        if (!client || !user) return null

        try {
            const payload = {
                id: user.id,
                username: user.username,
                email: user.email || null,
                phone: user.phone || null,
                password_hash: user.passwordHash,
                role: user.role || 'player',
                status: user.status || 'active',
                is_banned: Boolean(user.isBanned),
                kyc_status: user.kycStatus || 'unverified',
                phone_verified: Boolean(user.phoneVerified),
                email_verified: Boolean(user.emailVerified),
                avatar: user.avatar || '👤',
                balances: user.balances || { INR: 0, BTC: 0, USDT: 0, AMRAT: 0 },
                last_login_at: user.lastLoginAt || new Date().toISOString()
            }

            const { data, error } = await client
                .from('users')
                .upsert(payload, { onConflict: 'id' })
                .select()
                .single()

            if (error) {
                console.warn('[SUPABASE] syncUser error:', error.message)
                return null
            }

            // Sync relational user_balances table
            if (user.balances && typeof user.balances === 'object') {
                const balanceEntries = Object.entries(user.balances).map(([curr, bal]) => ({
                    user_id: user.id,
                    currency: curr,
                    balance: typeof bal === 'number' ? bal : (parseFloat(bal) || 0),
                    updated_at: new Date().toISOString()
                }))

                if (balanceEntries.length > 0) {
                    try {
                        await client.from('user_balances').upsert(balanceEntries, { onConflict: 'user_id,currency' })
                    } catch {
                        // non-fatal
                    }
                }
            }

            return data
        } catch (err) {
            console.warn('[SUPABASE] syncUser exception:', err.message)
            return null
        }
    }

    /**
     * Record a game bet in Supabase
     */
    async syncBet(bet) {
        const client = this.getClient()
        if (!client || !bet) return null

        try {
            const payload = {
                id: bet.id,
                user_id: bet.userId?.startsWith('sim_') ? null : bet.userId,
                username: bet.username,
                game: bet.game,
                game_name: bet.gameName || bet.game,
                currency: bet.currency || 'INR',
                bet_amount: bet.betAmount,
                multiplier: bet.multiplier || 0,
                payout: bet.payout || 0,
                profit: bet.profit || 0,
                won: Boolean(bet.won),
                hash: bet.hash || null,
                round_data: bet.roundData || bet.round_data || null,
                created_at: bet.timestamp || new Date().toISOString()
            }

            const { data, error } = await client
                .from('bets')
                .insert([payload])
                .select()
                .single()

            if (error) {
                console.warn('[SUPABASE] syncBet error:', error.message)
                return null
            }
            return data
        } catch (err) {
            console.warn('[SUPABASE] syncBet exception:', err.message)
            return null
        }
    }

    /**
     * Record a transaction in Supabase
     */
    async syncTransaction(tx) {
        const client = this.getClient()
        if (!client || !tx) return null

        try {
            const payload = {
                id: tx.id,
                user_id: tx.userId,
                username: tx.username || 'Player',
                type: tx.type,
                currency: tx.currency,
                amount: tx.amount,
                balance_after: typeof tx.balanceAfter === 'number' ? tx.balanceAfter : (parseFloat(tx.balanceAfter) || tx.amount || 0),
                note: tx.note || null,
                payment_method: tx.paymentMethod || null,
                status: tx.status || 'completed',
                created_at: tx.timestamp || new Date().toISOString()
            }

            const { data, error } = await client
                .from('transactions')
                .upsert(payload, { onConflict: 'id' })
                .select()
                .single()

            if (error) {
                console.warn('[SUPABASE] syncTransaction error:', error.message)
                return null
            }
            return data
        } catch (err) {
            console.warn('[SUPABASE] syncTransaction exception:', err.message)
            return null
        }
    }

    /**
     * Record an airdrop campaign in Supabase
     */
    async syncAirdrop(airdrop) {
        const client = this.getClient()
        if (!client || !airdrop) return null

        try {
            const payload = {
                id: airdrop.id,
                campaign: airdrop.campaign,
                admin_id: airdrop.adminId,
                admin_username: airdrop.adminUsername,
                token: airdrop.token || 'AMRAT',
                amount_per_user: airdrop.amountPerUser,
                recipient_count: airdrop.recipientCount,
                total_amount: airdrop.totalAmount,
                target_group: airdrop.targetGroup,
                note: airdrop.note || null,
                created_at: airdrop.timestamp || new Date().toISOString()
            }

            const { data, error } = await client
                .from('airdrops')
                .upsert(payload, { onConflict: 'id' })
                .select()
                .single()

            if (error) {
                console.warn('[SUPABASE] syncAirdrop error:', error.message)
                return null
            }
            return data
        } catch (err) {
            console.warn('[SUPABASE] syncAirdrop exception:', err.message)
            return null
        }
    }

    /**
     * Sync platform settings and seed entropy to Supabase
     */
    async syncSettings(settings) {
        const client = this.getClient()
        if (!client || !settings) return null

        try {
            const payload = {
                id: 'default',
                rtp: settings.rtp || 99.00,
                house_edge: settings.houseEdge || 1.00,
                maintenance_mode: Boolean(settings.maintenanceMode),
                active_announcements: settings.activeAnnouncements || '',
                current_server_seed: settings.currentServerSeed || '',
                server_seed_hash: settings.serverSeedHash || '',
                token_treasury: settings.tokenTreasury || {},
                updated_at: new Date().toISOString()
            }

            const { data, error } = await client
                .from('platform_settings')
                .upsert(payload, { onConflict: 'id' })
                .select()
                .single()

            if (error) {
                console.warn('[SUPABASE] syncSettings error:', error.message)
                return null
            }
            return data
        } catch (err) {
            console.warn('[SUPABASE] syncSettings exception:', err.message)
            return null
        }
    }

    /**
     * Store OTP in Supabase otps table
     */
    async syncOtp(identifier, otpCode, expiresAt) {
        const client = this.getClient()
        if (!client || !identifier) return null

        try {
            const payload = {
                identifier: String(identifier).trim().toLowerCase(),
                otp_code: String(otpCode),
                expires_at: new Date(expiresAt).toISOString(),
                attempts: 0,
                created_at: new Date().toISOString()
            }

            const { data, error } = await client
                .from('otps')
                .upsert(payload, { onConflict: 'identifier' })
                .select()
                .single()

            if (error) {
                console.warn('[SUPABASE] syncOtp error:', error.message)
                return null
            }
            return data
        } catch (err) {
            console.warn('[SUPABASE] syncOtp exception:', err.message)
            return null
        }
    }

    /**
     * Delete OTP from Supabase once verified
     */
    async deleteOtp(identifier) {
        const client = this.getClient()
        if (!client || !identifier) return

        try {
            await client
                .from('otps')
                .delete()
                .eq('identifier', String(identifier).trim().toLowerCase())
        } catch (err) {
            console.warn('[SUPABASE] deleteOtp exception:', err.message)
        }
    }

    /**
     * Run full migration from local JSON database to Supabase
     */
    async migrateLocalToSupabase(localData) {
        const client = this.getClient()
        if (!client) {
            throw new Error('Supabase client not initialized. Check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
        }

        const report = {
            usersMigrated: 0,
            betsMigrated: 0,
            transactionsMigrated: 0,
            airdropsMigrated: 0,
            settingsMigrated: false,
            errors: []
        }

        // 1. Settings
        if (localData.settings) {
            const sRes = await this.syncSettings(localData.settings)
            if (sRes) report.settingsMigrated = true
        }

        // 2. Users
        if (Array.isArray(localData.users)) {
            for (const user of localData.users) {
                const res = await this.syncUser(user)
                if (res) report.usersMigrated++
                else report.errors.push(`Failed to migrate user ${user.username}`)
            }
        }

        // 3. Transactions (batch in chunks of 50)
        if (Array.isArray(localData.transactions)) {
            const validTxs = localData.transactions.map(tx => ({
                id: tx.id,
                user_id: tx.userId,
                username: tx.username || (localData.users?.find(u => u.id === tx.userId)?.username) || 'Player',
                type: tx.type,
                currency: tx.currency,
                amount: tx.amount,
                balance_after: typeof tx.balanceAfter === 'number' ? tx.balanceAfter : (parseFloat(tx.balanceAfter) || tx.amount || 0),
                note: tx.note || null,
                payment_method: tx.paymentMethod || null,
                status: tx.status || 'completed',
                created_at: tx.timestamp || new Date().toISOString()
            }))

            for (let i = 0; i < validTxs.length; i += 50) {
                const chunk = validTxs.slice(i, i + 50)
                const { error } = await client.from('transactions').upsert(chunk, { onConflict: 'id' })
                if (!error) report.transactionsMigrated += chunk.length
                else report.errors.push(`Tx chunk error: ${error.message}`)
            }
        }

        // 4. Bets (batch in chunks of 50)
        if (Array.isArray(localData.bets)) {
            const validBets = localData.bets.map(bet => ({
                id: bet.id,
                user_id: bet.userId?.startsWith('sim_') ? null : bet.userId,
                username: bet.username,
                game: bet.game,
                game_name: bet.gameName || bet.game,
                currency: bet.currency || 'INR',
                bet_amount: bet.betAmount,
                multiplier: bet.multiplier || 0,
                payout: bet.payout || 0,
                profit: bet.profit || 0,
                won: Boolean(bet.won),
                hash: bet.hash || null,
                round_data: bet.roundData || bet.round_data || null,
                created_at: bet.timestamp || new Date().toISOString()
            }))

            for (let i = 0; i < validBets.length; i += 50) {
                const chunk = validBets.slice(i, i + 50)
                const { error } = await client.from('bets').upsert(chunk, { onConflict: 'id' })
                if (!error) report.betsMigrated += chunk.length
                else report.errors.push(`Bets chunk error: ${error.message}`)
            }
        }

        // 5. Airdrops
        if (Array.isArray(localData.airdrops)) {
            for (const airdrop of localData.airdrops) {
                const res = await this.syncAirdrop(airdrop)
                if (res) report.airdropsMigrated++
            }
        }

        return report
    }
}

export const supabaseSync = new SupabaseSyncService()
