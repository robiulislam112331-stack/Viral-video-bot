import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CreditCard,
  Edit3,
  Film,
  LayoutDashboard,
  Lock,
  LogOut,
  Megaphone,
  Plus,
  Power,
  Radio,
  Settings,
  Trash2,
  Upload,
  Wallet,
  X,
  Loader2,
} from 'lucide-react';
import type {
  AdminAuthStatus,
  AdSlot,
  AppSettings,
  ChannelItem,
  DashboardStats,
  DownloadType,
  PaymentRequest,
  PaymentStatus,
  VideoItem,
  VideoStatus,
} from '../types';

type AdminTab =
  | 'dashboard'
  | 'videos'
  | 'video-form'
  | 'payments'
  | 'ads'
  | 'force-join'
  | 'payment-settings';

interface AdminPanelProps {
  adminToken: string | null;
  onSetAdminToken: (token: string | null) => void;
  onDataChanged: () => Promise<void>;
}

function formatDurationFromSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatShortTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  adminToken,
  onSetAdminToken,
  onDataChanged,
}) => {
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
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Add / Edit Video Form state
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [vidTitle, setVidTitle] = useState('');
  const [vidCategory, setVidCategory] = useState('Short Film');
  const [vidDuration, setVidDuration] = useState('05:30');
  const [vidThumbUrl, setVidThumbUrl] = useState('');
  const [vidUrl, setVidUrl] = useState('');
  const [vidStatus, setVidStatus] = useState<VideoStatus>('active');
  const [vidDownloadType, setVidDownloadType] = useState<DownloadType>('paid');
  const [vidPriceTk, setVidPriceTk] = useState<number>(10);
  const [vidAdsEnabled, setVidAdsEnabled] = useState<boolean>(true);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [savingVideo, setSavingVideo] = useState(false);
  const [togglingVideoId, setTogglingVideoId] = useState<string | null>(null);

  // Payment filter state
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');
  const [decidingId, setDecidingId] = useState<string | null>(null);

  // Channel form state
  const [chName, setChName] = useState('');
  const [chInviteUrl, setChInviteUrl] = useState('');
  const [savingChannel, setSavingChannel] = useState(false);

  // Settings & Ads form state
  const [defaultPriceTk, setDefaultPriceTk] = useState(10);
  const [bkashNumber, setBkashNumber] = useState('');
  const [nagadNumber, setNagadNumber] = useState('');
  const [forceJoinEnabled, setForceJoinEnabled] = useState(true);
  const [adsDraft, setAdsDraft] = useState<AdSlot[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  const showToast = (type: 'ok' | 'err', text: string) => {
    setBannerMessage({ type, text });
    window.setTimeout(() => {
      setBannerMessage((prev) => (prev?.text === text ? null : prev));
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
        settings: AppSettings;
        payments: PaymentRequest[];
      };
      setStats(data.stats);
      setVideos(data.videos);
      setChannels(data.channels);
      setPayments(data.payments);
      setSettings(data.settings);

      setDefaultPriceTk(data.settings.downloadPriceTk);
      setBkashNumber(data.settings.bkashNumber);
      setNagadNumber(data.settings.nagadNumber);
      setForceJoinEnabled(data.settings.forceJoinEnabled);
      setAdsDraft(data.settings.ads);
      if (!editingVideoId) {
        setVidPriceTk(data.settings.downloadPriceTk);
      }
    } finally {
      setLoadingOverview(false);
    }
  }, [adminToken, editingVideoId, fetchAuthStatus, onSetAdminToken]);

  useEffect(() => {
    void fetchAuthStatus();
  }, [fetchAuthStatus]);

  useEffect(() => {
    if (adminToken) {
      void fetchOverview();
    }
  }, [adminToken, fetchOverview]);

  const resetVideoForm = (priceDefault = settings?.downloadPriceTk ?? 10) => {
    setEditingVideoId(null);
    setVidTitle('');
    setVidCategory('Short Film');
    setVidDuration('05:30');
    setVidThumbUrl('');
    setVidUrl('');
    setVidStatus('active');
    setVidDownloadType('paid');
    setVidPriceTk(priceDefault);
    setVidAdsEnabled(true);
  };

  const openAddVideoPage = () => {
    resetVideoForm(settings?.downloadPriceTk ?? 10);
    setActiveTab('video-form');
  };

  const openEditVideoPage = (video: VideoItem) => {
    setEditingVideoId(video.id);
    setVidTitle(video.title);
    setVidCategory(video.category);
    setVidDuration(video.duration);
    setVidThumbUrl(video.thumbnailUrl);
    setVidUrl(video.videoUrl);
    setVidStatus(video.status);
    setVidDownloadType(video.downloadType);
    setVidPriceTk(
      video.downloadType === 'free'
        ? 0
        : video.downloadPriceTk || settings?.downloadPriceTk || 10
    );
    setVidAdsEnabled(video.adsEnabled);
    setActiveTab('video-form');
  };

  const detectDurationFromVideoSrc = (src: string) => {
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
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
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

  const handleFileUpload = async (file: File, target: 'thumb' | 'video') => {
    if (!adminToken) return;
    if (target === 'thumb') setUploadingThumb(true);
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
      if (target === 'thumb') {
        setVidThumbUrl(data.url);
      } else {
        setVidUrl(data.url);
        detectDurationFromVideoSrc(data.url);
      }
      showToast('ok', `Uploaded ${file.name}`);
    } catch {
      showToast('err', 'Upload failed.');
    } finally {
      if (target === 'thumb') setUploadingThumb(false);
      else setUploadingVideo(false);
    }
  };

  const handleSaveVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setSavingVideo(true);
    try {
      const payload = {
        title: vidTitle,
        category: vidCategory,
        duration: vidDuration,
        thumbnailUrl: vidThumbUrl,
        videoUrl: vidUrl,
        status: vidStatus,
        downloadType: vidDownloadType,
        downloadPriceTk: vidDownloadType === 'free' ? 0 : vidPriceTk,
        adsEnabled: vidAdsEnabled,
      };

      const isEditing = Boolean(editingVideoId);
      const endpoint = isEditing
        ? `/api/admin/videos/${encodeURIComponent(editingVideoId!)}`
        : '/api/admin/videos';

      const res = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        video?: VideoItem;
        stats?: DashboardStats;
        error?: string;
      };
      if (!res.ok || !data.video) {
        showToast('err', data.error || 'Failed to save video.');
        return;
      }

      if (isEditing) {
        setVideos((prev) => prev.map((v) => (v.id === data.video!.id ? data.video! : v)));
      } else {
        setVideos((prev) => [data.video!, ...prev]);
      }
      if (data.stats) setStats(data.stats);
      await onDataChanged();
      showToast('ok', isEditing ? `Updated "${data.video.title}"` : `Published "${data.video.title}"`);
      resetVideoForm(settings?.downloadPriceTk ?? 10);
      setActiveTab('videos');
    } finally {
      setSavingVideo(false);
    }
  };

  const handleToggleVideoStatus = async (video: VideoItem) => {
    if (!adminToken) return;
    setTogglingVideoId(video.id);
    const nextStatus: VideoStatus = video.status === 'active' ? 'inactive' : 'active';
    try {
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
        await onDataChanged();
        showToast(
          'ok',
          `${data.video.title} is now ${data.video.status === 'active' ? 'Active' : 'Inactive'}.`
        );
      }
    } finally {
      setTogglingVideoId(null);
    }
  };

  const handleToggleVideoAds = async (video: VideoItem) => {
    if (!adminToken) return;
    setTogglingVideoId(video.id);
    try {
      const res = await fetch(`/api/admin/videos/${encodeURIComponent(video.id)}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adsEnabled: !video.adsEnabled }),
      });
      const data = (await res.json()) as { video?: VideoItem };
      if (res.ok && data.video) {
        setVideos((prev) => prev.map((v) => (v.id === video.id ? data.video! : v)));
        await onDataChanged();
        showToast(
          'ok',
          `Ads ${data.video.adsEnabled ? 'enabled' : 'disabled'} for "${data.video.title}".`
        );
      }
    } finally {
      setTogglingVideoId(null);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/videos/${encodeURIComponent(videoId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { stats?: DashboardStats };
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      if (data.stats) setStats(data.stats);
      await onDataChanged();
      showToast('ok', 'Video removed.');
    }
  };

  const handlePaymentDecision = async (paymentId: string, decision: 'approved' | 'rejected') => {
    if (!adminToken) return;
    setDecidingId(paymentId);
    try {
      const res = await fetch(`/api/admin/payments/${encodeURIComponent(paymentId)}/decision`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ decision }),
      });
      const data = (await res.json()) as {
        payment?: PaymentRequest;
        stats?: DashboardStats;
        error?: string;
      };
      if (!res.ok || !data.payment) {
        showToast('err', data.error || 'Action failed.');
        return;
      }
      setPayments((prev) => prev.map((p) => (p.id === paymentId ? data.payment! : p)));
      if (data.stats) setStats(data.stats);
      await onDataChanged();
      showToast(
        'ok',
        decision === 'approved'
          ? `Approved TrxID ${data.payment.trxId} — Download unlocked`
          : `Rejected TrxID ${data.payment.trxId}`
      );
    } finally {
      setDecidingId(null);
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
          inviteUrl: chInviteUrl,
        }),
      });
      const data = (await res.json()) as { channels?: ChannelItem[]; error?: string };
      if (!res.ok || !data.channels) {
        showToast('err', data.error || 'Unable to add channel.');
        return;
      }
      setChannels(data.channels);
      setChName('');
      setChInviteUrl('');
      await onDataChanged();
      showToast('ok', 'Force Join channel added.');
    } finally {
      setSavingChannel(false);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/channels/${encodeURIComponent(channelId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { channels: ChannelItem[] };
      setChannels(data.channels);
      await onDataChanged();
      showToast('ok', 'Channel removed.');
    }
  };

  const savePartialSettings = async (
    patch: Partial<{
      downloadPriceTk: number;
      bkashNumber: string;
      nagadNumber: string;
      forceJoinEnabled: boolean;
      ads: AdSlot[];
    }>,
    successText: string
  ) => {
    if (!adminToken) return;
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { settings?: AppSettings; error?: string };
      if (!res.ok || !data.settings) {
        showToast('err', data.error || 'Failed to save settings.');
        return;
      }
      setSettings(data.settings);
      setDefaultPriceTk(data.settings.downloadPriceTk);
      setBkashNumber(data.settings.bkashNumber);
      setNagadNumber(data.settings.nagadNumber);
      setForceJoinEnabled(data.settings.forceJoinEnabled);
      setAdsDraft(data.settings.ads);
      await onDataChanged();
      showToast('ok', successText);
    } finally {
      setSavingSettings(false);
    }
  };

  // Unauthenticated Login / First-Run Setup Gate
  if (!adminToken) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-76px)] max-w-md flex-col items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-white/[0.08] bg-[#12141A] p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-2 text-xs font-medium text-[#E5A93C]">
            <Lock className="h-3.5 w-3.5" />
            <span>{authStatus?.needsClaim ? 'First-Run Admin Setup' : 'Protected Console'}</span>
          </div>
          <h1 className="mt-1.5 font-display text-2xl font-bold text-[#F3F4F6]">
            {authStatus?.needsClaim ? 'Create Admin Passcode' : 'Admin Sign In'}
          </h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">
            {authStatus?.needsClaim
              ? 'No ADMIN_PASSCODE environment secret is set. Claim this panel with a passcode (min 4 characters).'
              : 'Enter the admin passcode to manage videos, channels, ads, and bKash/Nagad approvals.'}
          </p>

          <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="admin-pass" className="block text-xs font-medium text-[#D1D5DB]">
                Passcode
              </label>
              <input
                id="admin-pass"
                type="password"
                required
                minLength={4}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode"
                className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3.5 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#E5A93C] focus:outline-none"
              />
            </div>

            {authStatus?.needsClaim && (
              <div>
                <label
                  htmlFor="admin-pass-confirm"
                  className="block text-xs font-medium text-[#D1D5DB]"
                >
                  Confirm Passcode
                </label>
                <input
                  id="admin-pass-confirm"
                  type="password"
                  required
                  minLength={4}
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  placeholder="Re-enter passcode"
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3.5 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#E5A93C] focus:outline-none"
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
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#E5A93C] px-4 py-2.5 text-xs font-semibold text-[#0A0B0E] hover:bg-[#F0B94F] disabled:opacity-60 transition-colors"
            >
              {authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>{authStatus?.needsClaim ? 'Set Passcode & Enter' : 'Unlock Admin Panel'}</span>
              )}
            </button>
          </form>
        </div>
      </section>
    );
  }

  const pendingCount = payments.filter((p) => p.status === 'pending').length;
  const filteredPayments =
    paymentFilter === 'all' ? payments : payments.filter((p) => p.status === paymentFilter);

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'videos', label: 'Video List', icon: <Film className="h-4 w-4" />, count: videos.length },
    {
      id: 'video-form',
      label: editingVideoId ? 'Edit Video' : 'Add Video',
      icon: <Plus className="h-4 w-4" />,
    },
    {
      id: 'payments',
      label: 'Payment Requests',
      icon: <CreditCard className="h-4 w-4" />,
      count: pendingCount > 0 ? pendingCount : undefined,
    },
    { id: 'ads', label: 'Ads Settings', icon: <Megaphone className="h-4 w-4" /> },
    { id: 'force-join', label: 'Force Join', icon: <Radio className="h-4 w-4" /> },
    { id: 'payment-settings', label: 'Payment Settings', icon: <Wallet className="h-4 w-4" /> },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full shrink-0 lg:w-64">
        <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-3">
          <div className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'video-form' && activeTab !== 'video-form') {
                    openAddVideoPage();
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                className={`flex min-h-[42px] items-center justify-between gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === item.id
                    ? 'bg-[#E5A93C] text-[#0A0B0E]'
                    : 'text-[#9CA3AF] hover:bg-white/[0.04] hover:text-[#F3F4F6]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {item.count !== undefined && (
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      activeTab === item.id ? 'text-[#0A0B0E]' : 'text-[#E5A93C]'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-3 hidden border-t border-white/[0.08] pt-3 lg:block">
            <button
              type="button"
              onClick={() => onSetAdminToken(null)}
              className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-medium text-[#9CA3AF] hover:bg-white/[0.04] hover:text-red-300 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Lock Admin Session</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1 space-y-6">
        {bannerMessage && (
          <div
            role="status"
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-medium ${
              bannerMessage.type === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
            }`}
          >
            <span>{bannerMessage.text}</span>
            <button
              type="button"
              onClick={() => setBannerMessage(null)}
              aria-label="Dismiss notification"
              className="text-current opacity-70 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {loadingOverview && !stats ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-8 text-center text-sm text-[#9CA3AF]">
            Loading admin workspace...
          </div>
        ) : (
          <>
            {/* 1. ADMIN DASHBOARD */}
            {activeTab === 'dashboard' && stats && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-[#F3F4F6]">
                      Admin Dashboard
                    </h1>
                    <p className="mt-1 text-sm text-[#9CA3AF]">
                      Real-time overview of videos, views, downloads, earnings, and pending payments.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openAddVideoPage}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#E5A93C] px-4 py-2 text-xs font-semibold text-[#0A0B0E] hover:bg-[#F0B94F] transition-colors self-start"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Video</span>
                  </button>
                </div>

                {/* Top 5 KPI Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5">
                    <p className="text-xs font-medium text-[#9CA3AF]">Total Videos</p>
                    <p className="mt-2 font-mono text-2xl font-bold text-[#F3F4F6] tabular-nums">
                      {stats.totalVideos}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5">
                    <p className="text-xs font-medium text-[#9CA3AF]">Total Views</p>
                    <p className="mt-2 font-mono text-2xl font-bold text-[#F3F4F6] tabular-nums">
                      {stats.totalViews.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5">
                    <p className="text-xs font-medium text-[#9CA3AF]">Total Downloads</p>
                    <p className="mt-2 font-mono text-2xl font-bold text-[#F3F4F6] tabular-nums">
                      {stats.totalDownloads.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5">
                    <p className="text-xs font-medium text-[#9CA3AF]">Total Earning</p>
                    <p className="mt-2 font-mono text-2xl font-bold text-[#E5A93C] tabular-nums">
                      {stats.totalEarningTk.toLocaleString()} TK
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5">
                    <p className="text-xs font-medium text-[#9CA3AF]">Pending Payments</p>
                    <p className="mt-2 font-mono text-2xl font-bold text-[#F3F4F6] tabular-nums">
                      {stats.pendingPaymentsCount}
                    </p>
                  </div>
                </div>

                {/* Bottom: Recent Payments + Recent Videos */}
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  {/* Recent Payments */}
                  <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5">
                    <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-3.5">
                      <h2 className="font-display text-base font-bold text-[#F3F4F6]">
                        Recent Payments
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('payments')}
                        className="text-xs font-semibold text-[#E5A93C] hover:underline"
                      >
                        View All
                      </button>
                    </div>
                    {payments.length === 0 ? (
                      <p className="py-8 text-center text-xs text-[#9CA3AF]">
                        No payment requests yet.
                      </p>
                    ) : (
                      <ul className="divide-y divide-white/[0.06] mt-1">
                        {payments.slice(0, 5).map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-[#F3F4F6]">
                                {p.userName} · {p.videoTitle}
                              </p>
                              <p className="mt-0.5 font-mono text-[11px] text-[#9CA3AF] tabular-nums">
                                {p.method} · {p.trxId} · {p.amountTk} TK
                              </p>
                            </div>
                            {p.status === 'pending' ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={decidingId === p.id}
                                  onClick={() => handlePaymentDecision(p.id, 'approved')}
                                  className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={decidingId === p.id}
                                  onClick={() => handlePaymentDecision(p.id, 'rejected')}
                                  className="rounded-lg bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/25"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span
                                className={`text-xs font-semibold capitalize shrink-0 ${
                                  p.status === 'approved' ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {p.status}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Recent Videos */}
                  <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5">
                    <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-3.5">
                      <h2 className="font-display text-base font-bold text-[#F3F4F6]">
                        Recent Videos
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('videos')}
                        className="text-xs font-semibold text-[#E5A93C] hover:underline"
                      >
                        Manage All
                      </button>
                    </div>
                    {videos.length === 0 ? (
                      <p className="py-8 text-center text-xs text-[#9CA3AF]">
                        No videos added yet.
                      </p>
                    ) : (
                      <ul className="divide-y divide-white/[0.06] mt-1">
                        {videos.slice(0, 5).map((v) => (
                          <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={v.thumbnailUrl}
                                alt={v.title}
                                referrerPolicy="no-referrer"
                                className="h-10 w-16 rounded-md object-cover bg-[#0A0B0E] shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-[#F3F4F6]">
                                  {v.title}
                                </p>
                                <p className="mt-0.5 font-mono text-[11px] text-[#9CA3AF] tabular-nums">
                                  {v.downloadType === 'free' ? 'FREE' : `${v.downloadPriceTk} TK`} ·{' '}
                                  {v.views.toLocaleString()} views ·{' '}
                                  <span
                                    className={
                                      v.status === 'active' ? 'text-emerald-400' : 'text-[#6B7280]'
                                    }
                                  >
                                    {v.status === 'active' ? 'Active' : 'Inactive'}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openEditVideoPage(v)}
                              className="rounded-lg border border-white/[0.1] px-2.5 py-1 text-xs font-semibold text-[#F3F4F6] hover:border-[#E5A93C]/50 hover:text-[#E5A93C] shrink-0"
                            >
                              Edit
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. VIDEO LIST PAGE */}
            {activeTab === 'videos' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-[#F3F4F6]">Video List</h1>
                    <p className="mt-1 text-sm text-[#9CA3AF]">
                      Edit pricing (Free or custom TK), toggle Active/Inactive status, or delete videos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openAddVideoPage}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#E5A93C] px-4 py-2 text-xs font-semibold text-[#0A0B0E] hover:bg-[#F0B94F] transition-colors self-start"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add New Video</span>
                  </button>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5">
                  {videos.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-sm text-[#9CA3AF]">No videos published yet.</p>
                      <button
                        type="button"
                        onClick={openAddVideoPage}
                        className="mt-3 rounded-xl bg-[#E5A93C] px-4 py-2 text-xs font-semibold text-[#0A0B0E]"
                      >
                        Add First Video
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-white/[0.06] text-[#9CA3AF]">
                            <th className="py-2.5 pr-4 font-medium">Video</th>
                            <th className="py-2.5 pr-4 font-medium">Download</th>
                            <th className="py-2.5 pr-4 font-medium text-right">Views</th>
                            <th className="py-2.5 pr-4 font-medium">Status</th>
                            <th className="py-2.5 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                          {videos.map((v) => {
                            const isFree = v.downloadType === 'free' || v.downloadPriceTk <= 0;
                            return (
                              <tr key={v.id} className="hover:bg-white/[0.02]">
                                <td className="py-3 pr-4">
                                  <div className="flex items-center gap-3">
                                    <img
                                      src={v.thumbnailUrl}
                                      alt={v.title}
                                      referrerPolicy="no-referrer"
                                      className="h-11 w-20 rounded-md object-cover bg-[#0A0B0E] shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <p className="font-semibold text-[#F3F4F6] max-w-[240px] truncate">
                                        {v.title}
                                      </p>
                                      <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
                                        {v.category} · {v.duration} · Ads {v.adsEnabled ? 'On' : 'Off'}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 pr-4">
                                  <span
                                    className={`inline-block rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
                                      isFree
                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                        : 'border-[#E5A93C]/35 bg-[#E5A93C]/10 text-[#E5A93C]'
                                    }`}
                                  >
                                    {isFree ? 'FREE' : `${v.downloadPriceTk} TK`}
                                  </span>
                                </td>
                                <td className="py-3 pr-4 text-right font-mono text-[#F3F4F6] tabular-nums">
                                  {v.views.toLocaleString()}
                                </td>
                                <td className="py-3 pr-4">
                                  <span
                                    className={`font-semibold ${
                                      v.status === 'active' ? 'text-emerald-400' : 'text-[#6B7280]'
                                    }`}
                                  >
                                    {v.status === 'active' ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="py-3 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openEditVideoPage(v)}
                                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-white/[0.1] bg-[#181B23] px-2.5 py-1 text-xs font-semibold text-[#F3F4F6] hover:border-[#E5A93C]/50 hover:text-[#E5A93C] transition-colors"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={togglingVideoId === v.id}
                                      onClick={() => handleToggleVideoStatus(v)}
                                      className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                                        v.status === 'active'
                                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                                          : 'border-white/[0.1] bg-[#0A0B0E] text-[#9CA3AF] hover:text-[#F3F4F6]'
                                      }`}
                                    >
                                      <Power className="h-3.5 w-3.5" />
                                      <span>{v.status === 'active' ? 'On' : 'Off'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteVideo(v.id)}
                                      aria-label={`Delete ${v.title}`}
                                      className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-white/[0.08] text-[#9CA3AF] hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-400 transition-colors"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. ADD / EDIT VIDEO PAGE */}
            {activeTab === 'video-form' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-[#F3F4F6]">
                      {editingVideoId ? 'Edit Video' : 'Add New Video'}
                    </h1>
                    <p className="mt-1 text-sm text-[#9CA3AF]">
                      {editingVideoId
                        ? 'Update metadata, thumbnail, video source, Free/Paid download price, Ads, or Active status.'
                        : 'Publish a new video with per-video Free/Paid pricing and Ads control.'}
                    </p>
                  </div>
                  {editingVideoId && (
                    <button
                      type="button"
                      onClick={() => {
                        resetVideoForm(settings?.downloadPriceTk ?? 10);
                        setActiveTab('videos');
                      }}
                      className="rounded-xl border border-white/[0.1] px-4 py-2 text-xs font-semibold text-[#9CA3AF] hover:text-[#F3F4F6] self-start"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveVideo} className="space-y-6">
                  {/* Core Metadata Card */}
                  <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5 space-y-4">
                    <h2 className="font-display text-base font-bold text-[#F3F4F6]">
                      Video Details
                    </h2>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label htmlFor="v-title" className="block text-xs font-medium text-[#D1D5DB]">
                          Video Title
                        </label>
                        <input
                          id="v-title"
                          type="text"
                          required
                          value={vidTitle}
                          onChange={(e) => setVidTitle(e.target.value)}
                          placeholder="e.g. Midnight Neon: Tokyo Rain Study"
                          className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3.5 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#E5A93C] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="v-cat" className="block text-xs font-medium text-[#D1D5DB]">
                          Category
                        </label>
                        <input
                          id="v-cat"
                          type="text"
                          required
                          value={vidCategory}
                          onChange={(e) => setVidCategory(e.target.value)}
                          placeholder="Short Film, Music..."
                          className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3.5 py-2.5 text-sm text-[#F3F4F6] focus:border-[#E5A93C] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="v-thumb" className="block text-xs font-medium text-[#D1D5DB]">
                          Thumbnail Upload or URL
                        </label>
                        <div className="mt-1.5 flex gap-2">
                          <input
                            id="v-thumb"
                            type="text"
                            required
                            value={vidThumbUrl}
                            onChange={(e) => setVidThumbUrl(e.target.value)}
                            placeholder="https://... or upload image"
                            className="w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3.5 py-2 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#E5A93C] focus:outline-none"
                          />
                          <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/[0.12] bg-[#181B23] px-3.5 text-xs font-semibold text-[#F3F4F6] hover:border-[#E5A93C]/50 shrink-0">
                            {uploadingThumb ? (
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
                                const file = e.target.files?.[0];
                                if (file) void handleFileUpload(file, 'thumb');
                              }}
                            />
                          </label>
                        </div>
                        {vidThumbUrl && (
                          <img
                            src={vidThumbUrl}
                            alt="Thumbnail preview"
                            referrerPolicy="no-referrer"
                            className="mt-2.5 h-24 w-44 rounded-lg border border-white/[0.08] object-cover bg-[#0A0B0E]"
                          />
                        )}
                      </div>

                      <div>
                        <label htmlFor="v-url" className="block text-xs font-medium text-[#D1D5DB]">
                          Video File Upload or Video Link
                        </label>
                        <div className="mt-1.5 flex gap-2">
                          <input
                            id="v-url"
                            type="text"
                            required
                            value={vidUrl}
                            onChange={(e) => {
                              setVidUrl(e.target.value);
                              detectDurationFromVideoSrc(e.target.value);
                            }}
                            placeholder="https://example.com/video.mp4 or upload file"
                            className="w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3.5 py-2 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#E5A93C] focus:outline-none"
                          />
                          <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/[0.12] bg-[#181B23] px-3.5 text-xs font-semibold text-[#F3F4F6] hover:border-[#E5A93C]/50 shrink-0">
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
                                const file = e.target.files?.[0];
                                if (file) void handleFileUpload(file, 'video');
                              }}
                            />
                          </label>
                        </div>

                        <div className="mt-3">
                          <label htmlFor="v-dur" className="block text-xs font-medium text-[#D1D5DB]">
                            Duration (Auto-detected from upload or Manual MM:SS)
                          </label>
                          <input
                            id="v-dur"
                            type="text"
                            required
                            value={vidDuration}
                            onChange={(e) => setVidDuration(e.target.value)}
                            placeholder="08:45"
                            className="mt-1.5 w-40 rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3.5 py-2 font-mono text-sm text-[#F3F4F6] tabular-nums focus:border-[#E5A93C] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Per-Video Download Settings, Ads Toggle, & Status */}
                  <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5 space-y-5">
                    <h2 className="font-display text-base font-bold text-[#F3F4F6]">
                      Download, Ads &amp; Visibility Controls
                    </h2>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                      {/* Download Type Toggle */}
                      <div>
                        <p className="text-xs font-medium text-[#D1D5DB]">Download Type</p>
                        <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl border border-white/[0.08] bg-[#0A0B0E] p-1">
                          <button
                            type="button"
                            onClick={() => {
                              setVidDownloadType('free');
                              setVidPriceTk(0);
                            }}
                            className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                              vidDownloadType === 'free'
                                ? 'bg-emerald-500 text-[#0A0B0E]'
                                : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                            }`}
                          >
                            Free
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVidDownloadType('paid');
                              if (vidPriceTk <= 0) {
                                setVidPriceTk(settings?.downloadPriceTk ?? 10);
                              }
                            }}
                            className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                              vidDownloadType === 'paid'
                                ? 'bg-[#E5A93C] text-[#0A0B0E]'
                                : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                            }`}
                          >
                            Paid
                          </button>
                        </div>
                        <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
                          {vidDownloadType === 'free'
                            ? 'User button: "Free Download" (direct download)'
                            : `User button: "🔒 ${vidPriceTk} TK" (requires payment)`}
                        </p>
                      </div>

                      {/* Price Input */}
                      <div>
                        <label htmlFor="v-price" className="block text-xs font-medium text-[#D1D5DB]">
                          Download Price (TK)
                        </label>
                        <input
                          id="v-price"
                          type="number"
                          min={0}
                          max={100000}
                          disabled={vidDownloadType === 'free'}
                          value={vidDownloadType === 'free' ? 0 : vidPriceTk}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            setVidPriceTk(val);
                            if (val === 0) setVidDownloadType('free');
                          }}
                          className="mt-2 w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3.5 py-2.5 font-mono text-sm text-[#F3F4F6] tabular-nums disabled:opacity-50 focus:border-[#E5A93C] focus:outline-none"
                        />
                        <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
                          Default {settings?.downloadPriceTk ?? 10} TK · Set 0, 10, 20, 50 TK per video
                        </p>
                      </div>

                      {/* Status & Ads Toggles */}
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium text-[#D1D5DB]">Video Status</p>
                          <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl border border-white/[0.08] bg-[#0A0B0E] p-1">
                            <button
                              type="button"
                              onClick={() => setVidStatus('active')}
                              className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                                vidStatus === 'active'
                                  ? 'bg-emerald-500 text-[#0A0B0E]'
                                  : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                              }`}
                            >
                              Active
                            </button>
                            <button
                              type="button"
                              onClick={() => setVidStatus('inactive')}
                              className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                                vidStatus === 'inactive'
                                  ? 'bg-[#2A2F3D] text-[#F3F4F6]'
                                  : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                              }`}
                            >
                              Inactive
                            </button>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-[#D1D5DB]">3-Ad Watch Gate</p>
                          <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl border border-white/[0.08] bg-[#0A0B0E] p-1">
                            <button
                              type="button"
                              onClick={() => setVidAdsEnabled(true)}
                              className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                                vidAdsEnabled
                                  ? 'bg-[#E5A93C] text-[#0A0B0E]'
                                  : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                              }`}
                            >
                              Ads On
                            </button>
                            <button
                              type="button"
                              onClick={() => setVidAdsEnabled(false)}
                              className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                                !vidAdsEnabled
                                  ? 'bg-[#2A2F3D] text-[#F3F4F6]'
                                  : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                              }`}
                            >
                              Ads Off
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={savingVideo}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E5A93C] px-6 py-2.5 text-xs font-semibold text-[#0A0B0E] hover:bg-[#F0B94F] disabled:opacity-60 transition-colors"
                    >
                      <Check className="h-4 w-4" />
                      <span>
                        {savingVideo
                          ? 'Saving...'
                          : editingVideoId
                            ? 'Save Video Changes'
                            : 'Publish Video'}
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 4. PAYMENT REQUESTS PAGE */}
            {activeTab === 'payments' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-[#F3F4F6]">
                      Payment Requests
                    </h1>
                    <p className="mt-1 text-sm text-[#9CA3AF]">
                      Approve to unlock download immediately for that user and video.
                    </p>
                  </div>

                  <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#12141A] p-1 self-start">
                    {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setPaymentFilter(status)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                          paymentFilter === status
                            ? 'bg-[#E5A93C] text-[#0A0B0E]'
                            : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5">
                  {filteredPayments.length === 0 ? (
                    <p className="py-10 text-center text-sm text-[#9CA3AF]">
                      No payment requests match this filter.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-white/[0.06] text-[#9CA3AF]">
                            <th className="py-2.5 pr-4 font-medium">User Name</th>
                            <th className="py-2.5 pr-4 font-medium">Video Name</th>
                            <th className="py-2.5 pr-4 font-medium text-right">Amount</th>
                            <th className="py-2.5 pr-4 font-medium">TrxID</th>
                            <th className="py-2.5 pr-4 font-medium">Time</th>
                            <th className="py-2.5 pr-4 font-medium">Status</th>
                            <th className="py-2.5 font-medium text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                          {filteredPayments.map((p) => (
                            <tr key={p.id} className="hover:bg-white/[0.02]">
                              <td className="py-3 pr-4 font-medium text-[#F3F4F6]">
                                <div>{p.userName}</div>
                                <div className="font-mono text-[11px] text-[#9CA3AF]">
                                  {p.method}
                                  {p.senderNote ? ` · ${p.senderNote}` : ''}
                                </div>
                              </td>
                              <td className="py-3 pr-4 font-medium text-[#D1D5DB] max-w-[200px] truncate">
                                {p.videoTitle}
                              </td>
                              <td className="py-3 pr-4 text-right font-mono text-[#F3F4F6] tabular-nums">
                                {p.amountTk} TK
                              </td>
                              <td className="py-3 pr-4 font-mono font-semibold text-[#F3F4F6] tabular-nums">
                                {p.trxId}
                              </td>
                              <td className="py-3 pr-4 font-mono text-[11px] text-[#9CA3AF] tabular-nums whitespace-nowrap">
                                {formatShortTime(p.createdAt)}
                              </td>
                              <td className="py-3 pr-4">
                                <span
                                  className={`font-semibold capitalize ${
                                    p.status === 'approved'
                                      ? 'text-emerald-400'
                                      : p.status === 'rejected'
                                        ? 'text-red-400'
                                        : 'text-[#E5A93C]'
                                  }`}
                                >
                                  {p.status}
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                {p.status === 'pending' ? (
                                  <div className="inline-flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={decidingId === p.id}
                                      onClick={() => handlePaymentDecision(p.id, 'approved')}
                                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      <span>Approve</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={decidingId === p.id}
                                      onClick={() => handlePaymentDecision(p.id, 'rejected')}
                                      className="inline-flex items-center gap-1 rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/25"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                      <span>Reject</span>
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[#6B7280]">
                                    {p.reviewedAt ? formatShortTime(p.reviewedAt) : 'Done'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. ADS SETTINGS PAGE */}
            {activeTab === 'ads' && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-display text-2xl font-bold text-[#F3F4F6]">Ads Settings</h1>
                  <p className="mt-1 text-sm text-[#9CA3AF]">
                    Edit Ad 1, Ad 2, and Ad 3 links and toggle Ads On/Off per video.
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void savePartialSettings({ ads: adsDraft }, 'Ad 1, Ad 2, and Ad 3 links updated.');
                  }}
                  className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5 space-y-5"
                >
                  <h2 className="font-display text-base font-bold text-[#F3F4F6]">
                    Ad 1 / Ad 2 / Ad 3 Links (15s Each)
                  </h2>
                  {adsDraft.map((ad, idx) => (
                    <div
                      key={ad.slot}
                      className="grid grid-cols-1 gap-3 border-t border-white/[0.06] pt-4 first:border-t-0 first:pt-0 sm:grid-cols-3"
                    >
                      <div>
                        <label className="block text-xs font-medium text-[#D1D5DB]">
                          Ad {ad.slot} Title
                        </label>
                        <input
                          type="text"
                          required
                          value={ad.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAdsDraft((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, title: val } : item))
                            );
                          }}
                          className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3 py-2 text-xs text-[#F3F4F6] focus:border-[#E5A93C] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#D1D5DB]">
                          Ad {ad.slot} Sponsor
                        </label>
                        <input
                          type="text"
                          required
                          value={ad.sponsor}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAdsDraft((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, sponsor: val } : item))
                            );
                          }}
                          className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3 py-2 text-xs text-[#F3F4F6] focus:border-[#E5A93C] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#D1D5DB]">
                          Ad {ad.slot} Link
                        </label>
                        <input
                          type="url"
                          required
                          value={ad.url}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAdsDraft((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, url: val } : item))
                            );
                          }}
                          className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3 py-2 font-mono text-xs text-[#F3F4F6] focus:border-[#E5A93C] focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#E5A93C] px-5 py-2 text-xs font-semibold text-[#0A0B0E] hover:bg-[#F0B94F] disabled:opacity-60 transition-colors"
                  >
                    <Check className="h-4 w-4" />
                    <span>Save Ad Links</span>
                  </button>
                </form>

                {/* Per-video Ads On/Off Toggle Table */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5">
                  <h2 className="font-display text-base font-bold text-[#F3F4F6] border-b border-white/[0.08] pb-3">
                    Ads On / Off Per Video
                  </h2>
                  <ul className="divide-y divide-white/[0.06] mt-2">
                    {videos.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-[#F3F4F6]">{v.title}</p>
                          <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
                            {v.adsEnabled
                              ? 'Requires 3 ads (15s each) before Play'
                              : 'Direct playback — Ads bypassed'}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={togglingVideoId === v.id}
                          onClick={() => handleToggleVideoAds(v)}
                          className={`min-h-[36px] rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors shrink-0 ${
                            v.adsEnabled
                              ? 'border-[#E5A93C]/40 bg-[#E5A93C]/15 text-[#E5A93C]'
                              : 'border-white/[0.1] bg-[#0A0B0E] text-[#9CA3AF]'
                          }`}
                        >
                          {v.adsEnabled ? 'Ads On' : 'Ads Off'}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* 6. FORCE JOIN SETTINGS PAGE */}
            {activeTab === 'force-join' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#12141A] p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="font-display text-xl font-bold text-[#F3F4F6]">
                      Force Join Settings
                    </h1>
                    <p className="mt-1 text-xs text-[#9CA3AF]">
                      {forceJoinEnabled
                        ? 'Force Join is ON — users must join all channels below to enter.'
                        : 'Force Join is OFF — users enter the Video Bot directly.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-white/[0.08] bg-[#0A0B0E] p-1 self-start sm:self-auto">
                    <button
                      type="button"
                      disabled={savingSettings}
                      onClick={() =>
                        void savePartialSettings(
                          { forceJoinEnabled: true },
                          'Force Join turned ON.'
                        )
                      }
                      className={`min-h-[38px] rounded-lg px-4 text-xs font-semibold transition-colors ${
                        forceJoinEnabled
                          ? 'bg-[#E5A93C] text-[#0A0B0E]'
                          : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                      }`}
                    >
                      On
                    </button>
                    <button
                      type="button"
                      disabled={savingSettings}
                      onClick={() =>
                        void savePartialSettings(
                          { forceJoinEnabled: false },
                          'Force Join turned OFF.'
                        )
                      }
                      className={`min-h-[38px] rounded-lg px-4 text-xs font-semibold transition-colors ${
                        !forceJoinEnabled
                          ? 'bg-[#2A2F3D] text-[#F3F4F6]'
                          : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                      }`}
                    >
                      Off
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={handleAddChannel}
                  className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5 space-y-4"
                >
                  <h2 className="font-display text-base font-bold text-[#F3F4F6]">Add Channel</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="ch-name" className="block text-xs font-medium text-[#D1D5DB]">
                        Channel Name
                      </label>
                      <input
                        id="ch-name"
                        type="text"
                        required
                        value={chName}
                        onChange={(e) => setChName(e.target.value)}
                        placeholder="e.g. CineVault Backup"
                        className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3.5 py-2 text-sm text-[#F3F4F6] focus:border-[#E5A93C] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="ch-url" className="block text-xs font-medium text-[#D1D5DB]">
                        Channel Link
                      </label>
                      <input
                        id="ch-url"
                        type="url"
                        required
                        value={chInviteUrl}
                        onChange={(e) => setChInviteUrl(e.target.value)}
                        placeholder="https://t.me/CineVaultBackup"
                        className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3.5 py-2 text-xs text-[#F3F4F6] focus:border-[#E5A93C] focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={savingChannel}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#E5A93C] px-5 py-2 text-xs font-semibold text-[#0A0B0E] hover:bg-[#F0B94F] transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{savingChannel ? 'Adding...' : 'Add Channel'}</span>
                  </button>
                </form>

                <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5">
                  <h2 className="font-display text-base font-bold text-[#F3F4F6] border-b border-white/[0.08] pb-3">
                    Force Join Channels ({channels.length})
                  </h2>
                  <ul className="divide-y divide-white/[0.06] mt-2">
                    {channels.map((ch) => (
                      <li key={ch.id} className="flex items-center justify-between gap-4 py-3.5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#F3F4F6] truncate">{ch.name}</p>
                          <p className="mt-0.5 font-mono text-xs text-[#9CA3AF] truncate">
                            {ch.handle} · {ch.inviteUrl}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteChannel(ch.id)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/15 transition-colors shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* 7. PAYMENT SETTINGS PAGE */}
            {activeTab === 'payment-settings' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void savePartialSettings(
                    {
                      downloadPriceTk: defaultPriceTk,
                      bkashNumber,
                      nagadNumber,
                    },
                    'Payment numbers & global default price saved.'
                  );
                }}
                className="space-y-6"
              >
                <div>
                  <h1 className="font-display text-2xl font-bold text-[#F3F4F6]">
                    Payment Settings
                  </h1>
                  <p className="mt-1 text-sm text-[#9CA3AF]">
                    Update bKash &amp; Nagad receiver numbers and the global default download price.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label htmlFor="s-bkash" className="block text-xs font-medium text-[#D1D5DB]">
                        bKash Number
                      </label>
                      <input
                        id="s-bkash"
                        type="text"
                        required
                        value={bkashNumber}
                        onChange={(e) => setBkashNumber(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3.5 py-2.5 font-mono text-sm text-[#F3F4F6] focus:border-[#E5A93C] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="s-nagad" className="block text-xs font-medium text-[#D1D5DB]">
                        Nagad Number
                      </label>
                      <input
                        id="s-nagad"
                        type="text"
                        required
                        value={nagadNumber}
                        onChange={(e) => setNagadNumber(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3.5 py-2.5 font-mono text-sm text-[#F3F4F6] focus:border-[#E5A93C] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="s-price" className="block text-xs font-medium text-[#D1D5DB]">
                        Global Default Download Price (TK)
                      </label>
                      <input
                        id="s-price"
                        type="number"
                        min={0}
                        required
                        value={defaultPriceTk}
                        onChange={(e) => setDefaultPriceTk(Number(e.target.value))}
                        className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3.5 py-2.5 font-mono text-sm text-[#F3F4F6] tabular-nums focus:border-[#E5A93C] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E5A93C] px-6 py-2.5 text-xs font-semibold text-[#0A0B0E] hover:bg-[#F0B94F] disabled:opacity-60 transition-colors"
                >
                  {savingSettings ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4" />
                  )}
                  <span>Save Payment Settings</span>
                </button>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
};
