-- ═════════════════════════════════════════════════════════════════════════════════
-- AmratGames.com — Official Supabase PostgreSQL Database Schema
-- ═════════════════════════════════════════════════════════════════════════════════

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(32),
    password_hash TEXT NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'player',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    kyc_status VARCHAR(32) NOT NULL DEFAULT 'unverified',
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    avatar VARCHAR(32) DEFAULT '👤',
    balances JSONB NOT NULL DEFAULT '{"INR": 10000.00, "BTC": 0.0000, "USDT": 0.00, "AMRAT": 500.00}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 3. USER BALANCES (Normalized Ledger)
CREATE TABLE IF NOT EXISTS public.user_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    currency VARCHAR(16) NOT NULL,
    balance NUMERIC(20, 4) NOT NULL DEFAULT 0.0000,
    locked_balance NUMERIC(20, 4) NOT NULL DEFAULT 0.0000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_currency UNIQUE (user_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_user_balances_user_id ON public.user_balances(user_id);

-- 4. GAME BETS & ROUNDS
CREATE TABLE IF NOT EXISTS public.bets (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    username VARCHAR(64) NOT NULL,
    game VARCHAR(32) NOT NULL,
    game_name VARCHAR(64) NOT NULL,
    currency VARCHAR(16) NOT NULL DEFAULT 'INR',
    bet_amount NUMERIC(20, 4) NOT NULL,
    multiplier NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    payout NUMERIC(20, 4) NOT NULL DEFAULT 0.0000,
    profit NUMERIC(20, 4) NOT NULL DEFAULT 0.0000,
    won BOOLEAN NOT NULL DEFAULT FALSE,
    hash VARCHAR(128),
    round_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bets_user_id ON public.bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_game ON public.bets(game);
CREATE INDEX IF NOT EXISTS idx_bets_created_at ON public.bets(created_at DESC);

-- 5. TRANSACTIONS TABLE (Deposits, Withdrawals, Wagers, Payouts, Airdrops)
CREATE TABLE IF NOT EXISTS public.transactions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    username VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL, -- deposit, withdrawal, bet, win, airdrop, credit, debit
    currency VARCHAR(16) NOT NULL,
    amount NUMERIC(20, 4) NOT NULL,
    balance_after NUMERIC(20, 4) NOT NULL,
    note TEXT,
    payment_method VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- 6. AIRDROPS & TOKEN REWARD CAMPAIGNS
CREATE TABLE IF NOT EXISTS public.airdrops (
    id VARCHAR(64) PRIMARY KEY,
    campaign VARCHAR(128) NOT NULL,
    admin_id VARCHAR(64),
    admin_username VARCHAR(64),
    token VARCHAR(16) NOT NULL DEFAULT 'AMRAT',
    amount_per_user NUMERIC(20, 4) NOT NULL,
    recipient_count INTEGER NOT NULL,
    total_amount NUMERIC(20, 4) NOT NULL,
    target_group VARCHAR(64) NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_airdrops_created_at ON public.airdrops(created_at DESC);

-- 7. PLATFORM SETTINGS & PROVABLY FAIR SEEDS
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'default',
    rtp NUMERIC(6, 2) NOT NULL DEFAULT 98.00,
    house_edge NUMERIC(6, 2) NOT NULL DEFAULT 2.00,
    maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
    active_announcements TEXT,
    current_server_seed TEXT,
    server_seed_hash TEXT,
    token_treasury JSONB NOT NULL DEFAULT '{
        "totalSupply": 100000000,
        "circulatingSupply": 1197700,
        "treasuryBalance": 98802300,
        "totalAirdropped": 0
    }'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. ONE-TIME PASSWORDS (OTP)
CREATE TABLE IF NOT EXISTS public.otps (
    identifier VARCHAR(128) PRIMARY KEY,
    otp_code VARCHAR(16) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. DEPOSITS TABLE
CREATE TABLE IF NOT EXISTS public.deposits (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    amount NUMERIC(20, 4) NOT NULL,
    currency VARCHAR(16) NOT NULL DEFAULT 'INR',
    method VARCHAR(64) NOT NULL,
    utr VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON public.deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON public.deposits(created_at DESC);

-- 10. WITHDRAWALS TABLE
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    amount NUMERIC(20, 4) NOT NULL,
    currency VARCHAR(16) NOT NULL DEFAULT 'INR',
    payout_method VARCHAR(64) NOT NULL,
    payout_details JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    reference_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON public.withdrawals(created_at DESC);

-- 11. Insert Initial Platform Settings row if not exists
INSERT INTO public.platform_settings (id, rtp, house_edge, maintenance_mode, active_announcements)
VALUES (
    'default',
    98.00,
    2.00,
    FALSE,
    '👑 Welcome to AmratGames — Provably Fair Gaming'
)
ON CONFLICT (id) DO UPDATE SET rtp = 98.00, house_edge = 2.00;

-- 12. Enable Supabase Realtime for live bet feed
ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;
