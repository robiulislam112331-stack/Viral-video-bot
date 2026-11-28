import React from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Gift,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { deriveTelegramHandle } from '../../data/defaultEarnMoneyState';
import type { EarnMoneyConfig } from '../../types/earnMoney';
import { openExternalTelegramLink } from '../../utils/telegram';

export interface ForceJoinGateProps {
  config: EarnMoneyConfig;
  joinedWaincomesite: boolean;
  joinedPremiumApps: boolean;
  onJoinChannel: (channel: 'waincomesite' | 'premiumapps') => void;
  onVerifyMembership: () => void;
}

export const ForceJoinGate: React.FC<ForceJoinGateProps> = ({
  config,
  joinedWaincomesite,
  joinedPremiumApps,
  onJoinChannel,
  onVerifyMembership,
}) => {
  const channels: Array<{
    key: 'waincomesite' | 'premiumapps';
    buttonLabel: string;
    title: string;
    username: string;
    url: string;
  }> = [
    {
      key: 'waincomesite',
      buttonLabel: 'Join Channel 1',
      title: 'Channel 1',
      username: deriveTelegramHandle(config.channel1Url, '@Channel1'),
      url: config.channel1Url,
    },
    {
      key: 'premiumapps',
      buttonLabel: 'Join Channel 2',
      title: 'Channel 2',
      username: deriveTelegramHandle(config.channel2Url, '@Channel2'),
      url: config.channel2Url,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F2F4F7] px-4 py-8 text-[#111827]">
      <div className="w-full max-w-md space-y-5">
        {/* Main 3D Welcome Card */}
        <section className="mf-card-3d p-6">
          <div className="flex flex-col items-center text-center">
            <div className="mf-icon-circle flex h-16 w-16 items-center justify-center">
              <Lock className="h-7 w-7 text-[#00944A]" />
            </div>

            <h1 className="mt-4 flex items-center justify-center gap-1.5 font-display text-xl font-extrabold text-[#111827]">
              <span>{config.welcomeTitle}</span>
              <Gift className="h-5 w-5 text-[#00944A]" aria-hidden="true" />
            </h1>

            <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-600">
              {config.welcomeSubtitle}
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {channels.map((ch) => {
              const isJoined =
                ch.key === 'waincomesite' ? joinedWaincomesite : joinedPremiumApps;

              return (
                <div
                  key={ch.key}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-[#F6F8FA] p-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="mf-icon-circle flex h-10 w-10 shrink-0 items-center justify-center">
                      <ShieldCheck className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-sm font-extrabold text-[#111827]">
                        {ch.title}
                      </p>
                      <p className="truncate font-mono text-xs font-semibold text-slate-500">
                        {ch.username}
                      </p>
                    </div>
                  </div>

                  <a
                    href={ch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      onJoinChannel(ch.key);
                      if (openExternalTelegramLink(ch.url)) {
                        e.preventDefault();
                      }
                    }}
                    className={`inline-flex min-h-[42px] shrink-0 items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold whitespace-nowrap ${
                      isJoined ? 'mf-btn-outline-3d' : 'mf-btn-3d text-[#00944A]'
                    }`}
                  >
                    {isJoined ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#00944A]" />
                        <span>{ch.buttonLabel}</span>
                      </>
                    ) : (
                      <>
                        <span>{ch.buttonLabel}</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </>
                    )}
                  </a>
                </div>
              );
            })}
          </div>
        </section>

        {/* Verify & Continue Button Outside Card */}
        <button
          type="button"
          onClick={onVerifyMembership}
          className="mf-btn-green-3d flex min-h-[52px] w-full items-center justify-center gap-2 px-5 py-3.5 text-sm font-extrabold"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>Verify &amp; Continue</span>
        </button>
      </div>
    </div>
  );
};
