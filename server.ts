import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
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
  isTaskCompletedForUser,
  normalizeTaskType,
} from './src/data/defaultEarnMoneyState.ts';
import type {
  AdminWithdrawalRecord,
  BonusTaskItem,
  EarnMoneyConfig,
  EarnMoneyState,
  TaskType,
} from './src/types/earnMoney.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const STORE_PATH = path.resolve(DATA_DIR, 'cinevault_store.json');
const EARNMONEY_PATH = path.resolve(DATA_DIR, 'earnmoney_users.json');
const EARNMONEY_CONFIG_PATH = path.resolve(DATA_DIR, 'earnmoney_config.json');

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
  minWithdrawAmount: 0.8,
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
  dailyAdsLimitPerUser: 20,
  adsSlotPriceForAdvertiser: 5,

  maintenanceMode: false,
  maintenanceMessage:
    'Bot is under maintenance. New features coming soon. Please try again later.',
  maintenanceAdminId: '',

  tasks: [
    {
      id: 'task_verify_app',
      title: 'Verify App',
      taskType: 'Daily',
      badge: 'Daily',
      rewardUsdt: 0.2,
      url: 'https://t.me/premiumapps5462',
      completed: false,
      active: true,
      createdBy: 'admin',
    },
  ],
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
      ? parsed.tasks.map((t) => {
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
      : structuredClone(DEFAULT_EARNMONEY_CONFIG.tasks);

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

type ServerEarnMoneyState = EarnMoneyState;

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

function createZeroEarnMoneyUser(
  userId: string,
  userName: string,
  userAvatar: string
): ServerEarnMoneyState {
  const dailyTotal = Math.max(1, earnMoneyConfig.dailyAdsLimitPerUser || 20);
  const ceiling = Number((dailyTotal * (earnMoneyConfig.perAdViewReward || 0.01)).toFixed(4));
  const instantRefer =
    earnMoneyConfig.referMinAdsWatched === 0 &&
    earnMoneyConfig.referMinChannelsJoined === 0 &&
    earnMoneyConfig.referMinTasksCompleted === 0;

  return {
    userId,
    userName: userName || 'Earn Money User',
    userAvatar: userAvatar || '/src/assets/images/earnmoney_avatar_1795708537961.jpg',
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
    bonusTasks: [],
    referralsList: [],
    withdrawHistory: [],
  };
}

function syncUserWithConfig(user: ServerEarnMoneyState, now = Date.now()): ServerEarnMoneyState {
  const completedSet = new Set<string>(Array.isArray(user.completedTaskIds) ? user.completedTaskIds : []);
  const taskCompletions: Record<string, number> =
    user.taskCompletions && typeof user.taskCompletions === 'object' ? { ...user.taskCompletions } : {};

  if (Array.isArray(user.bonusTasks)) {
    for (const t of user.bonusTasks) {
      if (t.completed) completedSet.add(t.id);
    }
  }

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

  const dailyTotal = Math.max(1, earnMoneyConfig.dailyAdsLimitPerUser || 20);
  const dailyCeiling = Number((dailyTotal * (earnMoneyConfig.perAdViewReward || 0.01)).toFixed(4));
  const dailyCompleted = Math.min(dailyTotal, user.dailyAdsCompleted || 0);

  const syncedBase: ServerEarnMoneyState = {
    ...user,
    isBlocked: Boolean(user.isBlocked),
    dailyAdsTotal: dailyTotal,
    dailyAdsCompleted: dailyCompleted,
    nextSlotNumber: Math.min(dailyTotal, dailyCompleted + 1),
    dailyCeilingUsdt: dailyCeiling,
    completedTaskIds: Array.from(completedSet),
    taskCompletions,
    bonusTasks: [...adminTasks, ...userCustomTasks],
    referralsList: Array.isArray(user.referralsList) ? user.referralsList : [],
    withdrawHistory: Array.isArray(user.withdrawHistory) ? user.withdrawHistory : [],
  };

  syncedBase.referralActivated = isActivationRuleMetForUser(syncedBase);
  return syncedBase;
}

function loadEarnMoneyUsers(): EarnMoneyUserMap {
  if (!fs.existsSync(EARNMONEY_PATH)) return {};
  try {
    const raw = fs.readFileSync(EARNMONEY_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as EarnMoneyUserMap)
      : {};
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
    if (!earnMoneyUsers[uid]) {
      earnMoneyUsers[uid] = createZeroEarnMoneyUser(
        uid,
        'Earn Money User',
        '/src/assets/images/earnmoney_avatar_1795708537961.jpg'
      );
      saveEarnMoneyUsers(earnMoneyUsers);
    }

    const userRecord = earnMoneyUsers[uid];
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
    const canLiveCheck = Boolean(botToken) && isTelegramUser && /^\d{4,20}$/.test(uid);

    let joinedWaincomesite = Boolean(userRecord.joinedWaincomesite);
    let joinedPremiumApps = Boolean(userRecord.joinedPremiumApps);

    if (canLiveCheck) {
      const [wJoined, pJoined] = await Promise.all([
        checkLiveTelegramChannelMember(botToken, '@waincomesite', uid),
        checkLiveTelegramChannelMember(botToken, '@premiumapps5462', uid),
      ]);
      joinedWaincomesite = wJoined;
      joinedPremiumApps = pJoined;
      userRecord.joinedWaincomesite = wJoined;
      userRecord.joinedPremiumApps = pJoined;
      saveEarnMoneyUsers(earnMoneyUsers);
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

  app.get('/api/earnmoney/config', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ config: earnMoneyConfig });
  });

  app.get('/api/earnmoney/state', (req, res) => {
    const rawUid = typeof req.query?.uid === 'string' ? req.query.uid.trim() : '';
    const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!uid) {
      res.status(400).json({ error: 'Valid uid is required.' });
      return;
    }

    const name =
      typeof req.query?.name === 'string' && req.query.name.trim()
        ? req.query.name.trim().slice(0, 80)
        : 'Earn Money User';
    const avatar =
      typeof req.query?.avatar === 'string' && isSafeUrl(req.query.avatar, false)
        ? req.query.avatar.trim()
        : '/src/assets/images/earnmoney_avatar_1795708537961.jpg';
    const rawRef = typeof req.query?.ref === 'string' ? req.query.ref.trim() : '';
    const refUid = rawRef.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

    if (!earnMoneyUsers[uid]) {
      earnMoneyUsers[uid] = createZeroEarnMoneyUser(uid, name, avatar);
      applyReferralAttribution(uid, name, refUid);
      saveEarnMoneyUsers(earnMoneyUsers);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      state: syncUserWithConfig(earnMoneyUsers[uid]),
      config: earnMoneyConfig,
      isMaintenanceAdmin: isMaintenanceAdmin(uid),
    });
  });

  app.put('/api/earnmoney/state', (req, res) => {
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

    const base =
      earnMoneyUsers[uid] ??
      createZeroEarnMoneyUser(
        uid,
        typeof incoming.userName === 'string' ? incoming.userName.slice(0, 80) : 'Earn Money User',
        typeof incoming.userAvatar === 'string' && isSafeUrl(incoming.userAvatar, false)
          ? incoming.userAvatar
          : '/src/assets/images/earnmoney_avatar_1795708537961.jpg'
      );

    if (base.isBlocked) {
      res.status(403).json({ error: 'Account is blocked by administrator.' });
      return;
    }

    earnMoneyUsers[uid] = {
      ...base,
      userName:
        typeof incoming.userName === 'string' && incoming.userName.trim()
          ? incoming.userName.trim().slice(0, 80)
          : base.userName,
      userAvatar:
        typeof incoming.userAvatar === 'string' && isSafeUrl(incoming.userAvatar, false)
          ? incoming.userAvatar
          : base.userAvatar,
      joinedWaincomesite: Boolean(incoming.joinedWaincomesite ?? base.joinedWaincomesite),
      joinedPremiumApps: Boolean(incoming.joinedPremiumApps ?? base.joinedPremiumApps),
      userId: uid,
    };
    evaluateReferralProgressAndCredit(earnMoneyUsers[uid]);
    saveEarnMoneyUsers(earnMoneyUsers);
    res.json({ ok: true, state: syncUserWithConfig(earnMoneyUsers[uid]) });
  });

  app.post('/api/earnmoney/ad-claim', (req, res) => {
    const rawUid = typeof req.body?.uid === 'string' ? req.body.uid.trim() : '';
    const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const mode = req.body?.mode === 'click' ? 'click' : 'view';
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

    const user =
      earnMoneyUsers[uid] ??
      createZeroEarnMoneyUser(
        uid,
        'Earn Money User',
        '/src/assets/images/earnmoney_avatar_1795708537961.jpg'
      );
    if (user.isBlocked) {
      res.status(403).json({ error: 'Your account has been blocked by admin.' });
      return;
    }
    if (!earnMoneyConfig.premiumAdsEnabled || earnMoneyConfig.premiumAdsBudget <= 0) {
      res.status(400).json({ error: 'Premium Ads Slot Empty' });
      return;
    }

    const dailyLimit = Math.max(1, earnMoneyConfig.dailyAdsLimitPerUser || 20);
    if (user.dailyAdsCompleted >= dailyLimit) {
      res.status(400).json({ error: `Daily ${dailyLimit} ad slots already completed.` });
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
    saveEarnMoneyConfig(earnMoneyConfig);

    user.totalBalance = Number((user.totalBalance + reward).toFixed(4));
    user.totalIncome = Number((user.totalIncome + reward).toFixed(4));
    user.dailyAdsCompleted = Math.min(dailyLimit, user.dailyAdsCompleted + 1);
    user.dailyAdsTotal = dailyLimit;
    user.nextSlotNumber = Math.min(dailyLimit, user.dailyAdsCompleted + 1);
    user.adsWatchedTotal += 1;
    user.activateAdsDone = user.adsWatchedTotal;

    evaluateReferralProgressAndCredit(user);
    earnMoneyUsers[uid] = user;
    saveEarnMoneyUsers(earnMoneyUsers);
    res.json({ state: syncUserWithConfig(user), config: earnMoneyConfig, reward });
  });

  app.post('/api/earnmoney/tasks/complete', (req, res) => {
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

    const user =
      earnMoneyUsers[uid] ??
      createZeroEarnMoneyUser(
        uid,
        'Earn Money User',
        '/src/assets/images/earnmoney_avatar_1795708537961.jpg'
      );
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
          resolvedType === 'Permanent'
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
    saveEarnMoneyUsers(earnMoneyUsers);
    res.json({
      state: syncUserWithConfig(user, now),
      config: earnMoneyConfig,
      rewardUsdt: targetTask.rewardUsdt,
    });
  });

  app.post('/api/earnmoney/tasks/custom', (req, res) => {
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

    const user =
      earnMoneyUsers[uid] ??
      createZeroEarnMoneyUser(
        uid,
        'Earn Money User',
        '/src/assets/images/earnmoney_avatar_1795708537961.jpg'
      );
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
    saveEarnMoneyUsers(earnMoneyUsers);
    res.status(201).json({ state: syncUserWithConfig(user), config: earnMoneyConfig });
  });

  app.post('/api/earnmoney/activate-refer', (req, res) => {
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
    saveEarnMoneyUsers(earnMoneyUsers);
    res.json({ state: syncUserWithConfig(user) });
  });

  app.post('/api/earnmoney/withdraw', (req, res) => {
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

    const minWithdraw = earnMoneyConfig.minWithdrawAmount;
    if (!Number.isFinite(amount) || amount < minWithdraw) {
      res.status(400).json({
        error: `Minimum withdrawal amount is ${minWithdraw.toFixed(2)} USDT.`,
      });
      return;
    }
    if (amount > user.totalBalance) {
      res.status(400).json({ error: 'Insufficient USDT balance.' });
      return;
    }
    if (!/^0x[a-fA-F0-9]{10,42}$/.test(address)) {
      res.status(400).json({ error: 'Enter a valid BEP20 (BSC) wallet address starting with 0x.' });
      return;
    }

    const shortAddr =
      address.length > 12 ? `${address.slice(0, 5)}...${address.slice(-4)}` : address;
    const todayLabel = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });

    user.totalBalance = Number((user.totalBalance - amount).toFixed(4));
    user.withdrawHistory = [
      {
        id: `wd_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        amountUsdt: Number(amount.toFixed(4)),
        address: shortAddr,
        date: todayLabel,
        status: 'Pending',
      },
      ...(user.withdrawHistory || []),
    ];

    earnMoneyUsers[uid] = user;
    saveEarnMoneyUsers(earnMoneyUsers);
    res.status(201).json({
      state: syncUserWithConfig(user),
      message: `Withdrawal request for ${amount.toFixed(2)} USDT submitted to ${shortAddr}.`,
    });
  });

  app.post('/api/earnmoney/mark-channel', (req, res) => {
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

    if (!earnMoneyUsers[uid]) {
      earnMoneyUsers[uid] = createZeroEarnMoneyUser(
        uid,
        'Earn Money User',
        '/src/assets/images/earnmoney_avatar_1795708537961.jpg'
      );
    }

    if (channel === 'waincomesite') {
      earnMoneyUsers[uid].joinedWaincomesite = true;
    } else {
      earnMoneyUsers[uid].joinedPremiumApps = true;
    }
    evaluateReferralProgressAndCredit(earnMoneyUsers[uid]);
    saveEarnMoneyUsers(earnMoneyUsers);

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
    if (update?.message?.text && update.message.chat?.id && update.message.from?.id) {
      const text = update.message.text.trim();
      const chatId = update.message.chat.id;
      const uid = String(update.message.from.id).replace(/[^0-9]/g, '');
      const fullName =
        [update.message.from.first_name, update.message.from.last_name].filter(Boolean).join(' ') ||
        update.message.from.username ||
        'Earn Money User';

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

        if (uid && !earnMoneyUsers[uid]) {
          earnMoneyUsers[uid] = createZeroEarnMoneyUser(
            uid,
            fullName,
            '/src/assets/images/earnmoney_avatar_1795708537961.jpg'
          );
          applyReferralAttribution(uid, fullName, refUid);
          saveEarnMoneyUsers(earnMoneyUsers);
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
      const cbUid = String(update.callback_query.from?.id ?? '').replace(/[^0-9]/g, '');

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
    const usersList = Object.values(earnMoneyUsers).map((u) => syncUserWithConfig(u));
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

  app.get('/api/admin/earnmoney/overview', requireAdmin, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(buildEarnMoneyAdminOverview());
  });

  app.put('/api/admin/earnmoney/settings', requireAdmin, (req, res) => {
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
    const nonNegativeNumbers = [
      referBonusAmount,
      minWithdrawAmount,
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

      maintenanceMode,
      maintenanceMessage,
      maintenanceAdminId,

      updatedAt: new Date().toISOString(),
    };
    saveEarnMoneyConfig(earnMoneyConfig);
    res.json({ config: earnMoneyConfig });
  });

  app.post('/api/admin/earnmoney/tasks', requireAdmin, (req, res) => {
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

    earnMoneyConfig = {
      ...earnMoneyConfig,
      tasks: [newTask, ...earnMoneyConfig.tasks],
      updatedAt: new Date().toISOString(),
    };
    saveEarnMoneyConfig(earnMoneyConfig);
    res.status(201).json({ task: newTask, config: earnMoneyConfig });
  });

  app.put('/api/admin/earnmoney/tasks/:id', requireAdmin, (req, res) => {
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

    earnMoneyConfig.updatedAt = new Date().toISOString();
    saveEarnMoneyConfig(earnMoneyConfig);
    res.json({ task, config: earnMoneyConfig });
  });

  app.delete('/api/admin/earnmoney/tasks/:id', requireAdmin, (req, res) => {
    const before = earnMoneyConfig.tasks.length;
    earnMoneyConfig = {
      ...earnMoneyConfig,
      tasks: earnMoneyConfig.tasks.filter((t) => t.id !== req.params.id),
      updatedAt: new Date().toISOString(),
    };
    if (earnMoneyConfig.tasks.length === before) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    saveEarnMoneyConfig(earnMoneyConfig);
    res.json({ deleted: req.params.id, config: earnMoneyConfig });
  });

  app.get('/api/admin/earnmoney/users', requireAdmin, (req, res) => {
    const q = typeof req.query?.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const usersList = Object.values(earnMoneyUsers)
      .filter((u) => {
        if (!q) return true;
        return u.userId.toLowerCase().includes(q) || u.userName.toLowerCase().includes(q);
      })
      .map((u) => syncUserWithConfig(u));
    res.json({ users: usersList });
  });

  app.post('/api/admin/earnmoney/users/:uid/balance', requireAdmin, (req, res) => {
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
    saveEarnMoneyUsers(earnMoneyUsers);
    res.json({ user: syncUserWithConfig(user) });
  });

  app.post('/api/admin/earnmoney/users/:uid/block', requireAdmin, (req, res) => {
    const uid = String(req.params.uid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const user = earnMoneyUsers[uid];
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const isBlocked = typeof req.body?.isBlocked === 'boolean' ? req.body.isBlocked : !user.isBlocked;
    user.isBlocked = isBlocked;
    earnMoneyUsers[uid] = user;
    saveEarnMoneyUsers(earnMoneyUsers);
    res.json({ user: syncUserWithConfig(user) });
  });

  app.post('/api/admin/earnmoney/withdrawals/:uid/:wdId/decide', requireAdmin, (req, res) => {
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
      wd.status = 'Completed';
      user.totalWithdraw = Number((user.totalWithdraw + wd.amountUsdt).toFixed(4));
    } else {
      wd.status = 'Rejected';
      user.totalBalance = Number((user.totalBalance + wd.amountUsdt).toFixed(4));
    }

    earnMoneyUsers[uid] = user;
    saveEarnMoneyUsers(earnMoneyUsers);
    res.json({
      withdrawal: wd,
      user: syncUserWithConfig(user),
      overview: buildEarnMoneyAdminOverview(),
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

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Earn Money Mini App (@${TELEGRAM_BOT_USERNAME}) listening on http://0.0.0.0:${PORT}`);
    void startTelegramPollingIfConfigured();
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
