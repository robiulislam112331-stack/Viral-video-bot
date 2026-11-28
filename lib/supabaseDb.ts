import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import type {
  AdSlotClaimRecord,
  BonusTaskItem,
  DatabaseConnectionStatus,
  EarnMoneyConfig,
  EarnMoneyState,
  ReferBonusType,
  ReferralItem,
  TaskType,
  WithdrawalItem,
} from '../src/types/earnMoney.ts';

export type DbUserRecord = EarnMoneyState & {
  telegramPhotoFileId?: string;
};

let cachedKeySignature = '';
let cachedClient: SupabaseClient | null = null;

function readEnvFallback(): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const filename of ['.env', '.env.local', '.env.production']) {
    const filePath = path.resolve(process.cwd(), filename);
    if (fs.existsSync(filePath)) {
      try {
        const parsed = dotenv.parse(fs.readFileSync(filePath, 'utf-8'));
        Object.assign(merged, parsed);
      } catch {
        // ignore unreadable env file
      }
    }
  }
  return merged;
}

function getSupabaseCredentials(): { url: string; key: string } {
  let url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  let key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!url || !key) {
    const fileEnv = readEnvFallback();
    if (!url) {
      url = (fileEnv.SUPABASE_URL || fileEnv.VITE_SUPABASE_URL || '').trim();
    }
    if (!key) {
      key = (
        fileEnv.SUPABASE_SERVICE_ROLE_KEY ||
        fileEnv.SUPABASE_ANON_KEY ||
        fileEnv.VITE_SUPABASE_ANON_KEY ||
        ''
      ).trim();
    }
  }
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseCredentials();
  if (!url || !key) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    cachedClient = null;
    cachedKeySignature = '';
    return null;
  }
  const { url, key } = getSupabaseCredentials();
  const sig = `${url}::${key.slice(0, 12)}::${key.length}`;
  if (cachedClient && cachedKeySignature === sig) {
    return cachedClient;
  }
  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  cachedKeySignature = sig;
  return cachedClient;
}

const REQUIRED_TABLES = ['tasks', 'users', 'settings', 'withdraws', 'ads_config'] as const;

export async function checkSupabaseConnection(): Promise<DatabaseConnectionStatus> {
  if (!isSupabaseConfigured()) {
    return {
      connected: false,
      provider: 'Supabase',
      configured: false,
      error: 'Connect Database to Save Permanently',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      connected: false,
      provider: 'Supabase',
      configured: false,
      error: 'Connect Database to Save Permanently',
    };
  }

  try {
    const checks = await Promise.all(
      REQUIRED_TABLES.map(async (table) => {
        const { error } = await client.from(table).select('*', { head: true, count: 'exact' });
        return { table, error };
      })
    );

    const missingTables = checks
      .filter((c) => {
        if (!c.error) return false;
        const msg = (c.error.message || '').toLowerCase();
        return (
          c.error.code === '42P01' ||
          c.error.code === 'PGRST205' ||
          msg.includes('does not exist') ||
          msg.includes('could not find the table')
        );
      })
      .map((c) => c.table);

    if (missingTables.length > 0) {
      return {
        connected: false,
        provider: 'Supabase',
        configured: true,
        missingTables,
        error: 'Connect Database to Save Permanently',
      };
    }

    const firstErr = checks.find((c) => Boolean(c.error))?.error;
    if (firstErr) {
      return {
        connected: false,
        provider: 'Supabase',
        configured: true,
        error: 'Connect Database to Save Permanently',
      };
    }

    return {
      connected: true,
      provider: 'Supabase',
      configured: true,
    };
  } catch {
    return {
      connected: false,
      provider: 'Supabase',
      configured: true,
      error: 'Connect Database to Save Permanently',
    };
  }
}

function normalizeTaskTypeLocal(rawType?: string, rawBadge?: string): TaskType {
  const c = (rawType || rawBadge || '').trim().toLowerCase();
  if (c === 'permanent') return 'Permanent';
  if (
    c === '1 time remove' ||
    c === '1timeremove' ||
    c === 'one time remove' ||
    c === '1 time' ||
    c === 'onetime'
  ) {
    return '1 Time Remove';
  }
  if (c === '1 week' || c === '1week' || c === 'weekly' || c === 'week') return '1 Week';
  return 'Daily';
}

function numVal(v: unknown, fallback: number, min = 0): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

