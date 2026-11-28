import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  ShieldCheck,
  Unlock,
  Wallet,
  XCircle,
} from 'lucide-react';
import { deriveTelegramHandle } from '../../data/defaultEarnMoneyState';
import type { EarnMoneyConfig, EarnMoneyState } from '../../types/earnMoney';
import { openExternalTelegramLink } from '../../utils/telegram';

interface WithdrawViewProps {
  state: EarnMoneyState;
  config: EarnMoneyConfig;
  historyRef: React.RefObject<HTMLElement | null>;
  onJoinChannel: (channel: 'waincomesite' | 'premiumapps') => void;
  onSubmitWithdraw: (amount: number, address: string) => Promise<{ ok: boolean; message: string }>;
}

export const WithdrawView: React.FC<WithdrawViewProps> = ({
  state,
  config,
  historyRef,
  onJoinChannel,
  onSubmitWithdraw,
}) => {
  const [amountInput, setAmountInput] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  // Read all withdraw settings LIVE from Admin Panel Database config
  const requiredAds = Math.max(0, Math.floor(Number(config.withdrawRequiredAds ?? 0)));
  const minWithdraw = Math.max(0, Number(config.minWithdrawAmount ?? 0));
  const maxWithdraw = Math.max(0, Number(config.maxWithdrawAmount ?? 0));
  const feePercent = Math.min(100, Math.max(0, Number(config.withdrawFeePercent ?? 0)));

  const adsWatchedToday = Math.max(0, Number(state.dailyAdsCompleted || 0));
  const isLocked = requiredAds > 0 && adsWatchedToday < requiredAds;
  const adsProgressPct =
    requiredAds > 0 ? Math.min(100, Math.round((adsWatchedToday / requiredAds) * 100)) : 100;

  const channel1Handle = deriveTelegramHandle(config.channel1Url, '@Channel1');
  const channel2Handle = deriveTelegramHandle(config.channel2Url, '@Channel2');
  const meetsMinimum = state.totalBalance >= minWithdraw;

  const parsedPreviewAmount = Number.parseFloat(amountInput);
  const hasValidPreview = Number.isFinite(parsedPreviewAmount) && parsedPreviewAmount > 0;
  const previewFeeUsdt = hasValidPreview ? (parsedPreviewAmount * feePercent) / 100 : 0;
  const previewNetUsdt = hasValidPreview ? Math.max(0, parsedPreviewAmount - previewFeeUsdt) : 0;

  const handleSetMax = () => {
    const capped =
      maxWithdraw > 0 ? Math.min(state.totalBalance, maxWithdraw) : state.totalBalance;
    setAmountInput(capped.toFixed(2));
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      setFeedback({
        type: 'error',
        text: `Withdraw is LOCKED. Progress: ${adsWatchedToday} / ${requiredAds} Ads Watched.`,
      });
      return;
    }

    const numericAmount = Number.parseFloat(amountInput);
    const trimmedAddr = walletAddress.trim();

    if (!Number.isFinite(numericAmount) || numericAmount < minWithdraw) {
      setFeedback({
        type: 'error',
        text: `Minimum Withdraw is $${minWithdraw.toFixed(2)} USDT`,
      });
      return;
    }

    if (maxWithdraw > 0 && numericAmount > maxWithdraw) {
      setFeedback({
        type: 'error',
        text: `Maximum Withdraw is $${maxWithdraw.toFixed(2)} USDT`,
      });
      return;
    }

    if (numericAmount > state.totalBalance) {
      setFeedback({ type: 'error', text: 'Requested amount exceeds your available balance.' });
      return;
    }

    if (!/^0x[a-fA-F0-9]{10,42}$/.test(trimmedAddr)) {
      setFeedback({
        type: 'error',
        text: 'Enter a valid BEP20 (BSC) wallet address starting with 0x.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubmitWithdraw(numericAmount, trimmedAddr);
      if (result.ok) {
        setAmountInput('');
        setWalletAddress('');
        setFeedback({ type: 'success', text: result.message });
      } else {
        setFeedback({ type: 'error', text: result.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Available Header */}
      <section className="mf-card-3d flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="mf-icon-circle flex h-12 w-12 shrink-0 items-center justify-center">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Available</p>
            <p className="font-display text-2xl font-extrabold text-[#111827] tabular-nums">
              {state.totalBalance.toFixed(2)}{' '}
              <span className="text-sm font-bold text-[#00944A]">USDT</span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-block rounded-xl bg-emerald-50 px-3 py-1.5 font-mono text-xs font-extrabold text-[#00944A]">
            BEP20 (BSC)
          </span>
          <p className="mt-1 text-[11px] font-medium text-slate-400">
            Fee: {feePercent.toFixed(feePercent % 1 === 0 ? 0 : 2)}% &middot; Min $
            {minWithdraw.toFixed(2)}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        {/* RULES Card */}
        <section className="mf-card-3d space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-[#111827]">
              RULES
            </h2>
            <span
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-extrabold ${
                isLocked ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-[#00944A]'
              }`}
            >
              {isLocked ? (
                <>
                  <Lock className="h-3 w-3" />
                  <span>LOCKED</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3 w-3" />
                  <span>UNLOCKED</span>
                </>
              )}
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Ads Unlock Rule */}
            <div className="rounded-2xl bg-[#F6F8FA] px-3.5 py-3 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#111827]">
                  {requiredAds > 0
                    ? `Required Ads (${requiredAds} Today)`
                    : 'Daily Ads Requirement'}
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-extrabold tabular-nums ${
                    isLocked ? 'text-amber-600' : 'text-[#00944A]'
                  }`}
                >
                  {isLocked ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {requiredAds > 0
                      ? `${adsWatchedToday} / ${requiredAds} Ads Watched`
                      : 'Unlocked'}
                  </span>
                </span>
              </div>
              {requiredAds > 0 && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isLocked ? 'bg-amber-500' : 'bg-[#00944A]'
                    }`}
                    style={{ width: `${adsProgressPct}%` }}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-[#F6F8FA] px-3.5 py-2.5 text-xs">
              <span className="font-bold text-[#111827]">
                Minimum ${minWithdraw.toFixed(2)} USDT
              </span>
              <span
                className={`inline-flex items-center gap-1 font-extrabold ${
                  meetsMinimum ? 'text-[#00944A]' : 'text-amber-600'
                }`}
              >
                {meetsMinimum ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Clock className="h-3.5 w-3.5" />
                )}
                <span>{meetsMinimum ? 'Qualified' : 'Pending'}</span>
              </span>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-[#F6F8FA] px-3.5 py-2.5 text-xs">
              <span className="font-bold text-[#111827]">Maximum Limit</span>
              <span className="font-extrabold text-[#111827] tabular-nums">
                {maxWithdraw > 0 ? `$${maxWithdraw.toFixed(2)} USDT` : 'Unlimited'}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-[#F6F8FA] px-3.5 py-2.5 text-xs">
              <span className="font-bold text-[#111827]">Withdraw Fee</span>
              <span className="font-extrabold text-[#00944A] tabular-nums">
                {feePercent > 0 ? `${feePercent}%` : '0% (Free)'}
              </span>
            </div>

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
              className="flex items-center justify-between rounded-2xl bg-[#F6F8FA] px-3.5 py-2.5 text-xs transition-colors hover:bg-emerald-50/60"
            >
              <span className="flex items-center gap-2 font-bold text-[#111827]">
                <ShieldCheck className="h-4 w-4 text-[#00944A]" />
                <span>{channel1Handle}</span>
              </span>
              <span
                className={`font-extrabold ${
                  state.joinedWaincomesite ? 'text-[#00944A]' : 'text-amber-600'
                }`}
              >
                {state.joinedWaincomesite ? 'Joined' : 'Join Now'}
              </span>
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
              className="flex items-center justify-between rounded-2xl bg-[#F6F8FA] px-3.5 py-2.5 text-xs transition-colors hover:bg-emerald-50/60"
            >
              <span className="flex items-center gap-2 font-bold text-[#111827]">
                <ShieldCheck className="h-4 w-4 text-[#00944A]" />
                <span>{channel2Handle}</span>
              </span>
              <span
                className={`font-extrabold ${
                  state.joinedPremiumApps ? 'text-[#00944A]' : 'text-amber-600'
                }`}
              >
                {state.joinedPremiumApps ? 'Joined' : 'Join Now'}
              </span>
            </a>
          </div>
        </section>

        {/* Request Card */}
        <section className="mf-card-3d p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-[#111827]">
              Request
            </h2>
            {isLocked && (
              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-600">
                <Lock className="h-3.5 w-3.5" />
                <span>LOCKED</span>
              </span>
            )}
          </div>

          {isLocked && (
            <div className="mt-3.5 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-amber-800">
                <span className="flex items-center gap-1.5">
                  <Lock className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>LOCKED — Watch Ads to Unlock</span>
                </span>
                <span className="tabular-nums">
                  {adsWatchedToday} / {requiredAds} Ads Watched
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-amber-200/70">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${adsProgressPct}%` }}
                />
              </div>
            </div>
          )}

          <form noValidate onSubmit={(e) => void handleSubmit(e)} className="mt-3.5 space-y-3.5">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="withdraw-amount"
                  className="block text-xs font-bold text-slate-600"
                >
                  Amount (USDT)
                </label>
                <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                  Min ${minWithdraw.toFixed(2)}
                  {maxWithdraw > 0 ? ` · Max $${maxWithdraw.toFixed(2)}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="withdraw-amount"
                  type="number"
                  step="0.01"
                  placeholder={minWithdraw.toFixed(2)}
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    setFeedback(null);
                  }}
                  className="min-h-[46px] w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-3.5 font-mono text-sm font-bold text-[#111827] outline-none focus:border-[#00944A]"
                />
                <button
                  type="button"
                  onClick={handleSetMax}
                  className="mf-btn-3d min-h-[46px] shrink-0 px-4 text-xs font-extrabold text-[#00944A]"
                >
                  MAX
                </button>
              </div>
              {hasValidPreview && (
                <p className="mt-1.5 text-[11px] font-semibold text-slate-500 tabular-nums">
                  Fee ({feePercent}%): -{previewFeeUsdt.toFixed(4)} USDT &middot; Net Receive:{' '}
                  <span className="font-bold text-[#00944A]">
                    {previewNetUsdt.toFixed(4)} USDT
                  </span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="bep20-address"
                className="mb-1.5 block text-xs font-bold text-slate-600"
              >
                BEP20 Wallet Address
              </label>
              <input
                id="bep20-address"
                type="text"
                placeholder="0x..."
                value={walletAddress}
                onChange={(e) => {
                  setWalletAddress(e.target.value);
                  setFeedback(null);
                }}
                className="min-h-[46px] w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-3.5 font-mono text-xs font-semibold text-[#111827] outline-none focus:border-[#00944A]"
              />
            </div>

            {feedback && (
              <div
                role="alert"
                className={`flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-semibold ${
                  feedback.type === 'error'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-emerald-50 text-[#00944A]'
                }`}
              >
                {feedback.type === 'error' ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || isLocked}
              className={`flex min-h-[48px] w-full items-center justify-center gap-2 px-4 py-3 text-sm font-extrabold ${
                isLocked
                  ? 'rounded-2xl border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'mf-btn-green-3d'
              }`}
            >
              {isLocked ? (
                <>
                  <Lock className="h-4 w-4" />
                  <span>
                    LOCKED ({adsWatchedToday} / {requiredAds} Ads Watched)
                  </span>
                </>
              ) : submitting ? (
                <span>Submitting...</span>
              ) : (
                <span>Submit Request (${minWithdraw.toFixed(2)} USDT min)</span>
              )}
            </button>
          </form>
        </section>
      </div>

      {/* HISTORY Section */}
      <section ref={historyRef} id="withdraw-history" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-[#111827]">
            HISTORY
          </h2>
          <span className="text-xs font-bold text-slate-500 tabular-nums">
            {state.withdrawHistory.length} Total
          </span>
        </div>

        {state.withdrawHistory.length === 0 ? (
          <div className="mf-card-3d flex flex-col items-center justify-center p-8 text-center">
            <div className="mf-icon-circle flex h-12 w-12 items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
            <p className="mt-3 font-display text-sm font-extrabold text-[#111827]">
              No withdrawals yet
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Your BEP20 withdrawal requests will appear here once submitted.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {state.withdrawHistory.map((item) => (
              <div
                key={item.id}
                className="mf-card-3d flex items-center justify-between gap-3 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="mf-icon-circle flex h-10 w-10 shrink-0 items-center justify-center">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-extrabold text-[#111827] tabular-nums">
                      -{item.amountUsdt.toFixed(2)} USDT
                    </p>
                    <p className="truncate font-mono text-[11px] font-medium text-slate-500">
                      {item.address} &middot; {item.date}
                      {item.feePercent && item.feePercent > 0 && item.netAmountUsdt !== undefined
                        ? ` · Net ${item.netAmountUsdt.toFixed(2)} (${item.feePercent}% fee)`
                        : ''}
                    </p>
                  </div>
                </div>

                {item.status === 'Completed' ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-[#00944A]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Completed</span>
                  </span>
                ) : item.status === 'Pending' ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold text-amber-700">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Pending</span>
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-[11px] font-extrabold text-red-600">
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Rejected</span>
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
