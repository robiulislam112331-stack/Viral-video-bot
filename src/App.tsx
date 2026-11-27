import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { BottomNav } from './components/earnmoney/BottomNav';
import { ForceJoinGate } from './components/earnmoney/ForceJoinGate';
import { HomeView } from './components/earnmoney/HomeView';
import { Modals } from './components/earnmoney/Modals';
import { ReferView } from './components/earnmoney/ReferView';
import { TasksView } from './components/earnmoney/TasksView';
import { TopHeader } from './components/earnmoney/TopHeader';
import { WithdrawView } from './components/earnmoney/WithdrawView';
import { createInitialEarnMoneyState } from './data/defaultEarnMoneyState';
import type { BonusTaskItem, EarnMoneyState, EarnMoneyTab, ModalType } from './types/earnMoney';
import { initTelegramWebApp, openExternalTelegramLink } from './utils/telegram';

const TOKEN_KEY = 'cinevault_admin_token';
const STORAGE_PREFIX = 'earnmoney_user_v3_';

function loadLocalEarnMoneyState(
  userId: string,
  userName: string,
  userAvatar: string
): EarnMoneyState {
  const fallback = createInitialEarnMoneyState(userId, userName, userAvatar);
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<EarnMoneyState>;
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

interface VerifyMembershipResponse {
  verified: boolean;
  joinedWaincomesite: boolean;
  joinedPremiumApps: boolean;
  missing: string[];
  message: string | null;
}

const EarnMoneyApp: React.FC = () => {
  const [tgUser] = useState(() => initTelegramWebApp());
  const [state, setState] = useState<EarnMoneyState>(() =>
    loadLocalEarnMoneyState(tgUser.id, tgUser.name, tgUser.avatarUrl)
  );
  const [membershipStatus, setMembershipStatus] = useState<'checking' | 'locked' | 'verified'>(
    'checking'
  );
  const [verifyingMembership, setVerifyingMembership] = useState(false);
  const [gateAlert, setGateAlert] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<EarnMoneyTab>('home');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [scrollHistoryQueued, setScrollHistoryQueued] = useState(false);

  const historyRef = useRef<HTMLElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const notify = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 2800);
  };

  const persistState = useCallback((nextState: EarnMoneyState) => {
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${nextState.userId}`, JSON.stringify(nextState));
    } catch {
      // ignore localStorage quota errors
    }

    fetch('/api/earnmoney/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: nextState }),
    }).catch(() => {
      // offline fallback already stored in localStorage
    });
  }, []);

  const updateState = useCallback(
    (updater: (prev: EarnMoneyState) => EarnMoneyState) => {
      setState((prev) => {
        const next = updater(prev);
        persistState(next);
        return next;
      });
    },
    [persistState]
  );

  const checkMembershipOnServer = useCallback(
    async (showErrorOnFail: boolean): Promise<boolean> => {
      try {
        const res = await fetch('/api/earnmoney/verify-membership', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: tgUser.id,
            isTelegramUser: tgUser.isTelegramUser,
          }),
        });
        if (!res.ok) throw new Error('Verification request failed');
        const data = (await res.json()) as VerifyMembershipResponse;

        setState((prev) => {
          const updated: EarnMoneyState = {
            ...prev,
            joinedWaincomesite: Boolean(data.joinedWaincomesite),
            joinedPremiumApps: Boolean(data.joinedPremiumApps),
          };
          try {
            window.localStorage.setItem(
              `${STORAGE_PREFIX}${tgUser.id}`,
              JSON.stringify(updated)
            );
          } catch {
            // ignore
          }
          return updated;
        });

        if (data.verified) {
          setMembershipStatus('verified');
          setGateAlert(null);
          return true;
        }

        setMembershipStatus('locked');
        if (showErrorOnFail) {
          setGateAlert(
            data.message ||
              'Please join both channels. You have not joined: @waincomesite / @premiumapps5462'
          );
        }
        return false;
      } catch {
        let bothLocal = false;
        setState((prev) => {
          bothLocal = prev.joinedWaincomesite && prev.joinedPremiumApps;
          return prev;
        });
        if (bothLocal) {
          setMembershipStatus('verified');
          return true;
        }
        setMembershipStatus('locked');
        if (showErrorOnFail) {
          setGateAlert(
            'Please join both channels. You have not joined: @waincomesite / @premiumapps5462'
          );
        }
        return false;
      }
    },
    [tgUser.id, tgUser.isTelegramUser]
  );

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      uid: tgUser.id,
      name: tgUser.name,
      avatar: tgUser.avatarUrl,
    });
    if (tgUser.referrerId) {
      params.set('ref', tgUser.referrerId);
    }

    (async () => {
      try {
        const stateRes = await fetch(`/api/earnmoney/state?${params.toString()}`);
        if (active && stateRes.ok) {
          const data = (await stateRes.json()) as { state?: EarnMoneyState };
          if (data?.state) {
            const nextMerged: EarnMoneyState = {
              ...createInitialEarnMoneyState(tgUser.id, tgUser.name, tgUser.avatarUrl),
              ...data.state,
              userId: tgUser.id,
              userName: tgUser.name,
              userAvatar: tgUser.avatarUrl,
            };
            setState(nextMerged);
            try {
              window.localStorage.setItem(
                `${STORAGE_PREFIX}${tgUser.id}`,
                JSON.stringify(nextMerged)
              );
            } catch {
              // ignore storage errors
            }
          }
        }
      } catch {
        // fallback already initialized at 0
      }

      if (active) {
        await checkMembershipOnServer(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [checkMembershipOnServer, tgUser.avatarUrl, tgUser.id, tgUser.name, tgUser.referrerId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkMembershipOnServer(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkMembershipOnServer]);

  useEffect(() => {
    if (activeTab === 'withdraw' && scrollHistoryQueued) {
      setScrollHistoryQueued(false);
      window.setTimeout(() => {
        historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  }, [activeTab, scrollHistoryQueued]);

  const handleNavigateTab = (tab: EarnMoneyTab, scrollToHistory = false) => {
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
    notify('+0.0010 USDT added to your balance!');
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

  const handleCopyInviteLink = () => {
    const inviteLink = `https://t.me/moneyxearnbot?start=ref_${state.userId}`;
    try {
      void navigator.clipboard.writeText(inviteLink);
    } catch {
      // ignore clipboard errors
    }
    notify('Invite link copied to clipboard.');
  };

  const handleJoinChannel = (channel: 'waincomesite' | 'premiumapps') => {
    setGateAlert(null);
    updateState((prev) => ({
      ...prev,
      joinedWaincomesite: channel === 'waincomesite' ? true : prev.joinedWaincomesite,
      joinedPremiumApps: channel === 'premiumapps' ? true : prev.joinedPremiumApps,
    }));

    fetch('/api/earnmoney/mark-channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: tgUser.id, channel }),
    }).catch(() => {
      // already updated optimistically
    });
  };

  const handleVerifyGate = async () => {
    setVerifyingMembership(true);
    setGateAlert(null);
    const ok = await checkMembershipOnServer(true);
    setVerifyingMembership(false);
    if (ok) {
      notify('Both channels verified! Welcome to Earn Money.');
    }
  };

  const handleVerifyActivate = () => {
    if (!state.joinedWaincomesite || !state.joinedPremiumApps || state.activateAdsDone < 3) {
      notify('Join both channels and watch 3 ads to activate referral rewards.');
      return;
    }

    updateState((prev) => ({
      ...prev,
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

  if (membershipStatus !== 'verified') {
    return (
      <ForceJoinGate
        checkingInitial={membershipStatus === 'checking'}
        verifying={verifyingMembership}
        joinedWaincomesite={state.joinedWaincomesite}
        joinedPremiumApps={state.joinedPremiumApps}
        alertMessage={gateAlert}
        onJoinChannel={handleJoinChannel}
        onVerifyMembership={() => void handleVerifyGate()}
      />
    );
  }

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
            onJoinChannel={handleJoinChannel}
            onVerifyActivate={handleVerifyActivate}
            onOpenModal={setActiveModal}
          />
        )}

        {activeTab === 'withdraw' && (
          <WithdrawView
            state={state}
            historyRef={historyRef}
            onJoinChannel={handleJoinChannel}
            onSubmitWithdraw={handleSubmitWithdraw}
          />
        )}
      </main>

      <Modals
        activeModal={activeModal}
        state={state}
        onClose={() => setActiveModal(null)}
        onClaimAdSlot={handleClaimAdSlot}
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

  return <EarnMoneyApp />;
}
