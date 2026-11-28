import type { EarnMoneyConfig, EarnMoneyState } from '../types/earnMoney';

export const EARNMONEY_LIVE_CONFIG_KEY = 'earnmoney_live_config_v1';

export const DEFAULT_EARNMONEY_CONFIG: EarnMoneyConfig = {
  botName: 'Earn Money',
  welcomeTitle: 'Welcome to Earn Money',
  welcomeSubtitle: 'Join our 2 official channels to stay updated.',
  channel1Url: 'https://t.me/waincomesite',
  channel2Url: 'https://t.me/premiumapps5462',
  referBonusAmount: 0.1,
  minWithdrawAmount: 0.8,
  supportUsername: '@waincomesite',
  tasks: [
    {
      id: 'task_verify_app',
      title: 'Verify App',
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

export function createInitialEarnMoneyState(
  userId: string,
  userName: string,
  userAvatar: string,
  config: EarnMoneyConfig = DEFAULT_EARNMONEY_CONFIG
): EarnMoneyState {
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
    dailyAdsTotal: 100,
    nextSlotNumber: 1,
    dailyCeilingUsdt: 0.1,
    referralsInvited: 0,
    adsWatchedTotal: 0,
    totalReferrals: 0,
    activeReferrals: 0,
    pendingReferrals: 0,
    referralActivated: false,
    joinedWaincomesite: false,
    joinedPremiumApps: false,
    activateAdsDone: 0,
    completedTaskIds: [],
    bonusTasks: config.tasks
      .filter((t) => t.active !== false)
      .map((t) => ({ ...t, completed: false })),
    referralsList: [],
    withdrawHistory: [],
  };
}
