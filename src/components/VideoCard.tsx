import React, { useState } from 'react';
import { Clock, Download, Film, Lock, Play, Unlock } from 'lucide-react';
import type { PaymentRequest, VideoItem } from '../types';

interface VideoCardProps {
  video: VideoItem;
  isUnlocked: boolean;
  pendingPayment?: PaymentRequest;
  rejectedPayment?: PaymentRequest;
  onPlay: (video: VideoItem) => void;
  onDownloadClick: (video: VideoItem) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isUnlocked,
  pendingPayment,
  rejectedPayment,
  onPlay,
  onDownloadClick,
}) => {
  const [imgError, setImgError] = useState(false);

  const isFree = video.downloadType === 'free' || video.downloadPriceTk <= 0;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12141A] transition-colors hover:border-white/[0.16]">
      {/* 16:9 Thumbnail Container */}
      <div className="relative aspect-video w-full overflow-hidden bg-[#181B23]">
        {!imgError && video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#181B23] to-[#0A0B0E] p-4 text-center">
            <Film className="h-8 w-8 text-[#6B7280]" />
            <span className="mt-2 line-clamp-1 text-xs font-medium text-[#9CA3AF]">
              {video.title}
            </span>
          </div>
        )}

        {/* Measured scrim & crisp duration label */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
        <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/80 px-2 py-0.5 font-mono text-xs font-medium text-[#F3F4F6] tabular-nums backdrop-blur-sm">
          {video.duration}
        </span>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        <div>
          <h2 className="font-display text-base font-semibold leading-snug text-[#F3F4F6] line-clamp-2">
            {video.title}
          </h2>
          {/* Zero-Pill Unboxed Metadata */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[#9CA3AF]">
            <span>{video.category}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{video.duration}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{video.views.toLocaleString()} views</span>
          </div>
        </div>

        {/* Status Note if pending or rejected */}
        {!isFree && pendingPayment && !isUnlocked && (
          <p className="mt-3 text-xs text-[#E5A93C] font-mono tabular-nums">
            Pending verification · TrxID {pendingPayment.trxId}
          </p>
        )}
        {!isFree && rejectedPayment && !pendingPayment && !isUnlocked && (
          <p className="mt-3 text-xs text-red-400">
            Last TrxID rejected · Submit a valid payment
          </p>
        )}

        {/* Action Buttons */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onPlay(video)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#E5A93C] px-3 py-2 text-xs font-semibold text-[#0A0B0E] hover:bg-[#F0B94F] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A93C]"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Play</span>
          </button>

          {isFree ? (
            <button
              type="button"
              onClick={() => onDownloadClick(video)}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Free Download</span>
            </button>
          ) : isUnlocked ? (
            <button
              type="button"
              onClick={() => onDownloadClick(video)}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Download className="h-3.5 w-3.5" />
              <Unlock className="h-3 w-3" />
              <span>Download</span>
            </button>
          ) : pendingPayment ? (
            <button
              type="button"
              onClick={() => onDownloadClick(video)}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#E5A93C]/35 bg-[#E5A93C]/10 px-3 py-2 text-xs font-semibold text-[#E5A93C] hover:bg-[#E5A93C]/20 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A93C]"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Pending</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onDownloadClick(video)}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-[#181B23] px-3 py-2 text-xs font-semibold text-[#F3F4F6] hover:border-[#E5A93C]/50 hover:text-[#E5A93C] transition-colors whitespace-nowrap tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A93C]"
            >
              <Lock className="h-3.5 w-3.5 text-[#E5A93C]" />
              <span>{video.downloadPriceTk} TK</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
