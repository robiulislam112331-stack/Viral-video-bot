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

export interface BonusTaskItem {
  id: string;
  title: string;
  badge: string;
  rewardUsdt: number;
  url?: string;
  completed: boolean;
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
  address: string;
  date: string;
  status: 'Completed' | 'Rejected';
}

export interface EarnMoneyState {
  userId: string;
  userName: string;
  userAvatar: string;
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
  bonusTasks: BonusTaskItem[];
  referralsList: ReferralItem[];
  withdrawHistory: WithdrawalItem[];
}
