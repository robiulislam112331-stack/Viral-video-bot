import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Disc3,
  Headphones,
  Home,
  Lock,
  PlayCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { BonusTaskItem, ModalType, RewardBoxState, RewardTab } from '../../types/rewardBox';
import { openExternalTelegramLink, triggerMonetagAd } from '../../utils/telegram';

interface ModalsProps {
  activeModal: ModalType;
  state: RewardBoxState;
  onClose: () => void;
  onClaimAdSlot: () => void;
  onClaimSpin: (rewardUsdt: number) => void;
  onAddTask: (task: Omit<BonusTaskItem, 'id' | 'completed'>) => void;
  onNavigateTab: (tab: RewardTab, scrollToHistory?: boolean) => void;
  onOpenModal: (modal: ModalType) => void;
  onNotify: (msg: string) => void;
}

const SPIN_REWARDS = [0.005, 0.01, 0.015, 0.02, 0.03, 0.05];

export const Modals: React.FC<ModalsProps> = ({
  activeModal,
  state,
  onClose,
  onClaimAdSlot,
  onClaimSpin,
  onAddTask,
  onNavigateTab,
  onOpenModal,
  onNotify,
}) => {
  const [adSecondsLeft, setAdSecondsLeft] = useState(5);
  const [adStarted, setAdStarted] = useState(false);

  const [spinning, setSpinning] = useState(false);
  const [spinRotation, setSpinRotation] = useState(0);
  const [spinWon, setSpinWon] = useState<number | null>(null);

  const [supportMsg, setSupportMsg] = useState('');
  const [supportSent, setSupportSent] = useState(false);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskReward, setTaskReward] = useState('0.10');
  const [taskUrl, setTaskUrl] = useState('https://t.me/');
  const [taskError, setTaskError] = useState('');

  useEffect(() => {
    if (activeModal === 'ad_watch') {
      setAdSecondsLeft(5);
      setAdStarted(true);
      void triggerMonetagAd();
    } else {
      setAdStarted(false);
    }

    if (activeModal !== 'spin') {
      setSpinning(false);
      setSpinWon(null);
    }
    if (activeModal !== 'customer_service') {
      setSupportSent(false);
      setSupportMsg('');
    }
    if (activeModal !== 'add_task') {
      setTaskError('');
    }
  }, [activeModal]);

  useEffect(() => {
    if (activeModal !== 'ad_watch' || !adStarted || adSecondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setAdSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeModal, adStarted, adSecondsLeft]);

  if (!activeModal) return null;

  const handleSpinWheel = () => {
    if (spinning || state.spinUsedToday) return;
    setSpinning(true);
    const chosenIdx = Math.floor(Math.random() * SPIN_REWARDS.length);
    const prize = SPIN_REWARDS[chosenIdx];
    const segmentAngle = 360 / SPIN_REWARDS.length;
    const extraTurns = 1440 + chosenIdx * segmentAngle;
    setSpinRotation((prev) => prev + extraTurns);

    window.setTimeout(() => {
      setSpinning(false);
      setSpinWon(prize);
      onClaimSpin(prize);
    }, 1800);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = taskTitle.trim();
    const parsedReward = Number.parseFloat(taskReward);
    const cleanUrl = taskUrl.trim();

    if (cleanTitle.length < 3) {
      setTaskError('Task title must be at least 3 characters.');
      return;
    }
    if (!Number.isFinite(parsedReward) || parsedReward <= 0 || parsedReward > 50) {
      setTaskError('Enter a valid USDT reward between 0.01 and 50.00.');
      return;
    }
    if (!/^https?:\/\//i.test(cleanUrl)) {
      setTaskError('Enter a valid link starting with https:// or http://.');
      return;
    }

    onAddTask({
      title: cleanTitle,
      badge: 'Community',
      rewardUsdt: parsedReward,
      url: cleanUrl,
    });
    setTaskTitle('');
    setTaskReward('0.10');
    setTaskUrl('https://t.me/');
    onClose();
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMsg.trim()) return;
    setSupportSent(true);
    setSupportMsg('');
    onNotify('Support ticket received. Team replies within 2 hours.');
  };

  const slots = Array.from({ length: state.dailyAdsTotal }, (_, idx) => idx + 1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="mf-card-3d relative max-h-[88vh] w-full max-w-md overflow-y-auto p-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="mf-btn-3d absolute right-4 top-4 flex h-9 w-9 items-center justify-center !rounded-full text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 1. AD WATCH MODAL */}
        {activeModal === 'ad_watch' && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-3 pr-10">
              <span className="mf-icon-circle flex h-11 w-11 shrink-0 items-center justify-center">
                <PlayCircle className="h-6 w-6" />
              </span>
              <div>
                <h3 className="font-display text-lg font-extrabold text-[#111827]">
                  Premium Ad Slot #{state.nextSlotNumber}
                </h3>
                <p className="text-xs font-medium text-slate-500">
                  Reward: +0.0010 USDT BEP20
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-[#F6F8FA] p-5 text-center">
              {adSecondsLeft > 0 ? (
                <>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Verifying Sponsored Ad
                  </p>
                  <p className="mt-2 font-display text-4xl font-extrabold text-[#00944A] tabular-nums">
                    {adSecondsLeft}s
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Keep this window open until verification finishes.
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="mx-auto h-10 w-10 text-[#00944A]" />
                  <p className="mt-2 font-display text-base font-extrabold text-[#111827]">
                    Ad Verification Complete!
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Tap below to credit +0.0010 USDT to your balance.
                  </p>
                </>
              )}
            </div>

            <button
              type="button"
              disabled={adSecondsLeft > 0}
              onClick={() => {
                onClaimAdSlot();
                onClose();
              }}
              className="mf-btn-green-3d flex min-h-[48px] w-full items-center justify-center gap-2 px-4 py-3 text-sm font-extrabold"
            >
              <span>
                {adSecondsLeft > 0
                  ? `Please Wait (${adSecondsLeft}s)`
                  : 'Claim +0.0010 USDT'}
              </span>
            </button>
          </div>
        )}

        {/* 2. 100 SLOTS MODAL */}
        {activeModal === 'slots_list' && (
          <div className="space-y-4 pt-1">
            <div className="pr-10">
              <h3 className="font-display text-lg font-extrabold text-[#111827]">
                100 Daily Ad Slots
              </h3>
              <p className="text-xs font-medium text-slate-500">
                Completed {state.dailyAdsCompleted}/{state.dailyAdsTotal} &middot; Ceiling $
                {state.dailyCeilingUsdt.toFixed(4)} USDT
              </p>
            </div>

            <div className="grid max-h-[340px] grid-cols-4 gap-2 overflow-y-auto pr-1">
              {slots.map((slotNum) => {
                const isDone = slotNum <= state.dailyAdsCompleted;
                const isNext = slotNum === state.nextSlotNumber;
                return (
                  <button
                    key={slotNum}
                    type="button"
                    disabled={!isNext}
                    onClick={() => {
                      if (isNext) onOpenModal('ad_watch');
                    }}
                    className={`flex flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-center transition-all ${
                      isNext
                        ? 'mf-btn-green-3d'
                        : isDone
                          ? 'bg-emerald-50 text-[#00944A] border border-emerald-200'
                          : 'bg-[#F6F8FA] text-slate-400 border border-slate-200/80'
                    }`}
                  >
                    <span className="text-[11px] font-extrabold tabular-nums">
                      #{slotNum}
                    </span>
                    <span className="mt-0.5 flex items-center gap-0.5 text-[9px] font-bold">
                      {isDone ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Done</span>
                        </>
                      ) : isNext ? (
                        <span>Start</span>
                      ) : (
                        <>
                          <Lock className="h-2.5 w-2.5" />
                          <span>Wait</span>
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. LUCKY SPIN MODAL */}
        {activeModal === 'spin' && (
          <div className="space-y-4 pt-1 text-center">
            <div className="pr-8 text-left">
              <h3 className="font-display text-lg font-extrabold text-[#111827]">
                Daily USDT Spin
              </h3>
              <p className="text-xs font-medium text-slate-500">
                Spin once every 24h for instant USDT BEP20 bonuses.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center py-3">
              <div
                style={{ transform: `rotate(${spinRotation}deg)` }}
                className="mf-card-3d flex h-36 w-36 items-center justify-center !rounded-full border-4 border-[#00944A] transition-transform duration-[1800ms] ease-out"
              >
                <div className="mf-icon-circle flex h-24 w-24 flex-col items-center justify-center">
                  <Disc3 className="h-8 w-8 text-[#00944A]" />
                  <span className="mt-1 font-mono text-[10px] font-extrabold text-[#111827]">
                    USDT
                  </span>
                </div>
              </div>

              {spinWon !== null && (
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-emerald-50 px-4 py-2 font-mono text-sm font-extrabold text-[#00944A]">
                  <Sparkles className="h-4 w-4" />
                  <span>You won +{spinWon.toFixed(4)} USDT!</span>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={spinning || state.spinUsedToday}
              onClick={handleSpinWheel}
              className="mf-btn-green-3d flex min-h-[48px] w-full items-center justify-center px-4 py-3 text-sm font-extrabold"
            >
              {state.spinUsedToday
                ? 'Daily Spin Claimed'
                : spinning
                  ? 'Spinning...'
                  : 'Spin & Win USDT'}
            </button>
          </div>
        )}

        {/* 4. CUSTOMER SERVICE MODAL */}
        {activeModal === 'customer_service' && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-3 pr-10">
              <span className="mf-icon-circle flex h-11 w-11 shrink-0 items-center justify-center">
                <Headphones className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-extrabold text-[#111827]">
                  Customer Service
                </h3>
                <p className="text-xs font-medium text-slate-500">
                  24/7 Telegram Help Desk &amp; Payout Support
                </p>
              </div>
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
              className="mf-btn-outline-3d flex min-h-[46px] w-full items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold"
            >
              <Send className="h-4 w-4" />
              <span>Open Official Telegram Support</span>
            </a>

            <form onSubmit={handleSupportSubmit} className="space-y-3 border-t border-slate-200 pt-3">
              <label
                htmlFor="support-message"
                className="block text-xs font-bold text-slate-600"
              >
                Send a Quick Message
              </label>
              <textarea
                id="support-message"
                rows={3}
                placeholder="Describe your question or withdrawal ID..."
                value={supportMsg}
                onChange={(e) => {
                  setSupportMsg(e.target.value);
                  setSupportSent(false);
                }}
                className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3 text-xs font-medium text-[#111827] outline-none focus:border-[#00944A]"
              />
              {supportSent && (
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-[#00944A]">
                  Message sent! Our support team will reply shortly.
                </p>
              )}
              <button
                type="submit"
                className="mf-btn-green-3d flex min-h-[44px] w-full items-center justify-center px-4 py-2.5 text-xs font-extrabold"
              >
                Submit Support Ticket
              </button>
            </form>
          </div>
        )}

        {/* 5. HOW TO USE MODAL */}
        {activeModal === 'how_to_use' && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-3 pr-10">
              <span className="mf-icon-circle flex h-11 w-11 shrink-0 items-center justify-center">
                <BookOpen className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-extrabold text-[#111827]">
                  How to Use Bot?
                </h3>
                <p className="text-xs font-medium text-slate-500">
                  Earn USDT BEP20 in 4 simple steps
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  step: '01',
                  title: 'Watch Daily Ad Slots',
                  desc: 'Complete up to 100 sponsored video ad slots daily to earn +0.0010 USDT per slot.',
                },
                {
                  step: '02',
                  title: 'Finish Bonus Tasks',
                  desc: 'Open the Task Center and verify daily partner tasks for +0.20 USDT rewards.',
                },
                {
                  step: '03',
                  title: 'Invite Friends via Refer',
                  desc: 'Share your personal referral link to earn +0.02 USDT per active friend and milestone bonuses.',
                },
                {
                  step: '04',
                  title: 'Withdraw to BEP20 (BSC)',
                  desc: 'Once your balance reaches 0.80 USDT and rules are met, submit your BEP20 wallet address.',
                },
              ].map((row) => (
                <div
                  key={row.step}
                  className="flex items-start gap-3 rounded-2xl bg-[#F6F8FA] p-3.5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#00944A] font-mono text-xs font-extrabold text-white">
                    {row.step}
                  </span>
                  <div>
                    <p className="text-xs font-extrabold text-[#111827]">{row.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                      {row.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. ADD TASK MODAL */}
        {activeModal === 'add_task' && (
          <div className="space-y-4 pt-1">
            <div className="pr-10">
              <h3 className="font-display text-lg font-extrabold text-[#111827]">
                Add Your Task
              </h3>
              <p className="text-xs font-medium text-slate-500">
                Publish a new task to the Reward Box Task Center.
              </p>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">
                  Task Title
                </label>
                <input
                  type="text"
                  placeholder="e.g., Join Partner Channel"
                  value={taskTitle}
                  onChange={(e) => {
                    setTaskTitle(e.target.value);
                    setTaskError('');
                  }}
                  className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-3.5 text-xs font-semibold text-[#111827] outline-none focus:border-[#00944A]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">
                  Reward (USDT)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={taskReward}
                  onChange={(e) => {
                    setTaskReward(e.target.value);
                    setTaskError('');
                  }}
                  className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-3.5 font-mono text-xs font-bold text-[#111827] outline-none focus:border-[#00944A]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">
                  Target URL
                </label>
                <input
                  type="url"
                  placeholder="https://t.me/yourchannel"
                  value={taskUrl}
                  onChange={(e) => {
                    setTaskUrl(e.target.value);
                    setTaskError('');
                  }}
                  className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-3.5 font-mono text-xs font-semibold text-[#111827] outline-none focus:border-[#00944A]"
                />
              </div>

              {taskError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                  {taskError}
                </p>
              )}

              <button
                type="submit"
                className="mf-btn-green-3d flex min-h-[46px] w-full items-center justify-center px-4 py-2.5 text-sm font-extrabold"
              >
                Publish Task
              </button>
            </form>
          </div>
        )}

        {/* 7. MENU MODAL */}
        {activeModal === 'menu' && (
          <div className="space-y-4 pt-1">
            <div className="pr-10">
              <h3 className="font-display text-lg font-extrabold text-[#111827]">
                Reward Box Menu
              </h3>
              <p className="text-xs font-medium text-slate-500">
                USDT BEP20 &middot; 1 USDT = $1.00 USD
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Home', icon: <Home className="h-4 w-4" />, action: () => onNavigateTab('home') },
                { label: 'Task Center', icon: <ClipboardList className="h-4 w-4" />, action: () => onNavigateTab('tasks') },
                { label: 'Refer & Earn', icon: <Users className="h-4 w-4" />, action: () => onNavigateTab('refer') },
                { label: 'Withdraw', icon: <Wallet className="h-4 w-4" />, action: () => onNavigateTab('withdraw') },
                { label: 'Daily Spin', icon: <Disc3 className="h-4 w-4" />, action: () => onOpenModal('spin') },
                { label: 'How to Use', icon: <BookOpen className="h-4 w-4" />, action: () => onOpenModal('how_to_use') },
              ].map((entry) => (
                <button
                  key={entry.label}
                  type="button"
                  onClick={() => {
                    onClose();
                    entry.action();
                  }}
                  className="mf-btn-3d flex min-h-[54px] items-center gap-2.5 px-3.5 py-2.5 text-left"
                >
                  <span className="mf-icon-circle flex h-8 w-8 shrink-0 items-center justify-center">
                    {entry.icon}
                  </span>
                  <span className="text-xs font-extrabold text-[#111827]">{entry.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onOpenModal('customer_service')}
              className="mf-btn-green-3d flex min-h-[46px] w-full items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Contact Customer Service</span>
            </button>
          </div>
        )}

        {/* 8. BALANCE INFO MODAL */}
        {activeModal === 'balance_info' && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-3 pr-10">
              <span className="mf-icon-circle flex h-11 w-11 shrink-0 items-center justify-center">
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-extrabold text-[#111827]">
                  USDT BEP20 Wallet
                </h3>
                <p className="text-xs font-medium text-slate-500">1 USDT = $1.00 USD</p>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl bg-[#F6F8FA] p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Total Balance</span>
                <span className="font-mono font-extrabold text-[#111827] tabular-nums">
                  {state.totalBalance.toFixed(2)} USDT
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Refer Balance</span>
                <span className="font-mono font-extrabold text-[#111827] tabular-nums">
                  {state.referBalance.toFixed(2)} USDT
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Total Income</span>
                <span className="font-mono font-extrabold text-[#00944A] tabular-nums">
                  {state.totalIncome.toFixed(2)} USDT
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Total Withdraw</span>
                <span className="font-mono font-extrabold text-[#111827] tabular-nums">
                  {state.totalWithdraw.toFixed(2)} USDT
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateTab('withdraw');
              }}
              className="mf-btn-green-3d flex min-h-[46px] w-full items-center justify-center px-4 py-2.5 text-sm font-extrabold"
            >
              Withdraw USDT (BEP20)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
