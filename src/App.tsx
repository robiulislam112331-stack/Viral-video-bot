import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { BottomNav } from './components/earnmoney/BottomNav';
import { ForceJoinGate } from './components/earnmoney/ForceJoinGate';
import { HomeView } from './components/earnmoney/HomeView';
import { Modals } from './components/earnmoney/Modals';
import { ReferView } from './components/earnmoney/ReferView';
import { TasksView } from './components/earnmoney/TasksView';
import { TopHeader } from './components/earnmoney/TopHeader';
import { WithdrawView } from './components/earnmoney/WithdrawView';
import {
  buildSupportTelegramUrl,
  createInitialEarnMoneyState,
  DEFAULT_EARNMONEY_CONFIG,
  EARNMONEY_LIVE_CONFIG_KEY,
} from './data/defaultEarnMoneyState';
import type {
  BonusTaskItem,
  EarnMoneyConfig,
  EarnMoneyState,
  EarnMoneyTab,
  ModalType,
} from './types/earnMoney';
import { initTelegramWebApp, openExternalTelegramLink } from './utils/telegram';

const TOKEN_KEY = 'cinevault_admin_token';
const STORAGE_PREFIX = 'earnmoney_user_v3_';

function loadLocalConfig(): EarnMoneyConfig {
  try {
    const raw = window.localStorage.getItem(EARNMONEY_LIVE_CONFIG_KEY);
    if (!raw) return DEFAULT_EARNMONEY_CONFIG;
    const parsed = JSON.parse(raw) as Partial<EarnMoneyConfig>;
    return {
      ...DEFAULT_EARNMONEY_CONFIG,
      ...parsed,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : DEFAULT_EARNMONEY_CONFIG.tasks,
    };
  } catch {
    return DEFAULT_EARNMONEY_CONFIG;
  }
}

