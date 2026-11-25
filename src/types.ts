export type VideoStatus = 'active' | 'inactive';

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
  downloadAdsRequired: number;
  monetagZoneId: string;
}

export interface DashboardStats {
  totalVideos: number;
  activeVideos: number;
  totalViews: number;
  totalDownloads: number;
}

export interface AdminAuthStatus {
  authenticated: boolean;
  needsClaim: boolean;
  envConfigured: boolean;
}
