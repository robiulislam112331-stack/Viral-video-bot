import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { BottomNav } from './components/rewardbox/BottomNav';
import { HomeView } from './components/rewardbox/HomeView';
import { Modals } from './components/rewardbox/Modals';
import { ReferView } from './components/rewardbox/ReferView';
import { TasksView } from './components/rewardbox/TasksView';
import { TopHeader } from './components/rewardbox/TopHeader';
import { WithdrawView } from './components/rewardbox/WithdrawView';
import { createInitialRewardBoxState } from './data/defaultRewardBoxState';
import type { BonusTaskItem, ModalType, RewardBoxState, RewardTab } from './types/rewardBox';
import { initTelegramWebApp, openExternalTelegramLink } from './utils/telegram';

const TOKEN_KEY = 'cinevault_admin_token';
const STORAGE_PREFIX = 'rewardbox_state_v1_';

function loadLocalRewardBoxState(userId: string, userName: string, userAvatar: string): RewardBoxState {
  const fallback = createInitialRewardBoxState(userId, userName, userAvatar);
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<RewardBoxState>;
    return {
      ...fallback,
      ...parsed,
      userId,
      userName: userName || fallback.userName,
      userAvatar: userAvatar || fallback.userAvatar,
      bonusTasks: Array.isArray(parsed.bonusTasks) ? parsed.bonusTasks : fallback.bonusTasks,
      referralsList: Array.isArray(parsed.referralsList)
        ? parsed.referralsList
        : fallback.referralsList,
      withdrawHistory: Array.isArray(parsed.withdrawHistory)
        ? parsed.withdrawHistory
        : fallback.withdrawHistory,
    };
  } catch {
    return fallback;
  }
}

