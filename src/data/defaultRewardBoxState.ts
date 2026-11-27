import type { RewardBoxState } from '../types/rewardBox';

export function createInitialRewardBoxState(
  userId: string,
  userName: string,
  userAvatar: string
): RewardBoxState {
  return {
    userId,
    userName,
    userAvatar,
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
    spinUsedToday: false,
    bonusTasks: [
      {
        id: 'task_verify_app',
        title: 'Verify App',
        badge: 'Daily',
        rewardUsdt: 0.2,
        url: 'https://t.me/premiumapps5462',
        completed: false,
      },
    ],
    referralsList: [],
    withdrawHistory: [],
  };
}
