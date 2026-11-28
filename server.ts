import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import type {
  ChannelItem,
  DashboardStats,
  MiniAppSettings,
  VideoItem,
  VideoStatus,
} from './src/types.ts';
import {
  DEFAULT_MONETAG_LINK,
  isTaskCompletedForUser,
  normalizeTaskType,
} from './src/data/defaultEarnMoneyState.ts';
import type {
  AdminWithdrawalRecord,
  AdSlotClaimRecord,
  BonusTaskItem,
  DatabaseConnectionStatus,
  EarnMoneyConfig,
  EarnMoneyState,
  TaskType,
} from './src/types/earnMoney.ts';
import {
  checkSupabaseConnection,
  deleteTaskFromSupabase,
  insertTaskToSupabase,
  insertWithdrawToSupabase,
  loadConfigFromSupabase,
  loadUsersAndClaimsFromSupabase,
  saveConfigToSupabase,
  updateTaskInSupabase,
  updateWithdrawStatusInSupabase,
  upsertAdSlotClaimToSupabase,
  upsertUserToSupabase,
} from './lib/supabaseDb.ts';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const STORE_PATH = path.resolve(DATA_DIR, 'cinevault_store.json');
const EARNMONEY_PATH = path.resolve(DATA_DIR, 'earnmoney_users.json');
const EARNMONEY_CONFIG_PATH = path.resolve(DATA_DIR, 'earnmoney_config.json');
const EARNMONEY_AD_SLOTS_PATH = path.resolve(DATA_DIR, 'earnmoney_ad_slots.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const SERVER_SIGNING_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

interface StoreSchema {
  channels: ChannelItem[];
  videos: VideoItem[];
  users: string[];
  settings: MiniAppSettings;
  adminCredentialHash?: string;
}

const DEFAULT_STORE: StoreSchema = {
  channels: [
    {
      id: 'ch_premiumapps',
      name: 'Premium Apps',
      handle: '@premiumapps5462',
      members: '',
      url: 'https://t.me/premiumapps5462',
    },
    {
      id: 'ch_waincome',
      name: 'WA Income Site',
      handle: '@waincomesite',
      members: '',
      url: 'https://t.me/waincomesite',
    },
  ],
  videos: [
    {
      id: 'vid_tokyo_rain',
      title: 'Midnight Neon: Tokyo Rain',
      category: 'English',
      quality: '4K HDR',
      duration: '08:42',
      posterUrl: '/src/assets/images/thumb_tokyo_rain_1795435877207.jpg',
      videoUrl: 'demo://tokyo-rain',
      views: 1842,
      downloads: 420,
      status: 'active',
      createdAt: '2026-11-20T14:20:00.000Z',
    },
    {
      id: 'vid_alpine_dawn',
      title: 'Dolomites: Edge of Dawn',
      category: 'English',
      quality: '4K UHD',
      duration: '12:15',
      posterUrl: '/src/assets/images/thumb_alpine_dawn_1795435874924.jpg',
      videoUrl: 'demo://alpine-dawn',
      views: 1290,
      downloads: 318,
      status: 'active',
      createdAt: '2026-11-21T09:10:00.000Z',
    },
    {
      id: 'vid_analog_studio',
      title: 'Analog Echo: Studio Noir',
      category: 'Hindi',
      quality: '1080p',
      duration: '14:30',
      posterUrl: '/src/assets/images/thumb_analog_studio_1795435876576.jpg',
      videoUrl: 'demo://analog-studio',
      views: 964,
      downloads: 215,
      status: 'active',
      createdAt: '2026-11-22T18:45:00.000Z',
    },
    {
      id: 'vid_night_circuit',
      title: 'Night Circuit: Apex GT3',
      category: 'Bangla',
      quality: '4K 60fps',
      duration: '09:54',
      posterUrl: '/src/assets/images/thumb_night_circuit_1795435876007.jpg',
      videoUrl: 'demo://night-circuit',
      views: 2105,
      downloads: 540,
      status: 'active',
      createdAt: '2026-11-23T21:00:00.000Z',
    },
  ],
  users: [],
  settings: {
    watchAdsRequired: 1,
    watchAdTimerSeconds: 15,
    downloadAdsRequired: 2,
    downloadAdTimerSeconds: 15,
    forceJoinEnabled: true,
    monetagZoneId: '12118221',
  },
};

function loadStore(): StoreSchema {
  if (!fs.existsSync(STORE_PATH)) {
    saveStore(DEFAULT_STORE);
    return structuredClone(DEFAULT_STORE);
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoreSchema> & {
      settings?: Partial<MiniAppSettings>;
    };
    const legacyIds = new Set(['ch_main', 'ch_nightreel', 'ch_vault']);
    const hasLegacyOrEmptyChannels =
      !Array.isArray(parsed.channels) ||
      parsed.channels.length === 0 ||
      parsed.channels.some((c) => legacyIds.has(c.id));

    const migratedChannels = hasLegacyOrEmptyChannels
      ? structuredClone(DEFAULT_STORE.channels)
      : parsed.channels!;

    const rawVideos = Array.isArray(parsed.videos)
      ? parsed.videos
      : structuredClone(DEFAULT_STORE.videos);
    let videosMigrated = false;
    const migratedVideos: VideoItem[] = rawVideos.map((v) => {
      if (!v.category) {
        videosMigrated = true;
        return { ...v, category: 'English' };
      }
      return v;
    });

    const needsSettingsMigration =
      !parsed.settings ||
      typeof parsed.settings.watchAdTimerSeconds !== 'number' ||
      typeof parsed.settings.downloadAdTimerSeconds !== 'number' ||
      typeof parsed.settings.forceJoinEnabled !== 'boolean';

    const migratedSettings: MiniAppSettings = needsSettingsMigration
      ? {
          watchAdsRequired: 1,
          watchAdTimerSeconds: 15,
          downloadAdsRequired: 2,
          downloadAdTimerSeconds: 15,
          forceJoinEnabled: true,
          monetagZoneId:
            typeof parsed.settings?.monetagZoneId === 'string' && parsed.settings.monetagZoneId
              ? parsed.settings.monetagZoneId
              : '12118221',
        }
      : {
          watchAdsRequired:
            typeof parsed.settings!.watchAdsRequired === 'number' &&
            parsed.settings!.watchAdsRequired >= 0
              ? parsed.settings!.watchAdsRequired
              : 1,
          watchAdTimerSeconds:
            typeof parsed.settings!.watchAdTimerSeconds === 'number' &&
            parsed.settings!.watchAdTimerSeconds >= 0
              ? parsed.settings!.watchAdTimerSeconds
              : 15,
          downloadAdsRequired:
            typeof parsed.settings!.downloadAdsRequired === 'number' &&
            parsed.settings!.downloadAdsRequired >= 0
              ? parsed.settings!.downloadAdsRequired
              : 2,
          downloadAdTimerSeconds:
            typeof parsed.settings!.downloadAdTimerSeconds === 'number' &&
            parsed.settings!.downloadAdTimerSeconds >= 0
              ? parsed.settings!.downloadAdTimerSeconds
              : 15,
          forceJoinEnabled: Boolean(parsed.settings!.forceJoinEnabled),
          monetagZoneId:
            typeof parsed.settings!.monetagZoneId === 'string'
              ? parsed.settings!.monetagZoneId
              : '12118221',
        };

    const loaded: StoreSchema = {
      channels: migratedChannels,
      videos: migratedVideos,
      users: Array.isArray(parsed.users) ? parsed.users : [],
      settings: migratedSettings,
      adminCredentialHash:
        typeof parsed.adminCredentialHash === 'string' ? parsed.adminCredentialHash : undefined,
    };

    if (hasLegacyOrEmptyChannels || videosMigrated || needsSettingsMigration) {
      saveStore(loaded);
    }

    return loaded;
  } catch {
    return structuredClone(DEFAULT_STORE);
  }
}

function saveStore(store: StoreSchema): void {
  const tempPath = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tempPath, STORE_PATH);
}

let store: StoreSchema = loadStore();

const DEFAULT_EARNMONEY_CONFIG: EarnMoneyConfig = {
  botName: 'Earn Money',
  welcomeTitle: 'Welcome to Earn Money',
  welcomeSubtitle: 'Join our 2 official channels to stay updated.',
  channel1Url: 'https://t.me/waincomesite',
  channel2Url: 'https://t.me/premiumapps5462',
  minWithdrawAmount: 1,
  maxWithdrawAmount: 100,
  withdrawRequiredAds: 10,
  withdrawFeePercent: 0,
  supportUsername: '@waincomesite',

  referBonusAmount: 0.1,
  referMinAdsWatched: 0,
  referMinChannelsJoined: 0,
  referMinTasksCompleted: 0,
  referBonusType: 'after_activation',
  maxReferPerUser: 0,
  referLinkFormat: 'https://t.me/moneyxearnbot?start=ref_[USER_ID]',

  premiumAdsEnabled: true,
  premiumAdsBudget: 100,
  perAdViewReward: 0.01,
  perAdClickReward: 0.02,
  dailyAdsLimitPerUser: 100,
  adsSlotPriceForAdvertiser: 5,
  monetagLink: DEFAULT_MONETAG_LINK,

  maintenanceMode: false,
  maintenanceMessage:
    'Bot is under maintenance. New features coming soon. Please try again later.',
  maintenanceAdminId: '',

  tasks: [],
  updatedAt: new Date().toISOString(),
};