export async function loadConfigFromSupabase(
  defaultConfig: EarnMoneyConfig
): Promise<EarnMoneyConfig | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const [settingsRes, adsRes, tasksRes] = await Promise.all([
    client.from('settings').select('*').eq('id', 1).maybeSingle(),
    client.from('ads_config').select('*').eq('id', 1).maybeSingle(),
    client.from('tasks').select('*').order('created_at', { ascending: false }),
  ]);

  if (settingsRes.error || adsRes.error || tasksRes.error) {
    throw new Error(
      settingsRes.error?.message ||
        adsRes.error?.message ||
        tasksRes.error?.message ||
        'Failed loading Supabase config'
    );
  }

  let s = settingsRes.data as Record<string, unknown> | null;
  if (!s) {
    await saveSettingsRowToSupabase(client, defaultConfig);
    s = null;
  }

  let a = adsRes.data as Record<string, unknown> | null;
  if (!a) {
    await saveAdsConfigRowToSupabase(client, defaultConfig);
    a = null;
  }

  const tasksRows = Array.isArray(tasksRes.data) ? (tasksRes.data as Record<string, unknown>[]) : [];
  const tasks: BonusTaskItem[] = tasksRows.map((row) => {
    const taskType = normalizeTaskTypeLocal(
      typeof row.task_type === 'string'
        ? row.task_type
        : typeof row.type === 'string'
          ? row.type
          : undefined,
      typeof row.badge === 'string' ? row.badge : undefined
    );
    return {
      id: String(row.id),
      title: String(row.title || 'Task').slice(0, 80),
      taskType,
      badge: taskType,
      rewardUsdt: numVal(row.reward_usdt ?? row.reward, 0.1, 0),
      url: typeof row.url === 'string' ? row.url : defaultConfig.channel1Url,
      completed: false,
      active: row.active !== false,
      createdBy: row.created_by === 'user' ? 'user' : 'admin',
    };
  });

  const referBonusType: ReferBonusType =
    s?.refer_bonus_type === 'instant' || s?.refer_bonus_type === 'after_activation'
      ? (s.refer_bonus_type as ReferBonusType)
      : defaultConfig.referBonusType;

  return {
    botName:
      typeof s?.bot_name === 'string' && s.bot_name.trim()
        ? s.bot_name.trim()
        : defaultConfig.botName,
    welcomeTitle:
      typeof s?.welcome_title === 'string' && s.welcome_title.trim()
        ? s.welcome_title.trim()
        : defaultConfig.welcomeTitle,
    welcomeSubtitle:
      typeof s?.welcome_subtitle === 'string' && s.welcome_subtitle.trim()
        ? s.welcome_subtitle.trim()
        : defaultConfig.welcomeSubtitle,
    channel1Url:
      typeof s?.channel1_url === 'string' && s.channel1_url.trim()
        ? s.channel1_url.trim()
        : defaultConfig.channel1Url,
    channel2Url:
      typeof s?.channel2_url === 'string' && s.channel2_url.trim()
        ? s.channel2_url.trim()
        : defaultConfig.channel2Url,
    minWithdrawAmount: numVal(s?.min_withdraw_amount, defaultConfig.minWithdrawAmount),
    maxWithdrawAmount: numVal(s?.max_withdraw_amount, defaultConfig.maxWithdrawAmount),
    withdrawRequiredAds: Math.floor(
      numVal(s?.withdraw_required_ads, defaultConfig.withdrawRequiredAds)
    ),
    withdrawFeePercent: Math.min(
      100,
      numVal(s?.withdraw_fee_percent, defaultConfig.withdrawFeePercent)
    ),
    supportUsername:
      typeof s?.support_username === 'string' && s.support_username.trim()
        ? s.support_username.trim()
        : defaultConfig.supportUsername,

    referBonusAmount: numVal(s?.refer_bonus_amount, defaultConfig.referBonusAmount),
    referMinAdsWatched: Math.floor(
      numVal(s?.refer_min_ads_watched, defaultConfig.referMinAdsWatched)
    ),
    referMinChannelsJoined: Math.floor(
      numVal(s?.refer_min_channels_joined, defaultConfig.referMinChannelsJoined)
    ),
    referMinTasksCompleted: Math.floor(
      numVal(s?.refer_min_tasks_completed, defaultConfig.referMinTasksCompleted)
    ),
    referBonusType,
    maxReferPerUser: Math.floor(numVal(s?.max_refer_per_user, defaultConfig.maxReferPerUser)),
    referLinkFormat:
      typeof s?.refer_link_format === 'string' && s.refer_link_format.trim()
        ? s.refer_link_format.trim()
        : defaultConfig.referLinkFormat,

    premiumAdsEnabled:
      typeof a?.premium_ads_enabled === 'boolean'
        ? a.premium_ads_enabled
        : defaultConfig.premiumAdsEnabled,
    premiumAdsBudget: numVal(a?.premium_ads_budget, defaultConfig.premiumAdsBudget),
    perAdViewReward: numVal(a?.per_ad_view_reward, defaultConfig.perAdViewReward),
    perAdClickReward: numVal(a?.per_ad_click_reward, defaultConfig.perAdClickReward),
    dailyAdsLimitPerUser: Math.max(
      1,
      Math.floor(numVal(a?.daily_ads_limit_per_user, defaultConfig.dailyAdsLimitPerUser, 1))
    ),
    adsSlotPriceForAdvertiser: numVal(
      a?.ads_slot_price_for_advertiser,
      defaultConfig.adsSlotPriceForAdvertiser
    ),
    monetagLink:
      typeof a?.monetag_link === 'string' && a.monetag_link.trim()
        ? a.monetag_link.trim()
        : defaultConfig.monetagLink,

    maintenanceMode: Boolean(s?.maintenance_mode),
    maintenanceMessage:
      typeof s?.maintenance_message === 'string' && s.maintenance_message.trim()
        ? s.maintenance_message.trim()
        : defaultConfig.maintenanceMessage,
    maintenanceAdminId:
      typeof s?.maintenance_admin_id === 'string'
        ? s.maintenance_admin_id.trim()
        : defaultConfig.maintenanceAdminId,

    tasks,
    updatedAt:
      typeof s?.updated_at === 'string'
        ? s.updated_at
        : typeof a?.updated_at === 'string'
          ? a.updated_at
          : new Date().toISOString(),
  };
}

