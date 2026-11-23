import React, { useEffect, useState } from 'react';
import { ExternalLink, ArrowRight, X, Loader2 } from 'lucide-react';
import type { AdSlot, VideoItem } from '../types';

interface AdGateModalProps {
  video: VideoItem;
  adToken: string;
  initialAd: AdSlot;
  onAdvanceAd: (token: string, currentStep: 1 | 2 | 3) => Promise<{
    completed: boolean;
    step?: 2 | 3;
    ad?: AdSlot;
    video?: VideoItem | null;
  }>;
  onCancel: (token: string) => Promise<void>;
  onAllAdsComplete: (updatedVideo: VideoItem) => void;
}

export const AdGateModal: React.FC<AdGateModalProps> = ({
  video,
  adToken,
  initialAd,
  onAdvanceAd,
  onCancel,
  onAllAdsComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [currentAd, setCurrentAd] = useState<AdSlot>(initialAd);
  const totalSec = currentAd.durationSec || 15;
  const [secondsLeft, setSecondsLeft] = useState<number>(totalSec);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setSecondsLeft(currentAd.durationSec || 15);
  }, [step, currentAd]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft, step]);

  const handleClose = async () => {
    await onCancel(adToken);
  };

  const handleNext = async () => {
    if (secondsLeft > 0 || submitting) return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await onAdvanceAd(adToken, step);
      if (res.completed) {
        onAllAdsComplete(res.video || video);
      } else if (res.step && res.ad) {
        setStep(res.step);
        setCurrentAd(res.ad);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to advance ad step.');
    } finally {
      setSubmitting(false);
    }
  };

  const progressPct = Math.round(((totalSec - secondsLeft) / totalSec) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ad-gate-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#12141A] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <p className="font-mono text-xs font-semibold text-[#E5A93C] tabular-nums">
              Ad {step}/3 · Sponsored Break
            </p>
            <h2 id="ad-gate-title" className="mt-1 font-display text-lg font-bold text-[#F3F4F6]">
              Watch 3 short ads to unlock playback
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close ad sequence"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] text-[#9CA3AF] hover:border-white/20 hover:text-[#F3F4F6] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Indicator Bars */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="h-1.5 overflow-hidden rounded-full bg-[#1E222D]">
              <div
                className="h-full bg-[#E5A93C] transition-all duration-300"
                style={{
                  width: idx < step ? '100%' : idx === step ? `${progressPct}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Ad Content Surface */}
        <div className="mt-5 rounded-xl border border-white/[0.08] bg-[#0A0B0E] p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-[#9CA3AF]">
              {currentAd.sponsor}
            </span>
            <span className="font-mono text-sm font-semibold text-[#F3F4F6] tabular-nums">
              00:{String(secondsLeft).padStart(2, '0')}
            </span>
          </div>

          <h3 className="mt-2 font-display text-lg font-semibold text-[#F3F4F6]">
            {currentAd.title}
          </h3>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            Unlocking: <span className="text-[#F3F4F6]">{video.title}</span>
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
            <a
              href={currentAd.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-white/[0.12] bg-[#181B23] px-3.5 py-2 text-xs font-semibold text-[#F3F4F6] hover:border-[#E5A93C]/50 hover:text-[#E5A93C] transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open Sponsor Link</span>
            </a>

            <span className="text-xs text-[#6B7280]">
              Closing now resets progress to Ad 1
            </span>
          </div>
        </div>

        {errorMsg && (
          <p className="mt-3 text-xs font-medium text-red-400">{errorMsg}</p>
        )}

        {/* Footer Actions */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="min-h-[44px] rounded-xl border border-white/[0.1] px-4 py-2 text-xs font-semibold text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={secondsLeft > 0 || submitting}
            onClick={handleNext}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#E5A93C] px-5 py-2 text-xs font-semibold text-[#0A0B0E] hover:bg-[#F0B94F] disabled:cursor-not-allowed disabled:bg-[#232732] disabled:text-[#9CA3AF] transition-colors tabular-nums"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : secondsLeft > 0 ? (
              <span>Next ({secondsLeft}s)</span>
            ) : (
              <>
                <span>{step < 3 ? 'Next Ad' : 'Play Video Now'}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