function loadEarnMoneyConfig(): EarnMoneyConfig {
  if (!fs.existsSync(EARNMONEY_CONFIG_PATH)) {
    saveEarnMoneyConfig(DEFAULT_EARNMONEY_CONFIG);
    return structuredClone(DEFAULT_EARNMONEY_CONFIG);
  }
  try {
    const raw = fs.readFileSync(EARNMONEY_CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<EarnMoneyConfig>;
    const tasks: BonusTaskItem[] = Array.isArray(parsed.tasks)
      ? parsed.tasks
          .filter((t) => Boolean(t))
          .map((t) => {
            const taskType: TaskType = normalizeTaskType(t.taskType, t.badge);
            return {
              id: String(t.id || `task_${crypto.randomBytes(4).toString('hex')}`),
              title: String(t.title || 'Task').slice(0, 80),
              taskType,
              badge: taskType,
              rewardUsdt: Number.isFinite(Number(t.rewardUsdt)) ? Number(t.rewardUsdt) : 0.1,
              url: typeof t.url === 'string' ? t.url : 'https://t.me/waincomesite',
              completed: false,
              active: t.active !== false,
              createdBy: 'admin',
            };
          })
      : [];

    const numOr = (val: unknown, fallback: number, min = 0) =>
      typeof val === 'number' && Number.isFinite(val) && val >= min ? val : fallback;

    return {
      botName:
        typeof parsed.botName === 'string' && parsed.botName.trim()
          ? parsed.botName.trim()
          : DEFAULT_EARNMONEY_CONFIG.botName,
      welcomeTitle:
        typeof parsed.welcomeTitle === 'string' && parsed.welcomeTitle.trim()
          ? parsed.welcomeTitle.trim()
          : DEFAULT_EARNMONEY_CONFIG.welcomeTitle,
      welcomeSubtitle:
        typeof parsed.welcomeSubtitle === 'string' && parsed.welcomeSubtitle.trim()
          ? parsed.welcomeSubtitle.trim()
          : DEFAULT_EARNMONEY_CONFIG.welcomeSubtitle,
      channel1Url:
        typeof parsed.channel1Url === 'string' && parsed.channel1Url.trim()
          ? parsed.channel1Url.trim()
          : DEFAULT_EARNMONEY_CONFIG.channel1Url,
      channel2Url:
        typeof parsed.channel2Url === 'string' && parsed.channel2Url.trim()
          ? parsed.channel2Url.trim()
          : DEFAULT_EARNMONEY_CONFIG.channel2Url,
      minWithdrawAmount: numOr(parsed.minWithdrawAmount, DEFAULT_EARNMONEY_CONFIG.minWithdrawAmount),
      maxWithdrawAmount: numOr(parsed.maxWithdrawAmount, DEFAULT_EARNMONEY_CONFIG.maxWithdrawAmount),
      withdrawRequiredAds: Math.floor(
        numOr(parsed.withdrawRequiredAds, DEFAULT_EARNMONEY_CONFIG.withdrawRequiredAds)
      ),
      withdrawFeePercent: Math.min(
        100,
        numOr(parsed.withdrawFeePercent, DEFAULT_EARNMONEY_CONFIG.withdrawFeePercent)
      ),
      supportUsername:
        typeof parsed.supportUsername === 'string' && parsed.supportUsername.trim()
          ? parsed.supportUsername.trim()
          : DEFAULT_EARNMONEY_CONFIG.supportUsername,

      referBonusAmount: numOr(parsed.referBonusAmount, DEFAULT_EARNMONEY_CONFIG.referBonusAmount),
      referMinAdsWatched: Math.floor(
        numOr(parsed.referMinAdsWatched, DEFAULT_EARNMONEY_CONFIG.referMinAdsWatched)
      ),
      referMinChannelsJoined: Math.floor(
        numOr(parsed.referMinChannelsJoined, DEFAULT_EARNMONEY_CONFIG.referMinChannelsJoined)
      ),
      referMinTasksCompleted: Math.floor(
        numOr(parsed.referMinTasksCompleted, DEFAULT_EARNMONEY_CONFIG.referMinTasksCompleted)
      ),
      referBonusType:
        parsed.referBonusType === 'instant' || parsed.referBonusType === 'after_activation'
          ? parsed.referBonusType
          : DEFAULT_EARNMONEY_CONFIG.referBonusType,
      maxReferPerUser: Math.floor(
        numOr(parsed.maxReferPerUser, DEFAULT_EARNMONEY_CONFIG.maxReferPerUser)
      ),
      referLinkFormat:
        typeof parsed.referLinkFormat === 'string' && parsed.referLinkFormat.trim()
          ? parsed.referLinkFormat.trim()
          : DEFAULT_EARNMONEY_CONFIG.referLinkFormat,

      premiumAdsEnabled:
        typeof parsed.premiumAdsEnabled === 'boolean'
          ? parsed.premiumAdsEnabled
          : DEFAULT_EARNMONEY_CONFIG.premiumAdsEnabled,
      premiumAdsBudget: numOr(parsed.premiumAdsBudget, DEFAULT_EARNMONEY_CONFIG.premiumAdsBudget),
      perAdViewReward: numOr(parsed.perAdViewReward, DEFAULT_EARNMONEY_CONFIG.perAdViewReward),
      perAdClickReward: numOr(parsed.perAdClickReward, DEFAULT_EARNMONEY_CONFIG.perAdClickReward),
      dailyAdsLimitPerUser: Math.max(
        1,
        Math.floor(numOr(parsed.dailyAdsLimitPerUser, DEFAULT_EARNMONEY_CONFIG.dailyAdsLimitPerUser, 1))
      ),
      adsSlotPriceForAdvertiser: numOr(
        parsed.adsSlotPriceForAdvertiser,
        DEFAULT_EARNMONEY_CONFIG.adsSlotPriceForAdvertiser
      ),
      monetagLink:
        typeof parsed.monetagLink === 'string' && parsed.monetagLink.trim()
          ? parsed.monetagLink.trim()
          : DEFAULT_EARNMONEY_CONFIG.monetagLink,

      maintenanceMode: Boolean(parsed.maintenanceMode),
      maintenanceMessage:
        typeof parsed.maintenanceMessage === 'string' && parsed.maintenanceMessage.trim()
          ? parsed.maintenanceMessage.trim()
          : DEFAULT_EARNMONEY_CONFIG.maintenanceMessage,
      maintenanceAdminId:
        typeof parsed.maintenanceAdminId === 'string'
          ? parsed.maintenanceAdminId.trim()
          : DEFAULT_EARNMONEY_CONFIG.maintenanceAdminId,

      tasks,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return structuredClone(DEFAULT_EARNMONEY_CONFIG);
  }
}

function saveEarnMoneyConfig(config: EarnMoneyConfig): void {
  const tempPath = `${EARNMONEY_CONFIG_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2), 'utf-8');
  fs.renameSync(tempPath, EARNMONEY_CONFIG_PATH);
}

let earnMoneyConfig: EarnMoneyConfig = loadEarnMoneyConfig();

type ServerEarnMoneyState = EarnMoneyState & {
  telegramPhotoFileId?: string;
};

type EarnMoneyUserMap = Record<string, ServerEarnMoneyState>;

function isMaintenanceAdmin(uid: string): boolean {
  if (!uid) return false;
  const envAdminId = process.env.ADMIN_TELEGRAM_ID?.trim() || '';
  const cfgAdminId = (earnMoneyConfig.maintenanceAdminId || '').trim();
  return Boolean((envAdminId && uid === envAdminId) || (cfgAdminId && uid === cfgAdminId));
}

function isMaintenanceBlockedForUser(uid: string): boolean {
  return Boolean(earnMoneyConfig.maintenanceMode) && !isMaintenanceAdmin(uid);
}

function isActivationRuleMetForUser(user: ServerEarnMoneyState): boolean {
  const channelsDone = (user.joinedWaincomesite ? 1 : 0) + (user.joinedPremiumApps ? 1 : 0);
  const tasksDone = Array.isArray(user.completedTaskIds) ? user.completedTaskIds.length : 0;
  return (
    (user.adsWatchedTotal || 0) >= earnMoneyConfig.referMinAdsWatched &&
    channelsDone >= earnMoneyConfig.referMinChannelsJoined &&
    tasksDone >= earnMoneyConfig.referMinTasksCompleted
  );
}

interface TelegramProfileSeed {
  firstName?: string;
  lastName?: string;
  username?: string;
  isTelegramUser?: boolean;
  joinedAt?: string;
  lastActiveAt?: string;
  telegramPhotoFileId?: string;
}

function createZeroEarnMoneyUser(
  userId: string,
  userName: string,
  userAvatar: string,
  profile: TelegramProfileSeed = {}
): ServerEarnMoneyState {
  const dailyTotal = Math.max(1, Number(earnMoneyConfig.dailyAdsLimitPerUser) || DEFAULT_EARNMONEY_CONFIG.dailyAdsLimitPerUser);
  const ceiling = Number((dailyTotal * (earnMoneyConfig.perAdViewReward || 0.01)).toFixed(4));
  const instantRefer =
    earnMoneyConfig.referMinAdsWatched === 0 &&
    earnMoneyConfig.referMinChannelsJoined === 0 &&
    earnMoneyConfig.referMinTasksCompleted === 0;
  const nowIso = new Date().toISOString();
  const computedName =
    [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() ||
    userName ||
    (profile.username ? `@${profile.username}` : `User ${userId}`);

  return {
    userId,
    userName: computedName,
    firstName: profile.firstName,
    lastName: profile.lastName,
    username: profile.username,
    isTelegramUser: Boolean(profile.isTelegramUser),
    joinedAt: profile.joinedAt || nowIso,
    lastActiveAt: profile.lastActiveAt || nowIso,
    telegramPhotoFileId: profile.telegramPhotoFileId,
    userAvatar:
      userAvatar ||
      (profile.isTelegramUser
        ? `/api/telegram/avatar/${userId}`
        : '/src/assets/images/earnmoney_avatar_1795708537961.jpg'),
    isBlocked: false,
    totalBalance: 0,
    referBalance: 0,
    totalIncome: 0,
    totalWithdraw: 0,
    dailyAdsCompleted: 0,
    dailyAdsTotal: dailyTotal,
    nextSlotNumber: 1,
    dailyCeilingUsdt: ceiling,
    referralsInvited: 0,
    adsWatchedTotal: 0,
    totalReferrals: 0,
    activeReferrals: 0,
    pendingReferrals: 0,
    referralActivated: instantRefer,
    joinedWaincomesite: false,
    joinedPremiumApps: false,
    activateAdsDone: 0,
    completedTaskIds: [],
    taskCompletions: {},
    adSlotClaims: {},
    bonusTasks: [],
    referralsList: [],
    withdrawHistory: [],
  };
}

function loadAdSlotClaims(): AdSlotClaimRecord[] {
  if (!fs.existsSync(EARNMONEY_AD_SLOTS_PATH)) return [];
  try {
    const raw = fs.readFileSync(EARNMONEY_AD_SLOTS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdSlotClaimRecord[]) : [];
  } catch {
    return [];
  }
}

function saveAdSlotClaims(records: AdSlotClaimRecord[]): void {
  const tempPath = `${EARNMONEY_AD_SLOTS_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(records, null, 2), 'utf-8');
  fs.renameSync(tempPath, EARNMONEY_AD_SLOTS_PATH);
}

let adSlotClaimsList: AdSlotClaimRecord[] = loadAdSlotClaims();

function getUserAdSlotClaimsMap(uid: string): Record<string, AdSlotClaimRecord> {
  const out: Record<string, AdSlotClaimRecord> = {};
  for (const rec of adSlotClaimsList) {
    if (rec.user_id === uid) {
      out[String(rec.slot_id)] = rec;
    }
  }
  return out;
}

function syncUserWithConfig(user: ServerEarnMoneyState, now = Date.now()): ServerEarnMoneyState {
  const completedSet = new Set<string>(Array.isArray(user.completedTaskIds) ? user.completedTaskIds : []);
  const taskCompletions: Record<string, number> =
    user.taskCompletions && typeof user.taskCompletions === 'object' ? { ...user.taskCompletions } : {};

  const userSnapshot = {
    completedTaskIds: Array.from(completedSet),
    taskCompletions,
  };

  const adminTasks = earnMoneyConfig.tasks
    .filter((t) => t.active !== false)
    .map((t) => {
      const taskType = normalizeTaskType(t.taskType, t.badge);
      return {
        ...t,
        taskType,
        badge: taskType,
        completed: isTaskCompletedForUser({ ...t, taskType, badge: taskType, completed: false }, userSnapshot, now),
        createdBy: 'admin' as const,
      };
    })
    .filter((t) => !t.completed);

  const userCustomTasks = (Array.isArray(user.bonusTasks) ? user.bonusTasks : [])
    .filter((t) => t.createdBy === 'user')
    .map((t) => {
      const taskType = normalizeTaskType(t.taskType, 'Permanent');
      const done =
        Boolean(t.completed) ||
        isTaskCompletedForUser({ ...t, taskType, badge: t.badge || 'Community' }, userSnapshot, now);
      return {
        ...t,
        taskType,
        completed: done,
      };
    })
    .filter((t) => !t.completed);

  const dailyTotal = Math.max(1, Number(earnMoneyConfig.dailyAdsLimitPerUser) || DEFAULT_EARNMONEY_CONFIG.dailyAdsLimitPerUser);
  const dailyCeiling = Number((dailyTotal * (earnMoneyConfig.perAdViewReward || 0.01)).toFixed(4));
  const adSlotClaims = getUserAdSlotClaimsMap(user.userId);
  const claimedSlotCount = Object.values(adSlotClaims).filter((r) => r.view_reward_claimed).length;
  const dailyCompleted = Math.min(dailyTotal, Math.max(user.dailyAdsCompleted || 0, claimedSlotCount));

  const resolvedAvatar =
    user.userAvatar && user.userAvatar.startsWith('https://')
      ? user.userAvatar
      : user.telegramPhotoFileId || user.isTelegramUser
        ? `/api/telegram/avatar/${user.userId}`
        : user.userAvatar;

  const { telegramPhotoFileId: _hiddenPhotoId, ...publicUser } = user;

  const syncedBase: ServerEarnMoneyState = {
    ...publicUser,
    userAvatar: resolvedAvatar,
    isBlocked: Boolean(user.isBlocked),
    tasksCompletedCount: Array.from(completedSet).length,
    dailyAdsTotal: dailyTotal,
    dailyAdsCompleted: dailyCompleted,
    nextSlotNumber: Math.min(dailyTotal, dailyCompleted + 1),
    dailyCeilingUsdt: dailyCeiling,
    completedTaskIds: Array.from(completedSet),
    taskCompletions,
    adSlotClaims,
    bonusTasks: [...adminTasks, ...userCustomTasks],
    referralsList: Array.isArray(user.referralsList) ? user.referralsList : [],
    withdrawHistory: Array.isArray(user.withdrawHistory) ? user.withdrawHistory : [],
  };

  syncedBase.referralActivated = isActivationRuleMetForUser(syncedBase);
  return syncedBase;
}

function isRealTelegramUserRecord(user: ServerEarnMoneyState | undefined): boolean {
  if (!user || !user.userId) return false;
  if (user.userName === 'Earn Money User' && !user.isTelegramUser) return false;
  if (user.userName === 'Preview Guest' && !user.isTelegramUser) return false;
  return Boolean(user.isTelegramUser) || /^\d{4,20}$/.test(user.userId);
}

function loadEarnMoneyUsers(): EarnMoneyUserMap {
  if (!fs.existsSync(EARNMONEY_PATH)) return {};
  try {
    const raw = fs.readFileSync(EARNMONEY_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const filtered: EarnMoneyUserMap = {};
    for (const [k, v] of Object.entries(parsed as EarnMoneyUserMap)) {
      if (isRealTelegramUserRecord(v)) {
        filtered[k] = v;
      }
    }
    return filtered;
  } catch {
    return {};
  }
}

function saveEarnMoneyUsers(users: EarnMoneyUserMap): void {
  const tempPath = `${EARNMONEY_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(users, null, 2), 'utf-8');
  fs.renameSync(tempPath, EARNMONEY_PATH);
}

let earnMoneyUsers: EarnMoneyUserMap = loadEarnMoneyUsers();

function isValidMonetagInput(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^\d{4,16}$/.test(trimmed)) return true;
  if (isSafeUrl(trimmed, false)) return true;
  if (/^<script\b[^>]*>\s*<\/script>$/i.test(trimmed)) {
    const srcMatch = trimmed.match(/src\s*=\s*['"]?([^'"\s>]+)['"]?/i);
    const zoneMatch = trimmed.match(/data-zone\s*=\s*['"]?(\d{4,16})['"]?/i);
    if (!srcMatch) return false;
    const srcUrl = srcMatch[1].startsWith('//') ? `https:${srcMatch[1]}` : srcMatch[1];
    return isSafeUrl(srcUrl, false) && Boolean(zoneMatch || /libtl\.com|monetag/i.test(srcUrl));
  }
  return false;
}

// --- Security Helpers ---

function signValue(payload: string): string {
  return crypto.createHmac('sha256', SERVER_SIGNING_SECRET).update(payload).digest('hex');
}

function verifySignedValue(payload: string, sig: string): boolean {
  const expected = signValue(payload);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(sig, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isSafeUrl(raw: string, allowDemo = false): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (allowDemo && trimmed.startsWith('demo://')) return true;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/src/assets/')) {
    return !trimmed.includes('..');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPasscodeHash(passcode: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const derived = crypto.scryptSync(passcode, salt, 64);
  const target = Buffer.from(hashHex, 'hex');
  return derived.length === target.length && crypto.timingSafeEqual(derived, target);
}

function verifyEnvPasscode(passcode: string, envPasscode: string): boolean {
  const a = crypto.createHash('sha256').update(passcode).digest();
  const b = crypto.createHash('sha256').update(envPasscode).digest();
  return crypto.timingSafeEqual(a, b);
}

function issueAdminToken(): string {
  const payloadObj = {
    role: 'admin',
    exp: Date.now() + 12 * 60 * 60 * 1000,
    jti: crypto.randomBytes(8).toString('hex'),
  };
  const encoded = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = signValue(`admin.${encoded}`);
  return `${encoded}.${sig}`;
}

function verifyAdminToken(authHeader: string | undefined): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!verifySignedValue(`admin.${encoded}`, sig)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return parsed.role === 'admin' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!verifyAdminToken(req.headers.authorization)) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }
  next();
}

function computeStats(): DashboardStats {
  return {
    totalVideos: store.videos.length,
    totalUsers: store.users.length,
    activeVideos: store.videos.filter((v) => v.status === 'active').length,
    totalViews: store.videos.reduce((sum, v) => sum + (v.views || 0), 0),
    totalDownloads: store.videos.reduce((sum, v) => sum + (v.downloads || 0), 0),
  };
}

function deriveHandleFromUrl(urlStr: string, fallbackName: string): string {
  try {
    const u = new URL(urlStr);
    const segment = u.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
    if (segment && !segment.startsWith('+')) {
      return segment.startsWith('@') ? segment : `@${segment}`;
    }
  } catch {
    // ignore
  }
  const clean = fallbackName.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24);
  return clean ? `@${clean}` : '@Channel';
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      next();
    },
    express.static(UPLOADS_DIR)
  );

  app.use((req, res, next) => {
    if (req.path === '/api/admin/upload') {
      next();
      return;
    }
    express.json({ limit: '1mb' })(req, res, next);
  });

  // --- Public Mini App Sync API (No money/payment endpoints) ---

  app.get('/api/miniapp/data', (req, res) => {
    const rawUid = typeof req.query?.uid === 'string' ? req.query.uid.trim().slice(0, 80) : '';
    if (rawUid && !store.users.includes(rawUid)) {
      store.users.push(rawUid);
      saveStore(store);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      channels: store.channels,
      videos: store.videos.filter((v) => v.status === 'active'),
      watchAdsRequired: store.settings.watchAdsRequired,
      watchAdTimerSeconds: store.settings.watchAdTimerSeconds,
      downloadAdsRequired: store.settings.downloadAdsRequired,
      downloadAdTimerSeconds: store.settings.downloadAdTimerSeconds,
      forceJoinEnabled: store.settings.forceJoinEnabled,
    });
  });

  app.post('/api/miniapp/view/:id', (req, res) => {
    const video = store.videos.find((v) => v.id === req.params.id && v.status === 'active');
    if (video) {
      video.views += 1;
      saveStore(store);
    }
    res.json({ ok: true });
  });

  app.post('/api/miniapp/download/:id', (req, res) => {
    const video = store.videos.find((v) => v.id === req.params.id && v.status === 'active');
    if (video) {
      video.downloads += 1;
      saveStore(store);
    }
    res.json({ ok: true });
  });

  // --- Earn Money User State Sync API ---

  const TELEGRAM_BOT_USERNAME =
    process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '') || 'moneyxearnbot';

  const REQUIRED_FORCE_JOIN_CHANNELS = [
    {
      key: 'waincomesite' as const,
      username: '@waincomesite',
      url: 'https://t.me/waincomesite',
    },
    {
      key: 'premiumapps' as const,
      username: '@premiumapps5462',
      url: 'https://t.me/premiumapps5462',
    },
  ];

  async function telegramBotApiCall<T = unknown>(
    botToken: string,
    method: string,
    payload: Record<string, unknown>
  ): Promise<{ ok: boolean; result?: T; description?: string }> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return (await response.json()) as { ok: boolean; result?: T; description?: string };
    } catch {
      return { ok: false, description: 'Telegram API request failed' };
    }
  }

  async function checkLiveTelegramChannelMember(
    botToken: string,
    chatUsername: string,
    telegramUserId: string
  ): Promise<boolean> {
    if (!/^\d{4,20}$/.test(telegramUserId)) return false;
    const res = await telegramBotApiCall<{ status?: string; is_member?: boolean }>(
      botToken,
      'getChatMember',
      {
        chat_id: chatUsername,
        user_id: Number(telegramUserId),
      }
    );
    if (!res.ok || !res.result) return false;
    const st = res.result.status;
    return (
      st === 'member' ||
      st === 'administrator' ||
      st === 'creator' ||
      (st === 'restricted' && res.result.is_member === true)
    );
  }

  async function fetchTelegramProfilePhotoFileId(
    botToken: string,
    telegramUserId: string
  ): Promise<string | undefined> {
    if (!botToken || !/^\d{4,20}$/.test(telegramUserId)) return undefined;
    const res = await telegramBotApiCall<{
      total_count?: number;
      photos?: Array<Array<{ file_id?: string }>>;
    }>(botToken, 'getUserProfilePhotos', {
      user_id: Number(telegramUserId),
      limit: 1,
    });
    if (!res.ok || !res.result?.photos?.length) return undefined;
    const sizes = res.result.photos[0];
    if (!Array.isArray(sizes) || sizes.length === 0) return undefined;
    const chosen = sizes[sizes.length - 1] || sizes[0];
    return typeof chosen?.file_id === 'string' && chosen.file_id ? chosen.file_id : undefined;
  }

  app.get('/api/telegram/avatar/:uid', async (req, res) => {
    const uid = String(req.params.uid || '').replace(/[^0-9]/g, '').slice(0, 20);
    if (!/^\d{4,20}$/.test(uid)) {
      res.status(404).end();
      return;
    }

    const user = earnMoneyUsers[uid];
    if (user?.userAvatar && user.userAvatar.startsWith('https://')) {
      try {
        const parsed = new URL(user.userAvatar);
        if (parsed.hostname === 't.me' || parsed.hostname.endsWith('.t.me') || parsed.hostname.endsWith('.telegram.org')) {
          res.redirect(parsed.toString());
          return;
        }
      } catch {
        // fall through to Bot API lookup
      }
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
    if (!botToken) {
      res.status(404).end();
      return;
    }

    try {
      let fileId = user?.telegramPhotoFileId;
      if (!fileId) {
        fileId = await fetchTelegramProfilePhotoFileId(botToken, uid);
        if (fileId && user) {
          user.telegramPhotoFileId = fileId;
          if (latestDbStatus.connected) {
            await upsertUserToSupabase(user).catch(() => undefined);
          } else {
            saveEarnMoneyUsers(earnMoneyUsers);
          }
        }
      }
      if (!fileId) {
        res.status(404).end();
        return;
      }

      const fileInfo = await telegramBotApiCall<{ file_path?: string }>(botToken, 'getFile', {
        file_id: fileId,
      });
      const filePath = fileInfo.result?.file_path;
      if (!fileInfo.ok || !filePath || filePath.includes('..')) {
        res.status(404).end();
        return;
      }

      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath.replace(/^\/+/, '')}`;
      const imgRes = await fetch(fileUrl);
      if (!imgRes.ok) {
        res.status(404).end();
        return;
      }
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      const buf = Buffer.from(await imgRes.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=1800');
      res.send(buf);
    } catch {
      res.status(404).end();
    }
  });

  async function evaluateForceJoinMembership(
    uid: string,
    isTelegramUser: boolean
  ): Promise<{
    verified: boolean;
    joinedWaincomesite: boolean;
    joinedPremiumApps: boolean;
    missing: string[];
    message: string | null;
    liveChecked: boolean;
  }> {
    if (!earnMoneyUsers[uid] && isTelegramUser) {
      earnMoneyUsers[uid] = createZeroEarnMoneyUser(
        uid,
        `User ${uid}`,
        `/api/telegram/avatar/${uid}`,
        { isTelegramUser: true }
      );
      await persistUserAndReferrer(earnMoneyUsers[uid]).catch(() => undefined);
    }

    const userRecord = earnMoneyUsers[uid];
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
    const canLiveCheck = Boolean(botToken) && isTelegramUser && /^\d{4,20}$/.test(uid);

    let joinedWaincomesite = Boolean(userRecord?.joinedWaincomesite);
    let joinedPremiumApps = Boolean(userRecord?.joinedPremiumApps);

    if (canLiveCheck && userRecord) {
      const [wJoined, pJoined] = await Promise.all([
        checkLiveTelegramChannelMember(botToken, '@waincomesite', uid),
        checkLiveTelegramChannelMember(botToken, '@premiumapps5462', uid),
      ]);
      joinedWaincomesite = wJoined;
      joinedPremiumApps = pJoined;
      userRecord.joinedWaincomesite = wJoined;
      userRecord.joinedPremiumApps = pJoined;
      userRecord.lastActiveAt = new Date().toISOString();
      await persistUserAndReferrer(userRecord).catch(() => undefined);
    }

    const missing: string[] = [];
    if (!joinedWaincomesite) missing.push('@waincomesite');
    if (!joinedPremiumApps) missing.push('@premiumapps5462');

    const verified = missing.length === 0;
    const message = verified
      ? null
      : `Please join both channels. You have not joined: ${missing.join(' / ')}`;

    return {
      verified,
      joinedWaincomesite,
      joinedPremiumApps,
      missing,
      message,
      liveChecked: canLiveCheck,
    };
  }

  function applyReferralAttribution(uid: string, name: string, refUid: string): void {
    if (!refUid || refUid === uid || !earnMoneyUsers[refUid]) return;
    const referrer = earnMoneyUsers[refUid];
    const alreadyListed = referrer.referralsList.some((r) => r.id === `ref_${uid}`);
    if (alreadyListed) return;

    if (
      earnMoneyConfig.maxReferPerUser > 0 &&
      referrer.referralsList.length >= earnMoneyConfig.maxReferPerUser
    ) {
      return;
    }

    const user = earnMoneyUsers[uid];
    if (user) {
      user.referredBy = refUid;
    }

    const cleanUsername = `@${
      name.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || `user_${uid.slice(-4)}`
    }`;
    const initials =
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || '')
        .join('') || 'EM';

    const instantCredit =
      earnMoneyConfig.referBonusType === 'instant' ||
      (user ? isActivationRuleMetForUser(user) : false);

    referrer.referralsInvited += 1;
    referrer.totalReferrals += 1;

    if (instantCredit) {
      const bonus = earnMoneyConfig.referBonusAmount;
      referrer.activeReferrals += 1;
      referrer.referBalance = Number((referrer.referBalance + bonus).toFixed(4));
      referrer.totalBalance = Number((referrer.totalBalance + bonus).toFixed(4));
      referrer.totalIncome = Number((referrer.totalIncome + bonus).toFixed(4));
      referrer.referralsList.unshift({
        id: `ref_${uid}`,
        username: cleanUsername,
        initials,
        channelsJoined: 0,
        adsWatched: 0,
        status: 'ACTIVE',
        rewardUsdt: bonus,
      });
    } else {
      referrer.pendingReferrals += 1;
      referrer.referralsList.unshift({
        id: `ref_${uid}`,
        username: cleanUsername,
        initials,
        channelsJoined: 0,
        adsWatched: 0,
        status: 'PENDING',
        rewardUsdt: 0,
      });
    }
  }

  function evaluateReferralProgressAndCredit(user: ServerEarnMoneyState): void {
    if (!user.referredBy) return;
    const referrer = earnMoneyUsers[user.referredBy];
    if (!referrer) return;

    const entry = referrer.referralsList.find((r) => r.id === `ref_${user.userId}`);
    if (!entry) return;

    entry.channelsJoined = (user.joinedWaincomesite ? 1 : 0) + (user.joinedPremiumApps ? 1 : 0);
    entry.adsWatched = user.adsWatchedTotal;

    if (entry.status === 'PENDING' && isActivationRuleMetForUser(user)) {
      const bonus = earnMoneyConfig.referBonusAmount;
      entry.status = 'ACTIVE';
      entry.rewardUsdt = bonus;
      referrer.activeReferrals += 1;
      referrer.pendingReferrals = Math.max(0, referrer.pendingReferrals - 1);
      referrer.referBalance = Number((referrer.referBalance + bonus).toFixed(4));
      referrer.totalBalance = Number((referrer.totalBalance + bonus).toFixed(4));
      referrer.totalIncome = Number((referrer.totalIncome + bonus).toFixed(4));
    }
  }

  let latestDbStatus: DatabaseConnectionStatus = {
    connected: false,
    provider: 'Supabase',
    configured: false,
    error: 'Connect Database to Save Permanently',
  };

  async function refreshEarnMoneyStoreFromDatabase(): Promise<DatabaseConnectionStatus> {
    const status = await checkSupabaseConnection();
    latestDbStatus = status;
    if (!status.connected) {
      return status;
    }
    try {
      const dbConfig = await loadConfigFromSupabase(DEFAULT_EARNMONEY_CONFIG);
      if (dbConfig) {
        earnMoneyConfig = dbConfig;
      }
      const dbUsersAndClaims = await loadUsersAndClaimsFromSupabase(earnMoneyConfig);
      if (dbUsersAndClaims) {
        earnMoneyUsers = dbUsersAndClaims.usersMap;
        adSlotClaimsList = dbUsersAndClaims.adSlotClaims;
      }
      return status;
    } catch {
      latestDbStatus = {
        connected: false,
        provider: 'Supabase',
        configured: status.configured,
        error: 'Connect Database to Save Permanently',
      };
      return latestDbStatus;
    }
  }

  async function persistUserAndReferrer(user: ServerEarnMoneyState): Promise<void> {
    if (latestDbStatus.connected) {
      await upsertUserToSupabase(user);
      if (user.referredBy && earnMoneyUsers[user.referredBy]) {
        await upsertUserToSupabase(earnMoneyUsers[user.referredBy]);
      }
    } else {
      saveEarnMoneyUsers(earnMoneyUsers);
    }
  }

  app.get('/api/earnmoney/config', async (_req, res) => {
    const dbStatus = await refreshEarnMoneyStoreFromDatabase();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ config: earnMoneyConfig, dbStatus });
  });

  app.get('/api/earnmoney/state', async (req, res) => {
    await refreshEarnMoneyStoreFromDatabase();

    const rawUid = typeof req.query?.uid === 'string' ? req.query.uid.trim() : '';
    const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!uid) {
      res.status(400).json({ error: 'Valid uid is required.' });
      return;
    }

    const isTg = req.query?.isTg === '1';
    const firstName =
      typeof req.query?.firstName === 'string' && req.query.firstName.trim()
        ? req.query.firstName.trim().slice(0, 80)
        : undefined;
    const lastName =
      typeof req.query?.lastName === 'string' && req.query.lastName.trim()
        ? req.query.lastName.trim().slice(0, 80)
        : undefined;
    const username =
      typeof req.query?.username === 'string' && req.query.username.trim()
        ? req.query.username.trim().replace(/^@+/, '').slice(0, 64)
        : undefined;
    const rawName =
      typeof req.query?.name === 'string' && req.query.name.trim()
        ? req.query.name.trim().slice(0, 80)
        : '';
    const name =
      [firstName, lastName].filter(Boolean).join(' ').trim() ||
      (rawName && rawName !== 'Earn Money User' && rawName !== 'Preview Guest' ? rawName : '') ||
      (username ? `@${username}` : `User ${uid}`);
    const avatar =
      typeof req.query?.avatar === 'string' && isSafeUrl(req.query.avatar, false)
        ? req.query.avatar.trim()
        : isTg
          ? `/api/telegram/avatar/${uid}`
          : '/src/assets/images/earnmoney_avatar_1795708537961.jpg';
    const rawRef = typeof req.query?.ref === 'string' ? req.query.ref.trim() : '';
    const refUid = rawRef.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

    const nowIso = new Date().toISOString();

    if (earnMoneyUsers[uid]) {
      const existing = earnMoneyUsers[uid];
      existing.lastActiveAt = nowIso;
      if (isTg) {
        existing.isTelegramUser = true;
        if (firstName !== undefined) existing.firstName = firstName;
        if (lastName !== undefined) existing.lastName = lastName;
        if (username !== undefined) existing.username = username;
        if (name && name !== 'Earn Money User' && name !== 'Preview Guest') {
          existing.userName = name;
        }
        if (avatar.startsWith('https://')) {
          existing.userAvatar = avatar;
        }
      }
      await persistUserAndReferrer(existing).catch(() => undefined);

      res.setHeader('Cache-Control', 'no-store');
      res.json({
        state: syncUserWithConfig(existing),
        config: earnMoneyConfig,
        isMaintenanceAdmin: isMaintenanceAdmin(uid),
      });
      return;
    }

    if (isTg) {
      earnMoneyUsers[uid] = createZeroEarnMoneyUser(uid, name, avatar, {
        firstName,
        lastName,
        username,
        isTelegramUser: true,
        joinedAt: nowIso,
        lastActiveAt: nowIso,
      });
      applyReferralAttribution(uid, name, refUid);
      await persistUserAndReferrer(earnMoneyUsers[uid]).catch(() => undefined);

      res.setHeader('Cache-Control', 'no-store');
      res.json({
        state: syncUserWithConfig(earnMoneyUsers[uid]),
        config: earnMoneyConfig,
        isMaintenanceAdmin: isMaintenanceAdmin(uid),
      });
      return;
    }

    // Plain browser preview outside Telegram: return transient preview state without inserting a fake DB user
    const previewState = createZeroEarnMoneyUser(uid, 'Preview Guest', avatar, {
      isTelegramUser: false,
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      state: syncUserWithConfig(previewState),
      config: earnMoneyConfig,
      isMaintenanceAdmin: isMaintenanceAdmin(uid),
    });
  });

  app.put('/api/earnmoney/state', async (req, res) => {
    await refreshEarnMoneyStoreFromDatabase();

    const incoming = req.body?.state;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      res.status(400).json({ error: 'Invalid state payload.' });
      return;
    }
    const rawUid = typeof incoming.userId === 'string' ? incoming.userId : '';
    const uid = rawUid.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!uid) {
      res.status(400).json({ error: 'Valid userId is required.' });
      return;
    }
    if (isMaintenanceBlockedForUser(uid)) {
      res.status(503).json({
        error: earnMoneyConfig.maintenanceMessage,
        maintenanceMode: true,
      });
      return;
    }

    const existing = earnMoneyUsers[uid];
    if (!existing && !incoming.isTelegramUser) {
      res.json({ ok: true, state: syncUserWithConfig(createZeroEarnMoneyUser(uid, 'Preview Guest', '')) });
      return;
    }

    const base =
      existing ??
      createZeroEarnMoneyUser(
        uid,
        typeof incoming.userName === 'string' ? incoming.userName.slice(0, 80) : `User ${uid}`,
        typeof incoming.userAvatar === 'string' && isSafeUrl(incoming.userAvatar, false)
          ? incoming.userAvatar
          : `/api/telegram/avatar/${uid}`,
        { isTelegramUser: true }
      );

    if (base.isBlocked) {
      res.status(403).json({ error: 'Account is blocked by administrator.' });
      return;
    }

    earnMoneyUsers[uid] = {
      ...base,
      lastActiveAt: new Date().toISOString(),
      joinedWaincomesite: Boolean(incoming.joinedWaincomesite ?? base.joinedWaincomesite),
      joinedPremiumApps: Boolean(incoming.joinedPremiumApps ?? base.joinedPremiumApps),
      userId: uid,
    };
    evaluateReferralProgressAndCredit(earnMoneyUsers[uid]);
    await persistUserAndReferrer(earnMoneyUsers[uid]).catch(() => undefined);
    res.json({ ok: true, state: syncUserWithConfig(earnMoneyUsers[uid]) });
  });

  app.post('/api/earnmoney/ad-claim', async (req, res) => {
    await refreshEarnMoneyStoreFromDatabase();
    const rawUid = typeof req.body?.uid === 'string' ? req.body.uid.trim() : '';
    const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const mode = req.body?.mode === 'click' ? 'click' : 'view';
    const isTg = Boolean(req.body?.isTg);
    if (!uid) {
      res.status(400).json({ error: 'Valid uid is required.' });
      return;
    }
    if (isMaintenanceBlockedForUser(uid)) {
      res.status(503).json({
        error: earnMoneyConfig.maintenanceMessage,
        maintenanceMode: true,
      });
      return;
    }

    const user = earnMoneyUsers[uid];
    if (!user) {
      if (!isTg) {
        res.status(400).json({ error: 'Please press /start in @moneyxearnbot to activate your account.' });
        return;
      }
      earnMoneyUsers[uid] = createZeroEarnMoneyUser(uid, `User ${uid}`, `/api/telegram/avatar/${uid}`, {
        isTelegramUser: true,
      });
    }
    const activeUser = earnMoneyUsers[uid];
    activeUser.lastActiveAt = new Date().toISOString();
    if (activeUser.isBlocked) {
      res.status(403).json({ error: 'Your account has been blocked by admin.' });
      return;
    }
    if (!earnMoneyConfig.premiumAdsEnabled || earnMoneyConfig.premiumAdsBudget <= 0) {
      res.status(400).json({ error: 'Premium Ads Slot Empty' });
      return;
    }

    const dailyLimit = Math.max(1, Number(earnMoneyConfig.dailyAdsLimitPerUser) || DEFAULT_EARNMONEY_CONFIG.dailyAdsLimitPerUser);
    const requestedSlotRaw = Number(req.body?.slotId);
    const defaultNextSlot = Math.min(dailyLimit, (activeUser.dailyAdsCompleted || 0) + 1);
    const slotId =
      Number.isInteger(requestedSlotRaw) && requestedSlotRaw >= 1 && requestedSlotRaw <= dailyLimit
        ? requestedSlotRaw
        : defaultNextSlot;

    let slotRecord = adSlotClaimsList.find(
      (r) => r.user_id === uid && r.slot_id === slotId
    );
    if (!slotRecord) {
      slotRecord = {
        user_id: uid,
        slot_id: slotId,
        view_reward_claimed: false,
        click_bonus_claimed: false,
        updated_at: new Date().toISOString(),
      };
      adSlotClaimsList.push(slotRecord);
    }

    if (mode === 'view') {
      if (slotRecord.view_reward_claimed) {
        res.status(400).json({
          error: `View reward already claimed for Slot #${slotId}.`,
          state: syncUserWithConfig(activeUser),
          config: earnMoneyConfig,
        });
        return;
      }
      if (activeUser.dailyAdsCompleted >= dailyLimit) {
        res.status(400).json({ error: `Daily ${dailyLimit} ad slots already completed.` });
        return;
      }
    } else if (slotRecord.click_bonus_claimed) {
      res.status(400).json({
        error: `Ad click bonus already claimed for Slot #${slotId}.`,
        state: syncUserWithConfig(activeUser),
        config: earnMoneyConfig,
      });
      return;
    }

    const requestedReward =
      mode === 'click' ? earnMoneyConfig.perAdClickReward : earnMoneyConfig.perAdViewReward;
    const reward = Number(Math.min(requestedReward, earnMoneyConfig.premiumAdsBudget).toFixed(4));
    if (reward <= 0) {
      res.status(400).json({ error: 'Premium Ads Slot Empty' });
      return;
    }

    earnMoneyConfig.premiumAdsBudget = Math.max(
      0,
      Number((earnMoneyConfig.premiumAdsBudget - reward).toFixed(4))
    );
    earnMoneyConfig.updatedAt = new Date().toISOString();
    if (latestDbStatus.connected) {
      await saveConfigToSupabase(earnMoneyConfig);
    } else {
      saveEarnMoneyConfig(earnMoneyConfig);
    }

    if (mode === 'view') {
      slotRecord.view_reward_claimed = true;
      activeUser.dailyAdsCompleted = Math.min(dailyLimit, activeUser.dailyAdsCompleted + 1);
      activeUser.dailyAdsTotal = dailyLimit;
      activeUser.nextSlotNumber = Math.min(dailyLimit, activeUser.dailyAdsCompleted + 1);
      activeUser.adsWatchedTotal += 1;
      activeUser.activateAdsDone = activeUser.adsWatchedTotal;
    } else {
      slotRecord.click_bonus_claimed = true;
    }
    slotRecord.updated_at = new Date().toISOString();
    if (latestDbStatus.connected) {
      await upsertAdSlotClaimToSupabase(slotRecord);
    } else {
      saveAdSlotClaims(adSlotClaimsList);
    }

    activeUser.totalBalance = Number((activeUser.totalBalance + reward).toFixed(4));
    activeUser.totalIncome = Number((activeUser.totalIncome + reward).toFixed(4));

    evaluateReferralProgressAndCredit(activeUser);
    earnMoneyUsers[uid] = activeUser;
    await persistUserAndReferrer(activeUser);
    res.json({
      state: syncUserWithConfig(activeUser),
      config: earnMoneyConfig,
      reward,
      slotClaim: slotRecord,
    });
  });

  app.post('/api/earnmoney/tasks/complete', async (req, res) => {
    await refreshEarnMoneyStoreFromDatabase();
    const rawUid = typeof req.body?.uid === 'string' ? req.body.uid.trim() : '';
    const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const taskId = typeof req.body?.taskId === 'string' ? req.body.taskId.trim() : '';
    if (!uid || !taskId) {
      res.status(400).json({ error: 'Valid uid and taskId are required.' });
      return;
    }
    if (isMaintenanceBlockedForUser(uid)) {
      res.status(503).json({
        error: earnMoneyConfig.maintenanceMessage,
        maintenanceMode: true,
      });
      return;
    }

    const isTg = Boolean(req.body?.isTg);
    let user = earnMoneyUsers[uid];
    if (!user) {
      if (!isTg) {
        res.status(400).json({ error: 'Please press /start in @moneyxearnbot to activate your account.' });
        return;
      }
      user = createZeroEarnMoneyUser(uid, `User ${uid}`, `/api/telegram/avatar/${uid}`, {
        isTelegramUser: true,
      });
      earnMoneyUsers[uid] = user;
    }
    user.lastActiveAt = new Date().toISOString();
    if (user.isBlocked) {
      res.status(403).json({ error: 'Your account has been blocked by admin.' });
      return;
    }

    const adminTask = earnMoneyConfig.tasks.find((t) => t.id === taskId && t.active !== false);
    const customTask = (user.bonusTasks || []).find((t) => t.id === taskId && t.createdBy === 'user');
    const targetTask = adminTask || customTask;
    if (!targetTask) {
      res.status(404).json({ error: 'Task not found or inactive.' });
      return;
    }

    const now = Date.now();
    const resolvedType = normalizeTaskType(
      targetTask.taskType,
      customTask ? 'Permanent' : targetTask.badge
    );
    const completedSet = new Set<string>(user.completedTaskIds || []);
    const taskCompletions =
      user.taskCompletions && typeof user.taskCompletions === 'object' ? { ...user.taskCompletions } : {};

    const alreadyDone = isTaskCompletedForUser(
      { ...targetTask, taskType: resolvedType, completed: Boolean(customTask?.completed) },
      { completedTaskIds: Array.from(completedSet), taskCompletions },
      now
    );
    if (alreadyDone) {
      res.status(400).json({
        error:
          resolvedType === 'Permanent' || resolvedType === '1 Time Remove'
            ? 'Task already completed.'
            : `Task already completed. Available again after ${resolvedType === '1 Week' ? '7 days' : '24 hours'}.`,
        state: syncUserWithConfig(user, now),
        config: earnMoneyConfig,
        alreadyCompleted: true,
      });
      return;
    }

    taskCompletions[taskId] = now;
    user.taskCompletions = taskCompletions;
    completedSet.add(taskId);
    user.completedTaskIds = Array.from(completedSet);
    if (customTask) {
      customTask.completed = true;
    }
    user.totalBalance = Number((user.totalBalance + targetTask.rewardUsdt).toFixed(4));
    user.totalIncome = Number((user.totalIncome + targetTask.rewardUsdt).toFixed(4));

    evaluateReferralProgressAndCredit(user);
    earnMoneyUsers[uid] = user;
    await persistUserAndReferrer(user);
    res.json({
      state: syncUserWithConfig(user, now),
      config: earnMoneyConfig,
      rewardUsdt: targetTask.rewardUsdt,
    });
  });

  app.post('/api/earnmoney/tasks/custom', async (req, res) => {
    await refreshEarnMoneyStoreFromDatabase();
    const rawUid = typeof req.body?.uid === 'string' ? req.body.uid.trim() : '';
    const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 80) : '';
    const rewardUsdt = Number(req.body?.rewardUsdt);
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';

    if (isMaintenanceBlockedForUser(uid)) {
      res.status(503).json({
        error: earnMoneyConfig.maintenanceMessage,
        maintenanceMode: true,
      });
      return;
    }

    if (!uid || title.length < 3 || !Number.isFinite(rewardUsdt) || rewardUsdt <= 0 || rewardUsdt > 50 || !isSafeUrl(url, false)) {
      res.status(400).json({ error: 'Invalid custom task parameters.' });
      return;
    }

    const isTg = Boolean(req.body?.isTg);
    let user = earnMoneyUsers[uid];
    if (!user) {
      if (!isTg) {
        res.status(400).json({ error: 'Please press /start in @moneyxearnbot to activate your account.' });
        return;
      }
      user = createZeroEarnMoneyUser(uid, `User ${uid}`, `/api/telegram/avatar/${uid}`, {
        isTelegramUser: true,
      });
      earnMoneyUsers[uid] = user;
    }
    user.lastActiveAt = new Date().toISOString();
    if (user.isBlocked) {
      res.status(403).json({ error: 'Your account has been blocked by admin.' });
      return;
    }

    const newTask: BonusTaskItem = {
      id: `utask_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      title,
      badge: 'Community',
      rewardUsdt: Number(rewardUsdt.toFixed(2)),
      url,
      completed: false,
      active: true,
      createdBy: 'user',
    };
    user.bonusTasks = [newTask, ...(user.bonusTasks || [])];
    earnMoneyUsers[uid] = user;
    await persistUserAndReferrer(user);
    res.status(201).json({ state: syncUserWithConfig(user), config: earnMoneyConfig });
  });

  app.post('/api/earnmoney/activate-refer', async (req, res) => {
    await refreshEarnMoneyStoreFromDatabase();
    const rawUid = typeof req.body?.uid === 'string' ? req.body.uid.trim() : '';
    const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!uid || !earnMoneyUsers[uid]) {
      res.status(400).json({ error: 'Valid uid is required.' });
      return;
    }
    if (isMaintenanceBlockedForUser(uid)) {
      res.status(503).json({
        error: earnMoneyConfig.maintenanceMessage,
        maintenanceMode: true,
      });
      return;
    }

    const user = earnMoneyUsers[uid];
    if (!isActivationRuleMetForUser(user)) {
      const parts: string[] = [];
      if (earnMoneyConfig.referMinAdsWatched > 0 && user.adsWatchedTotal < earnMoneyConfig.referMinAdsWatched) {
        parts.push(`Watch ${earnMoneyConfig.referMinAdsWatched} Ads`);
      }
      const chDone = (user.joinedWaincomesite ? 1 : 0) + (user.joinedPremiumApps ? 1 : 0);
      if (earnMoneyConfig.referMinChannelsJoined > 0 && chDone < earnMoneyConfig.referMinChannelsJoined) {
        parts.push(`Join ${earnMoneyConfig.referMinChannelsJoined} Channels`);
      }
      const tasksDone = (user.completedTaskIds || []).length;
      if (earnMoneyConfig.referMinTasksCompleted > 0 && tasksDone < earnMoneyConfig.referMinTasksCompleted) {
        parts.push(`Complete ${earnMoneyConfig.referMinTasksCompleted} Tasks`);
      }
      res.status(400).json({
        error: `${parts.join(', ') || 'Complete activation rules'} to activate referral rewards.`,
      });
      return;
    }

    user.referralActivated = true;
    evaluateReferralProgressAndCredit(user);
    await persistUserAndReferrer(user);
    res.json({ state: syncUserWithConfig(user) });
  });

  app.post('/api/earnmoney/withdraw', async (req, res) => {
    await refreshEarnMoneyStoreFromDatabase();
    const rawUid = typeof req.body?.uid === 'string' ? req.body.uid.trim() : '';
    const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const amount = Number(req.body?.amount);
    const address = typeof req.body?.address === 'string' ? req.body.address.trim() : '';

    if (!uid) {
      res.status(400).json({ error: 'Valid uid is required.' });
      return;
    }
    if (isMaintenanceBlockedForUser(uid)) {
      res.status(503).json({
        error: earnMoneyConfig.maintenanceMessage,
        maintenanceMode: true,
      });
      return;
    }

    const user = earnMoneyUsers[uid];
    if (!user) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }
    if (user.isBlocked) {
      res.status(403).json({ error: 'Your account is blocked and cannot withdraw.' });
      return;
    }

    const requiredAds = Math.max(0, Math.floor(Number(earnMoneyConfig.withdrawRequiredAds ?? 0)));
    const adsWatchedToday = Math.max(0, Number(user.dailyAdsCompleted || 0));
    if (requiredAds > 0 && adsWatchedToday < requiredAds) {
      res.status(400).json({
        error: `Withdraw is locked. ${adsWatchedToday} / ${requiredAds} Ads Watched.`,
      });
      return;
    }

    const minWithdraw = Math.max(0, Number(earnMoneyConfig.minWithdrawAmount ?? 1));
    if (!Number.isFinite(amount) || amount < minWithdraw) {
      res.status(400).json({
        error: `Minimum Withdraw is $${minWithdraw.toFixed(2)} USDT`,
      });
      return;
    }
    const maxWithdraw = Math.max(0, Number(earnMoneyConfig.maxWithdrawAmount ?? 0));
    if (maxWithdraw > 0 && amount > maxWithdraw) {
      res.status(400).json({
        error: `Maximum Withdraw is $${maxWithdraw.toFixed(2)} USDT`,
      });
      return;
    }
    const pendingWithdrawTotal = (user.withdrawHistory || [])
      .filter((w) => w.status === 'Pending')
      .reduce((sum, w) => sum + (Number(w.amountUsdt) || 0), 0);
    const availableBalance = Math.max(0, Number((user.totalBalance - pendingWithdrawTotal).toFixed(4)));
    if (amount > availableBalance) {
      res.status(400).json({
        error:
          pendingWithdrawTotal > 0
            ? 'Insufficient available USDT balance (pending withdrawals are queued).'
            : 'Insufficient USDT balance.',
      });
      return;
    }
    if (!/^0x[a-fA-F0-9]{10,42}$/.test(address)) {
      res.status(400).json({ error: 'Enter a valid BEP20 (BSC) wallet address starting with 0x.' });
      return;
    }

    const feePercent = Math.min(100, Math.max(0, Number(earnMoneyConfig.withdrawFeePercent ?? 0)));
    const feeUsdt = Number(((amount * feePercent) / 100).toFixed(4));
    const netAmountUsdt = Number((amount - feeUsdt).toFixed(4));

    const shortAddr =
      address.length > 12 ? `${address.slice(0, 5)}...${address.slice(-4)}` : address;
    const todayLabel = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });

    const newWd = {
      id: `wd_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      amountUsdt: Number(amount.toFixed(4)),
      feePercent: Number(feePercent.toFixed(2)),
      feeUsdt,
      netAmountUsdt,
      address: shortAddr,
      date: todayLabel,
      status: 'Pending' as const,
    };

    user.withdrawHistory = [newWd, ...(user.withdrawHistory || [])];

    earnMoneyUsers[uid] = user;
    if (latestDbStatus.connected) {
      await insertWithdrawToSupabase(uid, newWd);
      await upsertUserToSupabase(user);
    } else {
      saveEarnMoneyUsers(earnMoneyUsers);
    }
    res.status(201).json({
      state: syncUserWithConfig(user),
      message:
        feePercent > 0
          ? `Withdrawal request for ${amount.toFixed(2)} USDT submitted (Net: ${netAmountUsdt.toFixed(2)} USDT after ${feePercent}% fee).`
          : `Withdrawal request for ${amount.toFixed(2)} USDT submitted to ${shortAddr}.`,
    });
  });

  app.post('/api/earnmoney/mark-channel', async (req, res) => {
    await refreshEarnMoneyStoreFromDatabase();
    const rawUid = typeof req.body?.uid === 'string' ? req.body.uid.trim() : '';
    const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const channel = req.body?.channel;

    if (isMaintenanceBlockedForUser(uid)) {
      res.status(503).json({
        error: earnMoneyConfig.maintenanceMessage,
        maintenanceMode: true,
      });
      return;
    }

    if (!uid || (channel !== 'waincomesite' && channel !== 'premiumapps')) {
      res.status(400).json({ error: 'Valid uid and channel are required.' });
      return;
    }

    const isTg = Boolean(req.body?.isTg);
    if (!earnMoneyUsers[uid]) {
      if (!isTg) {
        res.json({
          ok: true,
          joinedWaincomesite: channel === 'waincomesite',
          joinedPremiumApps: channel === 'premiumapps',
        });
        return;
      }
      earnMoneyUsers[uid] = createZeroEarnMoneyUser(
        uid,
        `User ${uid}`,
        `/api/telegram/avatar/${uid}`,
        { isTelegramUser: true }
      );
    }

    earnMoneyUsers[uid].lastActiveAt = new Date().toISOString();
    if (channel === 'waincomesite') {
      earnMoneyUsers[uid].joinedWaincomesite = true;
    } else {
      earnMoneyUsers[uid].joinedPremiumApps = true;
    }
    evaluateReferralProgressAndCredit(earnMoneyUsers[uid]);
    await persistUserAndReferrer(earnMoneyUsers[uid]);

    res.json({
      ok: true,
      joinedWaincomesite: earnMoneyUsers[uid].joinedWaincomesite,
      joinedPremiumApps: earnMoneyUsers[uid].joinedPremiumApps,
      state: syncUserWithConfig(earnMoneyUsers[uid]),
    });
  });

  app.post('/api/earnmoney/verify-membership', async (req, res) => {
    const rawUid = typeof req.body?.uid === 'string' ? req.body.uid.trim() : '';
    const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!uid) {
      res.status(400).json({ error: 'Valid uid is required.' });
      return;
    }

    const isTelegramUser = Boolean(req.body?.isTelegramUser);
    const result = await evaluateForceJoinMembership(uid, isTelegramUser);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ...result,
      channels: REQUIRED_FORCE_JOIN_CHANNELS,
    });
  });

  interface TelegramUpdatePayload {
    update_id?: number;
    message?: {
      chat?: { id?: number | string };
      from?: { id?: number | string; first_name?: string; last_name?: string; username?: string };
      text?: string;
    };
    callback_query?: {
      id: string;
      from?: { id?: number | string; first_name?: string; last_name?: string; username?: string };
      message?: { chat?: { id?: number | string } };
      data?: string;
    };
  }

  async function processTelegramUpdate(
    update: TelegramUpdatePayload,
    botToken: string,
    appBaseUrl: string
  ): Promise<void> {
    await refreshEarnMoneyStoreFromDatabase();

    if (update?.message?.text && update.message.chat?.id && update.message.from?.id) {
      const text = update.message.text.trim();
      const chatId = update.message.chat.id;
      const uid = String(update.message.from.id).replace(/[^0-9]/g, '');
      const firstName = update.message.from.first_name?.trim() || undefined;
      const lastName = update.message.from.last_name?.trim() || undefined;
      const username = update.message.from.username?.trim().replace(/^@+/, '') || undefined;
      const fullName =
        [firstName, lastName].filter(Boolean).join(' ').trim() ||
        (username ? `@${username}` : `User ${uid}`);

      if (text.startsWith('/start')) {
        if (isMaintenanceBlockedForUser(uid)) {
          if (botToken) {
            await telegramBotApiCall(botToken, 'sendMessage', {
              chat_id: chatId,
              text: earnMoneyConfig.maintenanceMessage,
            });
          }
          return;
        }

        const refMatch = text.match(/ref_([a-zA-Z0-9_-]{4,64})/);
        const refUid = refMatch ? refMatch[1] : '';
        const nowIso = new Date().toISOString();
        const photoFileId = botToken
          ? await fetchTelegramProfilePhotoFileId(botToken, uid).catch(() => undefined)
          : undefined;
        const avatarPath = photoFileId ? `/api/telegram/avatar/${uid}` : '';

        if (uid && !earnMoneyUsers[uid]) {
          earnMoneyUsers[uid] = createZeroEarnMoneyUser(uid, fullName, avatarPath, {
            firstName,
            lastName,
            username,
            isTelegramUser: true,
            joinedAt: nowIso,
            lastActiveAt: nowIso,
            telegramPhotoFileId: photoFileId,
          });
          applyReferralAttribution(uid, fullName, refUid);
          await persistUserAndReferrer(earnMoneyUsers[uid]);
        } else if (uid && earnMoneyUsers[uid]) {
          const existing = earnMoneyUsers[uid];
          existing.isTelegramUser = true;
          if (firstName !== undefined) existing.firstName = firstName;
          if (lastName !== undefined) existing.lastName = lastName;
          if (username !== undefined) existing.username = username;
          existing.userName = fullName;
          existing.lastActiveAt = nowIso;
          if (!existing.joinedAt) existing.joinedAt = nowIso;
          if (photoFileId) {
            existing.telegramPhotoFileId = photoFileId;
            if (!existing.userAvatar || !existing.userAvatar.startsWith('https://')) {
              existing.userAvatar = `/api/telegram/avatar/${uid}`;
            }
          }
          await persistUserAndReferrer(existing);
        }

        if (botToken) {
          await telegramBotApiCall(botToken, 'sendMessage', {
            chat_id: chatId,
            text: `${earnMoneyConfig.welcomeTitle} 🎁\n${earnMoneyConfig.welcomeSubtitle}`,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'Join Channel 1', url: earnMoneyConfig.channel1Url },
                  { text: 'Join Channel 2', url: earnMoneyConfig.channel2Url },
                ],
                [{ text: '✅ Verify & Continue', callback_data: 'verify_membership' }],
              ],
            },
          });
        }
      }
    }

    if (update?.callback_query?.id && update.callback_query.data === 'verify_membership') {
      const chatId = update.callback_query.message?.chat?.id;
      const cbFrom = update.callback_query.from;
      const cbUid = String(cbFrom?.id ?? '').replace(/[^0-9]/g, '');

      if (cbUid) {
        const nowIso = new Date().toISOString();
        const firstName = cbFrom?.first_name?.trim() || undefined;
        const lastName = cbFrom?.last_name?.trim() || undefined;
        const username = cbFrom?.username?.trim().replace(/^@+/, '') || undefined;
        const fullName =
          [firstName, lastName].filter(Boolean).join(' ').trim() ||
          (username ? `@${username}` : `User ${cbUid}`);
        const photoFileId =
          botToken && !earnMoneyUsers[cbUid]?.telegramPhotoFileId
            ? await fetchTelegramProfilePhotoFileId(botToken, cbUid).catch(() => undefined)
            : earnMoneyUsers[cbUid]?.telegramPhotoFileId;

        if (!earnMoneyUsers[cbUid]) {
          earnMoneyUsers[cbUid] = createZeroEarnMoneyUser(
            cbUid,
            fullName,
            photoFileId ? `/api/telegram/avatar/${cbUid}` : '',
            {
              firstName,
              lastName,
              username,
              isTelegramUser: true,
              joinedAt: nowIso,
              lastActiveAt: nowIso,
              telegramPhotoFileId: photoFileId,
            }
          );
        } else {
          const existing = earnMoneyUsers[cbUid];
          existing.isTelegramUser = true;
          if (firstName !== undefined) existing.firstName = firstName;
          if (lastName !== undefined) existing.lastName = lastName;
          if (username !== undefined) existing.username = username;
          existing.userName = fullName;
          existing.lastActiveAt = nowIso;
          if (photoFileId) existing.telegramPhotoFileId = photoFileId;
        }
        await persistUserAndReferrer(earnMoneyUsers[cbUid]);
      }

      if (botToken) {
        if (isMaintenanceBlockedForUser(cbUid)) {
          await telegramBotApiCall(botToken, 'answerCallbackQuery', {
            callback_query_id: update.callback_query.id,
            text: earnMoneyConfig.maintenanceMessage.slice(0, 180),
            show_alert: true,
          });
          return;
        }

        await telegramBotApiCall(botToken, 'answerCallbackQuery', {
          callback_query_id: update.callback_query.id,
          text: `Opening ${earnMoneyConfig.botName}...`,
          show_alert: false,
        });
        if (chatId) {
          await telegramBotApiCall(botToken, 'sendMessage', {
            chat_id: chatId,
            text: `✅ Welcome to ${earnMoneyConfig.botName}! Tap below to open:`,
            reply_markup: {
              inline_keyboard: [
                [{ text: `Open ${earnMoneyConfig.botName} 🎁`, web_app: { url: appBaseUrl } }],
              ],
            },
          });
        }
      }
    }
  }

  app.get('/api/telegram/bot-info', async (_req, res) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
    let liveBotUsername: string | null = null;
    if (botToken) {
      const me = await telegramBotApiCall<{ username?: string }>(botToken, 'getMe', {});
      if (me.ok && me.result?.username) {
        liveBotUsername = me.result.username;
      }
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      botUsername: TELEGRAM_BOT_USERNAME,
      configured: Boolean(botToken),
      liveBotUsername,
    });
  });

  app.post('/api/telegram/webhook', async (req, res) => {
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    if (webhookSecret) {
      const incomingHeader =
        typeof req.headers['x-telegram-bot-api-secret-token'] === 'string'
          ? req.headers['x-telegram-bot-api-secret-token']
          : '';
      const a = Buffer.from(incomingHeader, 'utf8');
      const b = Buffer.from(webhookSecret, 'utf8');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        res.status(401).json({ error: 'Invalid webhook secret token.' });
        return;
      }
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
    const update = req.body as TelegramUpdatePayload;
    const appBaseUrl =
      process.env.APP_URL?.trim() ||
      `${req.protocol}://${req.get('host') || 'localhost:3000'}`;

    await processTelegramUpdate(update, botToken, appBaseUrl);
    res.json({ ok: true });
  });

  // --- Secret /admin Auth Routes ---

  const ADMIN_DEFAULT_PASSCODE = 'admin123';

  app.get('/api/admin/auth/status', (req, res) => {
    const envConfigured = Boolean(process.env.ADMIN_PASSCODE?.trim());
    const authenticated = verifyAdminToken(req.headers.authorization);
    res.json({ authenticated, needsClaim: false, envConfigured });
  });

  app.post('/api/admin/auth/login', (req, res) => {
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (!passcode) {
      res.status(400).json({ error: 'Password is required.' });
      return;
    }

    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    const valid =
      verifyEnvPasscode(passcode, ADMIN_DEFAULT_PASSCODE) ||
      (envPasscode ? verifyEnvPasscode(passcode, envPasscode) : false) ||
      (store.adminCredentialHash ? verifyPasscodeHash(passcode, store.adminCredentialHash) : false);

    if (!valid) {
      res.status(401).json({ error: 'Invalid admin password.' });
      return;
    }

    res.json({ token: issueAdminToken() });
  });

  // --- Protected /admin Management Routes ---

  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    res.json({
      stats: computeStats(),
      videos: store.videos,
      channels: store.channels,
      settings: store.settings,
    });
  });

  app.post(
    '/api/admin/upload',
    requireAdmin,
    express.raw({ type: ['video/*', 'image/*', 'application/octet-stream'], limit: '50mb' }),
    (req, res) => {
      const rawName = typeof req.headers['x-file-name'] === 'string' ? req.headers['x-file-name'] : 'asset.bin';
      const ext = path.extname(path.basename(rawName)).toLowerCase();
      const allowedExts = new Set(['.mp4', '.webm', '.mov', '.jpg', '.jpeg', '.png', '.webp']);

      if (!allowedExts.has(ext)) {
        res.status(400).json({ error: 'Unsupported file type. Use MP4, WebM, MOV, JPG, PNG, or WebP.' });
        return;
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: 'Empty upload payload.' });
        return;
      }

      const fileName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
      const targetPath = path.resolve(UPLOADS_DIR, fileName);
      if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
        res.status(400).json({ error: 'Invalid file path.' });
        return;
      }

      fs.writeFileSync(targetPath, req.body);
      res.status(201).json({ url: `/uploads/${fileName}` });
    }
  );

  app.post('/api/admin/videos', requireAdmin, (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : '';
    const rawCat = typeof req.body?.category === 'string' ? req.body.category.trim() : 'Bangla';
    const category = ['Bangla', 'Hindi', 'English'].includes(rawCat) ? rawCat : 'Bangla';
    const quality =
      typeof req.body?.quality === 'string' && req.body.quality.trim()
        ? req.body.quality.trim().slice(0, 32)
        : 'HD';
    const duration =
      typeof req.body?.duration === 'string' && req.body.duration.trim()
        ? req.body.duration.trim().slice(0, 16)
        : '10:00';
    const posterUrl = typeof req.body?.posterUrl === 'string' ? req.body.posterUrl.trim() : '';
    const videoUrl = typeof req.body?.videoUrl === 'string' ? req.body.videoUrl.trim() : '';
    const status: VideoStatus = req.body?.status === 'inactive' ? 'inactive' : 'active';

    if (!title) {
      res.status(400).json({ error: 'Movie name is required.' });
      return;
    }

    if (!isSafeUrl(posterUrl, false)) {
      res.status(400).json({ error: 'Provide a valid Poster Image URL or upload a poster.' });
      return;
    }

    if (!isSafeUrl(videoUrl, true)) {
      res.status(400).json({ error: 'Provide a valid Video URL or upload a video file.' });
      return;
    }

    const newVideo: VideoItem = {
      id: `vid_${crypto.randomBytes(6).toString('hex')}`,
      title,
      category,
      quality,
      duration,
      posterUrl,
      videoUrl,
      views: 0,
      downloads: 0,
      status,
      createdAt: new Date().toISOString(),
    };

    store.videos.unshift(newVideo);
    saveStore(store);

    res.status(201).json({ video: newVideo, stats: computeStats() });
  });

  app.put('/api/admin/videos/:id', requireAdmin, (req, res) => {
    const video = store.videos.find((v) => v.id === req.params.id);
    if (!video) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    if (typeof req.body?.title === 'string') {
      const t = req.body.title.trim().slice(0, 120);
      if (!t) {
        res.status(400).json({ error: 'Movie name cannot be empty.' });
        return;
      }
      video.title = t;
    }

    if (typeof req.body?.category === 'string') {
      const c = req.body.category.trim();
      if (['Bangla', 'Hindi', 'English'].includes(c)) {
        video.category = c;
      }
    }

    if (typeof req.body?.quality === 'string') {
      const q = req.body.quality.trim().slice(0, 32);
      if (q) video.quality = q;
    }

    if (typeof req.body?.duration === 'string') {
      const d = req.body.duration.trim().slice(0, 16);
      if (d) video.duration = d;
    }

    if (typeof req.body?.posterUrl === 'string') {
      const p = req.body.posterUrl.trim();
      if (!isSafeUrl(p, false)) {
        res.status(400).json({ error: 'Invalid poster URL.' });
        return;
      }
      video.posterUrl = p;
    }

    if (typeof req.body?.videoUrl === 'string') {
      const u = req.body.videoUrl.trim();
      if (!isSafeUrl(u, true)) {
        res.status(400).json({ error: 'Invalid video URL.' });
        return;
      }
      video.videoUrl = u;
    }

    if (req.body?.status === 'active' || req.body?.status === 'inactive') {
      video.status = req.body.status;
    }

    saveStore(store);
    res.json({ video, stats: computeStats() });
  });

  app.delete('/api/admin/videos/:id', requireAdmin, (req, res) => {
    const before = store.videos.length;
    store.videos = store.videos.filter((v) => v.id !== req.params.id);
    if (store.videos.length === before) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }
    saveStore(store);
    res.json({ deleted: req.params.id, stats: computeStats() });
  });

  app.post('/api/admin/channels', requireAdmin, (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : '';
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const members = typeof req.body?.members === 'string' ? req.body.members.trim().slice(0, 20) : '';
    let handle = typeof req.body?.handle === 'string' ? req.body.handle.trim().slice(0, 40) : '';

    if (!name || !isSafeUrl(url, false)) {
      res.status(400).json({ error: 'Channel name and valid URL are required.' });
      return;
    }
    if (!handle) {
      handle = deriveHandleFromUrl(url, name);
    } else if (!handle.startsWith('@')) {
      handle = `@${handle}`;
    }

    const channel: ChannelItem = {
      id: `ch_${crypto.randomBytes(5).toString('hex')}`,
      name,
      handle,
      members: members || '',
      url,
    };

    store.channels.push(channel);
    saveStore(store);
    res.status(201).json({ channel, channels: store.channels });
  });

  app.delete('/api/admin/channels/:id', requireAdmin, (req, res) => {
    const before = store.channels.length;
    store.channels = store.channels.filter((c) => c.id !== req.params.id);
    if (store.channels.length === before) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    saveStore(store);
    res.json({ deleted: req.params.id, channels: store.channels });
  });

  app.put('/api/admin/settings', requireAdmin, (req, res) => {
    const watchAdsRequired = Number(req.body?.watchAdsRequired ?? store.settings.watchAdsRequired);
    const watchAdTimerSeconds = Number(
      req.body?.watchAdTimerSeconds ?? store.settings.watchAdTimerSeconds
    );
    const downloadAdsRequired = Number(
      req.body?.downloadAdsRequired ?? store.settings.downloadAdsRequired
    );
    const downloadAdTimerSeconds = Number(
      req.body?.downloadAdTimerSeconds ?? store.settings.downloadAdTimerSeconds
    );
    const forceJoinEnabled =
      typeof req.body?.forceJoinEnabled === 'boolean'
        ? req.body.forceJoinEnabled
        : store.settings.forceJoinEnabled;
    const monetagZoneId =
      typeof req.body?.monetagZoneId === 'string'
        ? req.body.monetagZoneId.trim().slice(0, 60)
        : store.settings.monetagZoneId;

    if (
      !Number.isFinite(watchAdsRequired) ||
      watchAdsRequired < 0 ||
      watchAdsRequired > 50 ||
      !Number.isFinite(downloadAdsRequired) ||
      downloadAdsRequired < 0 ||
      downloadAdsRequired > 50
    ) {
      res.status(400).json({ error: 'Ad counts must be between 0 and 50.' });
      return;
    }

    if (
      !Number.isFinite(watchAdTimerSeconds) ||
      watchAdTimerSeconds < 0 ||
      watchAdTimerSeconds > 300 ||
      !Number.isFinite(downloadAdTimerSeconds) ||
      downloadAdTimerSeconds < 0 ||
      downloadAdTimerSeconds > 300
    ) {
      res.status(400).json({ error: 'Ad timers must be between 0 and 300 seconds.' });
      return;
    }

    store.settings = {
      watchAdsRequired: Math.round(watchAdsRequired),
      watchAdTimerSeconds: Math.round(watchAdTimerSeconds),
      downloadAdsRequired: Math.round(downloadAdsRequired),
      downloadAdTimerSeconds: Math.round(downloadAdTimerSeconds),
      forceJoinEnabled,
      monetagZoneId,
    };
    saveStore(store);
    res.json({ settings: store.settings });
  });

  // --- Protected /admin Earn Money Management Routes ---

  function buildEarnMoneyAdminOverview() {
    const usersList = Object.values(earnMoneyUsers)
      .filter(isRealTelegramUserRecord)
      .sort((a, b) => {
        const ta = new Date(a.lastActiveAt || a.joinedAt || 0).getTime();
        const tb = new Date(b.lastActiveAt || b.joinedAt || 0).getTime();
        return tb - ta;
      })
      .map((u) => syncUserWithConfig(u));
    const withdrawals: AdminWithdrawalRecord[] = [];
    for (const user of usersList) {
      for (const wd of user.withdrawHistory || []) {
        withdrawals.push({
          ...wd,
          userId: user.userId,
          userName: user.userName,
          userBalance: user.totalBalance,
        });
      }
    }

    const pendingWithdrawals = withdrawals.filter((w) => w.status === 'Pending').length;
    const totalWithdrawAmount = Number(
      usersList.reduce((acc, u) => acc + (u.totalWithdraw || 0), 0).toFixed(4)
    );

    return {
      config: earnMoneyConfig,
      users: usersList,
      withdrawals,
      stats: {
        totalUsers: usersList.length,
        activeUsers: usersList.filter((u) => !u.isBlocked).length,
        blockedUsers: usersList.filter((u) => Boolean(u.isBlocked)).length,
        totalTasks: earnMoneyConfig.tasks.length,
        activeTasks: earnMoneyConfig.tasks.filter((t) => t.active !== false).length,
        pendingWithdrawals,
        totalWithdrawAmount,
      },
    };
  }

  app.get('/api/admin/earnmoney/overview', requireAdmin, async (_req, res) => {
    const dbStatus = await refreshEarnMoneyStoreFromDatabase();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...buildEarnMoneyAdminOverview(), dbStatus });
  });

  app.put('/api/admin/earnmoney/settings', requireAdmin, async (req, res) => {
    const dbStatus = await checkSupabaseConnection();
    latestDbStatus = dbStatus;
    if (!dbStatus.connected) {
      res.status(503).json({
        error: 'Connect Database to Save Permanently',
        dbStatus,
      });
      return;
    }

    const body = (req.body || {}) as Partial<EarnMoneyConfig>;

    const botName =
      body.botName !== undefined
        ? String(body.botName).trim().slice(0, 80)
        : earnMoneyConfig.botName;
    const welcomeTitle =
      body.welcomeTitle !== undefined
        ? String(body.welcomeTitle).trim().slice(0, 140)
        : earnMoneyConfig.welcomeTitle;
    const welcomeSubtitle =
      body.welcomeSubtitle !== undefined
        ? String(body.welcomeSubtitle).trim().slice(0, 240)
        : earnMoneyConfig.welcomeSubtitle;
    const channel1Url =
      body.channel1Url !== undefined ? String(body.channel1Url).trim() : earnMoneyConfig.channel1Url;
    const channel2Url =
      body.channel2Url !== undefined ? String(body.channel2Url).trim() : earnMoneyConfig.channel2Url;
    const minWithdrawAmount =
      body.minWithdrawAmount !== undefined
        ? Number(body.minWithdrawAmount)
        : earnMoneyConfig.minWithdrawAmount;
    const maxWithdrawAmount =
      body.maxWithdrawAmount !== undefined
        ? Number(body.maxWithdrawAmount)
        : earnMoneyConfig.maxWithdrawAmount;
    const withdrawRequiredAds =
      body.withdrawRequiredAds !== undefined
        ? Number(body.withdrawRequiredAds)
        : earnMoneyConfig.withdrawRequiredAds;
    const withdrawFeePercent =
      body.withdrawFeePercent !== undefined
        ? Number(body.withdrawFeePercent)
        : earnMoneyConfig.withdrawFeePercent;
    const supportUsername =
      body.supportUsername !== undefined
        ? String(body.supportUsername).trim().slice(0, 80)
        : earnMoneyConfig.supportUsername;

    // 1. Refer System Settings
    const referBonusAmount =
      body.referBonusAmount !== undefined
        ? Number(body.referBonusAmount)
        : earnMoneyConfig.referBonusAmount;
    const referMinAdsWatched =
      body.referMinAdsWatched !== undefined
        ? Number(body.referMinAdsWatched)
        : earnMoneyConfig.referMinAdsWatched;
    const referMinChannelsJoined =
      body.referMinChannelsJoined !== undefined
        ? Number(body.referMinChannelsJoined)
        : earnMoneyConfig.referMinChannelsJoined;
    const referMinTasksCompleted =
      body.referMinTasksCompleted !== undefined
        ? Number(body.referMinTasksCompleted)
        : earnMoneyConfig.referMinTasksCompleted;
    const referBonusType =
      body.referBonusType === 'instant' || body.referBonusType === 'after_activation'
        ? body.referBonusType
        : earnMoneyConfig.referBonusType;
    const maxReferPerUser =
      body.maxReferPerUser !== undefined
        ? Number(body.maxReferPerUser)
        : earnMoneyConfig.maxReferPerUser;
    const referLinkFormat =
      body.referLinkFormat !== undefined
        ? String(body.referLinkFormat).trim().slice(0, 200)
        : earnMoneyConfig.referLinkFormat;

    // 2. Premium Ads Slot Settings
    const premiumAdsEnabled =
      typeof body.premiumAdsEnabled === 'boolean'
        ? body.premiumAdsEnabled
        : earnMoneyConfig.premiumAdsEnabled;
    const premiumAdsBudget =
      body.premiumAdsBudget !== undefined
        ? Number(body.premiumAdsBudget)
        : earnMoneyConfig.premiumAdsBudget;
    const perAdViewReward =
      body.perAdViewReward !== undefined
        ? Number(body.perAdViewReward)
        : earnMoneyConfig.perAdViewReward;
    const perAdClickReward =
      body.perAdClickReward !== undefined
        ? Number(body.perAdClickReward)
        : earnMoneyConfig.perAdClickReward;
    const dailyAdsLimitPerUser =
      body.dailyAdsLimitPerUser !== undefined
        ? Number(body.dailyAdsLimitPerUser)
        : earnMoneyConfig.dailyAdsLimitPerUser;
    const adsSlotPriceForAdvertiser =
      body.adsSlotPriceForAdvertiser !== undefined
        ? Number(body.adsSlotPriceForAdvertiser)
        : earnMoneyConfig.adsSlotPriceForAdvertiser;
    const monetagLink =
      body.monetagLink !== undefined
        ? String(body.monetagLink).trim().slice(0, 600)
        : earnMoneyConfig.monetagLink;

    // 3. Maintenance Mode Settings
    const maintenanceMode =
      typeof body.maintenanceMode === 'boolean'
        ? body.maintenanceMode
        : earnMoneyConfig.maintenanceMode;
    const maintenanceMessage =
      body.maintenanceMessage !== undefined
        ? String(body.maintenanceMessage).trim().slice(0, 500)
        : earnMoneyConfig.maintenanceMessage;
    const maintenanceAdminId =
      body.maintenanceAdminId !== undefined
        ? String(body.maintenanceAdminId).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
        : earnMoneyConfig.maintenanceAdminId;

    if (!botName || !welcomeTitle || !welcomeSubtitle) {
      res.status(400).json({ error: 'Bot Name, Welcome Title, and Welcome Subtitle are required.' });
      return;
    }
    if (!isSafeUrl(channel1Url, false) || !isSafeUrl(channel2Url, false)) {
      res.status(400).json({ error: 'Channel 1 and Channel 2 links must be valid http/https URLs.' });
      return;
    }
    if (!referLinkFormat || !isSafeUrl(referLinkFormat.replace(/\[USER_ID\]|\{USER_ID\}/gi, '12345'), false)) {
      res.status(400).json({ error: 'Refer Link Format must be a valid http/https URL.' });
      return;
    }
    if (!isValidMonetagInput(monetagLink)) {
      res.status(400).json({
        error: 'Monetag Link must be a valid http/https URL, Zone ID, or Monetag SDK <script> tag.',
      });
      return;
    }
    const nonNegativeNumbers = [
      referBonusAmount,
      minWithdrawAmount,
      maxWithdrawAmount,
      withdrawRequiredAds,
      withdrawFeePercent,
      referMinAdsWatched,
      referMinChannelsJoined,
      referMinTasksCompleted,
      maxReferPerUser,
      premiumAdsBudget,
      perAdViewReward,
      perAdClickReward,
      adsSlotPriceForAdvertiser,
    ];
    if (nonNegativeNumbers.some((n) => !Number.isFinite(n) || n < 0)) {
      res.status(400).json({ error: 'Numeric reward, rule, and budget values must be 0 or higher.' });
      return;
    }
    if (maxWithdrawAmount > 0 && maxWithdrawAmount < minWithdrawAmount) {
      res.status(400).json({
        error: 'Maximum Withdraw Amount must be 0 (unlimited) or greater than or equal to Minimum Withdraw Amount.',
      });
      return;
    }
    if (withdrawFeePercent > 100) {
      res.status(400).json({ error: 'Withdraw Fee % must be between 0 and 100.' });
      return;
    }
    if (!Number.isFinite(dailyAdsLimitPerUser) || dailyAdsLimitPerUser < 1 || dailyAdsLimitPerUser > 1000) {
      res.status(400).json({ error: 'Daily Ads Limit Per User must be between 1 and 1000.' });
      return;
    }
    if (!supportUsername) {
      res.status(400).json({ error: 'Support Username is required.' });
      return;
    }
    if (!maintenanceMessage) {
      res.status(400).json({ error: 'Maintenance Message cannot be empty.' });
      return;
    }

    earnMoneyConfig = {
      ...earnMoneyConfig,
      botName,
      welcomeTitle,
      welcomeSubtitle,
      channel1Url,
      channel2Url,
      minWithdrawAmount: Number(minWithdrawAmount.toFixed(4)),
      maxWithdrawAmount: Number(maxWithdrawAmount.toFixed(4)),
      withdrawRequiredAds: Math.floor(withdrawRequiredAds),
      withdrawFeePercent: Number(withdrawFeePercent.toFixed(2)),
      supportUsername:
        supportUsername.startsWith('@') || supportUsername.startsWith('http')
          ? supportUsername
          : `@${supportUsername}`,

      referBonusAmount: Number(referBonusAmount.toFixed(4)),
      referMinAdsWatched: Math.floor(referMinAdsWatched),
      referMinChannelsJoined: Math.floor(referMinChannelsJoined),
      referMinTasksCompleted: Math.floor(referMinTasksCompleted),
      referBonusType,
      maxReferPerUser: Math.floor(maxReferPerUser),
      referLinkFormat,

      premiumAdsEnabled,
      premiumAdsBudget: Number(premiumAdsBudget.toFixed(4)),
      perAdViewReward: Number(perAdViewReward.toFixed(4)),
      perAdClickReward: Number(perAdClickReward.toFixed(4)),
      dailyAdsLimitPerUser: Math.floor(dailyAdsLimitPerUser),
      adsSlotPriceForAdvertiser: Number(adsSlotPriceForAdvertiser.toFixed(4)),
      monetagLink,

      maintenanceMode,
      maintenanceMessage,
      maintenanceAdminId,

      updatedAt: new Date().toISOString(),
    };
    try {
      await saveConfigToSupabase(earnMoneyConfig);
      const refreshed = await loadConfigFromSupabase(DEFAULT_EARNMONEY_CONFIG);
      if (refreshed) earnMoneyConfig = refreshed;
      res.json({ config: earnMoneyConfig, dbStatus });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to save settings to Supabase.',
        dbStatus,
      });
    }
  });

  app.post('/api/admin/earnmoney/tasks', requireAdmin, async (req, res) => {
    const dbStatus = await checkSupabaseConnection();
    latestDbStatus = dbStatus;
    if (!dbStatus.connected) {
      res.status(503).json({
        error: 'Connect Database to Save Permanently',
        dbStatus,
      });
      return;
    }

    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 80) : '';
    const taskType: TaskType = normalizeTaskType(
      typeof req.body?.taskType === 'string' ? req.body.taskType : undefined,
      typeof req.body?.badge === 'string' ? req.body.badge : undefined
    );
    const rewardUsdt = Number(req.body?.rewardUsdt);
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const active = req.body?.active !== false;

    if (title.length < 2) {
      res.status(400).json({ error: 'Task title is required.' });
      return;
    }
    if (!Number.isFinite(rewardUsdt) || rewardUsdt <= 0 || rewardUsdt > 1000) {
      res.status(400).json({ error: 'Task reward must be greater than 0.' });
      return;
    }
    if (!isSafeUrl(url, false)) {
      res.status(400).json({ error: 'Valid http/https Task URL is required.' });
      return;
    }

    const newTask: BonusTaskItem = {
      id: `task_${crypto.randomBytes(5).toString('hex')}`,
      title,
      taskType,
      badge: taskType,
      rewardUsdt: Number(rewardUsdt.toFixed(4)),
      url,
      completed: false,
      active,
      createdBy: 'admin',
    };

    try {
      await insertTaskToSupabase(newTask);
      const refreshed = await loadConfigFromSupabase(DEFAULT_EARNMONEY_CONFIG);
      if (refreshed) earnMoneyConfig = refreshed;
      res.status(201).json({ task: newTask, config: earnMoneyConfig, dbStatus });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to save task to Supabase.',
        dbStatus,
      });
    }
  });

  app.put('/api/admin/earnmoney/tasks/:id', requireAdmin, async (req, res) => {
    const dbStatus = await checkSupabaseConnection();
    latestDbStatus = dbStatus;
    if (!dbStatus.connected) {
      res.status(503).json({
        error: 'Connect Database to Save Permanently',
        dbStatus,
      });
      return;
    }

    await refreshEarnMoneyStoreFromDatabase();
    const task = earnMoneyConfig.tasks.find((t) => t.id === req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    if (typeof req.body?.title === 'string') {
      const t = req.body.title.trim().slice(0, 80);
      if (t.length < 2) {
        res.status(400).json({ error: 'Task title cannot be empty.' });
        return;
      }
      task.title = t;
    }
    if (typeof req.body?.taskType === 'string' || typeof req.body?.badge === 'string') {
      const nextType = normalizeTaskType(
        typeof req.body?.taskType === 'string' ? req.body.taskType : undefined,
        typeof req.body?.badge === 'string' ? req.body.badge : undefined
      );
      task.taskType = nextType;
      task.badge = nextType;
    }
    if (req.body?.rewardUsdt !== undefined) {
      const r = Number(req.body.rewardUsdt);
      if (!Number.isFinite(r) || r <= 0 || r > 1000) {
        res.status(400).json({ error: 'Reward must be greater than 0.' });
        return;
      }
      task.rewardUsdt = Number(r.toFixed(4));
    }
    if (typeof req.body?.url === 'string') {
      const u = req.body.url.trim();
      if (!isSafeUrl(u, false)) {
        res.status(400).json({ error: 'Valid http/https Task URL is required.' });
        return;
      }
      task.url = u;
    }
    if (typeof req.body?.active === 'boolean') {
      task.active = req.body.active;
    }

    try {
      await updateTaskInSupabase(task);
      const refreshed = await loadConfigFromSupabase(DEFAULT_EARNMONEY_CONFIG);
      if (refreshed) earnMoneyConfig = refreshed;
      res.json({ task, config: earnMoneyConfig, dbStatus });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to update task in Supabase.',
        dbStatus,
      });
    }
  });

  app.delete('/api/admin/earnmoney/tasks/:id', requireAdmin, async (req, res) => {
    const dbStatus = await checkSupabaseConnection();
    latestDbStatus = dbStatus;
    if (!dbStatus.connected) {
      res.status(503).json({
        error: 'Connect Database to Save Permanently',
        dbStatus,
      });
      return;
    }

    await refreshEarnMoneyStoreFromDatabase();
    const exists = earnMoneyConfig.tasks.some((t) => t.id === req.params.id);
    if (!exists) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    try {
      await deleteTaskFromSupabase(req.params.id);
      const refreshed = await loadConfigFromSupabase(DEFAULT_EARNMONEY_CONFIG);
      if (refreshed) earnMoneyConfig = refreshed;
      res.json({ deleted: req.params.id, config: earnMoneyConfig, dbStatus });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to delete task from Supabase.',
        dbStatus,
      });
    }
  });

  app.get('/api/admin/earnmoney/users', requireAdmin, async (req, res) => {
    const dbStatus = await refreshEarnMoneyStoreFromDatabase();
    const q = typeof req.query?.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const usersList = Object.values(earnMoneyUsers)
      .filter(isRealTelegramUserRecord)
      .filter((u) => {
        if (!q) return true;
        const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase();
        const uname = (u.username || '').toLowerCase();
        return (
          u.userId.toLowerCase().includes(q) ||
          u.userName.toLowerCase().includes(q) ||
          fullName.includes(q) ||
          uname.includes(q) ||
          (uname && `@${uname}`.includes(q))
        );
      })
      .sort((a, b) => {
        const ta = new Date(a.lastActiveAt || a.joinedAt || 0).getTime();
        const tb = new Date(b.lastActiveAt || b.joinedAt || 0).getTime();
        return tb - ta;
      })
      .map((u) => syncUserWithConfig(u));
    res.setHeader('Cache-Control', 'no-store');
    res.json({ users: usersList, dbStatus });
  });

  app.post('/api/admin/earnmoney/users/:uid/balance', requireAdmin, async (req, res) => {
    const dbStatus = await refreshEarnMoneyStoreFromDatabase();
    if (!dbStatus.connected) {
      res.status(503).json({ error: 'Connect Database to Save Permanently', dbStatus });
      return;
    }

    const uid = String(req.params.uid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const user = earnMoneyUsers[uid];
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const action = req.body?.action;
    const amount = Number(req.body?.amount);
    if ((action !== 'add' && action !== 'cut') || !Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      res.status(400).json({ error: 'Valid action (add/cut) and positive amount are required.' });
      return;
    }

    if (action === 'add') {
      user.totalBalance = Number((user.totalBalance + amount).toFixed(4));
      user.totalIncome = Number((user.totalIncome + amount).toFixed(4));
    } else {
      user.totalBalance = Math.max(0, Number((user.totalBalance - amount).toFixed(4)));
    }

    earnMoneyUsers[uid] = user;
    await upsertUserToSupabase(user);
    res.json({ user: syncUserWithConfig(user), dbStatus });
  });

  app.post('/api/admin/earnmoney/users/:uid/block', requireAdmin, async (req, res) => {
    const dbStatus = await refreshEarnMoneyStoreFromDatabase();
    if (!dbStatus.connected) {
      res.status(503).json({ error: 'Connect Database to Save Permanently', dbStatus });
      return;
    }

    const uid = String(req.params.uid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const user = earnMoneyUsers[uid];
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const isBlocked = typeof req.body?.isBlocked === 'boolean' ? req.body.isBlocked : !user.isBlocked;
    user.isBlocked = isBlocked;
    earnMoneyUsers[uid] = user;
    await upsertUserToSupabase(user);
    res.json({ user: syncUserWithConfig(user), dbStatus });
  });

  app.post('/api/admin/earnmoney/withdrawals/:uid/:wdId/decide', requireAdmin, async (req, res) => {
    const dbStatus = await refreshEarnMoneyStoreFromDatabase();
    if (!dbStatus.connected) {
      res.status(503).json({ error: 'Connect Database to Save Permanently', dbStatus });
      return;
    }

    const uid = String(req.params.uid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const wdId = String(req.params.wdId || '');
    const decision = req.body?.decision;

    const user = earnMoneyUsers[uid];
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const wd = (user.withdrawHistory || []).find((item) => item.id === wdId);
    if (!wd) {
      res.status(404).json({ error: 'Withdrawal request not found.' });
      return;
    }
    if (wd.status !== 'Pending') {
      res.status(409).json({ error: `Withdrawal is already ${wd.status}.` });
      return;
    }
    if (decision !== 'approve' && decision !== 'reject') {
      res.status(400).json({ error: 'Decision must be approve or reject.' });
      return;
    }

    if (decision === 'approve') {
      if (user.totalBalance < wd.amountUsdt) {
        res.status(400).json({ error: 'User balance is lower than withdrawal amount.' });
        return;
      }
      wd.status = 'Completed';
      user.totalBalance = Math.max(0, Number((user.totalBalance - wd.amountUsdt).toFixed(4)));
      user.totalWithdraw = Number((user.totalWithdraw + wd.amountUsdt).toFixed(4));
    } else {
      wd.status = 'Rejected';
    }

    earnMoneyUsers[uid] = user;
    await updateWithdrawStatusInSupabase(wdId, wd.status);
    await upsertUserToSupabase(user);
    res.json({
      withdrawal: wd,
      user: syncUserWithConfig(user),
      overview: { ...buildEarnMoneyAdminOverview(), dbStatus },
      dbStatus,
    });
  });

  const httpServer = http.createServer(app);

  // --- Vite / Static Frontend Serving ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
      },
      appType: 'custom',
    });

    app.get('/admin', async (req, res, next) => {
      try {
        const rawHtml = fs.readFileSync(path.resolve(__dirname, 'admin.html'), 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        next(err);
      }
    });

    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      try {
        const rawHtml = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/admin', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'admin.html'));
    });
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  async function startTelegramPollingIfConfigured() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
    if (!botToken || process.env.TELEGRAM_USE_WEBHOOK === 'true') return;

    const appBaseUrl = process.env.APP_URL?.trim() || `http://localhost:${Number(process.env.PORT) || 3000}`;
    await telegramBotApiCall(botToken, 'deleteWebhook', { drop_pending_updates: false });

    let offset = 0;
    const poll = async () => {
      try {
        const res = await telegramBotApiCall<TelegramUpdatePayload[]>(botToken, 'getUpdates', {
          offset,
          timeout: 25,
          allowed_updates: ['message', 'callback_query'],
        });
        if (res.ok && Array.isArray(res.result)) {
          for (const upd of res.result) {
            if (typeof upd.update_id === 'number') {
              offset = Math.max(offset, upd.update_id + 1);
            }
            await processTelegramUpdate(upd, botToken, appBaseUrl);
          }
        }
      } catch {
        // retry after short backoff
      }
      setTimeout(() => void poll(), 800);
    };

    console.log(`Telegram bot polling active for @${TELEGRAM_BOT_USERNAME}`);
    void poll();
  }

  await refreshEarnMoneyStoreFromDatabase().catch(() => undefined);

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Earn Money Mini App (@${TELEGRAM_BOT_USERNAME}) listening on http://0.0.0.0:${PORT} [DB: ${latestDbStatus.connected ? 'Connected (Supabase)' : 'Not Connected'}]`
    );
    void startTelegramPollingIfConfigured();
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
