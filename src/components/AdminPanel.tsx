import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Edit3,
  Film,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Megaphone,
  Plus,
  Power,
  Radio,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type {
  AdminAuthStatus,
  ChannelItem,
  DashboardStats,
  MiniAppSettings,
  VideoCategory,
  VideoItem,
  VideoStatus,
} from '../types';

type AdminTab = 'dashboard' | 'videos' | 'ads' | 'channels';

interface AdminPanelProps {
  adminToken: string | null;
  onSetAdminToken: (token: string | null) => void;
}

const CATEGORIES: VideoCategory[] = ['Bangla', 'Hindi', 'English'];
const LIVE_SYNC_STORAGE_KEY = 'cinevault_live_config_v1';

function formatDurationFromSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '10:00';
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function broadcastConfigToLocalStorage(
  settings: MiniAppSettings,
  videos?: VideoItem[],
  channels?: ChannelItem[]
) {
  try {
    const existingRaw = window.localStorage.getItem(LIVE_SYNC_STORAGE_KEY);
    const existing = existingRaw ? (JSON.parse(existingRaw) as Record<string, unknown>) : {};
    const nextPayload = {
      ...existing,
      watchAdsRequired: settings.watchAdsRequired,
      watchAdTimerSeconds: settings.watchAdTimerSeconds,
      downloadAdsRequired: settings.downloadAdsRequired,
      downloadAdTimerSeconds: settings.downloadAdTimerSeconds,
      forceJoinEnabled: settings.forceJoinEnabled,
      ...(videos ? { videos: videos.filter((v) => v.status === 'active') } : {}),
      ...(channels ? { channels } : {}),
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(LIVE_SYNC_STORAGE_KEY, JSON.stringify(nextPayload));
  } catch {
    // ignore storage quota/availability errors
  }
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ adminToken, onSetAdminToken }) => {
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus | null>(null);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Add / Edit Video Form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [vidTitle, setVidTitle] = useState('');
  const [vidCategory, setVidCategory] = useState<VideoCategory>('Bangla');
  const [vidPosterUrl, setVidPosterUrl] = useState('');
  const [vidUrl, setVidUrl] = useState('');
  const [vidDuration, setVidDuration] = useState('10:00');
  const [vidQuality, setVidQuality] = useState('1080p');
  const [vidStatus, setVidStatus] = useState<VideoStatus>('active');
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [savingVideo, setSavingVideo] = useState(false);

  // Channels Form
  const [chName, setChName] = useState('');
  const [chHandle, setChHandle] = useState('');
  const [chUrl, setChUrl] = useState('');
  const [savingChannel, setSavingChannel] = useState(false);

  // Ad Settings Form
  const [watchAdsRequired, setWatchAdsRequired] = useState(1);
  const [watchAdTimerSeconds, setWatchAdTimerSeconds] = useState(15);
  const [downloadAdsRequired, setDownloadAdsRequired] = useState(2);
  const [downloadAdTimerSeconds, setDownloadAdTimerSeconds] = useState(15);
  const [forceJoinEnabled, setForceJoinEnabled] = useState(true);
  const [monetagZoneId, setMonetagZoneId] = useState('12118221');
  const [savingSettings, setSavingSettings] = useState(false);

  const showToast = (type: 'ok' | 'err', text: string) => {
    setBanner({ type, text });
    window.setTimeout(() => {
      setBanner((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  const currentSettingsSnapshot = (): MiniAppSettings => ({
    watchAdsRequired,
    watchAdTimerSeconds,
    downloadAdsRequired,
    downloadAdTimerSeconds,
    forceJoinEnabled,
    monetagZoneId,
  });

  const fetchAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth/status', {
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
      });
      const data = (await res.json()) as AdminAuthStatus;
      setAuthStatus(data);
      if (!data.authenticated && adminToken) {
        onSetAdminToken(null);
      }
    } catch {
      // ignore initial check error
    }
  }, [adminToken, onSetAdminToken]);

  const fetchOverview = useCallback(async () => {
    if (!adminToken) return;
    setLoadingOverview(true);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.status === 401) {
        onSetAdminToken(null);
        await fetchAuthStatus();
        return;
      }
      const data = (await res.json()) as {
        stats: DashboardStats;
        videos: VideoItem[];
        channels: ChannelItem[];
        settings: MiniAppSettings;
      };
      setStats(data.stats);
      setVideos(data.videos);
      setChannels(data.channels);
      setWatchAdsRequired(data.settings.watchAdsRequired);
      setWatchAdTimerSeconds(data.settings.watchAdTimerSeconds);
      setDownloadAdsRequired(data.settings.downloadAdsRequired);
      setDownloadAdTimerSeconds(data.settings.downloadAdTimerSeconds);
      setForceJoinEnabled(data.settings.forceJoinEnabled);
      setMonetagZoneId(data.settings.monetagZoneId || '12118221');
      broadcastConfigToLocalStorage(data.settings, data.videos, data.channels);
    } finally {
      setLoadingOverview(false);
    }
  }, [adminToken, fetchAuthStatus, onSetAdminToken]);

  useEffect(() => {
    void fetchAuthStatus();
  }, [fetchAuthStatus]);

  useEffect(() => {
    if (adminToken) {
      void fetchOverview();
    }
  }, [adminToken, fetchOverview]);

  const resetVideoForm = () => {
    setEditingId(null);
    setVidTitle('');
    setVidCategory('Bangla');
    setVidPosterUrl('');
    setVidUrl('');
    setVidDuration('10:00');
    setVidQuality('1080p');
    setVidStatus('active');
  };

  const openEditVideo = (video: VideoItem) => {
    setEditingId(video.id);
    setVidTitle(video.title);
    const cat = CATEGORIES.includes(video.category as VideoCategory)
      ? (video.category as VideoCategory)
      : 'Bangla';
    setVidCategory(cat);
    setVidPosterUrl(video.posterUrl);
    setVidUrl(video.videoUrl);
    setVidDuration(video.duration || '10:00');
    setVidQuality(video.quality || '1080p');
    setVidStatus(video.status);
    setActiveTab('videos');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const detectDuration = (src: string) => {
    if (!src || src.startsWith('demo://')) return;
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        setVidDuration(formatDurationFromSeconds(probe.duration));
      }
    };
    probe.src = src;
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: password }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setAuthError(data.error || 'Invalid password.');
        return;
      }
      setPassword('');
      onSetAdminToken(data.token);
    } catch {
      setAuthError('Network error while signing in.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUpload = async (file: File, target: 'poster' | 'video') => {
    if (!adminToken) return;
    if (target === 'poster') setUploadingPoster(true);
    else setUploadingVideo(true);

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': file.name,
        },
        body: file,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        showToast('err', data.error || 'Upload failed.');
        return;
      }
      if (target === 'poster') {
        setVidPosterUrl(data.url);
      } else {
        setVidUrl(data.url);
        detectDuration(data.url);
      }
      showToast('ok', `Uploaded ${file.name}`);
    } finally {
      if (target === 'poster') setUploadingPoster(false);
      else setUploadingVideo(false);
    }
  };

  const handleSaveVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setSavingVideo(true);
    try {
      const isEditing = Boolean(editingId);
      const endpoint = isEditing
        ? `/api/admin/videos/${encodeURIComponent(editingId!)}`
        : '/api/admin/videos';

      const res = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: vidTitle,
          category: vidCategory,
          quality: vidQuality,
          duration: vidDuration,
          posterUrl: vidPosterUrl,
          videoUrl: vidUrl,
          status: vidStatus,
        }),
      });
      const data = (await res.json()) as {
        video?: VideoItem;
        stats?: DashboardStats;
        error?: string;
      };
      if (!res.ok || !data.video) {
        showToast('err', data.error || 'Failed to save movie.');
        return;
      }

      const nextVideos = isEditing
        ? videos.map((v) => (v.id === data.video!.id ? data.video! : v))
        : [data.video!, ...videos];
      setVideos(nextVideos);
      if (data.stats) setStats(data.stats);
      broadcastConfigToLocalStorage(currentSettingsSnapshot(), nextVideos, channels);
      showToast('ok', isEditing ? `Updated "${data.video.title}"` : `Added "${data.video.title}"`);
      resetVideoForm();
    } finally {
      setSavingVideo(false);
    }
  };

  const handleToggleStatus = async (video: VideoItem) => {
    if (!adminToken) return;
    const nextStatus: VideoStatus = video.status === 'active' ? 'inactive' : 'active';
    const res = await fetch(`/api/admin/videos/${encodeURIComponent(video.id)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = (await res.json()) as { video?: VideoItem; stats?: DashboardStats };
    if (res.ok && data.video) {
      const nextVideos = videos.map((v) => (v.id === video.id ? data.video! : v));
      setVideos(nextVideos);
      if (data.stats) setStats(data.stats);
      broadcastConfigToLocalStorage(currentSettingsSnapshot(), nextVideos, channels);
      showToast('ok', `${data.video.title} is now ${data.video.status}.`);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/videos/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { stats?: DashboardStats };
      const nextVideos = videos.filter((v) => v.id !== id);
      setVideos(nextVideos);
      if (data.stats) setStats(data.stats);
      broadcastConfigToLocalStorage(currentSettingsSnapshot(), nextVideos, channels);
      if (editingId === id) resetVideoForm();
      showToast('ok', 'Movie deleted.');
    }
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setSavingChannel(true);
    try {
      const res = await fetch('/api/admin/channels', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: chName,
          handle: chHandle,
          members: '',
          url: chUrl,
        }),
      });
      const data = (await res.json()) as { channels?: ChannelItem[]; error?: string };
      if (!res.ok || !data.channels) {
        showToast('err', data.error || 'Failed to add channel.');
        return;
      }
      setChannels(data.channels);
      broadcastConfigToLocalStorage(currentSettingsSnapshot(), videos, data.channels);
      setChName('');
      setChHandle('');
      setChUrl('');
      showToast('ok', 'Channel added.');
    } finally {
      setSavingChannel(false);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/channels/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { channels: ChannelItem[] };
      setChannels(data.channels);
      broadcastConfigToLocalStorage(currentSettingsSnapshot(), videos, data.channels);
      showToast('ok', 'Channel removed.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          watchAdsRequired,
          watchAdTimerSeconds,
          downloadAdsRequired,
          downloadAdTimerSeconds,
          forceJoinEnabled,
          monetagZoneId,
        }),
      });
      const data = (await res.json()) as { settings?: MiniAppSettings; error?: string };
      if (!res.ok || !data.settings) {
        showToast('err', data.error || 'Failed to save settings.');
        return;
      }
      setWatchAdsRequired(data.settings.watchAdsRequired);
      setWatchAdTimerSeconds(data.settings.watchAdTimerSeconds);
      setDownloadAdsRequired(data.settings.downloadAdsRequired);
      setDownloadAdTimerSeconds(data.settings.downloadAdTimerSeconds);
      setForceJoinEnabled(data.settings.forceJoinEnabled);
      setMonetagZoneId(data.settings.monetagZoneId);
      broadcastConfigToLocalStorage(data.settings, videos, channels);
      showToast('ok', 'Ad Settings saved! Bot & Website updated immediately.');
    } finally {
      setSavingSettings(false);
    }
  };

  // --- Admin Login Screen ---
  if (!adminToken) {
    return (
      <section className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-red-500/30 bg-gradient-to-b from-[#17171B] to-[#0B0B0E] p-7 shadow-[0_24px_60px_rgba(0,0,0,0.9)]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#ff5c40]">
            <Lock className="h-3.5 w-3.5" />
            <span>Admin Authentication</span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-white">
            CineVault Admin Login
          </h1>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            Sign in to control videos, ad counts, timers, and Force Join.
          </p>

          <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="adm-pass" className="block text-xs font-semibold text-[#E5E7EB]">
                Password
              </label>
              <input
                id="adm-pass"
                type="password"
                required
                autoFocus
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-3 text-sm text-white placeholder:text-[#6B7280] focus:border-[#ff4d4d] focus:outline-none"
              />
            </div>

            {authError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading || authStatus === null && false}
              className="flex min-h-[46px] w-full items-center justify-center rounded-xl bg-gradient-to-b from-[#ff4d4d] to-[#b30000] px-4 py-2.5 text-sm font-bold text-white shadow-[0_6px_0_#5a0000] active:translate-y-1 transition-all disabled:opacity-60"
            >
              {authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>Sign In to Admin</span>
              )}
            </button>
          </form>
        </div>
      </section>
    );
  }

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'videos', label: 'Videos', icon: <Film className="h-4 w-4" /> },
    { id: 'ads', label: 'Ad Settings', icon: <Megaphone className="h-4 w-4" /> },
    { id: 'channels', label: 'Channels', icon: <Radio className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#08080A] text-[#F3F4F6]">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0D0D10]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff4d4d] shadow-[0_0_10px_#ff4d4d]" />
            <span className="font-display text-lg font-bold text-white whitespace-nowrap">
              CineVault Admin
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <a
              href="/"
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#D1D5DB] hover:border-[#ff4d4d]/50 hover:text-white transition-colors whitespace-nowrap"
            >
              Open Bot / Site
            </a>
            <button
              type="button"
              onClick={() => onSetAdminToken(null)}
              aria-label="Log out"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#9CA3AF] hover:border-red-500/40 hover:text-red-300 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:flex-row lg:py-7">
        <aside className="w-full shrink-0 lg:w-56">
          <nav className="rounded-2xl border border-white/[0.08] bg-[#121215] p-2.5">
            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-row lg:flex-col">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap lg:justify-start ${
                    activeTab === item.id
                      ? 'bg-gradient-to-b from-[#ff4d4d] to-[#c81e1e] text-white shadow-lg shadow-red-950/50'
                      : 'text-[#9CA3AF] hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          {banner && (
            <div
              role="status"
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-semibold ${
                banner.type === 'ok'
                  ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300'
                  : 'border-red-500/35 bg-red-500/15 text-red-300'
              }`}
            >
              <span>{banner.text}</span>
              <button type="button" onClick={() => setBanner(null)} className="ml-3">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {loadingOverview && !stats ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#121215] p-8 text-center text-sm text-[#9CA3AF]">
              Loading admin console...
            </div>
          ) : (
            <>
              {/* DASHBOARD */}
              {activeTab === 'dashboard' && stats && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="font-display text-2xl font-bold text-white">Dashboard</h1>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 ${
                          forceJoinEnabled
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-white/10 bg-white/5 text-[#9CA3AF]'
                        }`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Force Join: {forceJoinEnabled ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </div>

                  {/* Primary Stats: Total Videos & Total Users */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-red-500/25 bg-gradient-to-br from-[#17171B] to-[#0D0D10] p-6 shadow-xl">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                          Total Videos
                        </p>
                        <Film className="h-5 w-5 text-[#ff5c40]" />
                      </div>
                      <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">
                        {stats.totalVideos}
                      </p>
                      <p className="mt-1 text-xs text-[#9CA3AF]">
                        {stats.activeVideos} active on Mini App
                      </p>
                    </div>

                    <div className="rounded-2xl border border-red-500/25 bg-gradient-to-br from-[#17171B] to-[#0D0D10] p-6 shadow-xl">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                          Total Users
                        </p>
                        <Users className="h-5 w-5 text-emerald-400" />
                      </div>
                      <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">
                        {stats.totalUsers.toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs text-[#9CA3AF]">
                        Unique Telegram &amp; Web visitors
                      </p>
                    </div>
                  </div>

                  {/* Live Ad Policy Summary + Quick Actions */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/[0.08] bg-[#121215] p-5">
                      <p className="text-xs font-semibold text-[#9CA3AF]">Active Play Rule</p>
                      <p className="mt-2 font-mono text-lg font-bold text-white">
                        {watchAdsRequired} {watchAdsRequired === 1 ? 'Ad' : 'Ads'} ·{' '}
                        {watchAdTimerSeconds}s Timer
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('ads')}
                        className="mt-3 text-xs font-semibold text-[#ff5c40] hover:underline"
                      >
                        Change Ad Settings →
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/[0.08] bg-[#121215] p-5">
                      <p className="text-xs font-semibold text-[#9CA3AF]">Active Download Rule</p>
                      <p className="mt-2 font-mono text-lg font-bold text-white">
                        {downloadAdsRequired} {downloadAdsRequired === 1 ? 'Ad' : 'Ads'} ·{' '}
                        {downloadAdTimerSeconds}s Timer
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('videos')}
                        className="mt-3 text-xs font-semibold text-[#ff5c40] hover:underline"
                      >
                        Add or Manage Videos →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ADD NEW VIDEO FORM + VIDEO LIST WITH DELETE */}
              {activeTab === 'videos' && (
                <div className="space-y-6">
                  <form
                    onSubmit={handleSaveVideo}
                    className="rounded-2xl border border-red-500/20 bg-gradient-to-b from-[#151519] to-[#101013] p-5 sm:p-6 space-y-4 shadow-xl"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h1 className="font-display text-xl font-bold text-white">
                        {editingId ? 'Edit Video' : 'Add New Video'}
                      </h1>
                      {editingId && (
                        <button
                          type="button"
                          onClick={resetVideoForm}
                          className="rounded-lg border border-white/10 px-3 py-1 text-xs font-semibold text-[#9CA3AF] hover:text-white"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-[#D1D5DB]">
                          Movie Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Toofan (2024)"
                          value={vidTitle}
                          onChange={(e) => setVidTitle(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2.5 text-sm text-white placeholder:text-[#6B7280] focus:border-[#ff4d4d] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#D1D5DB]">
                          Category
                        </label>
                        <select
                          value={vidCategory}
                          onChange={(e) => setVidCategory(e.target.value as VideoCategory)}
                          className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2.5 text-sm text-white focus:border-[#ff4d4d] focus:outline-none"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-[#D1D5DB]">
                          Poster Image URL
                        </label>
                        <div className="mt-1.5 flex gap-2">
                          <input
                            type="text"
                            required
                            placeholder="https://... or upload"
                            value={vidPosterUrl}
                            onChange={(e) => setVidPosterUrl(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2.5 text-xs text-white placeholder:text-[#6B7280] focus:border-[#ff4d4d] focus:outline-none"
                          />
                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-[#1B1B20] px-3 text-xs font-semibold text-white hover:border-[#ff4d4d]/50 shrink-0">
                            {uploadingPoster ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Upload className="h-3.5 w-3.5" />
                            )}
                            <span>Upload</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void handleUpload(f, 'poster');
                              }}
                            />
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#D1D5DB]">
                          Video File / Video URL
                        </label>
                        <div className="mt-1.5 flex gap-2">
                          <input
                            type="text"
                            required
                            placeholder="https://.../movie.mp4 or upload"
                            value={vidUrl}
                            onChange={(e) => {
                              setVidUrl(e.target.value);
                              detectDuration(e.target.value);
                            }}
                            className="w-full rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2.5 text-xs text-white placeholder:text-[#6B7280] focus:border-[#ff4d4d] focus:outline-none"
                          />
                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-[#1B1B20] px-3 text-xs font-semibold text-white hover:border-[#ff4d4d]/50 shrink-0">
                            {uploadingVideo ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Upload className="h-3.5 w-3.5" />
                            )}
                            <span>Upload</span>
                            <input
                              type="file"
                              accept="video/mp4,video/webm,video/quicktime"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void handleUpload(f, 'video');
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="text"
                          value={vidQuality}
                          onChange={(e) => setVidQuality(e.target.value)}
                          placeholder="Quality (1080p)"
                          aria-label="Quality"
                          className="w-28 rounded-xl border border-white/10 bg-[#08080A] px-3 py-2 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={vidDuration}
                          onChange={(e) => setVidDuration(e.target.value)}
                          placeholder="10:00"
                          aria-label="Duration"
                          className="w-24 rounded-xl border border-white/10 bg-[#08080A] px-3 py-2 font-mono text-xs text-white"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={savingVideo}
                        className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#ff4d4d] to-[#b30000] px-6 py-2.5 text-xs font-bold text-white shadow-[0_5px_0_#5a0000] active:translate-y-0.5 transition-all disabled:opacity-60"
                      >
                        <Check className="h-4 w-4" />
                        <span>{savingVideo ? 'Saving...' : editingId ? 'Update Video' : 'Save'}</span>
                      </button>
                    </div>
                  </form>

                  {/* Video List Below with Delete Button */}
                  <div className="rounded-2xl border border-white/[0.08] bg-[#121215] p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="font-display text-base font-bold text-white">
                        Video List ({videos.length})
                      </h2>
                    </div>

                    {videos.length === 0 ? (
                      <p className="py-8 text-center text-xs text-[#9CA3AF]">
                        No videos added yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {videos.map((v) => (
                          <div
                            key={v.id}
                            className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-[#0B0B0E] p-3.5 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={v.posterUrl}
                                alt={v.title}
                                className="h-14 w-11 rounded-lg object-cover bg-black shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-white">{v.title}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#9CA3AF]">
                                  <span className="rounded bg-red-500/15 px-2 py-0.5 font-semibold text-[#ff7b66]">
                                    {v.category || 'English'}
                                  </span>
                                  <span>{v.quality}</span>
                                  <span>·</span>
                                  <span>{v.duration}</span>
                                  <span>·</span>
                                  <span
                                    className={
                                      v.status === 'active' ? 'text-emerald-400' : 'text-[#6B7280]'
                                    }
                                  >
                                    {v.status === 'active' ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => openEditVideo(v)}
                                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:border-[#ff4d4d]"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleToggleStatus(v)}
                                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-[#D1D5DB]"
                              >
                                <Power className="h-3.5 w-3.5" />
                                <span>{v.status === 'active' ? 'On' : 'Off'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteVideo(v.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AD SETTINGS SECTION */}
              {activeTab === 'ads' && (
                <form
                  onSubmit={handleSaveSettings}
                  className="rounded-2xl border border-red-500/25 bg-gradient-to-b from-[#151519] to-[#101013] p-5 sm:p-6 space-y-6 shadow-xl"
                >
                  <div>
                    <h1 className="font-display text-xl font-bold text-white">Ad Settings</h1>
                    <p className="mt-1 text-xs text-[#9CA3AF]">
                      Changes saved here apply immediately to both the Telegram Mini App and Website.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.07] bg-[#0A0A0D] p-4">
                      <label
                        htmlFor="play-ads-count"
                        className="block text-xs font-semibold text-[#E5E7EB]"
                      >
                        How many Ads to Watch before Video Play
                      </label>
                      <input
                        id="play-ads-count"
                        type="number"
                        min={0}
                        max={50}
                        required
                        value={watchAdsRequired}
                        onChange={(e) => setWatchAdsRequired(Number(e.target.value))}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-[#121216] px-3.5 py-2.5 font-mono text-base font-bold text-white focus:border-[#ff4d4d] focus:outline-none"
                      />
                    </div>

                    <div className="rounded-xl border border-white/[0.07] bg-[#0A0A0D] p-4">
                      <label
                        htmlFor="play-ads-timer"
                        className="block text-xs font-semibold text-[#E5E7EB]"
                      >
                        Ad Timer in Seconds before Video Play
                      </label>
                      <input
                        id="play-ads-timer"
                        type="number"
                        min={0}
                        max={300}
                        required
                        value={watchAdTimerSeconds}
                        onChange={(e) => setWatchAdTimerSeconds(Number(e.target.value))}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-[#121216] px-3.5 py-2.5 font-mono text-base font-bold text-white focus:border-[#ff4d4d] focus:outline-none"
                      />
                    </div>

                    <div className="rounded-xl border border-white/[0.07] bg-[#0A0A0D] p-4">
                      <label
                        htmlFor="dl-ads-count"
                        className="block text-xs font-semibold text-[#E5E7EB]"
                      >
                        How many Ads to Watch before Video Download
                      </label>
                      <input
                        id="dl-ads-count"
                        type="number"
                        min={0}
                        max={50}
                        required
                        value={downloadAdsRequired}
                        onChange={(e) => setDownloadAdsRequired(Number(e.target.value))}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-[#121216] px-3.5 py-2.5 font-mono text-base font-bold text-white focus:border-[#ff4d4d] focus:outline-none"
                      />
                    </div>

                    <div className="rounded-xl border border-white/[0.07] bg-[#0A0A0D] p-4">
                      <label
                        htmlFor="dl-ads-timer"
                        className="block text-xs font-semibold text-[#E5E7EB]"
                      >
                        Ad Timer in Seconds before Download
                      </label>
                      <input
                        id="dl-ads-timer"
                        type="number"
                        min={0}
                        max={300}
                        required
                        value={downloadAdTimerSeconds}
                        onChange={(e) => setDownloadAdTimerSeconds(Number(e.target.value))}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-[#121216] px-3.5 py-2.5 font-mono text-base font-bold text-white focus:border-[#ff4d4d] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Force Join ON/OFF Toggle */}
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-[#0A0A0D] p-4">
                    <div>
                      <p className="text-sm font-bold text-white">Force Join Gate</p>
                      <p className="mt-0.5 text-xs text-[#9CA3AF]">
                        Require users to join all official channels before accessing movies.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={forceJoinEnabled}
                      onClick={() => setForceJoinEnabled((prev) => !prev)}
                      className={`relative inline-flex h-8 w-16 shrink-0 items-center rounded-full border transition-colors ${
                        forceJoinEnabled
                          ? 'border-emerald-400/50 bg-emerald-500'
                          : 'border-white/15 bg-[#242429]'
                      }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                          forceJoinEnabled ? 'translate-x-9' : 'translate-x-1'
                        }`}
                      />
                      <span className="sr-only">
                        {forceJoinEnabled ? 'Force Join ON' : 'Force Join OFF'}
                      </span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="inline-flex min-h-[46px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#ff4d4d] to-[#b30000] px-6 py-2.5 text-sm font-bold text-white shadow-[0_5px_0_#5a0000] active:translate-y-0.5 transition-all disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    <span>{savingSettings ? 'Saving Settings...' : 'Save Settings'}</span>
                  </button>
                </form>
              )}

              {/* CHANNELS MANAGEMENT */}
              {activeTab === 'channels' && (
                <div className="space-y-6">
                  <form
                    onSubmit={handleAddChannel}
                    className="rounded-2xl border border-white/[0.08] bg-[#121215] p-5 space-y-4"
                  >
                    <h2 className="font-display text-base font-bold text-white">
                      Force Join Channels
                    </h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <input
                        type="text"
                        required
                        placeholder="Channel Name"
                        value={chName}
                        onChange={(e) => setChName(e.target.value)}
                        className="rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2.5 text-sm text-white"
                      />
                      <input
                        type="text"
                        placeholder="@Username"
                        value={chHandle}
                        onChange={(e) => setChHandle(e.target.value)}
                        className="rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2.5 text-sm text-white"
                      />
                      <input
                        type="url"
                        required
                        placeholder="https://t.me/username"
                        value={chUrl}
                        onChange={(e) => setChUrl(e.target.value)}
                        className="rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2.5 text-sm text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingChannel}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#ff4d4d] px-4 py-2 text-xs font-bold text-white"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{savingChannel ? 'Adding...' : 'Add Channel'}</span>
                    </button>
                  </form>

                  <div className="rounded-2xl border border-white/[0.08] bg-[#121215] p-5">
                    <ul className="divide-y divide-white/[0.06]">
                      {channels.map((ch) => (
                        <li
                          key={ch.id}
                          className="flex flex-wrap items-center justify-between gap-3 py-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-white">{ch.name}</p>
                            <p className="text-xs text-[#9CA3AF]">
                              {ch.handle} · {ch.url}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleDeleteChannel(ch.id)}
                            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
