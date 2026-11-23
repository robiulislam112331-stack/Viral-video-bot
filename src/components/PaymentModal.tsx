import React, { useState } from 'react';
import { Check, Copy, Lock, X, Loader2, Clock, AlertCircle } from 'lucide-react';
import type { AppSettings, PaymentMethod, PaymentRequest, VideoItem } from '../types';

interface PaymentModalProps {
  video: VideoItem;
  settings: AppSettings;
  existingPending?: PaymentRequest;
  existingRejected?: PaymentRequest;
  onSubmitPayment: (payload: {
    videoId: string;
    method: PaymentMethod;
    trxId: string;
    userName: string;
    senderNote: string;
  }) => Promise<PaymentRequest>;
  onClose: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  video,
  settings,
  existingPending,
  existingRejected,
  onSubmitPayment,
  onClose,
}) => {
  const [method, setMethod] = useState<PaymentMethod>('bKash');
  const [userName, setUserName] = useState('');
  const [trxId, setTrxId] = useState('');
  const [senderNote, setSenderNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedPayment, setSubmittedPayment] = useState<PaymentRequest | null>(
    existingPending || null
  );

  const activeNumber = method === 'bKash' ? settings.bkashNumber : settings.nagadNumber;
  const videoPrice = video.downloadPriceTk;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const payment = await onSubmitPayment({
        videoId: video.id,
        method,
        trxId: trxId.trim(),
        userName: userName.trim(),
        senderNote: senderNote.trim(),
      });
      setSubmittedPayment(payment);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#12141A] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#E5A93C]">
              <Lock className="h-3.5 w-3.5" />
              <span>Locked Download</span>
            </div>
            <h2 id="payment-modal-title" className="mt-1 font-display text-lg font-bold text-[#F3F4F6]">
              Pay {videoPrice} TK via bKash / Nagad
            </h2>
            <p className="mt-0.5 text-xs text-[#9CA3AF] line-clamp-1">
              Video: {video.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment modal"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] text-[#9CA3AF] hover:border-white/20 hover:text-[#F3F4F6] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {submittedPayment ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-[#E5A93C]/30 bg-[#E5A93C]/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#E5A93C]">
                <Clock className="h-4 w-4" />
                <span>Payment Submitted for Approval</span>
              </div>
              <p className="mt-2 text-xs text-[#D1D5DB] leading-relaxed">
                Your {submittedPayment.method} transaction{' '}
                <span className="font-mono font-semibold text-[#F3F4F6]">
                  {submittedPayment.trxId}
                </span>{' '}
                for{' '}
                <span className="font-mono font-semibold text-[#F3F4F6] tabular-nums">
                  {submittedPayment.amountTk} TK
                </span>{' '}
                is waiting for Admin approval. Once approved, download unlocks for this video only.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] w-full rounded-xl bg-[#E5A93C] px-4 py-2.5 text-xs font-semibold text-[#0A0B0E] hover:bg-[#F0B94F] transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {existingRejected && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>
                  Previous TrxID <span className="font-mono">{existingRejected.trxId}</span> was rejected. Please send{' '}
                  {videoPrice} TK and enter a valid TrxID.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#0A0B0E] p-1 border border-white/[0.06]">
              {(['bKash', 'Nagad'] as PaymentMethod[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMethod(item)}
                  className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                    method === item
                      ? 'bg-[#E5A93C] text-[#0A0B0E]'
                      : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0A0B0E] p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-[#9CA3AF]">Send Money ({method} Personal)</p>
                  <p className="mt-1 font-mono text-base font-semibold text-[#F3F4F6] tabular-nums">
                    {activeNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#181B23] px-3 py-1.5 text-xs font-medium text-[#F3F4F6] hover:border-[#E5A93C]/50 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2.5 text-xs text-[#9CA3AF]">
                Video Download Price:{' '}
                <span className="font-mono font-semibold text-[#E5A93C] tabular-nums">
                  {videoPrice} TK
                </span>
              </p>
            </div>

            <div>
              <label htmlFor="payer-name" className="block text-xs font-medium text-[#D1D5DB]">
                Your Name or Telegram @username
              </label>
              <input
                id="payer-name"
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. @rafiq_bd"
                className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3.5 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#E5A93C] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="trx-id" className="block text-xs font-medium text-[#D1D5DB]">
                Transaction ID (TrxID)
              </label>
              <input
                id="trx-id"
                type="text"
                required
                value={trxId}
                onChange={(e) => setTrxId(e.target.value)}
                placeholder="e.g. BKH9A82KLM"
                className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3.5 py-2.5 font-mono text-sm uppercase text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#E5A93C] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="sender-note" className="block text-xs font-medium text-[#D1D5DB]">
                Sender Number / Last 4 Digits (Optional)
              </label>
              <input
                id="sender-note"
                type="text"
                value={senderNote}
                onChange={(e) => setSenderNote(e.target.value)}
                placeholder="e.g. 01711****90"
                className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0A0B0E] px-3.5 py-2.5 font-mono text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#E5A93C] focus:outline-none"
              />
            </div>

            {errorMsg && <p className="text-xs font-medium text-red-400">{errorMsg}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#E5A93C] px-4 py-2.5 text-xs font-semibold text-[#0A0B0E] hover:bg-[#F0B94F] disabled:opacity-60 transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting TrxID...</span>
                </>
              ) : (
                <span>Submit TrxID ({videoPrice} TK)</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
