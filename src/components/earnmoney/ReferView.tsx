import React, { useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  Share2,
  ShieldCheck,
  Tv,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  deriveTelegramHandle,
  formatReferralLink,
  isReferActivationComplete,
} from '../../data/defaultEarnMoneyState';
import type { EarnMoneyConfig, EarnMoneyState, ModalType } from '../../types/earnMoney';
import { openExternalTelegramLink } from '../../utils/telegram';

interface ReferViewProps {
  state: EarnMoneyState;
  config: EarnMoneyConfig;
  onCopyInviteLink: () => void;
  onJoinChannel: (channel: 'waincomesite' | 'premiumapps') => void;
  onVerifyActivate: () => void;
  onOpenModal: (modal: ModalType) => void;
}

type ReferralFilter = 'all' | 'active' | 'pending';

export const ReferView: React.FC<ReferViewProps> = ({
  state,
  config,
  onCopyInviteLink,
  onJoinChannel,
  onVerifyActivate,
  onOpenModal,
}) => {
  const [filter, setFilter] = useState<ReferralFilter>('all');
  const [copied, setCopied] = useState(false);

  const channel1Handle = deriveTelegramHandle(config.channel1Url, '@Channel1');
  const channel2Handle = deriveTelegramHandle(config.channel2Url, '@Channel2');
  const inviteLink = formatReferralLink(config.referLinkFormat, state.userId);
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
    inviteLink
  )}&text=${encodeURIComponent(`Join ${config.botName} & earn daily USDT BEP20 rewards!`)}`;

  const adsDone = state.adsWatchedTotal || 0;
  const channelsDone = (state.joinedWaincomesite ? 1 : 0) + (state.joinedPremiumApps ? 1 : 0);
  const tasksDone =
    state.completedTaskIds?.length ?? state.bonusTasks.filter((t) => t.completed).length;

  const minAds = config.referMinAdsWatched || 0;
  const minChannels = config.referMinChannelsJoined || 0;
  const minTasks = config.referMinTasksCompleted || 0;
  const allRulesZero = minAds === 0 && minChannels === 0 && minTasks === 0;
  const isActivated = allRulesZero || isReferActivationComplete(state, config);

  const pendingActionPrompt = (() => {
    if (isActivated) return null;
    if (minAds > 0 && adsDone < minAds) {
      return `Watch ${minAds} Ads to Activate Refer`;
    }
    if (minChannels > 0 && channelsDone < minChannels) {
      return `Join ${minChannels} Channels to Activate Refer`;
    }
    if (minTasks > 0 && tasksDone < minTasks) {
      return `Complete ${minTasks} Tasks to Activate Refer`;
    }
    return 'Complete activation rules to activate refer';
  })();

  const progressText =
    minTasks > 0
      ? `Ads: ${adsDone}/${minAds}, Channels: ${channelsDone}/${minChannels}, Tasks: ${tasksDone}/${minTasks}`
      : `Ads: ${adsDone}/${minAds}, Channels: ${channelsDone}/${minChannels}`;

  const handleCopy = () => {
    onCopyInviteLink();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const filteredList = state.referralsList.filter((item) => {
    if (filter === 'active') return item.status === 'ACTIVE';
    if (filter === 'pending') return item.status === 'PENDING';
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Top 2 3D Cards: Total Referrals & Referral Earnings */}
      <section className="grid grid-cols-2 gap-3.5">
        <div className="mf-card-3d p-4">
          <div className="flex items-center gap-2">
            <span className="mf-icon-circle flex h-9 w-9 items-center justify-center">
              <Users className="h-4 w-4" />
            </span>
            <p className="text-xs font-semibold text-slate-500">Total Referrals</p>
          </div>
          <p className="mt-2 font-display text-2xl font-extrabold text-[#111827] tabular-nums">
            {state.totalReferrals}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-400">
            {config.maxReferPerUser > 0
              ? `Limit: ${state.totalReferrals}/${config.maxReferPerUser}`
              : 'Unlimited Invites'}
          </p>
        </div>

        <div className="mf-card-3d p-4">
          <div className="flex items-center gap-2">
            <span className="mf-icon-circle flex h-9 w-9 items-center justify-center">
              <UserPlus className="h-4 w-4" />
            </span>
            <p className="text-xs font-semibold text-slate-500">Referral Earnings</p>
          </div>
          <p className="mt-2 font-display text-2xl font-extrabold text-[#111827] tabular-nums">
            {state.referBalance.toFixed(2)}{' '}
            <span className="text-sm font-bold text-[#00944A]">USDT</span>
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-400">
            +{config.referBonusAmount.toFixed(2)} USDT / Bonus
          </p>
        </div>
      </section>

      {/* Active / Pending Filter Tabs */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`min-h-[42px] px-3 py-2 text-xs font-extrabold ${
            filter === 'all' ? 'mf-btn-green-3d' : 'mf-btn-3d text-[#111827]'
          }`}
        >
          All ({state.totalReferrals})
        </button>
        <button
          type="button"
          onClick={() => setFilter('active')}
          className={`min-h-[42px] px-3 py-2 text-xs font-extrabold ${
            filter === 'active' ? 'mf-btn-green-3d' : 'mf-btn-3d text-[#111827]'
          }`}
        >
          Active: {state.activeReferrals}
        </button>
        <button
          type="button"
          onClick={() => setFilter('pending')}
          className={`min-h-[42px] px-3 py-2 text-xs font-extrabold ${
            filter === 'pending' ? 'mf-btn-green-3d' : 'mf-btn-3d text-[#111827]'
          }`}
        >
          Pending: {state.pendingReferrals}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        {/* Invite Link Box */}
        <section className="mf-card-3d space-y-3.5 p-5">
          <div>
            <h2 className="font-display text-base font-extrabold text-[#111827]">
              Your Invite Link
            </h2>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              Share your link to earn +{config.referBonusAmount.toFixed(2)} USDT per referral (
              {config.referBonusType === 'instant'
                ? 'Instant Bonus'
                : 'After Activation Rule Complete'}
              ).
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-[#F6F8FA] px-3.5 py-3">
            <p className="truncate font-mono text-xs font-semibold text-[#111827]">{inviteLink}</p>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleCopy}
              className="mf-btn-green-3d flex min-h-[46px] items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold"
            >
              <Copy className="h-4 w-4" />
              <span>{copied ? 'Link Copied!' : 'Copy My Link'}</span>
            </button>

            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (openExternalTelegramLink(shareUrl)) {
                  e.preventDefault();
                }
              }}
              className="mf-btn-outline-3d flex min-h-[46px] items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold"
            >
              <Share2 className="h-4 w-4" />
              <span>Share on Telegram</span>
            </a>
          </div>
        </section>

        {/* Activate Card */}
        <section className="mf-card-3d space-y-3.5 p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-extrabold text-[#111827]">
                Activate Referral Rewards
              </h2>
              <p className="mt-0.5 font-mono text-[11px] font-semibold text-slate-500 tabular-nums">
                {progressText}
              </p>
            </div>
            <span
              className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold shrink-0 ${
                isActivated
                  ? 'bg-emerald-50 text-[#00944A]'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {isActivated ? 'Activated' : 'Action Needed'}
            </span>
          </div>

          {pendingActionPrompt && (
            <div className="rounded-2xl bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-800">
              {pendingActionPrompt}
            </div>
          )}

          <div className="space-y-2.5">
            <a
              href={config.channel1Url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                onJoinChannel('waincomesite');
                if (openExternalTelegramLink(config.channel1Url)) {
                  e.preventDefault();
                }
              }}
              className="flex items-center justify-between rounded-2xl bg-[#F6F8FA] px-3.5 py-2.5 transition-colors hover:bg-emerald-50/60"
            >
              <span className="flex items-center gap-2.5 text-xs font-bold text-[#111827]">
                <ShieldCheck className="h-4 w-4 text-[#00944A]" />
                <span>Join {channel1Handle}</span>
              </span>
              {state.joinedWaincomesite ? (
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#00944A]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Completed</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-600">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Join Now</span>
                </span>
              )}
            </a>

            <a
              href={config.channel2Url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                onJoinChannel('premiumapps');
                if (openExternalTelegramLink(config.channel2Url)) {
                  e.preventDefault();
                }
              }}
              className="flex items-center justify-between rounded-2xl bg-[#F6F8FA] px-3.5 py-2.5 transition-colors hover:bg-emerald-50/60"
            >
              <span className="flex items-center gap-2.5 text-xs font-bold text-[#111827]">
                <ShieldCheck className="h-4 w-4 text-[#00944A]" />
                <span>Join {channel2Handle}</span>
              </span>
              {state.joinedPremiumApps ? (
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#00944A]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Completed</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-600">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Join Now</span>
                </span>
              )}
            </a>

            {minAds > 0 && (
              <button
                type="button"
                onClick={() => onOpenModal('ad_watch')}
                className="flex w-full items-center justify-between rounded-2xl bg-[#F6F8FA] px-3.5 py-2.5 text-left transition-colors hover:bg-emerald-50/60"
              >
                <span className="flex items-center gap-2.5 text-xs font-bold text-[#111827]">
                  <Tv className="h-4 w-4 text-[#00944A]" />
                  <span>Watch {minAds} Ads</span>
                </span>
                <span className="font-mono text-xs font-extrabold text-[#00944A] tabular-nums">
                  {Math.min(minAds, adsDone)}/{minAds}
                </span>
              </button>
            )}

            {minTasks > 0 && (
              <div className="flex w-full items-center justify-between rounded-2xl bg-[#F6F8FA] px-3.5 py-2.5 text-left">
                <span className="flex items-center gap-2.5 text-xs font-bold text-[#111827]">
                  <ClipboardList className="h-4 w-4 text-[#00944A]" />
                  <span>Complete {minTasks} Tasks</span>
                </span>
                <span className="font-mono text-xs font-extrabold text-[#00944A] tabular-nums">
                  {Math.min(minTasks, tasksDone)}/{minTasks}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onVerifyActivate}
            className="mf-btn-green-3d flex min-h-[46px] w-full items-center justify-center px-4 py-2.5 text-sm font-extrabold"
          >
            {isActivated ? 'Refer Rewards Active' : 'Verify & Activate'}
          </button>
        </section>
      </div>

      {/* My Referrals List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-[#111827]">
            My Referrals
          </h2>
          <span className="text-xs font-bold text-slate-500 tabular-nums">
            Showing {filteredList.length} recent
          </span>
        </div>

        {filteredList.length === 0 ? (
          <div className="mf-card-3d flex flex-col items-center justify-center p-8 text-center">
            <div className="mf-icon-circle flex h-12 w-12 items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <p className="mt-3 font-display text-sm font-extrabold text-[#111827]">
              No referrals yet
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {state.referralsList.length === 0
                ? 'Share your invite link above to invite friends and earn USDT.'
                : 'No referrals match the selected status filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filteredList.map((ref) => (
              <div
                key={ref.id}
                className="mf-card-3d flex items-center justify-between gap-3 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="mf-icon-circle flex h-11 w-11 shrink-0 items-center justify-center font-display text-xs font-extrabold">
                    {ref.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-extrabold text-[#111827]">
                      {ref.username}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-slate-500 tabular-nums">
                      Joined {ref.channelsJoined}/{Math.max(2, minChannels)} Channels &middot; Ads:{' '}
                      {ref.adsWatched}/{Math.max(1, minAds)}
                    </p>
                  </div>
                </div>

                {ref.status === 'ACTIVE' ? (
                  <span className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 font-mono text-[11px] font-extrabold text-[#00944A] tabular-nums">
                    ACTIVE +{ref.rewardUsdt.toFixed(2)} USDT
                  </span>
                ) : (
                  <span className="shrink-0 rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold text-amber-700">
                    PENDING
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
