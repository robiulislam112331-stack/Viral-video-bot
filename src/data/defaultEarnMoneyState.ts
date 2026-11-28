import type { BonusTaskItem, EarnMoneyConfig, EarnMoneyState, TaskType } from '../types/earnMoney';

export const EARNMONEY_LIVE_CONFIG_KEY = 'earnmoney_live_config_v1';

export const TASK_TYPES: TaskType[] = ['Permanent', 'Daily', '1 Week'];

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export function normalizeTaskType(rawType?: string, rawBadge?: string): TaskType {
  const candidate = (rawType || rawBadge || '').trim().toLowerCase();
  if (candidate === 'permanent') return 'Permanent';
  if (candidate === '1 week' || candidate === '1week' || candidate === 'weekly' || candidate === 'week') {
    return '1 Week';
  }
  return 'Daily';
}

export function getTaskCooldownMs(taskType: TaskType): number {
  if (taskType === 'Permanent') return Number.POSITIVE_INFINITY;
  if (taskType === '1 Week') return WEEK_MS;
  return DAY_MS;
}

export function isTaskCompletedForUser(
  task: Pick<BonusTaskItem, 'id' | 'taskType' | 'badge' | 'completed'>,
  state: Pick<EarnMoneyState, 'completedTaskIds' | 'taskCompletions'>,
  now = Date.now()
): boolean {
  const resolvedType = normalizeTaskType(task.taskType, task.badge);
  const completedAt = state.taskCompletions?.[task.id];
  if (typeof completedAt === 'number' && Number.isFinite(completedAt) && completedAt > 0) {
    if (resolvedType === 'Permanent') return true;
    return now - completedAt < getTaskCooldownMs(resolvedType);
  }
  if (resolvedType === 'Permanent' && state.completedTaskIds?.includes(task.id)) {
    return true;
  }
  return Boolean(task.completed);
}

export const DEFAULT_EARNMONEY_CONFIG: EarnMoneyConfig = {
  botName: 'Earn Money',
  welcomeTitle: 'Welcome to Earn Money',
  welcomeSubtitle: 'Join our 2 official channels to stay updated.',
  channel1Url: 'https://t.me/waincomesite',
  channel2Url: 'https://t.me/premiumapps5462',
  minWithdrawAmount: 0.8,
  supportUsername: '@waincomesite',

  // 1. Refer System Settings
  referBonusAmount: 0.1,
  referMinAdsWatched: 0,
  referMinChannelsJoined: 0,
  referMinTasksCompleted: 0,
  referBonusType: 'after_activation',
  maxReferPerUser: 0,
  referLinkFormat: 'https://t.me/moneyxearnbot?start=ref_[USER_ID]',

  // 2. Premium Ads Slot Settings
  premiumAdsEnabled: true,
  premiumAdsBudget: 100,
  perAdViewReward: 0.01,
  perAdClickReward: 0.02,
  dailyAdsLimitPerUser: 20,
  adsSlotPriceForAdvertiser: 5,

  // 3. Maintenance Mode Settings
  maintenanceMode: false,
  maintenanceMessage:
    'Bot is under maintenance. New features coming soon. Please try again later.',
  maintenanceAdminId: '',

  tasks: [
    {
      id: 'task_verify_app',
      title: 'Verify App',
      taskType: 'Daily',
      badge: 'Daily',
      rewardUsdt: 0.2,
      url: 'https://t.me/premiumapps5462',
      completed: false,
      active: true,
      createdBy: 'admin',
    },
  ],
  updatedAt: '2026-11-27T00:00:00.000Z',
};

export function deriveTelegramHandle(urlStr: string, fallback = '@Channel'): string {
  const trimmed = (urlStr || '').trim();
  if (!trimmed) return fallback;
  try {
    const parsed = new URL(trimmed);
    const segment = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
    if (segment && !segment.startsWith('+')) {
      return segment.startsWith('@') ? segment : `@${segment}`;
    }
  } catch {
    // ignore URL parse error
  }
  if (trimmed.startsWith('@')) return trimmed;
  return fallback;
}

export function buildSupportTelegramUrl(supportUsername: string): string {
  const clean = (supportUsername || '').trim();
  if (!clean) return 'https://t.me/waincomesite';
  if (/^https?:\/\//i.test(clean)) return clean;
  const handle = clean.replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '');
  return handle ? `https://t.me/${handle}` : 'https://t.me/waincomesite';
}

export function formatReferralLink(format: string, userId: string): string {
  const template =
    (format || '').trim() || 'https://t.me/moneyxearnbot?start=ref_[USER_ID]';
  if (/\[USER_ID\]|\{USER_ID\}/i.test(template)) {
    return template.replace(/\[USER_ID\]|\{USER_ID\}/gi, userId);
  }
  return `${template}${userId}`;
}

export function isReferActivationComplete(
  state: Pick<
    EarnMoneyState,
    'adsWatchedTotal' | 'joinedWaincomesite' | 'joinedPremiumApps' | 'completedTaskIds' | 'bonusTasks'
  >,
  config: Pick<
    EarnMoneyConfig,
    'referMinAdsWatched' | 'referMinChannelsJoined' | 'referMinTasksCompleted'
  >
): boolean {
  const channelsDone = (state.joinedWaincomesite ? 1 : 0) + (state.joinedPremiumApps ? 1 : 0);
  const tasksDone =
    state.completedTaskIds?.length ?? state.bonusTasks.filter((t) => t.completed).length;

  return (
    state.adsWatchedTotal >= config.referMinAdsWatched &&
    channelsDone >= config.referMinChannelsJoined &&
    tasksDone >= config.referMinTasksCompleted
  );
}

export function createInitialEarnMoneyState(
  userId: string,
  userName: string,
  userAvatar: string,
  config: EarnMoneyConfig = DEFAULT_EARNMONEY_CONFIG
): EarnMoneyState {
  const dailyTotal = Math.max(1, config.dailyAdsLimitPerUser || 20);
  const ceiling = Number((dailyTotal * (config.perAdViewReward || 0.01)).toFixed(4));
  const instantRefer =
    config.referMinAdsWatched === 0 &&
    config.referMinChannelsJoined === 0 &&
    config.referMinTasksCompleted === 0;

  return {
    userId,
    userName,
    userAvatar,
    isBlocked: false,
    totalBalance: 0,
    referBalance: 0,
    totalIncome: 0,
    totalWithdraw: 0,
    dailyAdsCompleted: 0,
    dailyAdsTotal: dailyTotal,
    nextSlotNumber: 1,
    dailyCeilingUsdt: ceiling,
    referralsInvited: 0,
    adsWatchedTotal: 0,
    totalReferrals: 0,
    activeReferrals: 0,
    pendingReferrals: 0,
    referralActivated: instantRefer,
    joinedWaincomesite: false,
    joinedPremiumApps: false,
    activateAdsDone: 0,
    completedTaskIds: [],
    taskCompletions: {},
    bonusTasks: config.tasks
      .filter((t) => t.active !== false)
      .map((t) => {
        const taskType = normalizeTaskType(t.taskType, t.badge);
        return { ...t, taskType, badge: taskType, completed: false };
      }),
    referralsList: [],
    withdrawHistory: [],
  };
}
