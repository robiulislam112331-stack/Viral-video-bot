-- Run this SQL in your Supabase Project -> SQL Editor to create all persistent tables.
-- Tables: tasks, users, settings, withdraws, ads_config, ad_slot_claims

CREATE TABLE IF NOT EXISTS public.settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  bot_name TEXT NOT NULL DEFAULT 'Earn Money',
  welcome_title TEXT NOT NULL DEFAULT 'Welcome to Earn Money',
  welcome_subtitle TEXT NOT NULL DEFAULT 'Join our 2 official channels to stay updated.',
  channel1_url TEXT NOT NULL DEFAULT 'https://t.me/waincomesite',
  channel2_url TEXT NOT NULL DEFAULT 'https://t.me/premiumapps5462',
  min_withdraw_amount NUMERIC(12, 4) NOT NULL DEFAULT 1,
  max_withdraw_amount NUMERIC(12, 4) NOT NULL DEFAULT 100,
  withdraw_required_ads INTEGER NOT NULL DEFAULT 10,
  withdraw_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  support_username TEXT NOT NULL DEFAULT '@waincomesite',
  refer_bonus_amount NUMERIC(12, 4) NOT NULL DEFAULT 0.1,
  refer_min_ads_watched INTEGER NOT NULL DEFAULT 0,
  refer_min_channels_joined INTEGER NOT NULL DEFAULT 0,
  refer_min_tasks_completed INTEGER NOT NULL DEFAULT 0,
  refer_bonus_type TEXT NOT NULL DEFAULT 'after_activation',
  max_refer_per_user INTEGER NOT NULL DEFAULT 0,
  refer_link_format TEXT NOT NULL DEFAULT 'https://t.me/moneyxearnbot?start=ref_[USER_ID]',
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message TEXT NOT NULL DEFAULT 'Bot is under maintenance. New features coming soon. Please try again later.',
  maintenance_admin_id TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ads_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  premium_ads_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  premium_ads_budget NUMERIC(14, 4) NOT NULL DEFAULT 100,
  per_ad_view_reward NUMERIC(12, 4) NOT NULL DEFAULT 0.01,
  per_ad_click_reward NUMERIC(12, 4) NOT NULL DEFAULT 0.02,
  daily_ads_limit_per_user INTEGER NOT NULL DEFAULT 100,
  ads_slot_price_for_advertiser NUMERIC(12, 4) NOT NULL DEFAULT 5,
  monetag_link TEXT NOT NULL DEFAULT '<script src=''//libtl.com/sdk.js'' data-zone=''12118221'' data-sdk=''show_12118221''></script>',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'Daily',
  badge TEXT NOT NULL DEFAULT 'Daily',
  reward_usdt NUMERIC(12, 4) NOT NULL DEFAULT 0.1,
  url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.users (
  user_id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  user_avatar TEXT,
  telegram_photo_file_id TEXT,
  is_telegram_user BOOLEAN NOT NULL DEFAULT FALSE,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_balance NUMERIC(14, 4) NOT NULL DEFAULT 0,
  refer_balance NUMERIC(14, 4) NOT NULL DEFAULT 0,
  total_income NUMERIC(14, 4) NOT NULL DEFAULT 0,
  total_withdraw NUMERIC(14, 4) NOT NULL DEFAULT 0,
  daily_ads_completed INTEGER NOT NULL DEFAULT 0,
  ads_watched_total INTEGER NOT NULL DEFAULT 0,
  referrals_invited INTEGER NOT NULL DEFAULT 0,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  active_referrals INTEGER NOT NULL DEFAULT 0,
  pending_referrals INTEGER NOT NULL DEFAULT 0,
  referral_activated BOOLEAN NOT NULL DEFAULT FALSE,
  referred_by TEXT,
  joined_waincomesite BOOLEAN NOT NULL DEFAULT FALSE,
  joined_premium_apps BOOLEAN NOT NULL DEFAULT FALSE,
  completed_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  task_completions JSONB NOT NULL DEFAULT '{}'::jsonb,
  bonus_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  referrals_list JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.withdraws (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_usdt NUMERIC(14, 4) NOT NULL,
  fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  fee_usdt NUMERIC(14, 4) NOT NULL DEFAULT 0,
  net_amount_usdt NUMERIC(14, 4) NOT NULL,
  address TEXT NOT NULL,
  date_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ad_slot_claims (
  user_id TEXT NOT NULL,
  slot_id INTEGER NOT NULL,
  view_reward_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  click_bonus_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, slot_id)
);

-- Seed default single-row settings & ads_config if empty (never seeds fake users or fake tasks)
INSERT INTO public.settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ads_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Note: This app accesses Supabase exclusively via server-side Express routes (/api/*).
-- Keeping RLS disabled on these backend-only tables allows VITE_SUPABASE_ANON_KEY to work
-- seamlessly from server.ts; if you enable RLS, add SUPABASE_SERVICE_ROLE_KEY in Settings -> Secrets.
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdraws DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_slot_claims DISABLE ROW LEVEL SECURITY;
