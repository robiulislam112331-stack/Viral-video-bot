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
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  AdminAuthStatus,
  ChannelItem,
  DashboardStats,
  MiniAppSettings,
  VideoItem,
  VideoStatus,
} from '../types';

type AdminTab = 'dashboard' | 'videos' | 'video-form' | 'channels' | 'ads';

interface AdminPanelProps {
  adminToken: string | null;
  onSetAdminToken: (token: string | null) => void;
}

function formatDurationFromSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ adminToken, onSetAdminToken }) => {
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus | null>(null);
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
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
  const [vidQuality, setVidQuality] = useState('4K HDR');
  const [vidDuration, setVidDuration] = useState('08:30');
  const [vidPosterUrl, setVidPosterUrl] = useState('');
  const [vidUrl, setVidUrl] = useState('');
  const [vidStatus, setVidStatus] = useState<VideoStatus>('active');
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [savingVideo, setSavingVideo] = useState(false);

  // Channels Form
  const [chName, setChName] = useState('');
  const [chHandle, setChHandle] = useState('');
  const [chMembers, setChMembers] = useState('');
  const [chUrl, setChUrl] = useState('');
  const [savingChannel, setSavingChannel] = useState(false);

  // Ads Settings Form
  const [watchAdsRequired, setWatchAdsRequired] = useState(5);
  const [downloadAdsRequired, setDownloadAdsRequired] = useState(15);
  const [monetagZoneId, setMonetagZoneId] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const showToast = (type: 'ok' | 'err', text: string) => {
    setBanner({ type, text });
    window.setTimeout(() => {
      setBanner((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  const fetchAuthStatus = useCallback(async () => {
    const res = await fetch('/api/admin/auth/status', {
      headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
    });
    const data = (await res.json()) as AdminAuthStatus;
    setAuthStatus(data);
    if (!data.authenticated && adminToken) {
      onSetAdminToken(null);
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
      setDownloadAdsRequired(data.settings.downloadAdsRequired);
      setMonetagZoneId(data.settings.monetagZoneId || '');
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
    setVidQuality('4K HDR');
    setVidDuration('08:30');
    setVidPosterUrl('');
    setVidUrl('');
    setVidStatus('active');
  };

  const openEditVideo = (video: VideoItem) => {
    setEditingId(video.id);
    setVidTitle(video.title);
    setVidQuality(video.quality);
    setVidDuration(video.duration);
    setVidPosterUrl(video.posterUrl);
    setVidUrl(video.videoUrl);
    setVidStatus(video.status);
    setActiveTab('video-form');
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

    if (authStatus?.needsClaim && passcode !== confirmPasscode) {
      setAuthError('Passcodes do not match.');
      return;
    }

    setAuthLoading(true);
    try {
      const endpoint = authStatus?.needsClaim ? '/api/admin/auth/claim' : '/api/admin/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setAuthError(data.error || 'Authentication failed.');
        return;
      }
      setPasscode('');
      setConfirmPasscode('');
      onSetAdminToken(data.token);
    } catch {
      setAuthError('Network error while authenticating.');
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

      if (isEditing) {
        setVideos((prev) => prev.map((v) => (v.id === data.video!.id ? data.video! : v)));
      } else {
        setVideos((prev) => [data.video!, ...prev]);
      }
      if (data.stats) setStats(data.stats);
      showToast('ok', isEditing ? `Updated "${data.video.title}"` : `Added "${data.video.title}"`);
      resetVideoForm();
      setActiveTab('videos');
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
      setVideos((prev) => prev.map((v) => (v.id === video.id ? data.video! : v)));
      if (data.stats) setStats(data.stats);
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
      setVideos((prev) => prev.filter((v) => v.id !== id));
      if (data.stats) setStats(data.stats);
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
          members: chMembers,
          url: chUrl,
        }),
      });
      const data = (await res.json()) as { channels?: ChannelItem[]; error?: string };
      if (!res.ok || !data.channels) {
        showToast('err', data.error || 'Failed to add channel.');
        return;
      }
      setChannels(data.channels);
      setChName('');
      setChHandle('');
      setChMembers('');
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
          downloadAdsRequired,
          monetagZoneId,
        }),
      });
      const data = (await res.json()) as { settings?: MiniAppSettings; error?: string };
      if (!res.ok || !data.settings) {
        showToast('err', data.error || 'Failed to save ad settings.');
        return;
      }
      showToast('ok', 'Monetag ad counts & Zone ID saved.');
    } finally {
      setSavingSettings(false);
    }
  };

  if (!adminToken) {
    return (
      <section className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-red-500/25 bg-[#121215] p-7 shadow-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#ff5c40]">
            <Lock className="h-3.5 w-3.5" />
            <span>{authStatus?.needsClaim ? 'First-Run Admin Setup' : 'Secret Admin Access'}</span>
          </div>
          <h1 className="mt-1.5 font-display text-2xl font-bold text-white">
            {authStatus?.needsClaim ? 'Set Admin Passcode' : 'CineVault Admin'}
          </h1>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            {authStatus?.needsClaim
              ? 'Create a passcode to protect /admin movie & channel management.'
              : 'Sign in to manage movies, channels, and Monetag ad counts.'}
          </p>

          <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="adm-pass" className="block text-xs font-medium text-[#D1D5DB]">
                Passcode
              </label>
              <input
                id="adm-pass"
                type="password"
                required
                minLength={4}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2.5 text-sm text-white focus:border-[#ff4d4d] focus:outline-none"
              />
            </div>

            {authStatus?.needsClaim && (
              <div>
                <label htmlFor="adm-pass-2" className="block text-xs font-medium text-[#D1D5DB]">
                  Confirm Passcode
                </label>
                <input
                  id="adm-pass-2"
                  type="password"
                  required
                  minLength={4}
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2.5 text-sm text-white focus:border-[#ff4d4d] focus:outline-none"
                />
              </div>
            )}

            {authError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#ff4d4d] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#ff6666] disabled:opacity-60 transition-colors"
            >
              {authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>{authStatus?.needsClaim ? 'Claim /admin Console' : 'Sign In'}</span>
              )}
            </button>
          </form>
        </div>
      </section>
    );
  }

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'videos', label: 'Movies', icon: <Film className="h-4 w-4" /> },
    {
      id: 'video-form',
      label: editingId ? 'Edit Movie' : 'Add Movie',
      icon: <Plus className="h-4 w-4" />,
    },
    { id: 'channels', label: 'Channels', icon: <Radio className="h-4 w-4" /> },
    { id: 'ads', label: 'Monetag Ads', icon: <Megaphone className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#08080A] text-[#F3F4F6]">
      <header className="border-b border-white/[0.08] bg-[#0D0D10]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          <span className="font-display text-lg font-bold text-white whitespace-nowrap shrink-0">
            CineVault Admin
          </span>
          <a
            href="/"
            className="rounded-lg border border-white/10 px-3.5 py-2 text-xs font-semibold text-[#D1D5DB] hover:border-[#ff4d4d]/50 hover:text-white transition-colors whitespace-nowrap"
          >
            Open Mini App
          </a>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-60">
          <div className="rounded-2xl border border-white/[0.08] bg-[#121215] p-3">
            <div className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'video-form' && activeTab !== 'video-form') {
                      resetVideoForm();
                    }
                    setActiveTab(item.id);
                  }}
                  className={`flex min-h-[40px] items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === item.id
                      ? 'bg-[#ff4d4d] text-white'
                      : 'text-[#9CA3AF] hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 hidden border-t border-white/[0.08] pt-3 lg:block">
              <button
                type="button"
                onClick={() => onSetAdminToken(null)}
                className="flex min-h-[38px] w-full items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-medium text-[#9CA3AF] hover:text-red-300"
              >
                <LogOut className="h-4 w-4" />
                <span>Lock Session</span>
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          {banner && (
            <div
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-medium ${
                banner.type === 'ok'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/30 bg-red-500/10 text-red-300'
              }`}
            >
              <span>{banner.text}</span>
              <button type="button" onClick={() => setBanner(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {loadingOverview && !stats ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#121215] p-8 text-center text-sm text-[#9CA3AF]">
              Loading...
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && stats && (
                <div className="space-y-6">
                  <h1 className="font-display text-2xl font-bold text-white">Dashboard</h1>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-white/[0.08] bg-[#121215] p-5">
                      <p className="text-xs text-[#9CA3AF]">Total Movies</p>
                      <p className="mt-2 font-mono text-3xl font-bold text-white tabular-nums">
                        {stats.totalVideos}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-[#121215] p-5">
                      <p className="text-xs text-[#9CA3AF]">Active Movies</p>
                      <p className="mt-2 font-mono text-3xl font-bold text-emerald-400 tabular-nums">
                        {stats.activeVideos}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-[#121215] p-5">
                      <p className="text-xs text-[#9CA3AF]">Total Views</p>
                      <p className="mt-2 font-mono text-3xl font-bold text-white tabular-nums">
                        {stats.totalViews.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-[#121215] p-5">
                      <p className="text-xs text-[#9CA3AF]">Total Downloads</p>
                      <p className="mt-2 font-mono text-3xl font-bold text-[#ff5c40] tabular-nums">
                        {stats.totalDownloads.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'videos' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h1 className="font-display text-2xl font-bold text-white">Movies</h1>
                    <button
                      type="button"
                      onClick={() => {
                        resetVideoForm();
                        setActiveTab('video-form');
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#ff4d4d] px-4 py-2 text-xs font-bold text-white"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Movie</span>
                    </button>
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-[#121215] p-5 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-[#9CA3AF]">
                          <th className="py-2.5 pr-4">Movie</th>
                          <th className="py-2.5 pr-4">Quality</th>
                          <th className="py-2.5 pr-4 text-right">Views</th>
                          <th className="py-2.5 pr-4 text-right">Downloads</th>
                          <th className="py-2.5 pr-4">Status</th>
                          <th className="py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {videos.map((v) => (
                          <tr key={v.id}>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={v.posterUrl}
                                  alt={v.title}
                                  className="h-11 w-9 rounded object-cover bg-black shrink-0"
                                />
                                <div>
                                  <p className="font-semibold text-white">{v.title}</p>
                                  <p className="text-[11px] text-[#9CA3AF]">{v.duration}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-[#D1D5DB]">{v.quality}</td>
                            <td className="py-3 pr-4 text-right font-mono tabular-nums">
                              {v.views.toLocaleString()}
                            </td>
                            <td className="py-3 pr-4 text-right font-mono tabular-nums">
                              {v.downloads.toLocaleString()}
                            </td>
                            <td className="py-3 pr-4">
                              <span
                                className={
                                  v.status === 'active' ? 'text-emerald-400' : 'text-[#6B7280]'
                                }
                              >
                                {v.status === 'active' ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditVideo(v)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:border-[#ff4d4d]"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleToggleStatus(v)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-[#D1D5DB]"
                                >
                                  <Power className="h-3.5 w-3.5" />
                                  <span>{v.status === 'active' ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteVideo(v.id)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-red-400 hover:bg-red-500/15"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'video-form' && (
                <form
                  onSubmit={handleSaveVideo}
                  className="rounded-2xl border border-white/[0.08] bg-[#121215] p-6 space-y-4"
                >
                  <h1 className="font-display text-xl font-bold text-white">
                    {editingId ? 'Edit Movie' : 'Add Movie'}
                  </h1>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-[#D1D5DB]">Movie Title</label>
                      <input
                        type="text"
                        required
                        value={vidTitle}
                        onChange={(e) => setVidTitle(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#D1D5DB]">Quality</label>
                      <input
                        type="text"
                        required
                        value={vidQuality}
                        onChange={(e) => setVidQuality(e.target.value)}
                        placeholder="4K HDR"
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2 text-sm text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-[#D1D5DB]">
                        Poster Upload or URL
                      </label>
                      <div className="mt-1.5 flex gap-2">
                        <input
                          type="text"
                          required
                          value={vidPosterUrl}
                          onChange={(e) => setVidPosterUrl(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-[#08080A] px-3 py-2 text-xs text-white"
                        />
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-white/10 bg-[#1B1B20] px-3 text-xs font-semibold text-white shrink-0">
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
                      <label className="block text-xs font-medium text-[#D1D5DB]">
                        Video File Upload or Link
                      </label>
                      <div className="mt-1.5 flex gap-2">
                        <input
                          type="text"
                          required
                          value={vidUrl}
                          onChange={(e) => {
                            setVidUrl(e.target.value);
                            detectDuration(e.target.value);
                          }}
                          className="w-full rounded-xl border border-white/10 bg-[#08080A] px-3 py-2 text-xs text-white"
                        />
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-white/10 bg-[#1B1B20] px-3 text-xs font-semibold text-white shrink-0">
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

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-[#D1D5DB]">
                        Duration (MM:SS)
                      </label>
                      <input
                        type="text"
                        required
                        value={vidDuration}
                        onChange={(e) => setVidDuration(e.target.value)}
                        className="mt-1.5 w-40 rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2 font-mono text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#D1D5DB]">Status</label>
                      <div className="mt-1.5 inline-flex gap-2 rounded-xl border border-white/10 bg-[#08080A] p-1">
                        <button
                          type="button"
                          onClick={() => setVidStatus('active')}
                          className={`rounded-lg px-4 py-1.5 text-xs font-semibold ${
                            vidStatus === 'active' ? 'bg-emerald-500 text-black' : 'text-[#9CA3AF]'
                          }`}
                        >
                          Active
                        </button>
                        <button
                          type="button"
                          onClick={() => setVidStatus('inactive')}
                          className={`rounded-lg px-4 py-1.5 text-xs font-semibold ${
                            vidStatus === 'inactive' ? 'bg-[#2A2A32] text-white' : 'text-[#9CA3AF]'
                          }`}
                        >
                          Inactive
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingVideo}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#ff4d4d] px-5 py-2 text-xs font-bold text-white"
                  >
                    <Check className="h-4 w-4" />
                    <span>{savingVideo ? 'Saving...' : 'Save Movie'}</span>
                  </button>
                </form>
              )}

              {activeTab === 'channels' && (
                <div className="space-y-6">
                  <form
                    onSubmit={handleAddChannel}
                    className="rounded-2xl border border-white/[0.08] bg-[#121215] p-5 space-y-4"
                  >
                    <h2 className="font-display text-base font-bold text-white">Add Channel</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <input
                        type="text"
                        required
                        placeholder="Channel Name"
                        value={chName}
                        onChange={(e) => setChName(e.target.value)}
                        className="rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2 text-sm text-white"
                      />
                      <input
                        type="text"
                        placeholder="@Username"
                        value={chHandle}
                        onChange={(e) => setChHandle(e.target.value)}
                        className="rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2 text-sm text-white"
                      />
                      <input
                        type="url"
                        required
                        placeholder="https://t.me/username"
                        value={chUrl}
                        onChange={(e) => setChUrl(e.target.value)}
                        className="rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2 text-sm text-white"
                      />
                      <input
                        type="text"
                        placeholder="Members (e.g. 48.2K)"
                        value={chMembers}
                        onChange={(e) => setChMembers(e.target.value)}
                        className="rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2 text-sm text-white"
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
                        <li key={ch.id} className="flex items-center justify-between py-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{ch.name}</p>
                            <p className="text-xs text-[#9CA3AF]">
                              {ch.handle} · {ch.members} · {ch.url}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleDeleteChannel(ch.id)}
                            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/15"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'ads' && (
                <form
                  onSubmit={handleSaveSettings}
                  className="rounded-2xl border border-white/[0.08] bg-[#121215] p-6 space-y-4"
                >
                  <h1 className="font-display text-xl font-bold text-white">
                    Monetag Ads Configuration
                  </h1>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium text-[#D1D5DB]">
                        Watch Ads Required
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={watchAdsRequired}
                        onChange={(e) => setWatchAdsRequired(Number(e.target.value))}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2 font-mono text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#D1D5DB]">
                        Download Ads Required
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={downloadAdsRequired}
                        onChange={(e) => setDownloadAdsRequired(Number(e.target.value))}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2 font-mono text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#D1D5DB]">
                        Monetag Zone ID (Reference)
                      </label>
                      <input
                        type="text"
                        value={monetagZoneId}
                        onChange={(e) => setMonetagZoneId(e.target.value)}
                        placeholder="e.g. 8492014"
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#08080A] px-3.5 py-2 font-mono text-sm text-white"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#ff4d4d] px-5 py-2 text-xs font-bold text-white"
                  >
                    <Check className="h-4 w-4" />
                    <span>{savingSettings ? 'Saving...' : 'Save Ads Settings'}</span>
                  </button>
                </form>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
