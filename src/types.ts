export type PaymentMethod = 'bKash' | 'Nagad';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';
export type VideoStatus = 'active' | 'inactive';
export type DownloadType = 'free' | 'paid';

export interface ChannelItem {
  id: string;
  name: string;
  handle: string;
  inviteUrl: string;
  memberCountLabel?: string;
}

export interface AdSlot {
  slot: 1 | 2 | 3;
  title: string;
  sponsor: string;
  url: string;
  durationSec: number;
}

export interface AppSettings {
  downloadPriceTk: number;
  bkashNumber: string;
  nagadNumber: string;
  forceJoinEnabled: boolean;
  ads: AdSlot[];
}

export interface VideoItem {
  id: string;
  title: string;
  category: string;
  duration: string;
  thumbnailUrl: string;
  videoUrl: string;
  views: number;
  downloads: number;
  status: VideoStatus;
  downloadType: DownloadType;
  downloadPriceTk: number;
  adsEnabled: boolean;
  createdAt: string;
  isDemoReel?: boolean;
}

export interface PaymentRequest {
  id: string;
  viewerId: string;
  userName: string;
  videoId: string;
  videoTitle: string;
  method: PaymentMethod;
  trxId: string;
  amountTk: number;
  senderNote?: string;
  status: PaymentStatus;
  createdAt: string;
  reviewedAt?: string;
}

export interface DashboardStats {
  totalVideos: number;
  totalViews: number;
  totalDownloads: number;
  totalEarningTk: number;
  pendingPaymentsCount: number;
}

export interface BootstrapPayload {
  viewerId: string;
  channels: ChannelItem[];
  joinedChannelIds: string[];
  membershipVerified: boolean;
  forceJoinEnabled: boolean;
  telegramBotConfigured: boolean;
  videos: VideoItem[];
  settings: AppSettings;
  unlockedVideoIds: string[];
  viewerPayments: PaymentRequest[];
}

export interface AdminAuthStatus {
  authenticated: boolean;
  needsClaim: boolean;
  envConfigured: boolean;
}
