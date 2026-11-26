import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, ShieldCheck, Wallet, XCircle } from 'lucide-react';
import type { RewardBoxState } from '../../types/rewardBox';
import { openExternalTelegramLink } from '../../utils/telegram';

interface WithdrawViewProps {
  state: RewardBoxState;
  historyRef: React.RefObject<HTMLElement | null>;
  onSubmitWithdraw: (amount: number, address: string) => { ok: boolean; message: string };
}

export const WithdrawView: React.FC<WithdrawViewProps> = ({
  state,
  historyRef,
  onSubmitWithdraw,
}) => {
  const [amountInput, setAmountInput] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  const meetsMinimum = state.totalBalance >= 0.8;
  const meetsReferrals = state.referralsInvited >= 5;

  const handleSetMax = () => {
    setAmountInput(state.totalBalance.toFixed(2));
    setFeedback(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number.parseFloat(amountInput);
    const trimmedAddr = walletAddress.trim();

    if (!Number.isFinite(numericAmount) || numericAmount < 0.8) {
      setFeedback({ type: 'error', text: 'Minimum withdrawal amount is 0.80 USDT.' });
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

    const result = onSubmitWithdraw(numericAmount, trimmedAddr);
    if (result.ok) {
      setAmountInput('');
      setWalletAddress('');
      setFeedback({ type: 'success', text: result.message });
    } else {
      setFeedback({ type: 'error', text: result.message });
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
          <p className="mt-1 text-[11px] font-medium text-slate-400">1 USDT = $1.00 USD</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        {/* RULES Card */}
        <section className="mf-card-3d space-y-3 p-5">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-[#111827]">
            RULES
          </h2>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-2xl bg-[#F6F8FA] px-3.5 py-2.5 text-xs">
              <span className="font-bold text-[#111827]">Minimum 0.80 USDT</span>
              <span
                className={`inline-flex items-center gap-1 font-extrabold ${
                  meetsMinimum ? 'text-[#00944A]' : 'text-amber-600'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{meetsMinimum ? 'Qualified' : 'In Progress'}</span>
              </span>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-[#F6F8FA] px-3.5 py-2.5 text-xs">
              <span className="font-bold text-[#111827]">5 Valid Referrals</span>
              <span
                className={`inline-flex items-center gap-1 font-extrabold tabular-nums ${
                  meetsReferrals ? 'text-[#00944A]' : 'text-amber-600'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Completed ({state.referralsInvited}/5)</span>
              </span>
            </div>

            <a
              href="https://t.me/waincomesite"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (openExternalTelegramLink('https://t.me/waincomesite')) {
                  e.preventDefault();
                }
              }}
              className="flex items-center justify-between rounded-2xl bg-[#F6F8FA] px-3.5 py-2.5 text-xs transition-colors hover:bg-emerald-50/60"
            >
              <span className="flex items-center gap-2 font-bold text-[#111827]">
                <ShieldCheck className="h-4 w-4 text-[#00944A]" />
                <span>@waincomesite</span>
              </span>
              <span className="font-extrabold text-[#00944A]">
                {state.joinedWaincomesite ? 'Joined' : 'Join Now'}
              </span>
            </a>

            <a
              href="https://t.me/premiumapps5462"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (openExternalTelegramLink('https://t.me/premiumapps5462')) {
                  e.preventDefault();
                }
              }}
              className="flex items-center justify-between rounded-2xl bg-[#F6F8FA] px-3.5 py-2.5 text-xs transition-colors hover:bg-emerald-50/60"
            >
              <span className="flex items-center gap-2 font-bold text-[#111827]">
                <ShieldCheck className="h-4 w-4 text-[#00944A]" />
                <span>@premiumapps5462</span>
              </span>
              <span className="font-extrabold text-[#00944A]">
                {state.joinedPremiumApps ? 'Joined' : 'Join Now'}
              </span>
            </a>
          </div>
        </section>

        {/* Request Card */}
        <section className="mf-card-3d p-5">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-[#111827]">
            Request
          </h2>

          <form onSubmit={handleSubmit} className="mt-3.5 space-y-3.5">
            <div>
              <label
                htmlFor="withdraw-amount"
                className="mb-1.5 block text-xs font-bold text-slate-600"
              >
                Amount (USDT)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="withdraw-amount"
                  type="number"
                  step="0.01"
                  min="0.80"
                  placeholder="0.80"
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
              className="mf-btn-green-3d flex min-h-[48px] w-full items-center justify-center px-4 py-3 text-sm font-extrabold"
            >
              Submit Request (0.80 USDT min)
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
                  </p>
                </div>
              </div>

              {item.status === 'Completed' ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-[#00944A]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Completed</span>
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
      </section>
    </div>
  );
};
