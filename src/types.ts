export type VideoStatus = 'active' | 'inactive';
export type VideoCategory = 'Bangla' | 'Hindi' | 'English';

export interface ChannelItem {
  id: string;
  name: string;
  handle: string;
  members: string;
  url: string;
}

export interface VideoItem {
  id: string;
  title: string;
  category: VideoCategory | string;
  quality: string;
  duration: string;
  posterUrl: string;
  videoUrl: string;
  views: number;
  downloads: number;
  status: VideoStatus;
  createdAt: string;
}

export interface MiniAppSettings {
  watchAdsRequired: number;
  watchAdTimerSeconds: number;
  downloadAdsRequired: number;
  downloadAdTimerSeconds: number;
  forceJoinEnabled: boolean;
  monetagZoneId: string;
}

export interface DashboardStats {
  totalVideos: number;
  totalUsers: number;
  activeVideos: number;
  totalViews: number;
  totalDownloads: number;
}

export interface AdminAuthStatus {
  authenticated: boolean;
  needsClaim: boolean;
  envConfigured: boolean;
}
