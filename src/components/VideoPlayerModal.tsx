import React, { useEffect, useRef, useState } from 'react';
import {
  Maximize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
  Lock,
  Download,
} from 'lucide-react';
import type { VideoItem } from '../types';

interface VideoPlayerModalProps {
  video: VideoItem;
  isUnlocked: boolean;
  onClose: () => void;
  onRequestDownload: (video: VideoItem) => void;
}

function parseDurationToSeconds(duration: string): number {
  const parts = duration.split(':').map((n) => parseInt(n, 10));
  if (parts.length === 2 && parts.every((n) => !Number.isNaN(n))) {
    return parts[0] * 60 + parts[1];
  }
  return 180;
}

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  video,
  isUnlocked,
  onClose,
  onRequestDownload,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDemo = video.isDemoReel || video.videoUrl.startsWith('demo://');
  const isFree = video.downloadType === 'free' || video.downloadPriceTk <= 0;
  const totalSeconds = parseDurationToSeconds(video.duration);

  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    if (!isDemo && !videoError) return;
    let rafId = 0;
    let lastTs = performance.now();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = video.thumbnailUrl;

    const render = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;

      if (playing) {
        setCurrentTime((prev) => (prev + dt >= totalSeconds ? 0 : prev + dt));
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.fillStyle = '#0A0B0E';
          ctx.fillRect(0, 0, w, h);

          if (img.complete && img.naturalWidth > 0) {
            const t = now * 0.00035;
            const scale = 1.06 + Math.sin(t) * 0.03;
            const dx = Math.sin(t * 0.7) * 14;
            const dy = Math.cos(t * 0.5) * 8;
            const dw = w * scale;
            const dh = h * scale;
            ctx.save();
            ctx.drawImage(img, (w - dw) / 2 + dx, (h - dh) / 2 + dy, dw, dh);
            ctx.restore();
          }

          const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.72);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.58)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);

          if (playing) {
            const bars = 28;
            const barWidth = 4;
            const gap = 4;
            const startX = 28;
            const baseY = h - 24;
            ctx.fillStyle = 'rgba(229, 169, 60, 0.75)';
            for (let i = 0; i < bars; i++) {
              const barH = 4 + Math.abs(Math.sin(now * 0.006 + i * 0.65)) * 16;
              ctx.fillRect(startX + i * (barWidth + gap), baseY - barH, barWidth, barH);
            }
          }
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [isDemo, videoError, playing, totalSeconds, video.thumbnailUrl]);

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
    >
      <div
        ref={containerRef}
        className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/[0.1] bg-[#12141A] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-3.5">
          <div className="min-w-0">
            <h2 id="player-title" className="truncate font-display text-base font-bold text-[#F3F4F6]">
              {video.title}
            </h2>
            <p className="text-xs text-[#9CA3AF]">
              {video.category} · {video.duration}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onRequestDownload(video)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#181B23] px-3 py-1.5 text-xs font-semibold text-[#F3F4F6] hover:border-[#E5A93C]/50 hover:text-[#E5A93C] transition-colors whitespace-nowrap"
            >
              {isFree ? (
                <>
                  <Download className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Free Download</span>
                </>
              ) : isUnlocked ? (
                <>
                  <Download className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Download</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-[#E5A93C]" />
                  <span>Download {video.downloadPriceTk} TK</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close player"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-[#9CA3AF] hover:border-white/20 hover:text-[#F3F4F6] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative aspect-video w-full bg-black">
          {!isDemo && !videoError ? (
            <video
              src={video.videoUrl}
              poster={video.thumbnailUrl}
              controls
              autoPlay
              playsInline
              onError={() => setVideoError(true)}
              className="h-full w-full object-contain bg-black"
            />
          ) : (
            <>
              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-3 pt-8">
                <input
                  type="range"
                  min={0}
                  max={totalSeconds}
                  value={currentTime}
                  onChange={(e) => setCurrentTime(Number(e.target.value))}
                  aria-label="Seek video timeline"
                  className="mb-2 h-1 w-full cursor-pointer accent-[#E5A93C]"
                />
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPlaying((p) => !p)}
                      aria-label={playing ? 'Pause' : 'Play'}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E5A93C] text-[#0A0B0E] hover:bg-[#F0B94F] transition-colors"
                    >
                      {playing ? (
                        <Pause className="h-4 w-4 fill-current" />
                      ) : (
                        <Play className="h-4 w-4 fill-current" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMuted((m) => !m)}
                      aria-label={muted ? 'Unmute' : 'Mute'}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-[#F3F4F6] hover:bg-white/20 transition-colors"
                    >
                      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    <span className="font-mono text-xs text-[#E5E7EB] tabular-nums">
                      {formatSeconds(currentTime)} / {formatSeconds(totalSeconds)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleFullscreen}
                    aria-label="Toggle fullscreen"
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-[#F3F4F6] hover:bg-white/20 transition-colors"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
