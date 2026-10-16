-- ═════════════════════════════════════════════════════════════════════════════════
-- 🏛️ AmratGames Enterprise PostgreSQL Schema (Production DDL)
-- Compatible with PostgreSQL 14+, AWS RDS, Supabase, Neon, Azure PostgreSQL
-- ═════════════════════════════════════════════════════════════════════════════════

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS & IDENTITY
CREATE TABLE IF NOT EXISTS users (
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
    balances JSONB NOT NULL DEFAULT '{"INR": 100.00, "BTC": 0.0000, "USDT": 0.00, "AMRAT": 0.00}'::jsonb,
    total_wagered NUMERIC(20, 4) NOT NULL DEFAULT 0.0000,
    total_deposited NUMERIC(20, 4) NOT NULL DEFAULT 0.0000,
    referral_code VARCHAR(32) UNIQUE,
    referred_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    unclaimed_rakeback NUMERIC(20, 4) NOT NULL DEFAULT 0.0000,
    total_rakeback_earned NUMERIC(20, 4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- 3. PROVABLY FAIR BETS & GAME ROUNDS
CREATE TABLE IF NOT EXISTS bets (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(64) NOT NULL,
    game VARCHAR(32) NOT NULL,
    game_name VARCHAR(64) NOT NULL,
    currency VARCHAR(16) NOT NULL DEFAULT 'INR',
    bet_amount NUMERIC(20, 4) NOT NULL CHECK (bet_amount > 0),
    multiplier NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    payout NUMERIC(20, 4) NOT NULL DEFAULT 0.0000,
    profit NUMERIC(20, 4) NOT NULL DEFAULT 0.0000,
    won BOOLEAN NOT NULL DEFAULT FALSE,
    hash VARCHAR(128),
    round_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_game ON bets(game);
CREATE INDEX IF NOT EXISTS idx_bets_created_at ON bets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bets_won ON bets(won);

-- 4. FINANCIAL LEDGER TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL, -- deposit, withdrawal, bet, win, rakeback, referral, airdrop
    currency VARCHAR(16) NOT NULL,
    amount NUMERIC(20, 4) NOT NULL,
    balance_after NUMERIC(20, 4) NOT NULL,
    note TEXT,
    payment_method VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- 5. CASHIER DEPOSITS (INR UPI / CRYPTO)
CREATE TABLE IF NOT EXISTS deposits (
    id VARCHAR(64) PRIMARY KEY,
    transaction_id VARCHAR(64),
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    user_email VARCHAR(255),
    user_phone VARCHAR(32),
    currency VARCHAR(16) NOT NULL DEFAULT 'INR',
    amount NUMERIC(20, 4) NOT NULL CHECK (amount >= 100),
    payment_method VARCHAR(64) NOT NULL DEFAULT 'UPI',
    utr_number VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, completed, rejected
    admin_note TEXT,
    rejection_reason TEXT,
    approved_by VARCHAR(64),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_utr_number ON deposits(utr_number);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON deposits(created_at DESC);

-- 6. CASHIER WITHDRAWALS
CREATE TABLE IF NOT EXISTS withdrawals (
    id VARCHAR(64) PRIMARY KEY,
    transaction_id VARCHAR(64),
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    user_email VARCHAR(255),
    user_phone VARCHAR(32),
    currency VARCHAR(16) NOT NULL DEFAULT 'INR',
    amount NUMERIC(20, 4) NOT NULL CHECK (amount > 0),
    payout_method VARCHAR(64) NOT NULL DEFAULT 'UPI',
    payout_destination VARCHAR(255) NOT NULL,
    bank_details JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    admin_note TEXT,
    transaction_ref VARCHAR(128),
    rejection_reason TEXT,
    processed_by VARCHAR(64),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON withdrawals(created_at DESC);

-- 7. PLATFORM SETTINGS & HOUSE CONFIGURATION
CREATE TABLE IF NOT EXISTS platform_settings (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'default',
    rtp NUMERIC(5, 2) NOT NULL DEFAULT 98.00,
    house_edge NUMERIC(5, 2) NOT NULL DEFAULT 2.00,
    maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
    active_announcements TEXT,
    current_server_seed VARCHAR(128),
    server_seed_hash VARCHAR(128),
    token_treasury JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. LIQUIDITY VAULT STAKES (Be the House)
CREATE TABLE IF NOT EXISTS liquidity_vault_stakes (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(20, 4) NOT NULL CHECK (amount > 0),
    pool_share_pct NUMERIC(8, 4) NOT NULL DEFAULT 0.0000,
    unclaimed_dividends NUMERIC(20, 4) NOT NULL DEFAULT 0.0000,
    total_dividends_earned NUMERIC(20, 4) NOT NULL DEFAULT 0.0000,
    staked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_user_id ON liquidity_vault_stakes(user_id);
