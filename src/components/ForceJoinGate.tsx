import React, { useState } from 'react';
import { Check, ExternalLink, Lock, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import type { ChannelItem } from '../types';

interface ForceJoinGateProps {
  channels: ChannelItem[];
  joinedChannelIds: string[];
  telegramBotConfigured: boolean;
  onJoinChannel: (channel: ChannelItem) => Promise<void>;
  onLeaveChannel: (channelId: string) => Promise<void>;
  onCheckMembership: (telegramUserId?: string) => Promise<{ allJoined: boolean; message?: string }>;
}

export const ForceJoinGate: React.FC<ForceJoinGateProps> = ({
  channels,
  joinedChannelIds,
  telegramBotConfigured,
  onJoinChannel,
  onLeaveChannel,
  onCheckMembership,
}) => {
  const [checking, setChecking] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [telegramUserId, setTelegramUserId] = useState('');

  const joinedSet = new Set(joinedChannelIds);
  const joinedCount = channels.filter((c) => joinedSet.has(c.id)).length;

  const handleJoinClick = async (channel: ChannelItem) => {
    setErrorMsg(null);
    setJoiningId(channel.id);
    try {
      await onJoinChannel(channel);
    } finally {
      setJoiningId(null);
    }
  };

  const handleContinue = async () => {
    setErrorMsg(null);
    setChecking(true);
    try {
      const result = await onCheckMembership(telegramUserId.trim() || undefined);
      if (!result.allJoined) {
        setErrorMsg(result.message || 'Please join all channels');
      }
    } catch {
      setErrorMsg('Please join all channels');
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[calc(100vh-76px)] w-full max-w-2xl flex-col items-center justify-center px-4 py-10 sm:px-6">
      {/* 1 Card Only */}
      <div className="w-full rounded-2xl border border-white/[0.08] bg-[#12141A] p-6 sm:p-8 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#E5A93C]">
              <Lock className="h-3.5 w-3.5" />
              <span>Mandatory Channel Verification</span>
            </div>
            <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[#F3F4F6] text-balance">
              Join Our Channels
            </h1>
            <p className="mt-1 text-sm text-[#9CA3AF]">
              Join all {channels.length} official channels below to unlock the video library.
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="font-mono text-sm font-semibold text-[#F3F4F6] tabular-nums">
              {joinedCount}/{channels.length}
            </span>
            <p className="text-xs text-[#6B7280]">Joined</p>
          </div>
        </div>

        {/* Channel List inside the single card */}
        <ul className="divide-y divide-white/[0.06] mt-2">
          {channels.length === 0 ? (
            <li className="py-8 text-center text-sm text-[#9CA3AF]">
              No channels required right now. Click Check Membership &amp; Continue below.
            </li>
          ) : (
            channels.map((channel, index) => {
              const isJoined = joinedSet.has(channel.id);
              const isBusy = joiningId === channel.id;

              return (
                <li
                  key={channel.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[#6B7280] tabular-nums">
                        {String(index + 1).padStart(2, '0')}.
                      </span>
                      <span className="truncate text-sm font-semibold text-[#F3F4F6]">
                        {channel.name}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 pl-6 text-xs text-[#9CA3AF]">
                      <span className="font-mono text-[#9CA3AF]">{channel.handle}</span>
                      {channel.memberCountLabel && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{channel.memberCountLabel}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-6 sm:pl-0 shrink-0">
                    {isJoined ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                          <Check className="h-4 w-4" />
                          Joined
                        </span>
                        <button
                          type="button"
                          onClick={() => onLeaveChannel(channel.id)}
                          className="min-h-[36px] rounded-lg border border-white/[0.08] px-2.5 py-1 text-xs text-[#9CA3AF] hover:text-[#F3F4F6] hover:border-white/20 transition-colors"
                          title="Simulate leaving channel"
                        >
                          Leave
                        </button>
                      </>
                    ) : (
                      <a
                        href={channel.inviteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          void handleJoinClick(channel);
                        }}
                        className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-[#E5A93C]/40 bg-[#E5A93C]/10 px-4 py-2 text-xs font-semibold text-[#E5A93C] hover:bg-[#E5A93C] hover:text-[#0A0B0E] transition-colors whitespace-nowrap"
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ExternalLink className="h-3.5 w-3.5" />
                        )}
                        <span>Join Channel</span>
                      </a>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {telegramBotConfigured && (
          <div className="mt-4 border-t border-white/[0.08] pt-4">
            <label
              htmlFor="tg-user-id"
              className="block text-xs font-medium text-[#9CA3AF]"
            >
              Telegram Numeric User ID (Live Bot API Check)
            </label>
            <input
              id="tg-user-id"
              type="text"
              inputMode="numeric"
              value={telegramUserId}
              onChange={(e) => setTelegramUserId(e.target.value)}
              placeholder="e.g. 5482910384 (optional in web preview)"
              className="mt-1.5 w-full rounded-lg border border-white/[0.1] bg-[#0A0B0E] px-3 py-2 font-mono text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#E5A93C] focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Error Message when blocked */}
      {errorMsg && (
        <div
          role="alert"
          className="mt-4 flex w-full items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Primary Button BELOW the card (outside card) */}
      <button
        type="button"
        disabled={checking}
        onClick={handleContinue}
        className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#E5A93C] px-6 py-3 text-sm font-semibold text-[#0A0B0E] hover:bg-[#F0B94F] disabled:opacity-60 transition-colors shadow-lg shadow-[#E5A93C]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A93C]"
      >
        {checking ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Verifying Membership...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            <span>Check Membership &amp; Continue</span>
          </>
        )}
      </button>
    </section>
  );
};