function loadLocalEarnMoneyState(
  userId: string,
  userName: string,
  userAvatar: string,
  config: EarnMoneyConfig
): EarnMoneyState {
  const fallback = createInitialEarnMoneyState(userId, userName, userAvatar, config);
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

const EarnMoneyApp: React.FC = () => {
  const [tgUser] = useState(() => initTelegramWebApp());
  const [config, setConfig] = useState<EarnMoneyConfig>(() => loadLocalConfig());
  const [state, setState] = useState<EarnMoneyState>(() =>
    loadLocalEarnMoneyState(tgUser.id, tgUser.name, tgUser.avatarUrl, loadLocalConfig())
  );
  const [enteredApp, setEnteredApp] = useState(false);

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

  const cacheState = useCallback((nextState: EarnMoneyState) => {
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${nextState.userId}`, JSON.stringify(nextState));
    } catch {
      // ignore localStorage quota errors
    }
  }, []);

  const cacheConfig = useCallback((nextConfig: EarnMoneyConfig) => {
    try {
      window.localStorage.setItem(EARNMONEY_LIVE_CONFIG_KEY, JSON.stringify(nextConfig));
    } catch {
      // ignore storage quota errors
    }
  }, []);

  const syncFromServer = useCallback(async () => {
    const params = new URLSearchParams({
      uid: tgUser.id,
      name: tgUser.name,
      avatar: tgUser.avatarUrl,
    });
    if (tgUser.referrerId) {
      params.set('ref', tgUser.referrerId);
    }

    try {
      const stateRes = await fetch(`/api/earnmoney/state?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!stateRes.ok) return;
      const data = (await stateRes.json()) as {
        state?: EarnMoneyState;
        config?: EarnMoneyConfig;
      };
      if (data?.config) {
        setConfig(data.config);
        cacheConfig(data.config);
      }
      if (data?.state) {
        const nextMerged: EarnMoneyState = {
          ...createInitialEarnMoneyState(
            tgUser.id,
            tgUser.name,
            tgUser.avatarUrl,
            data.config || DEFAULT_EARNMONEY_CONFIG
          ),
          ...data.state,
          userId: tgUser.id,
          userName: tgUser.name,
          userAvatar: tgUser.avatarUrl,
        };
        setState(nextMerged);
        cacheState(nextMerged);
      }
    } catch {
      // ignore transient network errors
    }
  }, [cacheConfig, cacheState, tgUser.avatarUrl, tgUser.id, tgUser.name, tgUser.referrerId]);

  useEffect(() => {
    document.title = `${config.botName} — USDT BEP20 Mini App`;
  }, [config.botName]);

  useEffect(() => {
    void syncFromServer();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === EARNMONEY_LIVE_CONFIG_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as EarnMoneyConfig;
          setConfig(parsed);
          void syncFromServer();
        } catch {
          // ignore
        }
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncFromServer();
      }
    };

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = window.setInterval(() => {
      void syncFromServer();
    }, 6000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(interval);
    };
  }, [syncFromServer]);

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

    fetch('/api/earnmoney/ad-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: state.userId }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { state?: EarnMoneyState; error?: string };
        if (!res.ok) {
          notify(data.error || 'Unable to claim ad slot.');
          return;
        }
        if (data.state) {
          setState(data.state);
          cacheState(data.state);
        }
        notify('+0.0010 USDT added to your balance!');
      })
      .catch(() => {
        notify('Network error while claiming ad slot.');
      });
  };

  const handleCompleteBonusTask = (task: BonusTaskItem) => {
    if (task.completed) return;
    if (task.url) {
      openExternalTelegramLink(task.url);
    }

    fetch('/api/earnmoney/tasks/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: state.userId, taskId: task.id }),
    })
      .then(async (res) => {
        const data = (await res.json()) as {
          state?: EarnMoneyState;
          error?: string;
          alreadyCompleted?: boolean;
        };
        if (!res.ok) {
          notify(data.error || 'Unable to verify task.');
          return;
        }
        if (data.state) {
          setState(data.state);
          cacheState(data.state);
        }
        if (!data.alreadyCompleted) {
          notify(`Verified! +${task.rewardUsdt.toFixed(2)} USDT credited.`);
        }
      })
      .catch(() => {
        notify('Network error while verifying task.');
      });
  };

  const handleAddTask = (taskInput: Omit<BonusTaskItem, 'id' | 'completed'>) => {
    fetch('/api/earnmoney/tasks/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: state.userId,
        title: taskInput.title,
        rewardUsdt: taskInput.rewardUsdt,
        url: taskInput.url,
      }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { state?: EarnMoneyState; error?: string };
        if (!res.ok) {
          notify(data.error || 'Could not add task.');
          return;
        }
        if (data.state) {
          setState(data.state);
          cacheState(data.state);
        }
        notify('Your custom task has been added to Task Center.');
      })
      .catch(() => {
        notify('Network error while creating task.');
      });
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
    setState((prev) => {
      const next: EarnMoneyState = {
        ...prev,
        joinedWaincomesite: channel === 'waincomesite' ? true : prev.joinedWaincomesite,
        joinedPremiumApps: channel === 'premiumapps' ? true : prev.joinedPremiumApps,
      };
      cacheState(next);
      return next;
    });

    fetch('/api/earnmoney/mark-channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: tgUser.id, channel }),
    }).catch(() => {
      // already updated optimistically
    });
  };

  const handleVerifyGate = () => {
    setActiveTab('home');
    setEnteredApp(true);
    notify(`Welcome to ${config.botName}!`);
  };

  const handleVerifyActivate = () => {
    if (!state.joinedWaincomesite || !state.joinedPremiumApps || state.activateAdsDone < 3) {
      notify('Join both channels and watch 3 ads to activate referral rewards.');
      return;
    }

    fetch('/api/earnmoney/activate-refer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: state.userId }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { state?: EarnMoneyState; error?: string };
        if (!res.ok) {
          notify(data.error || 'Could not activate referral rewards.');
          return;
        }
        if (data.state) {
          setState(data.state);
          cacheState(data.state);
        }
        notify('Referral rewards verified and active!');
      })
      .catch(() => {
        notify('Network error while activating referral rewards.');
      });
  };

  const handleSubmitWithdraw = async (
    amount: number,
    address: string
  ): Promise<{ ok: boolean; message: string }> => {
    if (amount < config.minWithdrawAmount) {
      return {
        ok: false,
        message: `Minimum withdrawal is ${config.minWithdrawAmount.toFixed(2)} USDT.`,
      };
    }
    if (amount > state.totalBalance) {
      return { ok: false, message: 'Insufficient USDT balance.' };
    }

    try {
      const res = await fetch('/api/earnmoney/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: state.userId,
          amount,
          address,
        }),
      });
      const data = (await res.json()) as {
        state?: EarnMoneyState;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        return { ok: false, message: data.error || 'Withdrawal request failed.' };
      }
      if (data.state) {
        setState(data.state);
        cacheState(data.state);
      }
      notify(`Withdrawal of ${amount.toFixed(2)} USDT submitted to BEP20.`);
      return {
        ok: true,
        message: data.message || `Withdrawal request for ${amount.toFixed(2)} USDT submitted.`,
      };
    } catch {
      return { ok: false, message: 'Network error while submitting withdrawal.' };
    }
  };

  if (state.isBlocked) {
    const supportUrl = buildSupportTelegramUrl(config.supportUsername);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F2F4F7] px-4 py-8 text-[#111827]">
        <div className="mf-card-3d w-full max-w-md space-y-4 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="font-display text-xl font-extrabold text-[#111827]">
            Account Suspended
          </h1>
          <p className="text-sm font-medium text-slate-600">
            Your account (ID: <span className="font-mono font-bold">{state.userId}</span>) has been
            blocked by the administrator.
          </p>
          <a
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (openExternalTelegramLink(supportUrl)) e.preventDefault();
            }}
            className="mf-btn-green-3d flex min-h-[48px] w-full items-center justify-center px-4 py-3 text-sm font-extrabold"
          >
            Contact Support ({config.supportUsername})
          </a>
        </div>
      </div>
    );
  }

  if (!enteredApp) {
    return (
      <ForceJoinGate
        config={config}
        joinedWaincomesite={state.joinedWaincomesite}
        joinedPremiumApps={state.joinedPremiumApps}
        onJoinChannel={handleJoinChannel}
        onVerifyMembership={handleVerifyGate}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F4F7] text-[#111827] pb-24">
      <TopHeader
        botName={config.botName}
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
            config={config}
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
            config={config}
            onCopyInviteLink={handleCopyInviteLink}
            onJoinChannel={handleJoinChannel}
            onVerifyActivate={handleVerifyActivate}
            onOpenModal={setActiveModal}
          />
        )}

        {activeTab === 'withdraw' && (
          <WithdrawView
            state={state}
            config={config}
            historyRef={historyRef}
            onJoinChannel={handleJoinChannel}
            onSubmitWithdraw={handleSubmitWithdraw}
          />
        )}
      </main>

      <Modals
        activeModal={activeModal}
        state={state}
        config={config}
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
