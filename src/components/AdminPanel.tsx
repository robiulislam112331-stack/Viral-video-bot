import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  ClipboardList,
  Coins,
  Edit3,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  PlayCircle,
  Plus,
  Power,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import {
  DEFAULT_EARNMONEY_CONFIG,
  EARNMONEY_LIVE_CONFIG_KEY,
  normalizeTaskType,
  TASK_TYPES,
} from '../data/defaultEarnMoneyState';
import type { AdminAuthStatus } from '../types';
import type {
  AdminWithdrawalRecord,
  BonusTaskItem,
  EarnMoneyConfig,
  EarnMoneyState,
  ReferBonusType,
  TaskType,
} from '../types/earnMoney';

type AdminTab = 'dashboard' | 'settings' | 'tasks' | 'users' | 'withdrawals';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  totalTasks: number;
  activeTasks: number;
  pendingWithdrawals: number;
  totalWithdrawAmount: number;
}

interface AdminOverviewResponse {
  config: EarnMoneyConfig;
  users: EarnMoneyState[];
  withdrawals: AdminWithdrawalRecord[];
  stats: AdminStats;
}

interface AdminPanelProps {
  adminToken: string | null;
  onSetAdminToken: (token: string | null) => void;
}

function broadcastLiveConfig(config: EarnMoneyConfig): void {
  try {
    window.localStorage.setItem(EARNMONEY_LIVE_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore storage quota errors
  }
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ adminToken, onSetAdminToken }) => {
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus | null>(null);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('settings');
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeUsers: 0,
    blockedUsers: 0,
    totalTasks: 0,
    activeTasks: 0,
    pendingWithdrawals: 0,
    totalWithdrawAmount: 0,
  });
  const [users, setUsers] = useState<EarnMoneyState[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRecord[]>([]);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Maintenance Mode State (Top of Admin Panel)
  const [maintenanceMode, setMaintenanceMode] = useState(DEFAULT_EARNMONEY_CONFIG.maintenanceMode);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    DEFAULT_EARNMONEY_CONFIG.maintenanceMessage
  );
  const [maintenanceAdminId, setMaintenanceAdminId] = useState(
    DEFAULT_EARNMONEY_CONFIG.maintenanceAdminId
  );
  const [maintenanceSavedMsg, setMaintenanceSavedMsg] = useState<string | null>(null);

  // General Bot Settings
  const [botName, setBotName] = useState(DEFAULT_EARNMONEY_CONFIG.botName);
  const [welcomeTitle, setWelcomeTitle] = useState(DEFAULT_EARNMONEY_CONFIG.welcomeTitle);
  const [welcomeSubtitle, setWelcomeSubtitle] = useState(DEFAULT_EARNMONEY_CONFIG.welcomeSubtitle);
  const [channel1Url, setChannel1Url] = useState(DEFAULT_EARNMONEY_CONFIG.channel1Url);
  const [channel2Url, setChannel2Url] = useState(DEFAULT_EARNMONEY_CONFIG.channel2Url);
  const [minWithdrawAmount, setMinWithdrawAmount] = useState(
    String(DEFAULT_EARNMONEY_CONFIG.minWithdrawAmount)
  );
  const [supportUsername, setSupportUsername] = useState(DEFAULT_EARNMONEY_CONFIG.supportUsername);
  const [generalSavedMsg, setGeneralSavedMsg] = useState<string | null>(null);

  // 1. Refer System Settings
  const [referBonusAmount, setReferBonusAmount] = useState(
    String(DEFAULT_EARNMONEY_CONFIG.referBonusAmount)
  );
  const [referMinAdsWatched, setReferMinAdsWatched] = useState(
    String(DEFAULT_EARNMONEY_CONFIG.referMinAdsWatched)
  );
  const [referMinChannelsJoined, setReferMinChannelsJoined] = useState(
    String(DEFAULT_EARNMONEY_CONFIG.referMinChannelsJoined)
  );
  const [referMinTasksCompleted, setReferMinTasksCompleted] = useState(
    String(DEFAULT_EARNMONEY_CONFIG.referMinTasksCompleted)
  );
  const [referBonusType, setReferBonusType] = useState<ReferBonusType>(
    DEFAULT_EARNMONEY_CONFIG.referBonusType
  );
  const [maxReferPerUser, setMaxReferPerUser] = useState(
    String(DEFAULT_EARNMONEY_CONFIG.maxReferPerUser)
  );
  const [referLinkFormat, setReferLinkFormat] = useState(DEFAULT_EARNMONEY_CONFIG.referLinkFormat);
  const [referSavedMsg, setReferSavedMsg] = useState<string | null>(null);

  // 2. Premium Ads Slot Settings
  const [premiumAdsEnabled, setPremiumAdsEnabled] = useState(
    DEFAULT_EARNMONEY_CONFIG.premiumAdsEnabled
  );
  const [premiumAdsBudget, setPremiumAdsBudget] = useState(
    String(DEFAULT_EARNMONEY_CONFIG.premiumAdsBudget)
  );
  const [perAdViewReward, setPerAdViewReward] = useState(
    String(DEFAULT_EARNMONEY_CONFIG.perAdViewReward)
  );
  const [perAdClickReward, setPerAdClickReward] = useState(
    String(DEFAULT_EARNMONEY_CONFIG.perAdClickReward)
  );
  const [dailyAdsLimitPerUser, setDailyAdsLimitPerUser] = useState(
    String(DEFAULT_EARNMONEY_CONFIG.dailyAdsLimitPerUser)
  );
  const [adsSlotPriceForAdvertiser, setAdsSlotPriceForAdvertiser] = useState(
    String(DEFAULT_EARNMONEY_CONFIG.adsSlotPriceForAdvertiser)
  );
  const [monetagLink, setMonetagLink] = useState(DEFAULT_EARNMONEY_CONFIG.monetagLink);
  const [adsSavedMsg, setAdsSavedMsg] = useState<string | null>(null);

  const [savingSection, setSavingSection] = useState<string | null>(null);

  // Task Management State
  const [tasks, setTasks] = useState<BonusTaskItem[]>(DEFAULT_EARNMONEY_CONFIG.tasks);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('Daily');
  const [taskReward, setTaskReward] = useState('0.20');
  const [taskUrl, setTaskUrl] = useState('https://t.me/waincomesite');
  const [taskActive, setTaskActive] = useState(true);
  const [savingTask, setSavingTask] = useState(false);
  const [taskSavedMsg, setTaskSavedMsg] = useState<string | null>(null);

  // User Management State
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [balanceInputs, setBalanceInputs] = useState<Record<string, string>>({});
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  // Withdraw Management State
  const [wdFilter, setWdFilter] = useState<'all' | 'Pending' | 'Completed' | 'Rejected'>('all');
  const [busyWdId, setBusyWdId] = useState<string | null>(null);

  const showToast = (type: 'ok' | 'err', text: string) => {
    setBanner({ type, text });
    window.setTimeout(() => {
      setBanner((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  const applyConfigToForm = useCallback((cfg: EarnMoneyConfig) => {
    setBotName(cfg.botName);
    setWelcomeTitle(cfg.welcomeTitle);
    setWelcomeSubtitle(cfg.welcomeSubtitle);
    setChannel1Url(cfg.channel1Url);
    setChannel2Url(cfg.channel2Url);
    setMinWithdrawAmount(String(cfg.minWithdrawAmount));
    setSupportUsername(cfg.supportUsername);

    setReferBonusAmount(String(cfg.referBonusAmount));
    setReferMinAdsWatched(String(cfg.referMinAdsWatched ?? 0));
    setReferMinChannelsJoined(String(cfg.referMinChannelsJoined ?? 0));
    setReferMinTasksCompleted(String(cfg.referMinTasksCompleted ?? 0));
    setReferBonusType(cfg.referBonusType || 'after_activation');
    setMaxReferPerUser(String(cfg.maxReferPerUser ?? 0));
    setReferLinkFormat(cfg.referLinkFormat || DEFAULT_EARNMONEY_CONFIG.referLinkFormat);

    setPremiumAdsEnabled(cfg.premiumAdsEnabled !== false);
    setPremiumAdsBudget(String(cfg.premiumAdsBudget ?? 100));
    setPerAdViewReward(String(cfg.perAdViewReward ?? 0.01));
    setPerAdClickReward(String(cfg.perAdClickReward ?? 0.02));
    setDailyAdsLimitPerUser(String(cfg.dailyAdsLimitPerUser ?? 20));
    setAdsSlotPriceForAdvertiser(String(cfg.adsSlotPriceForAdvertiser ?? 5));
    setMonetagLink(cfg.monetagLink || DEFAULT_EARNMONEY_CONFIG.monetagLink);

    setMaintenanceMode(Boolean(cfg.maintenanceMode));
    setMaintenanceMessage(cfg.maintenanceMessage || DEFAULT_EARNMONEY_CONFIG.maintenanceMessage);
    setMaintenanceAdminId(cfg.maintenanceAdminId || '');

    setTasks(Array.isArray(cfg.tasks) ? cfg.tasks : []);
    broadcastLiveConfig(cfg);
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth/status', {
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
      });
      const data = (await res.json()) as AdminAuthStatus;
      setAuthStatus(data);
      if (adminToken && !data.authenticated) {
        onSetAdminToken(null);
      }
    } catch {
      setAuthStatus({ authenticated: false, needsClaim: false, envConfigured: false });
    }
  }, [adminToken, onSetAdminToken]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const fetchOverview = useCallback(async () => {
    if (!adminToken) return;
    setLoadingOverview(true);
    try {
      const res = await fetch('/api/admin/earnmoney/overview', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.status === 401) {
        onSetAdminToken(null);
        return;
      }
      if (!res.ok) throw new Error('Failed to load admin overview.');
      const data = (await res.json()) as AdminOverviewResponse;
      if (data.config) applyConfigToForm(data.config);
      if (data.stats) setStats(data.stats);
      if (Array.isArray(data.users)) setUsers(data.users);
      if (Array.isArray(data.withdrawals)) setWithdrawals(data.withdrawals);
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Unable to load dashboard.');
    } finally {
      setLoadingOverview(false);
    }
  }, [adminToken, applyConfigToForm, onSetAdminToken]);

  useEffect(() => {
    if (authStatus?.authenticated && adminToken) {
      void fetchOverview();
    }
  }, [authStatus?.authenticated, adminToken, fetchOverview]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setAuthError('Enter admin password.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: password }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setAuthError(data.error || 'Authentication failed.');
        return;
      }
      onSetAdminToken(data.token);
      setPassword('');
    } catch {
      setAuthError('Network error while authenticating.');
    } finally {
      setAuthLoading(false);
    }
  };

  // --- Shared Settings Persistence ---
  const saveConfigPayload = async (
    sectionKey: 'maintenance' | 'general' | 'refer' | 'ads',
    payload: Partial<EarnMoneyConfig>
  ) => {
    if (!adminToken) return;
    setSavingSection(sectionKey);
    if (sectionKey === 'maintenance') setMaintenanceSavedMsg(null);
    if (sectionKey === 'general') setGeneralSavedMsg(null);
    if (sectionKey === 'refer') setReferSavedMsg(null);
    if (sectionKey === 'ads') setAdsSavedMsg(null);

    try {
      const res = await fetch('/api/admin/earnmoney/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { config?: EarnMoneyConfig; error?: string };
      if (!res.ok || !data.config) {
        showToast('err', data.error || 'Failed to save settings.');
        return;
      }
      applyConfigToForm(data.config);
      if (sectionKey === 'maintenance') setMaintenanceSavedMsg('Saved Successfully');
      if (sectionKey === 'general') setGeneralSavedMsg('Saved Successfully');
      if (sectionKey === 'refer') setReferSavedMsg('Saved Successfully');
      if (sectionKey === 'ads') setAdsSavedMsg('Saved Successfully');
      showToast('ok', 'Saved Successfully');
    } catch {
      showToast('err', 'Network error while saving settings.');
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    void saveConfigPayload('maintenance', {
      maintenanceMode,
      maintenanceMessage: maintenanceMessage.trim(),
      maintenanceAdminId: maintenanceAdminId.trim(),
    });
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    void saveConfigPayload('general', {
      botName: botName.trim(),
      welcomeTitle: welcomeTitle.trim(),
      welcomeSubtitle: welcomeSubtitle.trim(),
      channel1Url: channel1Url.trim(),
      channel2Url: channel2Url.trim(),
      minWithdrawAmount: Number.parseFloat(minWithdrawAmount),
      supportUsername: supportUsername.trim(),
    });
  };

  const handleSaveRefer = (e: React.FormEvent) => {
    e.preventDefault();
    void saveConfigPayload('refer', {
      referBonusAmount: Number.parseFloat(referBonusAmount),
      referMinAdsWatched: Number.parseInt(referMinAdsWatched || '0', 10),
      referMinChannelsJoined: Number.parseInt(referMinChannelsJoined || '0', 10),
      referMinTasksCompleted: Number.parseInt(referMinTasksCompleted || '0', 10),
      referBonusType,
      maxReferPerUser: Number.parseInt(maxReferPerUser || '0', 10),
      referLinkFormat: referLinkFormat.trim(),
    });
  };

  const handleSaveAds = (e: React.FormEvent) => {
    e.preventDefault();
    void saveConfigPayload('ads', {
      premiumAdsEnabled,
      premiumAdsBudget: Number.parseFloat(premiumAdsBudget),
      perAdViewReward: Number.parseFloat(perAdViewReward),
      perAdClickReward: Number.parseFloat(perAdClickReward),
      dailyAdsLimitPerUser: Number.parseInt(dailyAdsLimitPerUser || '20', 10),
      adsSlotPriceForAdvertiser: Number.parseFloat(adsSlotPriceForAdvertiser),
      monetagLink: monetagLink.trim(),
    });
  };

  // --- Task Management Handlers ---
  const resetTaskForm = () => {
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskType('Daily');
    setTaskReward('0.20');
    setTaskUrl(channel1Url || 'https://t.me/waincomesite');
    setTaskActive(true);
  };

  const handleEditTaskClick = (task: BonusTaskItem) => {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskType(normalizeTaskType(task.taskType, task.badge));
    setTaskReward(String(task.rewardUsdt));
    setTaskUrl(task.url || '');
    setTaskActive(task.active !== false);
    setTaskSavedMsg(null);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setSavingTask(true);
    setTaskSavedMsg(null);
    try {
      const endpoint = editingTaskId
        ? `/api/admin/earnmoney/tasks/${editingTaskId}`
        : '/api/admin/earnmoney/tasks';
      const method = editingTaskId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          title: taskTitle.trim(),
          taskType,
          badge: taskType,
          rewardUsdt: Number.parseFloat(taskReward),
          url: taskUrl.trim(),
          active: taskActive,
        }),
      });
      const data = (await res.json()) as { config?: EarnMoneyConfig; error?: string };
      if (!res.ok || !data.config) {
        showToast('err', data.error || 'Failed to save task.');
        return;
      }
      applyConfigToForm(data.config);
      resetTaskForm();
      setTaskSavedMsg('Saved Successfully');
      showToast('ok', 'Saved Successfully');
      void fetchOverview();
    } catch {
      showToast('err', 'Network error while saving task.');
    } finally {
      setSavingTask(false);
    }
  };

  const handleToggleTask = async (task: BonusTaskItem) => {
    if (!adminToken) return;
    const nextActive = task.active === false;
    try {
      const res = await fetch(`/api/admin/earnmoney/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = (await res.json()) as { config?: EarnMoneyConfig; error?: string };
      if (!res.ok || !data.config) {
        showToast('err', data.error || 'Could not update task status.');
        return;
      }
      applyConfigToForm(data.config);
      showToast('ok', `Task ${nextActive ? 'enabled' : 'disabled'}.`);
      void fetchOverview();
    } catch {
      showToast('err', 'Network error updating task status.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/admin/earnmoney/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = (await res.json()) as { config?: EarnMoneyConfig; error?: string };
      if (!res.ok || !data.config) {
        showToast('err', data.error || 'Could not delete task.');
        return;
      }
      applyConfigToForm(data.config);
      if (editingTaskId === taskId) resetTaskForm();
      showToast('ok', 'Task deleted successfully.');
      void fetchOverview();
    } catch {
      showToast('err', 'Network error deleting task.');
    }
  };

  // --- User Management Handlers ---
  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.userId.toLowerCase().includes(q) || u.userName.toLowerCase().includes(q)
    );
  }, [userSearchQuery, users]);

  const handleAdjustBalance = async (uid: string, action: 'add' | 'cut') => {
    if (!adminToken) return;
    const rawVal = balanceInputs[uid] ?? '1.00';
    const amount = Number.parseFloat(rawVal);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('err', 'Enter a valid positive USDT amount.');
      return;
    }

    setBusyUserId(uid);
    try {
      const res = await fetch(`/api/admin/earnmoney/users/${encodeURIComponent(uid)}/balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ action, amount }),
      });
      const data = (await res.json()) as { user?: EarnMoneyState; error?: string };
      if (!res.ok || !data.user) {
        showToast('err', data.error || 'Balance update failed.');
        return;
      }
      setUsers((prev) => prev.map((u) => (u.userId === uid ? data.user! : u)));
      showToast(
        'ok',
        `${action === 'add' ? 'Added' : 'Deducted'} ${amount.toFixed(2)} USDT for user ${uid}.`
      );
      void fetchOverview();
    } catch {
      showToast('err', 'Network error updating user balance.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleToggleBlockUser = async (user: EarnMoneyState) => {
    if (!adminToken) return;
    const nextBlocked = !user.isBlocked;
    setBusyUserId(user.userId);
    try {
      const res = await fetch(
        `/api/admin/earnmoney/users/${encodeURIComponent(user.userId)}/block`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ isBlocked: nextBlocked }),
        }
      );
      const data = (await res.json()) as { user?: EarnMoneyState; error?: string };
      if (!res.ok || !data.user) {
        showToast('err', data.error || 'Failed to update block status.');
        return;
      }
      setUsers((prev) => prev.map((u) => (u.userId === user.userId ? data.user! : u)));
      showToast('ok', `User ${user.userId} ${nextBlocked ? 'blocked' : 'unblocked'}.`);
      void fetchOverview();
    } catch {
      showToast('err', 'Network error toggling block status.');
    } finally {
      setBusyUserId(null);
    }
  };

  // --- Withdraw Management Handlers ---
  const filteredWithdrawals = useMemo(() => {
    if (wdFilter === 'all') return withdrawals;
    return withdrawals.filter((w) => w.status === wdFilter);
  }, [wdFilter, withdrawals]);

  const handleDecideWithdrawal = async (
    record: AdminWithdrawalRecord,
    decision: 'approve' | 'reject'
  ) => {
    if (!adminToken) return;
    setBusyWdId(record.id);
    try {
      const res = await fetch(
        `/api/admin/earnmoney/withdrawals/${encodeURIComponent(record.userId)}/${encodeURIComponent(record.id)}/decide`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ decision }),
        }
      );
      const data = (await res.json()) as {
        overview?: AdminOverviewResponse;
        error?: string;
      };
      if (!res.ok) {
        showToast('err', data.error || 'Failed to process withdrawal.');
        return;
      }
      if (data.overview) {
        setStats(data.overview.stats);
        setUsers(data.overview.users);
        setWithdrawals(data.overview.withdrawals);
      } else {
        await fetchOverview();
      }
      showToast(
        'ok',
        decision === 'approve'
          ? `Approved ${record.amountUsdt.toFixed(2)} USDT withdrawal for ${record.userId}.`
          : `Rejected & refunded ${record.amountUsdt.toFixed(2)} USDT to ${record.userId}.`
      );
    } catch {
      showToast('err', 'Network error updating withdrawal.');
    } finally {
      setBusyWdId(null);
    }
  };

  // --- Render Auth Gate ---
  if (!authStatus || !authStatus.authenticated || !adminToken) {
    return (
      <div className="min-h-screen bg-[#070B09] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-emerald-500/20 bg-[#0E1512] p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                Earn Money Control
              </p>
              <h1 className="font-display text-xl font-bold text-white">Admin Login</h1>
            </div>
          </div>

          <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none text-sm text-white"
              />
            </div>

            {authError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 rounded-xl bg-[#00944A] hover:bg-[#00A854] disabled:opacity-50 font-bold text-sm text-white transition-all flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>Sign In to Admin Panel</span>
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
            <a href="/" className="hover:text-emerald-400 transition-colors">
              &larr; Back to Mini App
            </a>
            <span className="font-mono text-[11px] text-zinc-600">/admin</span>
          </div>
        </div>
      </div>
    );
  }

  const adsBudgetEmpty = !premiumAdsEnabled || Number.parseFloat(premiumAdsBudget || '0') <= 0;

  return (
    <div className="min-h-screen bg-[#070B09] text-zinc-100 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#0A100D]/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#00944A] flex items-center justify-center text-white shadow-lg shadow-emerald-950/50 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-bold text-white truncate">
                {botName || 'Earn Money'} — Admin Panel
              </h1>
              <p className="text-[11px] text-zinc-400 truncate">
                Live Database Configuration &amp; User Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void fetchOverview()}
              disabled={loadingOverview}
              className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOverview ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <a
              href="/"
              className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 text-xs font-semibold text-emerald-400"
            >
              Open Bot
            </a>
            <button
              type="button"
              onClick={() => onSetAdminToken(null)}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:text-red-400 text-zinc-400"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto max-w-6xl px-4 pb-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
            { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
            { id: 'tasks', label: `Tasks (${stats.totalTasks})`, icon: <ClipboardList className="w-4 h-4" /> },
            { id: 'users', label: `Users (${stats.totalUsers})`, icon: <Users className="w-4 h-4" /> },
            {
              id: 'withdrawals',
              label: `Withdraws (${stats.pendingWithdrawals})`,
              icon: <Wallet className="w-4 h-4" />,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[#00944A] text-white shadow-md shadow-emerald-950/50'
                  : 'bg-zinc-900/90 text-zinc-400 border border-zinc-800 hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Toast Banner */}
      {banner && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl text-xs font-bold ${
              banner.type === 'ok'
                ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/95 border-red-500/40 text-red-200'
            }`}
          >
            {banner.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 pt-6 space-y-6">
        {/* TOP SECTION: MAINTENANCE MODE (Always at Top of Admin Panel) */}
        <section
          className={`rounded-2xl border p-5 transition-colors ${
            maintenanceMode
              ? 'border-amber-500/50 bg-amber-950/15'
              : 'border-zinc-800/90 bg-[#0E1512]'
          }`}
        >
          <form onSubmit={handleSaveMaintenance} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    maintenanceMode
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-zinc-900 text-emerald-400 border border-zinc-800'
                  }`}
                >
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-white">Maintenance Mode</h2>
                  <p className="text-xs text-zinc-400">
                    When ON, only the configured Admin ID can enter the bot; all other users see Maintenance Message.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {maintenanceSavedMsg && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {maintenanceSavedMsg}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMaintenanceMode((prev) => !prev);
                    setMaintenanceSavedMsg(null);
                  }}
                  className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 border transition-all ${
                    maintenanceMode
                      ? 'bg-amber-500 text-black border-amber-400'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-emerald-500/40'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Maintenance Mode: {maintenanceMode ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label
                  htmlFor="admin-maintenance-msg"
                  className="block text-xs font-semibold text-zinc-300 mb-1.5"
                >
                  Maintenance Message
                </label>
                <input
                  id="admin-maintenance-msg"
                  type="text"
                  required
                  value={maintenanceMessage}
                  onChange={(e) => {
                    setMaintenanceMessage(e.target.value);
                    setMaintenanceSavedMsg(null);
                  }}
                  placeholder="Bot is under maintenance. New features coming soon. Please try again later."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none text-sm text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-maintenance-id"
                  className="block text-xs font-semibold text-zinc-300 mb-1.5"
                >
                  Admin User ID (Bypass)
                </label>
                <input
                  id="admin-maintenance-id"
                  type="text"
                  value={maintenanceAdminId}
                  onChange={(e) => {
                    setMaintenanceAdminId(e.target.value);
                    setMaintenanceSavedMsg(null);
                  }}
                  placeholder="e.g. 74920184"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingSection === 'maintenance'}
                className="px-5 py-2.5 rounded-xl bg-[#00944A] hover:bg-[#00A854] disabled:opacity-50 font-bold text-xs text-white flex items-center gap-2"
              >
                {savingSection === 'maintenance' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Maintenance Settings</span>
              </button>
            </div>
          </form>
        </section>

        {/* 1. DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <section className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-zinc-800/90 bg-[#0E1512] p-5">
                <p className="text-xs font-semibold text-zinc-400">Total Users</p>
                <p className="mt-2 font-display text-3xl font-extrabold text-white tabular-nums">
                  {stats.totalUsers}
                </p>
                <p className="mt-1 text-[11px] text-emerald-400">
                  {stats.activeUsers} Active &middot; {stats.blockedUsers} Blocked
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800/90 bg-[#0E1512] p-5">
                <p className="text-xs font-semibold text-zinc-400">Ads Slot Budget</p>
                <p className="mt-2 font-display text-3xl font-extrabold text-white tabular-nums">
                  {Number(premiumAdsBudget || 0).toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {adsBudgetEmpty ? 'Premium Ads Slot Empty' : 'USDT Remaining'}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800/90 bg-[#0E1512] p-5">
                <p className="text-xs font-semibold text-zinc-400">Pending Withdrawals</p>
                <p className="mt-2 font-display text-3xl font-extrabold text-amber-400 tabular-nums">
                  {stats.pendingWithdrawals}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">Awaiting Approval</p>
              </div>

              <div className="rounded-2xl border border-zinc-800/90 bg-[#0E1512] p-5">
                <p className="text-xs font-semibold text-zinc-400">Total Paid Out</p>
                <p className="mt-2 font-display text-3xl font-extrabold text-emerald-400 tabular-nums">
                  {stats.totalWithdrawAmount.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">USDT (BEP20)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-zinc-800/90 bg-[#0E1512] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-white">Active Config</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="text-xs font-bold text-emerald-400 hover:underline"
                  >
                    Edit Settings &rarr;
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-zinc-800/70">
                    <span className="text-zinc-400">Bot Name</span>
                    <span className="font-bold text-white">{botName}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-800/70">
                    <span className="text-zinc-400">Refer Bonus</span>
                    <span className="font-mono font-bold text-emerald-400">
                      +{Number(referBonusAmount || 0).toFixed(2)} USDT ({referBonusType})
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-800/70">
                    <span className="text-zinc-400">Per Ad View / Click</span>
                    <span className="font-mono font-bold text-emerald-400">
                      ${Number(perAdViewReward || 0).toFixed(4)} / $
                      {Number(perAdClickReward || 0).toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-zinc-400">Min Withdraw</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {Number(minWithdrawAmount || 0).toFixed(2)} USDT
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800/90 bg-[#0E1512] p-5 space-y-3">
                <h2 className="font-display text-base font-bold text-white">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 text-left"
                  >
                    <Settings className="w-4 h-4 text-emerald-400 mb-1.5" />
                    <p className="text-xs font-bold text-white">All Settings</p>
                    <p className="text-[11px] text-zinc-500">Refer, Ads &amp; General</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('tasks')}
                    className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 text-left"
                  >
                    <ClipboardList className="w-4 h-4 text-emerald-400 mb-1.5" />
                    <p className="text-xs font-bold text-white">Manage Tasks</p>
                    <p className="text-[11px] text-zinc-500">Add, Edit &amp; Toggle</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('users')}
                    className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 text-left"
                  >
                    <Users className="w-4 h-4 text-emerald-400 mb-1.5" />
                    <p className="text-xs font-bold text-white">Manage Users</p>
                    <p className="text-[11px] text-zinc-500">Balance &amp; Block</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('withdrawals')}
                    className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 text-left"
                  >
                    <Wallet className="w-4 h-4 text-emerald-400 mb-1.5" />
                    <p className="text-xs font-bold text-white">Withdrawals</p>
                    <p className="text-[11px] text-zinc-500">Approve or Reject</p>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 2. SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* A. REFER SYSTEM SETTINGS */}
            <section className="rounded-2xl border border-zinc-800/90 bg-[#0E1512] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-white">
                      Refer System Settings
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Configure referral bonus, activation rules (0 = no need), bonus type, limits &amp; link format.
                    </p>
                  </div>
                </div>
                {referSavedMsg && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs font-bold text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    {referSavedMsg}
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveRefer} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="admin-refer-bonus"
                      className="block text-xs font-semibold text-zinc-300 mb-1.5"
                    >
                      Refer Bonus Amount (USDT)
                    </label>
                    <input
                      id="admin-refer-bonus"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={referBonusAmount}
                      onChange={(e) => {
                        setReferBonusAmount(e.target.value);
                        setReferSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-refer-type"
                      className="block text-xs font-semibold text-zinc-300 mb-1.5"
                    >
                      Refer Bonus Type
                    </label>
                    <select
                      id="admin-refer-type"
                      value={referBonusType}
                      onChange={(e) => {
                        setReferBonusType(e.target.value as ReferBonusType);
                        setReferSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none text-sm text-white"
                    >
                      <option value="instant">Instant</option>
                      <option value="after_activation">After Activation Rule Complete</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-max-refer"
                      className="block text-xs font-semibold text-zinc-300 mb-1.5"
                    >
                      Max Refer Per User (0 = Unlimited)
                    </label>
                    <input
                      id="admin-max-refer"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={maxReferPerUser}
                      onChange={(e) => {
                        setMaxReferPerUser(e.target.value);
                        setReferSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                    />
                  </div>
                </div>

                {/* Refer Activation Rule Group */}
                <div className="rounded-xl border border-zinc-800 bg-[#070B09]/70 p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Refer Activation Rule (0 = No Need)
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="admin-min-ads-watched"
                        className="block text-xs font-semibold text-zinc-300 mb-1.5"
                      >
                        Min Ads Watched
                      </label>
                      <input
                        id="admin-min-ads-watched"
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={referMinAdsWatched}
                        onChange={(e) => {
                          setReferMinAdsWatched(e.target.value);
                          setReferSavedMsg(null);
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E1512] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="admin-min-channels-joined"
                        className="block text-xs font-semibold text-zinc-300 mb-1.5"
                      >
                        Min Channels Joined
                      </label>
                      <input
                        id="admin-min-channels-joined"
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={referMinChannelsJoined}
                        onChange={(e) => {
                          setReferMinChannelsJoined(e.target.value);
                          setReferSavedMsg(null);
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E1512] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="admin-min-tasks-completed"
                        className="block text-xs font-semibold text-zinc-300 mb-1.5"
                      >
                        Min Tasks Completed
                      </label>
                      <input
                        id="admin-min-tasks-completed"
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={referMinTasksCompleted}
                        onChange={(e) => {
                          setReferMinTasksCompleted(e.target.value);
                          setReferSavedMsg(null);
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E1512] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="admin-refer-link-format"
                    className="block text-xs font-semibold text-zinc-300 mb-1.5"
                  >
                    Refer Link Format
                  </label>
                  <input
                    id="admin-refer-link-format"
                    type="text"
                    required
                    value={referLinkFormat}
                    onChange={(e) => {
                      setReferLinkFormat(e.target.value);
                      setReferSavedMsg(null);
                    }}
                    placeholder="https://t.me/moneyxearnbot?start=ref_[USER_ID]"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={savingSection === 'refer'}
                    className="px-6 py-3 rounded-xl bg-[#00944A] hover:bg-[#00A854] disabled:opacity-50 font-bold text-sm text-white flex items-center gap-2"
                  >
                    {savingSection === 'refer' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Save Refer Settings</span>
                  </button>
                  {referSavedMsg && (
                    <span className="text-sm font-bold text-emerald-400">{referSavedMsg}</span>
                  )}
                </div>
              </form>
            </section>

            {/* B. PREMIUM ADS SLOT SETTINGS */}
            <section className="rounded-2xl border border-zinc-800/90 bg-[#0E1512] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <PlayCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-lg font-bold text-white">
                        Premium Ads Slot
                      </h2>
                      {adsBudgetEmpty && (
                        <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 text-[10px] font-bold">
                          SLOT EMPTY
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">
                      Control Ads ON/OFF, total ads budget, view/click rewards, daily limits, and advertiser slot price.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {adsSavedMsg && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs font-bold text-emerald-300">
                      <CheckCircle2 className="w-4 h-4" />
                      {adsSavedMsg}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPremiumAdsEnabled((prev) => !prev);
                      setAdsSavedMsg(null);
                    }}
                    className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 border transition-all ${
                      premiumAdsEnabled
                        ? 'bg-[#00944A] text-white border-emerald-400'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Premium Ads Slot: {premiumAdsEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveAds} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="admin-ads-budget"
                      className="block text-xs font-semibold text-zinc-300 mb-1.5"
                    >
                      Total Ads Budget / Balance (USDT)
                    </label>
                    <input
                      id="admin-ads-budget"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={premiumAdsBudget}
                      onChange={(e) => {
                        setPremiumAdsBudget(e.target.value);
                        setAdsSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-per-ad-view"
                      className="block text-xs font-semibold text-zinc-300 mb-1.5"
                    >
                      Per Ad View Reward (USDT)
                    </label>
                    <input
                      id="admin-per-ad-view"
                      type="number"
                      step="0.0001"
                      min="0"
                      required
                      value={perAdViewReward}
                      onChange={(e) => {
                        setPerAdViewReward(e.target.value);
                        setAdsSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-per-ad-click"
                      className="block text-xs font-semibold text-zinc-300 mb-1.5"
                    >
                      Per Ad Click Reward (USDT)
                    </label>
                    <input
                      id="admin-per-ad-click"
                      type="number"
                      step="0.0001"
                      min="0"
                      required
                      value={perAdClickReward}
                      onChange={(e) => {
                        setPerAdClickReward(e.target.value);
                        setAdsSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-daily-ads-limit"
                      className="block text-xs font-semibold text-zinc-300 mb-1.5"
                    >
                      Daily Ads Limit Per User
                    </label>
                    <input
                      id="admin-daily-ads-limit"
                      type="number"
                      step="1"
                      min="1"
                      required
                      value={dailyAdsLimitPerUser}
                      onChange={(e) => {
                        setDailyAdsLimitPerUser(e.target.value);
                        setAdsSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-slot-price"
                      className="block text-xs font-semibold text-zinc-300 mb-1.5"
                    >
                      Ads Slot Price for Advertiser (USDT)
                    </label>
                    <input
                      id="admin-slot-price"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={adsSlotPriceForAdvertiser}
                      onChange={(e) => {
                        setAdsSlotPriceForAdvertiser(e.target.value);
                        setAdsSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label
                      htmlFor="admin-monetag-link"
                      className="block text-xs font-semibold text-zinc-300 mb-1.5"
                    >
                      Monetag Link / Zone Code
                    </label>
                    <input
                      id="admin-monetag-link"
                      type="text"
                      required
                      value={monetagLink}
                      onChange={(e) => {
                        setMonetagLink(e.target.value);
                        setAdsSavedMsg(null);
                      }}
                      placeholder="<script src='//libtl.com/sdk.js' data-zone='12118221' data-sdk='show_12118221'></script> or https://..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-xs text-white"
                    />
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Paste your Monetag SDK script tag, Zone ID, or Direct Ad URL. Updates live for all ad slots.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={savingSection === 'ads'}
                    className="px-6 py-3 rounded-xl bg-[#00944A] hover:bg-[#00A854] disabled:opacity-50 font-bold text-sm text-white flex items-center gap-2"
                  >
                    {savingSection === 'ads' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Save Premium Ads Settings</span>
                  </button>
                  {adsSavedMsg && (
                    <span className="text-sm font-bold text-emerald-400">{adsSavedMsg}</span>
                  )}
                </div>
              </form>
            </section>

            {/* C. GENERAL BOT & MINI APP SETTINGS */}
            <section className="rounded-2xl border border-zinc-800/90 bg-[#0E1512] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    General Bot &amp; Mini App Settings
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Welcome texts, official channels, minimum withdrawal, and support handle.
                  </p>
                </div>
                {generalSavedMsg && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs font-bold text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    {generalSavedMsg}
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveGeneral} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="admin-bot-name"
                      className="block text-xs font-semibold text-zinc-300 mb-1.5"
                    >
                      Bot Name
                    </label>
                    <input
                      id="admin-bot-name"
                      type="text"
                      required
                      value={botName}
                      onChange={(e) => {
                        setBotName(e.target.value);
                        setGeneralSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none text-sm text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-support-username"
                      className="block text-xs font-semibold text-zinc-300 mb-1.5"
                    >
                      Support Username
                    </label>
                    <input
                      id="admin-support-username"
                      type="text"
                      required
                      value={supportUsername}
                      onChange={(e) => {
                        setSupportUsername(e.target.value);
                        setGeneralSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-welcome-title"
                      className="block text-xs font-semibold text-zinc-300 mb-1.5"
                    >
                      Welcome Title
                    </label>
                    <input
                      id="admin-welcome-title"
                      type="text"
                      required
                      value={welcomeTitle}
                      onChange={(e) => {
                        setWelcomeTitle(e.target.value);
                        setGeneralSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none text-sm text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-welcome-subtitle"
                      className="block text-xs font-semibold text-zinc-300 mb-1.5"
                    >
                      Welcome Subtitle
                    </label>
                    <input
                      id="admin-welcome-subtitle"
                      type="text"
                      required
                      value={welcomeSubtitle}
                      onChange={(e) => {
                        setWelcomeSubtitle(e.target.value);
                        setGeneralSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none text-sm text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-channel1-url"
                      className="block text-xs font-semibold text-zinc-300 mb-1.5"
                    >
                      Channel 1 Link
                    </label>
                    <input
                      id="admin-channel1-url"
                      type="url"
                      required
                      value={channel1Url}
                      onChange={(e) => {
                        setChannel1Url(e.target.value);
                        setGeneralSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-channel2-url"
                      className="block text-xs font-semibold text-zinc-300 mb-1.5"
                    >
                      Channel 2 Link
                    </label>
                    <input
                      id="admin-channel2-url"
                      type="url"
                      required
                      value={channel2Url}
                      onChange={(e) => {
                        setChannel2Url(e.target.value);
                        setGeneralSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-min-withdraw"
                      className="block text-xs font-semibold text-zinc-300 mb-1.5"
                    >
                      Min Withdraw Amount (USDT)
                    </label>
                    <input
                      id="admin-min-withdraw"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={minWithdrawAmount}
                      onChange={(e) => {
                        setMinWithdrawAmount(e.target.value);
                        setGeneralSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={savingSection === 'general'}
                    className="px-6 py-3 rounded-xl bg-[#00944A] hover:bg-[#00A854] disabled:opacity-50 font-bold text-sm text-white flex items-center gap-2 transition-all"
                  >
                    {savingSection === 'general' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Save Settings</span>
                  </button>

                  {generalSavedMsg && (
                    <span className="text-sm font-bold text-emerald-400">{generalSavedMsg}</span>
                  )}
                </div>
              </form>
            </section>
          </div>
        )}

        {/* 3. TASK MANAGEMENT TAB */}
        {activeTab === 'tasks' && (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            <div className="rounded-2xl border border-zinc-800/90 bg-[#0E1512] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-white">
                  {editingTaskId ? 'Edit Task' : 'Add New Task'}
                </h2>
                {editingTaskId && (
                  <button
                    type="button"
                    onClick={resetTaskForm}
                    className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                )}
              </div>

              <form onSubmit={(e) => void handleSaveTask(e)} className="space-y-3">
                <div>
                  <label
                    htmlFor="admin-task-title"
                    className="block text-xs font-semibold text-zinc-400 mb-1"
                  >
                    Task Title
                  </label>
                  <input
                    id="admin-task-title"
                    type="text"
                    required
                    value={taskTitle}
                    onChange={(e) => {
                      setTaskTitle(e.target.value);
                      setTaskSavedMsg(null);
                    }}
                    placeholder="e.g., Join Official Channel"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none text-sm text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="admin-task-type"
                      className="block text-xs font-semibold text-zinc-400 mb-1"
                    >
                      Task Type
                    </label>
                    <select
                      id="admin-task-type"
                      value={taskType}
                      onChange={(e) => {
                        setTaskType(e.target.value as TaskType);
                        setTaskSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none text-sm text-white"
                    >
                      {TASK_TYPES.map((tType) => (
                        <option key={tType} value={tType}>
                          {tType}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="admin-task-reward"
                      className="block text-xs font-semibold text-zinc-400 mb-1"
                    >
                      Reward (USDT)
                    </label>
                    <input
                      id="admin-task-reward"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={taskReward}
                      onChange={(e) => {
                        setTaskReward(e.target.value);
                        setTaskSavedMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-sm text-white"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="admin-task-url"
                    className="block text-xs font-semibold text-zinc-400 mb-1"
                  >
                    Target Link URL
                  </label>
                  <input
                    id="admin-task-url"
                    type="url"
                    required
                    value={taskUrl}
                    onChange={(e) => {
                      setTaskUrl(e.target.value);
                      setTaskSavedMsg(null);
                    }}
                    placeholder="https://t.me/..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-xs text-white"
                  />
                </div>

                <label className="flex items-center justify-between rounded-xl bg-[#070B09] border border-zinc-800 px-3.5 py-2.5 cursor-pointer">
                  <span className="text-xs font-semibold text-zinc-300">Task Status (On/Off)</span>
                  <input
                    type="checkbox"
                    checked={taskActive}
                    onChange={(e) => {
                      setTaskActive(e.target.checked);
                      setTaskSavedMsg(null);
                    }}
                    className="h-4 w-4 accent-[#00944A]"
                  />
                </label>

                <button
                  type="submit"
                  disabled={savingTask}
                  className="w-full py-3 rounded-xl bg-[#00944A] hover:bg-[#00A854] disabled:opacity-50 font-bold text-sm text-white flex items-center justify-center gap-2"
                >
                  {savingTask ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>{editingTaskId ? 'Update Task' : 'Add New Task'}</span>
                </button>

                {taskSavedMsg && (
                  <div className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-3 py-2 text-xs font-bold text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{taskSavedMsg}</span>
                  </div>
                )}
              </form>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-display text-base font-bold text-white">
                  All Tasks ({tasks.length})
                </h2>
                <span className="text-xs text-zinc-400">
                  Changes sync immediately to User Task Center
                </span>
              </div>

              {tasks.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-[#0E1512] p-8 text-center text-sm text-zinc-500">
                  No tasks configured yet. Add one using the form.
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => {
                    const isOn = task.active !== false;
                    const displayType = normalizeTaskType(task.taskType, task.badge);
                    return (
                      <div
                        key={task.id}
                        className="rounded-2xl border border-zinc-800/90 bg-[#0E1512] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-display text-sm font-bold text-white truncate">
                              {task.title}
                            </p>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                              {displayType}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                isOn
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {isOn ? 'ON' : 'OFF'}
                            </span>
                          </div>
                          <p className="font-mono text-xs font-bold text-emerald-400">
                            +{task.rewardUsdt.toFixed(2)} USDT
                          </p>
                          {task.url && (
                            <p className="font-mono text-[11px] text-zinc-500 truncate">
                              {task.url}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleToggleTask(task)}
                            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                              isOn
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{isOn ? 'ON' : 'OFF'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditTaskClick(task)}
                            className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-xs font-bold text-zinc-200 flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteTask(task.id)}
                            className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-xs font-bold text-red-300 flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* 4. USER MANAGEMENT TAB */}
        {activeTab === 'users' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-zinc-800/90 bg-[#0E1512] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search User by ID or Name..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none text-sm text-white"
                />
              </div>
              <div className="text-xs font-semibold text-zinc-400">
                Showing <span className="text-white font-bold">{filteredUsers.length}</span> of{' '}
                {users.length} users
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-[#0E1512] p-10 text-center text-sm text-zinc-500">
                No matching users found in database yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredUsers.map((user) => {
                  const isBusy = busyUserId === user.userId;
                  const amtInput = balanceInputs[user.userId] ?? '1.00';
                  return (
                    <div
                      key={user.userId}
                      className={`rounded-2xl border p-4 space-y-4 ${
                        user.isBlocked
                          ? 'border-red-500/40 bg-red-950/10'
                          : 'border-zinc-800/90 bg-[#0E1512]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-display text-base font-bold text-white truncate">
                              {user.userName}
                            </p>
                            {user.isBlocked && (
                              <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 text-[10px] font-bold">
                                BLOCKED
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-xs text-zinc-400 mt-0.5">
                            ID: {user.userId}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleToggleBlockUser(user)}
                          className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 ${
                            user.isBlocked
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                              : 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20'
                          }`}
                        >
                          {user.isBlocked ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Unblock</span>
                            </>
                          ) : (
                            <>
                              <Ban className="w-3.5 h-3.5" />
                              <span>Block</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#070B09] border border-zinc-800/80 p-3 text-xs">
                        <div>
                          <p className="text-[10px] text-zinc-500">Balance</p>
                          <p className="font-mono font-bold text-emerald-400 tabular-nums">
                            {user.totalBalance.toFixed(2)} USDT
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500">Total Income</p>
                          <p className="font-mono font-bold text-white tabular-nums">
                            {user.totalIncome.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500">Withdrawn</p>
                          <p className="font-mono font-bold text-zinc-300 tabular-nums">
                            {user.totalWithdraw.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Coins className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={amtInput}
                            onChange={(e) =>
                              setBalanceInputs((prev) => ({
                                ...prev,
                                [user.userId]: e.target.value,
                              }))
                            }
                            aria-label={`Balance adjustment amount for ${user.userId}`}
                            className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#070B09] border border-zinc-800 focus:border-emerald-500 outline-none font-mono text-xs font-bold text-white"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleAdjustBalance(user.userId, 'add')}
                          className="px-3.5 py-2 rounded-xl bg-[#00944A] hover:bg-[#00A854] text-xs font-bold text-white whitespace-nowrap"
                        >
                          + Add Balance
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleAdjustBalance(user.userId, 'cut')}
                          className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-xs font-bold text-amber-300 whitespace-nowrap"
                        >
                          - Cut Balance
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 5. WITHDRAW MANAGEMENT TAB */}
        {activeTab === 'withdrawals' && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold text-white">
                Withdrawal Requests ({filteredWithdrawals.length})
              </h2>

              <div className="flex items-center gap-2">
                {(['all', 'Pending', 'Completed', 'Rejected'] as const).map((statusKey) => (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => setWdFilter(statusKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize ${
                      wdFilter === statusKey
                        ? 'bg-[#00944A] text-white'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {statusKey}
                  </button>
                ))}
              </div>
            </div>

            {filteredWithdrawals.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-[#0E1512] p-10 text-center text-sm text-zinc-500">
                No withdrawal requests found for this filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredWithdrawals.map((wd) => {
                  const isBusy = busyWdId === wd.id;
                  return (
                    <div
                      key={wd.id}
                      className="rounded-2xl border border-zinc-800/90 bg-[#0E1512] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-base font-extrabold text-emerald-400 tabular-nums">
                            {wd.amountUsdt.toFixed(2)} USDT
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              wd.status === 'Pending'
                                ? 'bg-amber-500/20 text-amber-300'
                                : wd.status === 'Completed'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {wd.status}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-white">
                          {wd.userName}{' '}
                          <span className="font-mono text-zinc-400">(ID: {wd.userId})</span>
                        </p>
                        <p className="font-mono text-[11px] text-zinc-400">
                          BEP20: {wd.address} &middot; {wd.date}
                        </p>
                      </div>

                      {wd.status === 'Pending' ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDecideWithdrawal(wd, 'approve')}
                            className="px-4 py-2.5 rounded-xl bg-[#00944A] hover:bg-[#00A854] disabled:opacity-50 text-xs font-bold text-white flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDecideWithdrawal(wd, 'reject')}
                            className="px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/35 hover:bg-red-500/25 disabled:opacity-50 text-xs font-bold text-red-300 flex items-center gap-1.5"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-mono text-zinc-500 shrink-0">
                          Processed ({wd.status})
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};
