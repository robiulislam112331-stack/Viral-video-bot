import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Download, AlertCircle, X } from 'lucide-react';
import { TopBar, type AppView, type BotSection } from './components/TopBar';
import { ForceJoinGate } from './components/ForceJoinGate';
import { VideoCard } from './components/VideoCard';
import { AdGateModal } from './components/AdGateModal';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { PaymentModal } from './components/PaymentModal';
import { AdminPanel } from './components/AdminPanel';
import type {
  AdSlot,
  BootstrapPayload,
  ChannelItem,
  PaymentMethod,
  PaymentRequest,
  VideoItem,
} from './types';

async function downloadDemoReelBlob(video: VideoItem): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = video.thumbnailUrl;

  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });

  if (typeof MediaRecorder !== 'undefined' && canvas.captureStream) {
    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunks.push(ev.data);
    };

    const donePromise = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    });

    recorder.start();
    const start = performance.now();
    const renderFrame = (now: number) => {
      const elapsed = now - start;
      if (ctx) {
        ctx.fillStyle = '#0A0B0E';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (img.complete && img.naturalWidth > 0) {
          const zoom = 1 + (elapsed / 2500) * 0.05;
          const dw = canvas.width * zoom;
          const dh = canvas.height * zoom;
          ctx.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, canvas.height - 90, canvas.width, 90);
        ctx.fillStyle = '#F3F4F6';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(video.title, 40, canvas.height - 46);
        ctx.fillStyle = '#E5A93C';
        ctx.font = '18px monospace';
        ctx.fillText(`${video.category} · ${video.duration}`, 40, canvas.height - 18);
      }
      if (elapsed < 2200) {
        requestAnimationFrame(renderFrame);
      } else {
        recorder.stop();
      }
    };
    requestAnimationFrame(renderFrame);

    const blob = await donePromise;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${video.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const a = document.createElement('a');
  a.href = video.thumbnailUrl;
  a.download = `${video.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function App() {
  const [view, setView] = useState<AppView>('bot');
  const [botSection, setBotSection] = useState<BotSection>('all');
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Admin Bearer token kept strictly in React memory
  const [adminToken, setAdminToken] = useState<string | null>(null);

  // Filters on Home
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Active modals
  const [adGateState, setAdGateState] = useState<{
    video: VideoItem;
    token: string;
    initialAd: AdSlot;
  } | null>(null);
  const [activePlayerVideo, setActivePlayerVideo] = useState<VideoItem | null>(null);
  const [paymentModalVideo, setPaymentModalVideo] = useState<VideoItem | null>(null);

  const loadBootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap', { credentials: 'include' });
      if (!res.ok) throw new Error('Unable to load bot state');
      const payload = (await res.json()) as BootstrapPayload;
      setData(payload);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to reach server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  // Keep User Bot synced when in Bot View (lightweight focus refresh so Admin changes apply immediately)
  useEffect(() => {
    const onFocus = () => {
      if (view === 'bot') {
        void loadBootstrap();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [view, loadBootstrap]);

  const handleJoinChannel = async (channel: ChannelItem) => {
    const res = await fetch('/api/membership/join', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ channelId: channel.id }),
    });
    if (res.ok) {
      const json = (await res.json()) as { joinedChannelIds: string[] };
      setData((prev) => (prev ? { ...prev, joinedChannelIds: json.joinedChannelIds } : prev));
    }
  };

  const handleLeaveChannel = async (channelId: string) => {
    const res = await fetch('/api/membership/leave', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ channelId }),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        joinedChannelIds: string[];
        membershipVerified: boolean;
      };
      setData((prev) =>
        prev
          ? {
              ...prev,
              joinedChannelIds: json.joinedChannelIds,
              membershipVerified: json.membershipVerified,
            }
          : prev
      );
    }
  };

  const handleCheckMembership = async (telegramUserId?: string) => {
    const res = await fetch('/api/membership/check', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ telegramUserId }),
    });
    const json = (await res.json()) as {
      allJoined: boolean;
      joinedChannelIds: string[];
      message?: string;
      videos: VideoItem[];
    };

    setData((prev) =>
      prev
        ? {
            ...prev,
            joinedChannelIds: json.joinedChannelIds,
            membershipVerified: json.allJoined,
            videos: json.allJoined ? json.videos : [],
          }
        : prev
    );

    return { allJoined: json.allJoined, message: json.message };
  };

  const handleStartPlay = async (video: VideoItem) => {
    setErrorBanner(null);
    const res = await fetch('/api/ads/start', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ videoId: video.id }),
    });
    const json = (await res.json()) as {
      adsSkipped?: boolean;
      video?: VideoItem;
      token?: string;
      ad?: AdSlot;
      error?: string;
    };

    if (!res.ok) {
      setErrorBanner(json.error || 'Could not start playback.');
      return;
    }

    // If Admin turned Ads OFF for this video, open player directly
    if (json.adsSkipped && json.video) {
      setData((prev) =>
        prev
          ? {
              ...prev,
              videos: prev.videos.map((v) => (v.id === json.video!.id ? json.video! : v)),
            }
          : prev
      );
      setActivePlayerVideo(json.video);
      return;
    }

    if (!json.token || !json.ad) {
      setErrorBanner('Could not initialize ad sequence.');
      return;
    }

    setAdGateState({
      video,
      token: json.token,
      initialAd: json.ad,
    });
  };

  const handleAdvanceAd = async (token: string, currentStep: 1 | 2 | 3) => {
    const res = await fetch('/api/ads/next', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ token, currentStep }),
    });
    const json = (await res.json()) as {
      completed: boolean;
      step?: 2 | 3;
      ad?: AdSlot;
      video?: VideoItem | null;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(json.error || 'Please finish the 15-second ad.');
    }
    return json;
  };

  const handleCancelAd = async (token: string) => {
    setAdGateState(null);
    await fetch('/api/ads/cancel', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ token }),
    });
  };

  const handleAllAdsComplete = (updatedVideo: VideoItem) => {
    setAdGateState(null);
    setData((prev) =>
      prev
        ? {
            ...prev,
            videos: prev.videos.map((v) => (v.id === updatedVideo.id ? updatedVideo : v)),
          }
        : prev
    );
    setActivePlayerVideo(updatedVideo);
  };

  const handleDownloadClick = async (video: VideoItem) => {
    if (!data) return;
    const isFree = video.downloadType === 'free' || video.downloadPriceTk <= 0;
    const isUnlocked = isFree || data.unlockedVideoIds.includes(video.id);

    if (!isUnlocked) {
      setPaymentModalVideo(video);
      return;
    }

    const res = await fetch(`/api/videos/${encodeURIComponent(video.id)}/download`, {
      credentials: 'include',
    });

    if (res.status === 403) {
      setPaymentModalVideo(video);
      return;
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = (await res.json()) as {
        unlocked?: boolean;
        videoUrl?: string;
        isDemoReel?: boolean;
      };
      if (json.isDemoReel) {
        await downloadDemoReelBlob(video);
        return;
      }
      if (json.videoUrl) {
        const a = document.createElement('a');
        a.href = json.videoUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.download = `${video.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } else {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${video.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  };

  const handleSubmitPayment = async (payload: {
    videoId: string;
    method: PaymentMethod;
    trxId: string;
    userName: string;
    senderNote: string;
  }) => {
    const res = await fetch('/api/payments', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { payment?: PaymentRequest; error?: string };
    if (!res.ok || !json.payment) {
      throw new Error(json.error || 'Failed to submit TrxID.');
    }
    setData((prev) =>
      prev
        ? {
            ...prev,
            viewerPayments: [json.payment!, ...prev.viewerPayments],
          }
        : prev
    );
    return json.payment;
  };

  const categories = useMemo(() => {
    if (!data) return ['All'];
    const unique = Array.from(new Set(data.videos.map((v) => v.category)));
    return ['All', ...unique];
  }, [data]);

  const visibleVideos = useMemo(() => {
    if (!data) return [];
    return data.videos.filter((v) => {
      const isFree = v.downloadType === 'free' || v.downloadPriceTk <= 0;
      if (botSection === 'unlocked' && !isFree && !data.unlockedVideoIds.includes(v.id)) {
        return false;
      }
      if (selectedCategory !== 'All' && v.category !== selectedCategory) {
        return false;
      }
      if (
        searchQuery.trim() &&
        !v.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
        !v.category.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [data, botSection, selectedCategory, searchQuery]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0B0E] text-sm text-[#9CA3AF]">
        Initializing CineVault Bot...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0B0E] px-4 text-center">
        <p className="text-sm text-red-400">{errorBanner || 'Unable to connect to server.'}</p>
        <button
          type="button"
          onClick={() => void loadBootstrap()}
          className="mt-4 rounded-xl bg-[#E5A93C] px-4 py-2 text-xs font-semibold text-[#0A0B0E]"
        >
          Retry
        </button>
      </div>
    );
  }

  const unlockedSet = new Set(data.unlockedVideoIds);
  const canAccessHome = !data.forceJoinEnabled || data.membershipVerified;

  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#F3F4F6]">
      <TopBar
        view={view}
        onToggleView={(next) => {
          setView(next);
          if (next === 'bot') {
            void loadBootstrap();
          }
        }}
        membershipVerified={canAccessHome}
        botSection={botSection}
        onSelectBotSection={setBotSection}
        unlockedCount={
          data.videos.filter(
            (v) => v.downloadType === 'free' || v.downloadPriceTk <= 0 || unlockedSet.has(v.id)
          ).length
        }
      />

      {errorBanner && (
        <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              {errorBanner}
            </span>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              aria-label="Close error"
              className="opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {view === 'admin' ? (
        <AdminPanel
          adminToken={adminToken}
          onSetAdminToken={setAdminToken}
          onDataChanged={loadBootstrap}
        />
      ) : !canAccessHome ? (
        <ForceJoinGate
          channels={data.channels}
          joinedChannelIds={data.joinedChannelIds}
          telegramBotConfigured={data.telegramBotConfigured}
          onJoinChannel={handleJoinChannel}
          onLeaveChannel={handleLeaveChannel}
          onCheckMembership={handleCheckMembership}
        />
      ) : (
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-5 border-b border-white/[0.08] pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-xs text-[#E5A93C] tabular-nums">
                {data.videos.length} Videos · Default Price {data.settings.downloadPriceTk} TK
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-[#F3F4F6] text-balance">
                {botSection === 'unlocked' ? 'Unlocked Downloads' : 'Premium Video Feed'}
              </h1>
              <p className="mt-1 text-sm text-[#9CA3AF]">
                Stream videos in-app or download free &amp; paid releases.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search videos..."
                  aria-label="Search videos"
                  className="min-h-[42px] w-full rounded-xl border border-white/[0.1] bg-[#12141A] pl-9 pr-3.5 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#E5A93C] focus:outline-none sm:w-64"
                />
              </div>
              <div className="flex items-center gap-2 md:hidden">
                <button
                  type="button"
                  onClick={() => setBotSection(botSection === 'all' ? 'unlocked' : 'all')}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-white/[0.1] bg-[#12141A] px-3.5 text-xs font-semibold text-[#F3F4F6]"
                >
                  <Download className="h-3.5 w-3.5 text-[#E5A93C]" />
                  <span>{botSection === 'unlocked' ? 'Show All' : 'Unlocked'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-[#E5A93C] text-[#0A0B0E]'
                    : 'border border-white/[0.08] bg-[#12141A] text-[#9CA3AF] hover:text-[#F3F4F6]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {visibleVideos.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-white/[0.08] bg-[#12141A] p-12 text-center">
              <p className="text-sm font-medium text-[#F3F4F6]">
                {botSection === 'unlocked'
                  ? 'You have no free or unlocked downloads yet.'
                  : 'No active videos match your filter.'}
              </p>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                {botSection === 'unlocked'
                  ? 'Click Download on any video to get started.'
                  : 'Clear the search query or select All categories.'}
              </p>
              {botSection === 'unlocked' && (
                <button
                  type="button"
                  onClick={() => setBotSection('all')}
                  className="mt-4 rounded-xl bg-[#E5A93C] px-4 py-2 text-xs font-semibold text-[#0A0B0E]"
                >
                  Browse All Videos
                </button>
              )}
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleVideos.map((video) => {
                const pendingPayment = data.viewerPayments.find(
                  (p) => p.videoId === video.id && p.status === 'pending'
                );
                const rejectedPayment = data.viewerPayments.find(
                  (p) => p.videoId === video.id && p.status === 'rejected'
                );
                return (
                  <VideoCard
                    key={video.id}
                    video={video}
                    isUnlocked={unlockedSet.has(video.id)}
                    pendingPayment={pendingPayment}
                    rejectedPayment={rejectedPayment}
                    onPlay={(v) => void handleStartPlay(v)}
                    onDownloadClick={(v) => void handleDownloadClick(v)}
                  />
                );
              })}
            </div>
          )}
        </main>
      )}

      {adGateState && (
        <AdGateModal
          video={adGateState.video}
          adToken={adGateState.token}
          initialAd={adGateState.initialAd}
          onAdvanceAd={handleAdvanceAd}
          onCancel={handleCancelAd}
          onAllAdsComplete={handleAllAdsComplete}
        />
      )}

      {activePlayerVideo && (
        <VideoPlayerModal
          video={activePlayerVideo}
          isUnlocked={unlockedSet.has(activePlayerVideo.id)}
          onClose={() => setActivePlayerVideo(null)}
          onRequestDownload={(v) => {
            setActivePlayerVideo(null);
            void handleDownloadClick(v);
          }}
        />
      )}

      {paymentModalVideo && (
        <PaymentModal
          video={paymentModalVideo}
          settings={data.settings}
          existingPending={data.viewerPayments.find(
            (p) => p.videoId === paymentModalVideo.id && p.status === 'pending'
          )}
          existingRejected={data.viewerPayments.find(
            (p) => p.videoId === paymentModalVideo.id && p.status === 'rejected'
          )}
          onSubmitPayment={handleSubmitPayment}
          onClose={() => setPaymentModalVideo(null)}
        />
      )}
    </div>
  );
}