const RewardBoxApp: React.FC = () => {
  const [tgUser] = useState(() => initTelegramWebApp());
  const [state, setState] = useState<RewardBoxState>(() =>
    loadLocalRewardBoxState(tgUser.id, tgUser.name, tgUser.avatarUrl)
  );
  const [activeTab, setActiveTab] = useState<RewardTab>('home');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [scrollHistoryQueued, setScrollHistoryQueued] = useState(false);

  const historyRef = useRef<HTMLElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const hydratedFromServerRef = useRef(false);

  const notify = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 2800);
  };

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      uid: tgUser.id,
      name: tgUser.name,
      avatar: tgUser.avatarUrl,
    });

    fetch(`/api/rewardbox/state?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { state?: RewardBoxState } | null) => {
        if (!active || !data?.state) return;
        setState((prev) => ({
          ...prev,
          ...data.state,
          userId: tgUser.id,
          userName: tgUser.name,
          userAvatar: tgUser.avatarUrl,
        }));
        hydratedFromServerRef.current = true;
      })
      .catch(() => {
        hydratedFromServerRef.current = true;
      });

    return () => {
      active = false;
    };
  }, [tgUser.avatarUrl, tgUser.id, tgUser.name]);

  const persistState = (nextState: RewardBoxState) => {
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${nextState.userId}`, JSON.stringify(nextState));
    } catch {
      // ignore localStorage quota errors
    }

    fetch('/api/rewardbox/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: nextState }),
    }).catch(() => {
      // offline fallback already stored in localStorage
    });
  };

  const updateState = (updater: (prev: RewardBoxState) => RewardBoxState) => {
    setState((prev) => {
      const next = updater(prev);
      persistState(next);
      return next;
    });
  };

  useEffect(() => {
    if (activeTab === 'withdraw' && scrollHistoryQueued) {
      setScrollHistoryQueued(false);
      window.setTimeout(() => {
        historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  }, [activeTab, scrollHistoryQueued]);

  const handleNavigateTab = (tab: RewardTab, scrollToHistory = false) => {
    setActiveTab(tab);
    if (tab === 'withdraw' && scrollToHistory) {
      setScrollHistoryQueued(true);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleClaimAdSlot = () => {
    if (state.dailyAdsCompleted >= state.dailyAdsTotal) {
      notify('Daily 100 ad slots already completed.');
      return;
    }

    const reward = 0.001;
    updateState((prev) => ({
      ...prev,
      totalBalance: Number((prev.totalBalance + reward).toFixed(4)),
      totalIncome: Number((prev.totalIncome + reward).toFixed(4)),
      dailyAdsCompleted: Math.min(prev.dailyAdsTotal, prev.dailyAdsCompleted + 1),
      nextSlotNumber: Math.min(prev.dailyAdsTotal, prev.nextSlotNumber + 1),
      adsWatchedTotal: prev.adsWatchedTotal + 1,
      activateAdsDone: Math.min(3, prev.activateAdsDone + 1),
    }));
    notify(`+0.0010 USDT added to your balance!`);
  };

  const handleCompleteBonusTask = (task: BonusTaskItem) => {
    if (task.completed) return;
    if (task.url) {
      openExternalTelegramLink(task.url);
    }

    updateState((prev) => ({
      ...prev,
      totalBalance: Number((prev.totalBalance + task.rewardUsdt).toFixed(4)),
      totalIncome: Number((prev.totalIncome + task.rewardUsdt).toFixed(4)),
      bonusTasks: prev.bonusTasks.map((t) =>
        t.id === task.id ? { ...t, completed: true } : t
      ),
    }));
    notify(`Verified! +${task.rewardUsdt.toFixed(2)} USDT credited.`);
  };

  const handleAddTask = (taskInput: Omit<BonusTaskItem, 'id' | 'completed'>) => {
    const newTask: BonusTaskItem = {
      ...taskInput,
      id: `task_${Date.now()}`,
      completed: false,
    };
    updateState((prev) => ({
      ...prev,
      bonusTasks: [newTask, ...prev.bonusTasks],
    }));
    notify('Your custom task has been added to Task Center.');
  };

  const handleClaimSpin = (rewardUsdt: number) => {
    updateState((prev) => ({
      ...prev,
      totalBalance: Number((prev.totalBalance + rewardUsdt).toFixed(4)),
      totalIncome: Number((prev.totalIncome + rewardUsdt).toFixed(4)),
      spinUsedToday: true,
    }));
    notify(`Spin reward +${rewardUsdt.toFixed(4)} USDT credited!`);
  };

  const handleCopyInviteLink = () => {
    const inviteLink = `https://t.me/boxreward_bot?start=ref_${state.userId}`;
    try {
      void navigator.clipboard.writeText(inviteLink);
    } catch {
      // ignore clipboard errors
    }
    notify('Invite link copied to clipboard.');
  };

  const handleVerifyActivate = () => {
    updateState((prev) => ({
      ...prev,
      joinedWaincomesite: true,
      joinedPremiumApps: true,
      activateAdsDone: 3,
      referralActivated: true,
    }));
    notify('Referral rewards verified and active!');
  };

  const handleSubmitWithdraw = (
    amount: number,
    address: string
  ): { ok: boolean; message: string } => {
    if (amount < 0.8) {
      return { ok: false, message: 'Minimum withdrawal is 0.80 USDT.' };
    }
    if (amount > state.totalBalance) {
      return { ok: false, message: 'Insufficient USDT balance.' };
    }
    if (state.referralsInvited < 5) {
      return { ok: false, message: 'At least 5 valid referrals are required.' };
    }

    const shortAddr =
      address.length > 12 ? `${address.slice(0, 5)}...${address.slice(-4)}` : address;
    const todayLabel = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });

    updateState((prev) => ({
      ...prev,
      totalBalance: Number((prev.totalBalance - amount).toFixed(4)),
      totalWithdraw: Number((prev.totalWithdraw + amount).toFixed(4)),
      withdrawHistory: [
        {
          id: `wd_${Date.now()}`,
          amountUsdt: amount,
          address: shortAddr,
          date: todayLabel,
          status: 'Completed',
        },
        ...prev.withdrawHistory,
      ],
    }));

    notify(`Withdrawal of ${amount.toFixed(2)} USDT submitted to BEP20.`);
    return {
      ok: true,
      message: `Withdrawal request for ${amount.toFixed(2)} USDT submitted to ${shortAddr}.`,
    };
  };

  return (
    <div className="min-h-screen bg-[#F2F4F7] text-[#111827] pb-24">
      <TopHeader
        userName={state.userName}
        userId={state.userId}
        userAvatar={state.userAvatar}
        onOpenMenu={() => setActiveModal('menu')}
      />

      {toastMsg && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 px-4">
          <div className="mf-card-3d flex items-center gap-2 border border-[#00944A]/30 bg-white px-4 py-2.5 text-xs font-extrabold text-[#111827] shadow-lg">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#00944A]" />
            <span className="whitespace-nowrap">{toastMsg}</span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 pt-4">
        {activeTab === 'home' && (
          <HomeView
            state={state}
            onNavigateTab={handleNavigateTab}
            onOpenModal={setActiveModal}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksView
            state={state}
            onOpenModal={setActiveModal}
            onCompleteBonusTask={handleCompleteBonusTask}
          />
        )}

        {activeTab === 'refer' && (
          <ReferView
            state={state}
            onCopyInviteLink={handleCopyInviteLink}
            onVerifyActivate={handleVerifyActivate}
            onOpenModal={setActiveModal}
          />
        )}

        {activeTab === 'withdraw' && (
          <WithdrawView
            state={state}
            historyRef={historyRef}
            onSubmitWithdraw={handleSubmitWithdraw}
          />
        )}
      </main>

      <Modals
        activeModal={activeModal}
        state={state}
        onClose={() => setActiveModal(null)}
        onClaimAdSlot={handleClaimAdSlot}
        onClaimSpin={handleClaimSpin}
        onAddTask={handleAddTask}
        onNavigateTab={handleNavigateTab}
        onOpenModal={setActiveModal}
        onNotify={notify}
      />

      <BottomNav activeTab={activeTab} onSelectTab={handleNavigateTab} />
    </div>
  );
};

export default function App() {
  const isAdminRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  const [adminToken, setAdminTokenState] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const handleSetAdminToken = (token: string | null) => {
    setAdminTokenState(token);
    try {
      if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
      else window.sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore storage errors
    }
  };

  if (isAdminRoute) {
    return <AdminPanel adminToken={adminToken} onSetAdminToken={handleSetAdminToken} />;
  }

  return <RewardBoxApp />;
}
