import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Headphones,
  Home,
  Lock,
  PlayCircle,
  Send,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { buildSupportTelegramUrl } from '../../data/defaultEarnMoneyState';
import type {
  BonusTaskItem,
  EarnMoneyConfig,
  EarnMoneyState,
  EarnMoneyTab,
  ModalType,
} from '../../types/earnMoney';
import {
  getMonetagDirectUrl,
  openExternalTelegramLink,
  triggerMonetagAd,
} from '../../utils/telegram';

interface ModalsProps {
  activeModal: ModalType;
  activeSlotId?: number;
  state: EarnMoneyState;
  config: EarnMoneyConfig;
  onClose: () => void;
  onClaimAdSlot: (mode?: 'view' | 'click', slotId?: number) => void;
  onSelectAdSlot?: (slotId: number) => void;
  onAddTask: (task: Omit<BonusTaskItem, 'id' | 'completed'>) => void;
  onNavigateTab: (tab: EarnMoneyTab, scrollToHistory?: boolean) => void;
  onOpenModal: (modal: ModalType) => void;
  onNotify: (msg: string) => void;
}

export const Modals: React.FC<ModalsProps> = ({
  activeModal,
  activeSlotId,
  state,
  config,
  onClose,
  onClaimAdSlot,
  onSelectAdSlot,
  onAddTask,
  onNavigateTab,
  onOpenModal,
  onNotify,
}) => {
  const supportUrl = buildSupportTelegramUrl(config.supportUsername);
  const dailyTotal = Math.max(1, config.dailyAdsLimitPerUser || state.dailyAdsTotal || 20);
  const dailyCeiling = Number((dailyTotal * config.perAdViewReward).toFixed(4));
  const adsSlotEmpty = !config.premiumAdsEnabled || config.premiumAdsBudget <= 0;
  const currentSlotId = Math.min(
    dailyTotal,
    Math.max(1, activeSlotId ?? state.nextSlotNumber ?? state.dailyAdsCompleted + 1)
  );
  const currentSlotClaim = state.adSlotClaims?.[String(currentSlotId)];
  const viewClaimedForSlot = Boolean(currentSlotClaim?.view_reward_claimed);
  const clickClaimedForSlot = Boolean(currentSlotClaim?.click_bonus_claimed);

  const [adSecondsLeft, setAdSecondsLeft] = useState(15);
  const [adStarted, setAdStarted] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [clickBonusVerifying, setClickBonusVerifying] = useState(false);

  const [supportMsg, setSupportMsg] = useState('');
  const [supportSent, setSupportSent] = useState(false);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskReward, setTaskReward] = useState('0.10');
  const [taskUrl, setTaskUrl] = useState('https://t.me/');
  const [taskError, setTaskError] = useState('');

  useEffect(() => {
    if (activeModal === 'ad_watch') {
      setClickBonusVerifying(false);
      if (viewClaimedForSlot) {
        setAdSecondsLeft(0);
        setAdLoading(false);
        setAdStarted(true);
      } else {
        setAdSecondsLeft(15);
        setAdLoading(true);
        setAdStarted(true);
        void triggerMonetagAd(config.monetagLink).finally(() => {
          setAdLoading(false);
        });
      }
    } else {
      setAdStarted(false);
      setAdLoading(false);
      setClickBonusVerifying(false);
    }

    if (activeModal !== 'customer_service') {
      setSupportSent(false);
      setSupportMsg('');
    }
    if (activeModal !== 'add_task') {
      setTaskError('');
    }
  }, [activeModal, currentSlotId]);

  useEffect(() => {
    if (activeModal !== 'ad_watch' || !adStarted || adSecondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setAdSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeModal, adStarted, adSecondsLeft]);

  useEffect(() => {
    if (activeModal !== 'ad_watch' || !clickBonusVerifying || clickClaimedForSlot) return;

    let claimed = false;
    const finalizeClickBonus = () => {
      if (claimed) return;
      claimed = true;
      setClickBonusVerifying(false);
      onClaimAdSlot('click', currentSlotId);
    };

    const handleReturn = () => {
      if (document.visibilityState === 'visible') {
        window.setTimeout(finalizeClickBonus, 400);
      }
    };

    const handleFocus = () => {
      window.setTimeout(finalizeClickBonus, 400);
    };

    document.addEventListener('visibilitychange', handleReturn);
    window.addEventListener('focus', handleFocus);
    const fallbackTimer = window.setTimeout(finalizeClickBonus, 2600);

    return () => {
      document.removeEventListener('visibilitychange', handleReturn);
      window.removeEventListener('focus', handleFocus);
      window.clearTimeout(fallbackTimer);
    };
  }, [activeModal, clickBonusVerifying, clickClaimedForSlot, currentSlotId, onClaimAdSlot]);

  if (!activeModal) return null;

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

  const slots = Array.from({ length: dailyTotal }, (_, idx) => idx + 1);

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
                  Premium Ad Slot #{currentSlotId}
                </h3>
                <p className="text-xs font-medium text-slate-500">
                  View: +{config.perAdViewReward.toFixed(4)} USDT &middot; Click: +
                  {config.perAdClickReward.toFixed(4)} USDT
                </p>
              </div>
            </div>

            {adsSlotEmpty ? (
              <div className="rounded-2xl bg-red-50 p-5 text-center">
                <p className="font-display text-base font-extrabold text-red-700">
                  Premium Ads Slot Empty
                </p>
                <p className="mt-1 text-xs text-red-600">
                  Ads budget is currently empty. Please check back later.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-[#F6F8FA] p-5 text-center">
                  {adSecondsLeft > 0 ? (
                    <>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {adLoading ? 'Loading Ad... Please wait' : 'Verifying Sponsored Ad'}
                      </p>
                      <p className="mt-2 font-display text-4xl font-extrabold text-[#00944A] tabular-nums">
                        {adSecondsLeft}s
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Keep this window open. Closing early cancels your reward.
                      </p>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mx-auto h-10 w-10 text-[#00944A]" />
                      <p className="mt-2 font-display text-base font-extrabold text-[#111827]">
                        Ad Verification Complete!
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Claim view reward (+{config.perAdViewReward.toFixed(4)} USDT) or ad click bonus (+
                        {config.perAdClickReward.toFixed(4)} USDT).
                      </p>
                    </>
                  )}
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    disabled={adSecondsLeft > 0 || viewClaimedForSlot}
                    onClick={() => {
                      onClaimAdSlot('view', currentSlotId);
                      onClose();
                    }}
                    className="mf-btn-green-3d flex min-h-[48px] w-full items-center justify-center gap-2 px-4 py-3 text-sm font-extrabold disabled:opacity-60"
                  >
                    <span>
                      {adSecondsLeft > 0
                        ? `Please watch ad... ${adSecondsLeft}s`
                        : viewClaimedForSlot
                          ? 'View Reward Claimed ✅'
                          : `Claim +${config.perAdViewReward.toFixed(4)} USDT`}
                    </span>
                  </button>

                  {adSecondsLeft <= 0 && config.perAdClickReward > 0 && (() => {
                    const directUrl = getMonetagDirectUrl(config.monetagLink);
                    const startClickBonus = () => {
                      if (clickClaimedForSlot || clickBonusVerifying) return;
                      setClickBonusVerifying(true);
                      if (!directUrl) {
                        void triggerMonetagAd(config.monetagLink);
                      } else {
                        openExternalTelegramLink(directUrl);
                      }
                    };

                    if (clickClaimedForSlot) {
                      return (
                        <button
                          type="button"
                          disabled
                          className="mf-btn-outline-3d flex min-h-[44px] w-full items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold opacity-60"
                        >
                          <span>Click Bonus Claimed ✅</span>
                        </button>
                      );
                    }

                    if (clickBonusVerifying) {
                      return (
                        <button
                          type="button"
                          disabled
                          className="mf-btn-outline-3d flex min-h-[44px] w-full items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold opacity-75"
                        >
                          <span>Verifying Ad Click... Please wait</span>
                        </button>
                      );
                    }

                    if (directUrl) {
                      return (
                        <a
                          href={directUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            if (openExternalTelegramLink(directUrl)) {
                              e.preventDefault();
                            }
                            startClickBonus();
                          }}
                          className="mf-btn-outline-3d flex min-h-[44px] w-full items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold"
                        >
                          <span>Ad Click Bonus (+{config.perAdClickReward.toFixed(4)} USDT)</span>
                        </a>
                      );
                    }

                    return (
                      <button
                        type="button"
                        onClick={startClickBonus}
                        className="mf-btn-outline-3d flex min-h-[44px] w-full items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold"
                      >
                        <span>Ad Click Bonus (+{config.perAdClickReward.toFixed(4)} USDT)</span>
                      </button>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        )}

        {/* 2. DAILY SLOTS MODAL */}
        {activeModal === 'slots_list' && (
          <div className="space-y-4 pt-1">
            <div className="pr-10">
              <h3 className="font-display text-lg font-extrabold text-[#111827]">
                {dailyTotal} Daily Ad Slots
              </h3>
              <p className="text-xs font-medium text-slate-500">
                Completed {state.dailyAdsCompleted}/{dailyTotal} &middot; Ceiling $
                {dailyCeiling.toFixed(4)} USDT &middot; Slot Price $
                {config.adsSlotPriceForAdvertiser.toFixed(2)} USDT
              </p>
            </div>

            <div className="grid max-h-[340px] grid-cols-4 gap-2 overflow-y-auto pr-1">
              {slots.map((slotNum) => {
                const slotClaim = state.adSlotClaims?.[String(slotNum)];
                const isDone = Boolean(slotClaim?.view_reward_claimed) || slotNum <= state.dailyAdsCompleted;
                const isNext = !isDone && slotNum === state.nextSlotNumber;
                const canOpenClickBonus = isDone && !slotClaim?.click_bonus_claimed && config.perAdClickReward > 0;
                const clickable = !adsSlotEmpty && (isNext || canOpenClickBonus);

                return (
                  <button
                    key={slotNum}
                    type="button"
                    disabled={!clickable}
                    onClick={() => {
                      if (!clickable) return;
                      if (onSelectAdSlot) {
                        onSelectAdSlot(slotNum);
                      } else {
                        onOpenModal('ad_watch');
                      }
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

        {/* 3. CUSTOMER SERVICE MODAL */}
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
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (openExternalTelegramLink(supportUrl)) {
                  e.preventDefault();
                }
              }}
              className="mf-btn-outline-3d flex min-h-[46px] w-full items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold"
            >
              <Send className="h-4 w-4" />
              <span>Open Official Telegram Support ({config.supportUsername})</span>
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
                  desc: `Complete up to ${dailyTotal} sponsored video ad slots daily to earn +${config.perAdViewReward.toFixed(4)} USDT per view.`,
                },
                {
                  step: '02',
                  title: 'Finish Bonus Tasks',
                  desc: 'Open the Task Center and verify daily partner tasks for USDT rewards.',
                },
                {
                  step: '03',
                  title: 'Invite Friends via Refer',
                  desc: `Share your personal referral link to earn +${config.referBonusAmount.toFixed(2)} USDT referral bonus rewards.`,
                },
                {
                  step: '04',
                  title: 'Withdraw to BEP20 (BSC)',
                  desc: `Once your balance reaches ${config.minWithdrawAmount.toFixed(2)} USDT and rules are met, submit your BEP20 wallet address.`,
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
                Publish a new task to the {config.botName} Task Center.
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
                {config.botName} Menu
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
              onClick={() => onOpenModal('how_to_use')}
              className="mf-btn-3d flex min-h-[50px] w-full items-center justify-center gap-2.5 px-4 py-2.5 text-xs font-extrabold text-[#111827]"
            >
              <BookOpen className="h-4 w-4 text-[#00944A]" />
              <span>How to Use</span>
            </button>

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