async function saveSettingsRowToSupabase(
  client: SupabaseClient,
  config: EarnMoneyConfig
): Promise<void> {
  const { error } = await client.from('settings').upsert(
    {
      id: 1,
      bot_name: config.botName,
      welcome_title: config.welcomeTitle,
      welcome_subtitle: config.welcomeSubtitle,
      channel1_url: config.channel1Url,
      channel2_url: config.channel2Url,
      min_withdraw_amount: config.minWithdrawAmount,
      max_withdraw_amount: config.maxWithdrawAmount,
      withdraw_required_ads: config.withdrawRequiredAds,
      withdraw_fee_percent: config.withdrawFeePercent,
      support_username: config.supportUsername,
      refer_bonus_amount: config.referBonusAmount,
      refer_min_ads_watched: config.referMinAdsWatched,
      refer_min_channels_joined: config.referMinChannelsJoined,
      refer_min_tasks_completed: config.referMinTasksCompleted,
      refer_bonus_type: config.referBonusType,
      max_refer_per_user: config.maxReferPerUser,
      refer_link_format: config.referLinkFormat,
      maintenance_mode: config.maintenanceMode,
      maintenance_message: config.maintenanceMessage,
      maintenance_admin_id: config.maintenanceAdminId,
      updated_at: config.updatedAt || new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

async function saveAdsConfigRowToSupabase(
  client: SupabaseClient,
  config: EarnMoneyConfig
): Promise<void> {
  const { error } = await client.from('ads_config').upsert(
    {
      id: 1,
      premium_ads_enabled: config.premiumAdsEnabled,
      premium_ads_budget: config.premiumAdsBudget,
      per_ad_view_reward: config.perAdViewReward,
      per_ad_click_reward: config.perAdClickReward,
      daily_ads_limit_per_user: config.dailyAdsLimitPerUser,
      ads_slot_price_for_advertiser: config.adsSlotPriceForAdvertiser,
      monetag_link: config.monetagLink,
      updated_at: config.updatedAt || new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

export async function saveConfigToSupabase(config: EarnMoneyConfig): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Connect Database to Save Permanently');
  await Promise.all([
    saveSettingsRowToSupabase(client, config),
    saveAdsConfigRowToSupabase(client, config),
  ]);
}

export async function insertTaskToSupabase(task: BonusTaskItem): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Connect Database to Save Permanently');
  const taskType = normalizeTaskTypeLocal(task.taskType, task.badge);
  const now = new Date().toISOString();
  const { error } = await client.from('tasks').insert({
    id: task.id,
    title: task.title,
    task_type: taskType,
    badge: taskType,
    reward_usdt: task.rewardUsdt,
    url: task.url || '',
    active: task.active !== false,
    created_by: task.createdBy || 'admin',
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
}

export async function updateTaskInSupabase(task: BonusTaskItem): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Connect Database to Save Permanently');
  const taskType = normalizeTaskTypeLocal(task.taskType, task.badge);
  const { error } = await client
    .from('tasks')
    .update({
      title: task.title,
      task_type: taskType,
      badge: taskType,
      reward_usdt: task.rewardUsdt,
      url: task.url || '',
      active: task.active !== false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', task.id);
  if (error) throw new Error(error.message);
}

export async function deleteTaskFromSupabase(taskId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Connect Database to Save Permanently');
  const { error } = await client.from('tasks').delete().eq('id', taskId);
  if (error) throw new Error(error.message);
}

export async function loadUsersAndClaimsFromSupabase(
  config: EarnMoneyConfig
): Promise<{ usersMap: Record<string, DbUserRecord>; adSlotClaims: AdSlotClaimRecord[] } | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const [usersRes, withdrawsRes, claimsRes] = await Promise.all([
    client.from('users').select('*'),
    client.from('withdraws').select('*').order('created_at', { ascending: false }),
    client.from('ad_slot_claims').select('*'),
  ]);

  if (usersRes.error || withdrawsRes.error) {
    throw new Error(
      usersRes.error?.message ||
        withdrawsRes.error?.message ||
        'Failed loading Supabase users'
    );
  }

  const claimsRows = claimsRes.error ? [] : (claimsRes.data || []);

  const withdrawsByUser: Record<string, WithdrawalItem[]> = {};
  for (const w of (withdrawsRes.data || []) as Record<string, unknown>[]) {
    const uid = String(w.user_id || '');
    if (!uid) continue;
    if (!withdrawsByUser[uid]) withdrawsByUser[uid] = [];
    const statusRaw = String(w.status || 'Pending');
    const status: WithdrawalItem['status'] =
      statusRaw === 'Completed' || statusRaw === 'Rejected' ? statusRaw : 'Pending';
    withdrawsByUser[uid].push({
      id: String(w.id),
      amountUsdt: numVal(w.amount_usdt, 0),
      feePercent: numVal(w.fee_percent, 0),
      feeUsdt: numVal(w.fee_usdt, 0),
      netAmountUsdt: numVal(w.net_amount_usdt, 0),
      address: String(w.address || ''),
      date: String(w.date_label || ''),
      status,
    });
  }

  const adSlotClaims: AdSlotClaimRecord[] = (
    claimsRows as Record<string, unknown>[]
  ).map((c) => ({
    user_id: String(c.user_id),
    slot_id: Number(c.slot_id) || 1,
    view_reward_claimed: Boolean(c.view_reward_claimed),
    click_bonus_claimed: Boolean(c.click_bonus_claimed),
    updated_at: typeof c.updated_at === 'string' ? c.updated_at : undefined,
  }));

  const dailyTotal = Math.max(1, Number(config.dailyAdsLimitPerUser) || 100);
  const dailyCeiling = Number((dailyTotal * (config.perAdViewReward || 0.01)).toFixed(4));

  const usersMap: Record<string, DbUserRecord> = {};
  for (const row of (usersRes.data || []) as Record<string, unknown>[]) {
    const uid = String(row.user_id || '');
    if (!uid) continue;
    const userName = String(row.user_name || `User ${uid}`);
    const isNumericTelegramId = /^\d{4,20}$/.test(uid);
    const isTg =
      Boolean(row.is_telegram_user) ||
      (isNumericTelegramId && userName !== 'Earn Money User' && userName !== 'Preview Guest');
    if (!isTg || (userName === 'Earn Money User' && !Boolean(row.is_telegram_user))) continue;

    const completedTaskIds = Array.isArray(row.completed_task_ids)
      ? (row.completed_task_ids as string[])
      : [];
    const taskCompletions =
      row.task_completions && typeof row.task_completions === 'object' && !Array.isArray(row.task_completions)
        ? (row.task_completions as Record<string, number>)
        : {};
    const bonusTasks = Array.isArray(row.bonus_tasks) ? (row.bonus_tasks as BonusTaskItem[]) : [];
    const referralsList = Array.isArray(row.referrals_list)
      ? (row.referrals_list as ReferralItem[])
      : [];

    const dailyCompleted = Math.floor(numVal(row.daily_ads_completed, 0));

    usersMap[uid] = {
      userId: uid,
      userName,
      firstName: typeof row.first_name === 'string' ? row.first_name : undefined,
      lastName: typeof row.last_name === 'string' ? row.last_name : undefined,
      username: typeof row.username === 'string' ? row.username : undefined,
      userAvatar: typeof row.user_avatar === 'string' ? row.user_avatar : '',
      telegramPhotoFileId:
        typeof row.telegram_photo_file_id === 'string' ? row.telegram_photo_file_id : undefined,
      isTelegramUser: true,
      isBlocked: Boolean(row.is_blocked),
      joinedAt: typeof row.joined_at === 'string' ? row.joined_at : undefined,
      lastActiveAt: typeof row.last_active_at === 'string' ? row.last_active_at : undefined,
      totalBalance: numVal(row.total_balance, 0),
      referBalance: numVal(row.refer_balance, 0),
      totalIncome: numVal(row.total_income, 0),
      totalWithdraw: numVal(row.total_withdraw, 0),
      dailyAdsCompleted: dailyCompleted,
      dailyAdsTotal: dailyTotal,
      nextSlotNumber: Math.min(dailyTotal, dailyCompleted + 1),
      dailyCeilingUsdt: dailyCeiling,
      referralsInvited: Math.floor(numVal(row.referrals_invited, 0)),
      adsWatchedTotal: Math.floor(numVal(row.ads_watched_total, 0)),
      totalReferrals: Math.floor(numVal(row.total_referrals, 0)),
      activeReferrals: Math.floor(numVal(row.active_referrals, 0)),
      pendingReferrals: Math.floor(numVal(row.pending_referrals, 0)),
      referralActivated: Boolean(row.referral_activated),
      referredBy: typeof row.referred_by === 'string' ? row.referred_by : undefined,
      joinedWaincomesite: Boolean(row.joined_waincomesite),
      joinedPremiumApps: Boolean(row.joined_premium_apps),
      activateAdsDone: Math.floor(numVal(row.ads_watched_total, 0)),
      completedTaskIds,
      taskCompletions,
      adSlotClaims: {},
      bonusTasks,
      referralsList,
      withdrawHistory: withdrawsByUser[uid] || [],
    };
  }

  return { usersMap, adSlotClaims };
}

export async function upsertUserToSupabase(user: DbUserRecord): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !user.isTelegramUser) return;

  const { error } = await client.from('users').upsert(
    {
      user_id: user.userId,
      user_name: user.userName,
      first_name: user.firstName ?? null,
      last_name: user.lastName ?? null,
      username: user.username ?? null,
      user_avatar: user.userAvatar ?? '',
      telegram_photo_file_id: user.telegramPhotoFileId ?? null,
      is_telegram_user: Boolean(user.isTelegramUser),
      is_blocked: Boolean(user.isBlocked),
      joined_at: user.joinedAt || new Date().toISOString(),
      last_active_at: user.lastActiveAt || new Date().toISOString(),
      total_balance: user.totalBalance,
      refer_balance: user.referBalance,
      total_income: user.totalIncome,
      total_withdraw: user.totalWithdraw,
      daily_ads_completed: user.dailyAdsCompleted,
      ads_watched_total: user.adsWatchedTotal,
      referrals_invited: user.referralsInvited,
      total_referrals: user.totalReferrals,
      active_referrals: user.activeReferrals,
      pending_referrals: user.pendingReferrals,
      referral_activated: Boolean(user.referralActivated),
      referred_by: user.referredBy ?? null,
      joined_waincomesite: Boolean(user.joinedWaincomesite),
      joined_premium_apps: Boolean(user.joinedPremiumApps),
      completed_task_ids: user.completedTaskIds || [],
      task_completions: user.taskCompletions || {},
      bonus_tasks: (user.bonusTasks || []).filter((t) => t.createdBy === 'user'),
      referrals_list: user.referralsList || [],
    },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(error.message);
}

export async function insertWithdrawToSupabase(userId: string, wd: WithdrawalItem): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  const now = new Date().toISOString();
  const { error } = await client.from('withdraws').insert({
    id: wd.id,
    user_id: userId,
    amount_usdt: wd.amountUsdt,
    fee_percent: wd.feePercent ?? 0,
    fee_usdt: wd.feeUsdt ?? 0,
    net_amount_usdt: wd.netAmountUsdt ?? wd.amountUsdt,
    address: wd.address,
    date_label: wd.date,
    status: wd.status,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
}

export async function updateWithdrawStatusInSupabase(
  wdId: string,
  status: WithdrawalItem['status']
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client
    .from('withdraws')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', wdId);
  if (error) throw new Error(error.message);
}

export async function upsertAdSlotClaimToSupabase(claim: AdSlotClaimRecord): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.from('ad_slot_claims').upsert(
    {
      user_id: claim.user_id,
      slot_id: claim.slot_id,
      view_reward_claimed: claim.view_reward_claimed,
      click_bonus_claimed: claim.click_bonus_claimed,
      updated_at: claim.updated_at || new Date().toISOString(),
    },
    { onConflict: 'user_id,slot_id' }
  );
  if (error) {
    const msg = (error.message || '').toLowerCase();
    if (error.code === '42P01' || error.code === 'PGRST205' || msg.includes('does not exist')) {
      return;
    }
    throw new Error(error.message);
  }
}
