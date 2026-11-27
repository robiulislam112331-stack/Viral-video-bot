import React, { useState } from 'react';
import { CheckCircle2, Clock, Copy, Share2, ShieldCheck, Tv, UserPlus, Users } from 'lucide-react';
import type { ModalType, RewardBoxState } from '../../types/rewardBox';
import { openExternalTelegramLink } from '../../utils/telegram';

interface ReferViewProps {
  state: RewardBoxState;
  onCopyInviteLink: () => void;
  onJoinChannel: (channel: 'waincomesite' | 'premiumapps') => void;
  onVerifyActivate: () => void;
  onOpenModal: (modal: ModalType) => void;
}

type ReferralFilter = 'all' | 'active' | 'pending';

export const ReferView: React.FC<ReferViewProps> = ({
  state,
  onCopyInviteLink,
  onJoinChannel,
  onVerifyActivate,
  onOpenModal,
}) => {
  const [filter, setFilter] = useState<ReferralFilter>('all');
  const [copied, setCopied] = useState(false);

  const inviteLink = `https://t.me/boxreward_bot?start=ref_${state.userId}`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
    inviteLink
  )}&text=${encodeURIComponent('Join Reward Box & earn daily USDT BEP20 rewards!')}`;

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
          <p className="mt-0.5 text-[11px] font-medium text-slate-400">Network Invites</p>
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
          <p className="mt-0.5 text-[11px] font-medium text-slate-400">+0.10 USDT / Bonus</p>
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
              Share your link to earn +0.02 USDT per verified referral and +0.10 USDT milestone
              rewards.
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
            <h2 className="font-display text-base font-extrabold text-[#111827]">
              Activate Referral Rewards
            </h2>
            <span
              className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold ${
                state.referralActivated
                  ? 'bg-emerald-50 text-[#00944A]'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {state.referralActivated ? 'Activated' : 'Action Needed'}
            </span>
          </div>

          <div className="space-y-2.5">
            <a
              href="https://t.me/waincomesite"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                onJoinChannel('waincomesite');
                if (openExternalTelegramLink('https://t.me/waincomesite')) {
                  e.preventDefault();
                }
              }}
              className="flex items-center justify-between rounded-2xl bg-[#F6F8FA] px-3.5 py-2.5 transition-colors hover:bg-emerald-50/60"
            >
              <span className="flex items-center gap-2.5 text-xs font-bold text-[#111827]">
                <ShieldCheck className="h-4 w-4 text-[#00944A]" />
                <span>Join @waincomesite</span>
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
              href="https://t.me/premiumapps5462"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                onJoinChannel('premiumapps');
                if (openExternalTelegramLink('https://t.me/premiumapps5462')) {
                  e.preventDefault();
                }
              }}
              className="flex items-center justify-between rounded-2xl bg-[#F6F8FA] px-3.5 py-2.5 transition-colors hover:bg-emerald-50/60"
            >
              <span className="flex items-center gap-2.5 text-xs font-bold text-[#111827]">
                <ShieldCheck className="h-4 w-4 text-[#00944A]" />
                <span>Join @premiumapps5462</span>
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

            <button
              type="button"
              onClick={() => onOpenModal('ad_watch')}
              className="flex w-full items-center justify-between rounded-2xl bg-[#F6F8FA] px-3.5 py-2.5 text-left transition-colors hover:bg-emerald-50/60"
            >
              <span className="flex items-center gap-2.5 text-xs font-bold text-[#111827]">
                <Tv className="h-4 w-4 text-[#00944A]" />
                <span>Watch 3 Ads</span>
              </span>
              <span className="font-mono text-xs font-extrabold text-[#00944A] tabular-nums">
                {Math.min(3, state.activateAdsDone)}/3
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={onVerifyActivate}
            className="mf-btn-green-3d flex min-h-[46px] w-full items-center justify-center px-4 py-2.5 text-sm font-extrabold"
          >
            Verify &amp; Activate
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
                      Joined {ref.channelsJoined}/2 Channels &middot; Ads: {ref.adsWatched}/3
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
