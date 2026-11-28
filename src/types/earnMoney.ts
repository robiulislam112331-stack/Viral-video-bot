export type EarnMoneyTab = 'home' | 'tasks' | 'refer' | 'withdraw';

export type ModalType =
  | null
  | 'ad_watch'
  | 'slots_list'
  | 'customer_service'
  | 'how_to_use'
  | 'add_task'
  | 'menu'
  | 'balance_info';

export type ReferBonusType = 'instant' | 'after_activation';

export type TaskType = 'Permanent' | 'Daily' | '1 Week' | '1 Time Remove';

export interface BonusTaskItem {
  id: string;
  title: string;
  taskType?: TaskType;
  badge: string;
  rewardUsdt: number;
  url?: string;
  completed: boolean;
  active?: boolean;
  createdBy?: 'admin' | 'user';
}

export interface EarnMoneyConfig {
  botName: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  channel1Url: string;
  channel2Url: string;
  minWithdrawAmount: number;
  maxWithdrawAmount: number;
  withdrawRequiredAds: number;
  withdrawFeePercent: number;
  supportUsername: string;

  // 1. Refer System Settings
  referBonusAmount: number;
  referMinAdsWatched: number;
  referMinChannelsJoined: number;
  referMinTasksCompleted: number;
  referBonusType: ReferBonusType;
  maxReferPerUser: number;
  referLinkFormat: string;

  // 2. Premium Ads Slot Settings
  premiumAdsEnabled: boolean;
  premiumAdsBudget: number;
  perAdViewReward: number;
  perAdClickReward: number;
  dailyAdsLimitPerUser: number;
  adsSlotPriceForAdvertiser: number;
  monetagLink: string;

  // 3. Maintenance Mode Settings
  maintenanceMode: boolean;
  maintenanceMessage: string;
  maintenanceAdminId: string;

  tasks: BonusTaskItem[];
  updatedAt: string;
}

export interface AdSlotClaimRecord {
  user_id: string;
  slot_id: number;
  view_reward_claimed: boolean;
  click_bonus_claimed: boolean;
  updated_at?: string;
}

export interface ReferralItem {
  id: string;
  username: string;
  initials: string;
  channelsJoined: number;
  adsWatched: number;
  status: 'PENDING' | 'ACTIVE';
  rewardUsdt: number;
}

export interface WithdrawalItem {
  id: string;
  amountUsdt: number;
  feePercent?: number;
  feeUsdt?: number;
  netAmountUsdt?: number;
  address: string;
  date: string;
  status: 'Pending' | 'Completed' | 'Rejected';
}

export interface AdminWithdrawalRecord extends WithdrawalItem {
  userId: string;
  userName: string;
  userBalance: number;
}

export interface EarnMoneyState {
  userId: string;
  userName: string;
  userAvatar: string;
  isBlocked?: boolean;
  referredBy?: string;
  totalBalance: number;
  referBalance: number;
  totalIncome: number;
  totalWithdraw: number;
  dailyAdsCompleted: number;
  dailyAdsTotal: number;
  nextSlotNumber: number;
  dailyCeilingUsdt: number;
  referralsInvited: number;
  adsWatchedTotal: number;
  totalReferrals: number;
  activeReferrals: number;
  pendingReferrals: number;
  referralActivated: boolean;
  joinedWaincomesite: boolean;
  joinedPremiumApps: boolean;
  activateAdsDone: number;
  completedTaskIds?: string[];
  taskCompletions?: Record<string, number>;
  adSlotClaims?: Record<string, AdSlotClaimRecord>;
  bonusTasks: BonusTaskItem[];
  referralsList: ReferralItem[];
  withdrawHistory: WithdrawalItem[];
}
