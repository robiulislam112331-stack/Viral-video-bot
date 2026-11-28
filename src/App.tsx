import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ShieldAlert, Wrench } from 'lucide-react';
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
  formatReferralLink,
  isReferActivationComplete,
  isTaskCompletedForUser,
} from './data/defaultEarnMoneyState';
import type {
  BonusTaskItem,
  EarnMoneyConfig,
  EarnMoneyState,
  EarnMoneyTab,
  ModalType,
} from './types/earnMoney';
import { initTelegramWebApp, openExternalTelegramLink } from './utils/telegram';

const STORAGE_PREFIX = 'earnmoney_user_v3_';

function loadLocalConfig(): EarnMoneyConfig {
  try {
    const raw = window.localStorage.getItem(EARNMONEY_LIVE_CONFIG_KEY);
    if (!raw) return DEFAULT_EARNMONEY_CONFIG;
    const parsed = JSON.parse(raw) as Partial<EarnMoneyConfig>;
    return {
      ...DEFAULT_EARNMONEY_CONFIG,
      ...parsed,
      tasks: Array.isArray(parsed.tasks)
        ? parsed.tasks.filter((t) => t && t.id !== 'task_verify_app')
        : [],
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
      bonusTasks: Array.isArray(parsed.bonusTasks)
        ? parsed.bonusTasks.filter((t) => t && t.id !== 'task_verify_app')
        : [],
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
  const [serverIsMaintenanceAdmin, setServerIsMaintenanceAdmin] = useState(false);
  const [enteredApp, setEnteredApp] = useState(false);

  const [activeTab, setActiveTab] = useState<EarnMoneyTab>('home');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [activeAdSlotId, setActiveAdSlotId] = useState<number>(1);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [scrollHistoryQueued, setScrollHistoryQueued] = useState(false);

  const historyRef = useRef<HTMLElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const isMaintenanceAdmin =
    serverIsMaintenanceAdmin ||
    Boolean(config.maintenanceAdminId?.trim() && tgUser.id === config.maintenanceAdminId.trim());

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
      isTg: tgUser.isTelegramUser ? '1' : '0',
    });
    if (tgUser.firstName) params.set('firstName', tgUser.firstName);
    if (tgUser.lastName) params.set('lastName', tgUser.lastName);
    if (tgUser.username) params.set('username', tgUser.username);
    if (tgUser.avatarUrl && tgUser.avatarUrl.startsWith('https://')) {
      params.set('avatar', tgUser.avatarUrl);
    }
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
        isMaintenanceAdmin?: boolean;
      };
      if (typeof data.isMaintenanceAdmin === 'boolean') {
        setServerIsMaintenanceAdmin(data.isMaintenanceAdmin);
      }
      if (data?.config) {
        setConfig(data.config);
        cacheConfig(data.config);
      }
      if (data?.state) {
        const syncedConfig = data.config || DEFAULT_EARNMONEY_CONFIG;
        const dynamicDailyTotal = Math.max(
          1,
          Number(syncedConfig.dailyAdsLimitPerUser) || DEFAULT_EARNMONEY_CONFIG.dailyAdsLimitPerUser
        );
        const nextMerged: EarnMoneyState = {
          ...data.state,
          dailyAdsTotal: dynamicDailyTotal,
          dailyCeilingUsdt: Number(
            (dynamicDailyTotal * (Number(syncedConfig.perAdViewReward) || 0)).toFixed(4)
          ),
          userId: data.state.userId || tgUser.id,
          userName: data.state.userName || tgUser.name,
          userAvatar: data.state.userAvatar || tgUser.avatarUrl,
        };
        setState(nextMerged);
        cacheState(nextMerged);
      }
    } catch {
      // ignore transient network errors
    }
  }, [
    cacheConfig,
    cacheState,
    tgUser.avatarUrl,
    tgUser.firstName,
    tgUser.id,
    tgUser.isTelegramUser,
    tgUser.lastName,
    tgUser.name,
    tgUser.referrerId,
    tgUser.username,
  ]);

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
    void syncFromServer();
    if (tab === 'withdraw' && scrollToHistory) {
      setScrollHistoryQueued(true);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenModal = (modal: ModalType, slotId?: number) => {
    if (modal === 'ad_watch') {
      const dailyLimit = Math.max(
        1,
        Number(config.dailyAdsLimitPerUser) || Number(state.dailyAdsTotal) || DEFAULT_EARNMONEY_CONFIG.dailyAdsLimitPerUser
      );
      const nextSlot = Math.min(dailyLimit, Math.max(1, slotId ?? state.nextSlotNumber ?? state.dailyAdsCompleted + 1));
      setActiveAdSlotId(nextSlot);
    }
    setActiveModal(modal);
  };

  const handleClaimAdSlot = (mode: 'view' | 'click' = 'view', slotId?: number) => {
    if (!config.premiumAdsEnabled || config.premiumAdsBudget <= 0) {
      notify('Premium Ads Slot Empty');
      return;
    }
    const dailyLimit = Math.max(
      1,
      Number(config.dailyAdsLimitPerUser) || Number(state.dailyAdsTotal) || DEFAULT_EARNMONEY_CONFIG.dailyAdsLimitPerUser
    );
    const targetSlot = slotId ?? activeAdSlotId ?? Math.min(dailyLimit, state.dailyAdsCompleted + 1);
    const existingClaim = state.adSlotClaims?.[String(targetSlot)];

    if (mode === 'view') {
      if (existingClaim?.view_reward_claimed) {
        notify(`View reward already claimed for Slot #${targetSlot}.`);
        return;
      }
      if (state.dailyAdsCompleted >= dailyLimit) {
        notify(`Daily ${dailyLimit} ad slots already completed.`);
        return;
      }
    } else if (existingClaim?.click_bonus_claimed) {
      notify(`Ad click bonus already claimed for Slot #${targetSlot}.`);
      return;
    }

    fetch('/api/earnmoney/ad-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: state.userId,
        mode,
        slotId: targetSlot,
        isTg: tgUser.isTelegramUser,
      }),
    })
      .then(async (res) => {
        const data = (await res.json()) as {
          state?: EarnMoneyState;
          config?: EarnMoneyConfig;
          reward?: number;
          error?: string;
        };
        if (data.config) {
          setConfig(data.config);
          cacheConfig(data.config);
        }
        if (data.state) {
          setState(data.state);
          cacheState(data.state);
        }
        if (!res.ok) {
          notify(data.error || 'Unable to claim ad slot.');
          return;
        }
        const credited =
          data.reward ?? (mode === 'click' ? config.perAdClickReward : config.perAdViewReward);
        notify(
          mode === 'click'
            ? `+${credited.toFixed(4)} USDT Ad Click Bonus added!`
            : `+${credited.toFixed(4)} USDT added to your balance!`
        );
      })
      .catch(() => {
        notify('Network error while claiming ad slot.');
      });
  };

  const handleCompleteBonusTask = (task: BonusTaskItem) => {
    if (task.completed || isTaskCompletedForUser(task, state)) return;
    if (task.url) {
      openExternalTelegramLink(task.url);
    }

    fetch('/api/earnmoney/tasks/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: state.userId,
        taskId: task.id,
        isTg: tgUser.isTelegramUser,
      }),
    })
      .then(async (res) => {
        const data = (await res.json()) as {
          state?: EarnMoneyState;
          config?: EarnMoneyConfig;
          error?: string;
          alreadyCompleted?: boolean;
        };
        if (data.config) {
          setConfig(data.config);
          cacheConfig(data.config);
        }
        if (data.state) {
          setState(data.state);
          cacheState(data.state);
        }
        if (!res.ok) {
          notify(data.error || 'Unable to verify task.');
          return;
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
        isTg: tgUser.isTelegramUser,
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
    const inviteLink = formatReferralLink(config.referLinkFormat, state.userId);
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
      body: JSON.stringify({
        uid: tgUser.id,
        channel,
        isTg: tgUser.isTelegramUser,
      }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { state?: EarnMoneyState };
        if (data.state) {
          setState(data.state);
          cacheState(data.state);
        }
      })
      .catch(() => {
        // already updated optimistically
      });
  };

  const handleVerifyGate = () => {
    if (config.maintenanceMode && !isMaintenanceAdmin) {
      notify(config.maintenanceMessage);
      return;
    }
    setActiveTab('home');
    setEnteredApp(true);
    notify(`Welcome to ${config.botName}!`);
  };

  const handleVerifyActivate = () => {
    if (!isReferActivationComplete(state, config)) {
      const minAds = config.referMinAdsWatched || 0;
      if (minAds > 0 && (state.adsWatchedTotal || 0) < minAds) {
        notify(`Watch ${minAds} Ads to Activate Refer.`);
      } else {
        notify('Complete the required refer activation rules first.');
      }
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
    const requiredAds = Math.max(0, Math.floor(Number(config.withdrawRequiredAds ?? 0)));
    const adsWatchedToday = Math.max(0, Number(state.dailyAdsCompleted || 0));
    if (requiredAds > 0 && adsWatchedToday < requiredAds) {
      return {
        ok: false,
        message: `Withdraw is locked. ${adsWatchedToday} / ${requiredAds} Ads Watched.`,
      };
    }

    const minWithdraw = Math.max(0, Number(config.minWithdrawAmount ?? 1));
    if (!Number.isFinite(amount) || amount < minWithdraw) {
      return {
        ok: false,
        message: `Minimum Withdraw is $${minWithdraw.toFixed(2)} USDT`,
      };
    }

    const maxWithdraw = Math.max(0, Number(config.maxWithdrawAmount ?? 0));
    if (maxWithdraw > 0 && amount > maxWithdraw) {
      return {
        ok: false,
        message: `Maximum Withdraw is $${maxWithdraw.toFixed(2)} USDT`,
      };
    }

    const pendingTotal = (state.withdrawHistory || [])
      .filter((w) => w.status === 'Pending')
      .reduce((sum, w) => sum + (Number(w.amountUsdt) || 0), 0);
    const availableBalance = Math.max(0, Number((state.totalBalance - pendingTotal).toFixed(4)));
    if (amount > availableBalance) {
      return {
        ok: false,
        message:
          pendingTotal > 0
            ? 'Insufficient available USDT balance (pending withdrawals are queued).'
            : 'Insufficient USDT balance.',
      };
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

  if (config.maintenanceMode && !isMaintenanceAdmin) {
    const supportUrl = buildSupportTelegramUrl(config.supportUsername);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F2F4F7] px-4 py-8 text-[#111827]">
        <div className="mf-card-3d w-full max-w-md space-y-4 p-6 text-center">
          <div className="mf-icon-circle mx-auto flex h-14 w-14 items-center justify-center">
            <Wrench className="h-7 w-7 text-[#00944A]" />
          </div>
          <h1 className="font-display text-xl font-extrabold text-[#111827]">
            Maintenance Mode
          </h1>
          <p className="text-sm font-medium leading-relaxed text-slate-600">
            {config.maintenanceMessage}
          </p>
          <a
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (openExternalTelegramLink(supportUrl)) e.preventDefault();
            }}
            className="mf-btn-outline-3d flex min-h-[46px] w-full items-center justify-center px-4 py-2.5 text-xs font-extrabold"
          >
            Support ({config.supportUsername})
          </a>
        </div>
      </div>
    );
  }

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
            onOpenModal={handleOpenModal}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksView
            state={state}
            config={config}
            onOpenModal={handleOpenModal}
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
            onOpenModal={handleOpenModal}
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
        activeSlotId={activeAdSlotId}
        state={state}
        config={config}
        onClose={() => setActiveModal(null)}
        onClaimAdSlot={handleClaimAdSlot}
        onSelectAdSlot={(slotId) => handleOpenModal('ad_watch', slotId)}
        onAddTask={handleAddTask}
        onNavigateTab={handleNavigateTab}
        onOpenModal={handleOpenModal}
        onNotify={notify}
      />

      <BottomNav activeTab={activeTab} onSelectTab={handleNavigateTab} />
    </div>
  );
};

export default function App() {
  const isAdminRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  const [adminToken, setAdminTokenState] = useState<string | null>(null);

  if (isAdminRoute) {
    return <AdminPanel adminToken={adminToken} onSetAdminToken={setAdminTokenState} />;
  }

  return <EarnMoneyApp />;
}
