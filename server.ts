import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import type {
  AdSlot,
  AppSettings,
  ChannelItem,
  DashboardStats,
  DownloadType,
  PaymentMethod,
  PaymentRequest,
  VideoItem,
  VideoStatus,
} from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const STORE_PATH = path.resolve(DATA_DIR, 'store.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Ephemeral fallback secret for signing cookies and Bearer tokens if SESSION_SECRET is unset
const SERVER_SIGNING_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

interface StoreSchema {
  channels: ChannelItem[];
  settings: AppSettings;
  videos: VideoItem[];
  payments: PaymentRequest[];
  viewerJoinedChannels: Record<string, string[]>;
  adminCredentialHash?: string;
}

const DEFAULT_STORE: StoreSchema = {
  channels: [
    {
      id: 'ch_main',
      name: 'CineVault Main Channel',
      handle: '@CineVaultMain',
      inviteUrl: 'https://t.me/CineVaultMain',
      memberCountLabel: '48.2K members',
    },
    {
      id: 'ch_cinema',
      name: 'NightReel Releases',
      handle: '@NightReelReleases',
      inviteUrl: 'https://t.me/NightReelReleases',
      memberCountLabel: '21.9K members',
    },
    {
      id: 'ch_support',
      name: 'Vault Updates & Mirrors',
      handle: '@VaultUpdatesBD',
      inviteUrl: 'https://t.me/VaultUpdatesBD',
      memberCountLabel: '14.5K members',
    },
  ],
  settings: {
    downloadPriceTk: 10,
    bkashNumber: '01712-849302',
    nagadNumber: '01819-405817',
    forceJoinEnabled: true,
    ads: [
      {
        slot: 1,
        title: 'CloudRender 4K — Instant Cinema Encoding',
        sponsor: 'CloudRender Labs',
        url: 'https://example.com/sponsor-cloudrender',
        durationSec: 15,
      },
      {
        slot: 2,
        title: 'Monolith Audio — Mastering Grade Studio Packs',
        sponsor: 'Monolith Audio',
        url: 'https://example.com/sponsor-monolith',
        durationSec: 15,
      },
      {
        slot: 3,
        title: 'TrackSide Telemetry — Live Motorsport Streams',
        sponsor: 'TrackSide Pro',
        url: 'https://example.com/sponsor-trackside',
        durationSec: 15,
      },
    ],
  },
  videos: [
    {
      id: 'vid_tokyo_rain',
      title: 'Midnight Neon: Tokyo Rain Study',
      category: 'Short Film',
      duration: '08:42',
      thumbnailUrl: '/src/assets/images/thumb_tokyo_rain_1795435877207.jpg',
      videoUrl: 'demo://tokyo-rain',
      views: 1842,
      downloads: 42,
      status: 'active',
      downloadType: 'paid',
      downloadPriceTk: 10,
      adsEnabled: true,
      createdAt: '2026-11-18T14:20:00.000Z',
      isDemoReel: true,
    },
    {
      id: 'vid_alpine_dawn',
      title: 'Dolomites at First Light — 4K Aerial Reel',
      category: 'Travel & Aerial',
      duration: '12:15',
      thumbnailUrl: '/src/assets/images/thumb_alpine_dawn_1795435874924.jpg',
      videoUrl: 'demo://alpine-dawn',
      views: 1290,
      downloads: 29,
      status: 'active',
      downloadType: 'paid',
      downloadPriceTk: 10,
      adsEnabled: true,
      createdAt: '2026-11-19T09:10:00.000Z',
      isDemoReel: true,
    },
    {
      id: 'vid_analog_studio',
      title: 'Analog Modular Sessions: Deep Tape Echo',
      category: 'Music & Studio',
      duration: '14:30',
      thumbnailUrl: '/src/assets/images/thumb_analog_studio_1795435876576.jpg',
      videoUrl: 'demo://analog-studio',
      views: 964,
      downloads: 18,
      status: 'active',
      downloadType: 'paid',
      downloadPriceTk: 10,
      adsEnabled: true,
      createdAt: '2026-11-20T18:45:00.000Z',
      isDemoReel: true,
    },
    {
      id: 'vid_night_circuit',
      title: 'Night Circuit: GT3 Endurance Pitlane',
      category: 'Motorsport',
      duration: '09:54',
      thumbnailUrl: '/src/assets/images/thumb_night_circuit_1795435876007.jpg',
      videoUrl: 'demo://night-circuit',
      views: 2105,
      downloads: 54,
      status: 'active',
      downloadType: 'paid',
      downloadPriceTk: 10,
      adsEnabled: true,
      createdAt: '2026-11-21T21:00:00.000Z',
      isDemoReel: true,
    },
  ],
  payments: [
    {
      id: 'pay_seed_1',
      viewerId: 'demo_user_901',
      userName: '@rafiq_cinema',
      videoId: 'vid_tokyo_rain',
      videoTitle: 'Midnight Neon: Tokyo Rain Study',
      method: 'bKash',
      trxId: 'BKH9X42LM8',
      amountTk: 10,
      senderNote: '01711****42',
      status: 'approved',
      createdAt: '2026-11-21T10:15:00.000Z',
      reviewedAt: '2026-11-21T10:18:00.000Z',
    },
    {
      id: 'pay_seed_2',
      viewerId: 'demo_user_404',
      userName: '@tanvir_bd',
      videoId: 'vid_night_circuit',
      videoTitle: 'Night Circuit: GT3 Endurance Pitlane',
      method: 'Nagad',
      trxId: 'NGD77P19QA',
      amountTk: 10,
      senderNote: '01815****88',
      status: 'pending',
      createdAt: '2026-11-22T16:40:00.000Z',
    },
  ],
  viewerJoinedChannels: {},
};

function loadStore(): StoreSchema {
  if (!fs.existsSync(STORE_PATH)) {
    saveStore(DEFAULT_STORE);
    return structuredClone(DEFAULT_STORE);
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoreSchema>;
    const defaultPrice =
      typeof parsed.settings?.downloadPriceTk === 'number' && parsed.settings.downloadPriceTk >= 0
        ? parsed.settings.downloadPriceTk
        : 10;

    const settings: AppSettings = parsed.settings
      ? {
          downloadPriceTk: defaultPrice,
          bkashNumber: parsed.settings.bkashNumber || DEFAULT_STORE.settings.bkashNumber,
          nagadNumber: parsed.settings.nagadNumber || DEFAULT_STORE.settings.nagadNumber,
          forceJoinEnabled:
            typeof parsed.settings.forceJoinEnabled === 'boolean'
              ? parsed.settings.forceJoinEnabled
              : true,
          ads:
            Array.isArray(parsed.settings.ads) && parsed.settings.ads.length === 3
              ? parsed.settings.ads
              : structuredClone(DEFAULT_STORE.settings.ads),
        }
      : structuredClone(DEFAULT_STORE.settings);

    const videos: VideoItem[] = Array.isArray(parsed.videos)
      ? parsed.videos.map((v) => ({
          ...v,
          downloads: typeof v.downloads === 'number' ? v.downloads : 0,
          status: v.status === 'inactive' ? 'inactive' : 'active',
          downloadType: v.downloadType === 'free' ? 'free' : 'paid',
          downloadPriceTk:
            typeof v.downloadPriceTk === 'number' && v.downloadPriceTk >= 0
              ? v.downloadPriceTk
              : defaultPrice,
          adsEnabled: typeof v.adsEnabled === 'boolean' ? v.adsEnabled : true,
        }))
      : structuredClone(DEFAULT_STORE.videos);

    const payments: PaymentRequest[] = Array.isArray(parsed.payments)
      ? parsed.payments.map((p) => ({
          ...p,
          userName: p.userName || p.senderNote || p.viewerId,
        }))
      : structuredClone(DEFAULT_STORE.payments);

    return {
      channels: Array.isArray(parsed.channels)
        ? parsed.channels
        : structuredClone(DEFAULT_STORE.channels),
      settings,
      videos,
      payments,
      viewerJoinedChannels:
        parsed.viewerJoinedChannels && typeof parsed.viewerJoinedChannels === 'object'
          ? parsed.viewerJoinedChannels
          : {},
      adminCredentialHash:
        typeof parsed.adminCredentialHash === 'string' ? parsed.adminCredentialHash : undefined,
    };
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

// Active ad-watch sessions (in-memory per server instance)
interface AdSession {
  token: string;
  viewerId: string;
  videoId: string;
  currentStep: 1 | 2 | 3;
  stepStartedAt: number;
  completed: boolean;
}
const adSessions = new Map<string, AdSession>();

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

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    out[key] = val;
  }
  return out;
}

function getOrCreateViewerId(req: Request, res: Response): string {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies['viewer_sid'];
  if (raw) {
    const dot = raw.lastIndexOf('.');
    if (dot > 0) {
      const viewerId = raw.slice(0, dot);
      const sig = raw.slice(dot + 1);
      if (/^tg_[a-zA-Z0-9_-]{8,32}$/.test(viewerId) && verifySignedValue(viewerId, sig)) {
        return viewerId;
      }
    }
  }
  const newId = `tg_${crypto.randomBytes(8).toString('hex')}`;
  const signed = `${newId}.${signValue(newId)}`;
  res.cookie('viewer_sid', signed, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  return newId;
}

function verifyMutationCsrf(req: Request, res: Response, next: NextFunction): void {
  const hasCustomHeader = req.headers['x-requested-with'] === 'XMLHttpRequest';
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;

  let originMatches = false;
  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      originMatches = originUrl.host === host;
    } catch {
      originMatches = false;
    }
  }

  if (!hasCustomHeader && !originMatches) {
    res.status(403).json({ error: 'Invalid request origin' });
    return;
  }
  next();
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

function hasJoinedAllChannels(viewerId: string): boolean {
  if (!store.settings.forceJoinEnabled) return true;
  if (store.channels.length === 0) return true;
  const joined = new Set(store.viewerJoinedChannels[viewerId] || []);
  return store.channels.every((ch) => joined.has(ch.id));
}

function getActiveVideos(): VideoItem[] {
  return store.videos.filter((v) => v.status === 'active');
}

function computeStats(): DashboardStats {
  const approvedPayments = store.payments.filter((p) => p.status === 'approved');
  const pendingPayments = store.payments.filter((p) => p.status === 'pending');
  return {
    totalVideos: store.videos.length,
    totalViews: store.videos.reduce((sum, v) => sum + (v.views || 0), 0),
    totalDownloads: store.videos.reduce((sum, v) => sum + (v.downloads || 0), 0),
    totalEarningTk: approvedPayments.reduce((sum, p) => sum + (p.amountTk || 0), 0),
    pendingPaymentsCount: pendingPayments.length,
  };
}

function getUnlockedVideoIdsForViewer(viewerId: string): string[] {
  const set = new Set<string>();
  for (const p of store.payments) {
    if (p.viewerId === viewerId && p.status === 'approved') {
      set.add(p.videoId);
    }
  }
  return Array.from(set);
}

async function checkTelegramRealMembership(
  botToken: string,
  telegramUserId: string,
  channels: ChannelItem[]
): Promise<{ checked: boolean; allJoined: boolean; joinedIds: string[] }> {
  const joinedIds: string[] = [];
  for (const ch of channels) {
    const chatId = ch.handle.startsWith('@') ? ch.handle : `@${ch.handle}`;
    try {
      const apiUrl = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${encodeURIComponent(telegramUserId)}`;
      const response = await fetch(apiUrl);
      const data = (await response.json()) as {
        ok?: boolean;
        result?: { status?: string };
      };
      const status = data.result?.status;
      if (data.ok && status && ['creator', 'administrator', 'member', 'restricted'].includes(status)) {
        joinedIds.push(ch.id);
      }
    } catch {
      // Treat unreachable channel check as not joined
    }
  }
  return {
    checked: true,
    allJoined: joinedIds.length === channels.length,
    joinedIds,
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

// --- Express App ---

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  // Serve uploaded media safely with nosniff
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      next();
    },
    express.static(UPLOADS_DIR)
  );

  // JSON parser for standard routes (upload route uses express.raw)
  app.use((req, res, next) => {
    if (req.path === '/api/admin/upload') {
      next();
      return;
    }
    express.json({ limit: '1mb' })(req, res, next);
  });

  // --- Viewer / Bot API Routes ---

  app.get('/api/bootstrap', (req, res) => {
    const viewerId = getOrCreateViewerId(req, res);
    const joinedChannelIds = store.viewerJoinedChannels[viewerId] || [];
    const membershipVerified = hasJoinedAllChannels(viewerId);
    const viewerPayments = store.payments.filter((p) => p.viewerId === viewerId);

    res.json({
      viewerId,
      channels: store.channels,
      joinedChannelIds,
      membershipVerified,
      forceJoinEnabled: store.settings.forceJoinEnabled,
      telegramBotConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
      videos: membershipVerified ? getActiveVideos() : [],
      settings: store.settings,
      unlockedVideoIds: getUnlockedVideoIdsForViewer(viewerId),
      viewerPayments,
    });
  });

  app.post('/api/membership/join', verifyMutationCsrf, (req, res) => {
    const viewerId = getOrCreateViewerId(req, res);
    const channelId = typeof req.body?.channelId === 'string' ? req.body.channelId.trim() : '';
    const exists = store.channels.some((c) => c.id === channelId);
    if (!exists) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    const current = new Set(store.viewerJoinedChannels[viewerId] || []);
    current.add(channelId);
    store.viewerJoinedChannels[viewerId] = Array.from(current);
    saveStore(store);

    res.json({
      joinedChannelIds: store.viewerJoinedChannels[viewerId],
    });
  });

  app.post('/api/membership/leave', verifyMutationCsrf, (req, res) => {
    const viewerId = getOrCreateViewerId(req, res);
    const channelId = typeof req.body?.channelId === 'string' ? req.body.channelId.trim() : '';
    const current = new Set(store.viewerJoinedChannels[viewerId] || []);
    current.delete(channelId);
    store.viewerJoinedChannels[viewerId] = Array.from(current);
    saveStore(store);

    res.json({
      joinedChannelIds: store.viewerJoinedChannels[viewerId],
      membershipVerified: hasJoinedAllChannels(viewerId),
    });
  });

  app.post('/api/membership/check', verifyMutationCsrf, async (req, res) => {
    const viewerId = getOrCreateViewerId(req, res);
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const telegramUserId =
      typeof req.body?.telegramUserId === 'string' && /^\d{4,20}$/.test(req.body.telegramUserId.trim())
        ? req.body.telegramUserId.trim()
        : '';

    if (store.settings.forceJoinEnabled && botToken && telegramUserId && store.channels.length > 0) {
      const liveCheck = await checkTelegramRealMembership(botToken, telegramUserId, store.channels);
      store.viewerJoinedChannels[viewerId] = liveCheck.joinedIds;
      saveStore(store);
    }

    const joinedIds = store.viewerJoinedChannels[viewerId] || [];
    const allJoined = hasJoinedAllChannels(viewerId);

    if (!allJoined) {
      res.json({
        allJoined: false,
        joinedChannelIds: joinedIds,
        message: 'Please join all channels',
        videos: [],
      });
      return;
    }

    res.json({
      allJoined: true,
      joinedChannelIds: joinedIds,
      videos: getActiveVideos(),
    });
  });

  // --- Play Flow (Respects Per-Video Ads On/Off Toggle) ---

  app.post('/api/ads/start', verifyMutationCsrf, (req, res) => {
    const viewerId = getOrCreateViewerId(req, res);
    if (!hasJoinedAllChannels(viewerId)) {
      res.status(403).json({ error: 'Please join all channels' });
      return;
    }
    const videoId = typeof req.body?.videoId === 'string' ? req.body.videoId.trim() : '';
    const video = store.videos.find((v) => v.id === videoId && v.status === 'active');
    if (!video) {
      res.status(404).json({ error: 'Video not found or inactive' });
      return;
    }

    // If Ads are turned OFF for this video, play directly and increment view
    if (!video.adsEnabled) {
      video.views += 1;
      saveStore(store);
      res.json({
        adsSkipped: true,
        video,
      });
      return;
    }

    const token = crypto.randomBytes(16).toString('hex');
    adSessions.set(token, {
      token,
      viewerId,
      videoId,
      currentStep: 1,
      stepStartedAt: Date.now(),
      completed: false,
    });

    res.json({
      adsSkipped: false,
      token,
      step: 1,
      totalSteps: 3,
      ad: store.settings.ads[0],
    });
  });

  app.post('/api/ads/next', verifyMutationCsrf, (req, res) => {
    const viewerId = getOrCreateViewerId(req, res);
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const session = adSessions.get(token);

    if (!session || session.viewerId !== viewerId) {
      res.status(404).json({ error: 'Ad session expired. Please start from Ad 1.' });
      return;
    }

    const requiredDuration = (store.settings.ads[session.currentStep - 1]?.durationSec ?? 15) * 1000;
    const elapsed = Date.now() - session.stepStartedAt;
    if (elapsed < requiredDuration - 1200) {
      res.status(400).json({
        error: 'Please wait for the 15-second ad timer to finish.',
        remainingSec: Math.ceil((requiredDuration - elapsed) / 1000),
      });
      return;
    }

    if (session.currentStep < 3) {
      const nextStep = (session.currentStep + 1) as 2 | 3;
      session.currentStep = nextStep;
      session.stepStartedAt = Date.now();
      res.json({
        completed: false,
        step: nextStep,
        totalSteps: 3,
        ad: store.settings.ads[nextStep - 1],
      });
      return;
    }

    session.completed = true;
    const video = store.videos.find((v) => v.id === session.videoId);
    if (video) {
      video.views += 1;
      saveStore(store);
    }

    res.json({
      completed: true,
      video: video || null,
    });
  });

  app.post('/api/ads/cancel', verifyMutationCsrf, (req, res) => {
    const viewerId = getOrCreateViewerId(req, res);
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const session = adSessions.get(token);
    if (session && session.viewerId === viewerId) {
      adSessions.delete(token);
    }
    res.json({ cancelled: true });
  });

  // --- Paid & Free Download Flow ---

  app.post('/api/payments', verifyMutationCsrf, (req, res) => {
    const viewerId = getOrCreateViewerId(req, res);
    if (!hasJoinedAllChannels(viewerId)) {
      res.status(403).json({ error: 'Please join all channels' });
      return;
    }

    const videoId = typeof req.body?.videoId === 'string' ? req.body.videoId.trim() : '';
    const method: PaymentMethod | null =
      req.body?.method === 'bKash' || req.body?.method === 'Nagad' ? req.body.method : null;
    const rawTrxId = typeof req.body?.trxId === 'string' ? req.body.trxId.trim().toUpperCase() : '';
    const userName =
      typeof req.body?.userName === 'string' && req.body.userName.trim()
        ? req.body.userName.trim().slice(0, 50)
        : viewerId;
    const senderNote =
      typeof req.body?.senderNote === 'string' ? req.body.senderNote.trim().slice(0, 40) : '';

    if (!method) {
      res.status(400).json({ error: 'Select bKash or Nagad payment method.' });
      return;
    }

    if (!/^[A-Z0-9_-]{5,32}$/.test(rawTrxId)) {
      res.status(400).json({ error: 'Enter a valid Transaction ID (5-32 alphanumeric characters).' });
      return;
    }

    const video = store.videos.find((v) => v.id === videoId && v.status === 'active');
    if (!video) {
      res.status(404).json({ error: 'Video not found or inactive' });
      return;
    }

    if (video.downloadType === 'free' || video.downloadPriceTk <= 0) {
      res.status(400).json({ error: 'This video is set to Free Download. No payment is needed.' });
      return;
    }

    const existingApproved = store.payments.find(
      (p) => p.viewerId === viewerId && p.videoId === videoId && p.status === 'approved'
    );
    if (existingApproved) {
      res.json({ payment: existingApproved, alreadyUnlocked: true });
      return;
    }

    const existingPending = store.payments.find(
      (p) => p.viewerId === viewerId && p.videoId === videoId && p.status === 'pending'
    );
    if (existingPending) {
      res.status(409).json({
        error: `Payment ${existingPending.trxId} is already pending admin approval for this video.`,
      });
      return;
    }

    const duplicateTrx = store.payments.find(
      (p) => p.trxId === rawTrxId && p.status !== 'rejected'
    );
    if (duplicateTrx) {
      res.status(409).json({ error: 'This Transaction ID has already been submitted.' });
      return;
    }

    const payment: PaymentRequest = {
      id: `pay_${crypto.randomBytes(6).toString('hex')}`,
      viewerId,
      userName,
      videoId,
      videoTitle: video.title,
      method,
      trxId: rawTrxId,
      amountTk: video.downloadPriceTk,
      senderNote: senderNote || undefined,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    store.payments.unshift(payment);
    saveStore(store);

    res.status(201).json({ payment });
  });

  app.get('/api/videos/:id/download', (req, res) => {
    const viewerId = getOrCreateViewerId(req, res);
    if (!hasJoinedAllChannels(viewerId)) {
      res.status(403).json({ error: 'Please join all channels' });
      return;
    }

    const videoId = req.params.id;
    const video = store.videos.find((v) => v.id === videoId && v.status === 'active');
    if (!video) {
      res.status(404).json({ error: 'Video not found or inactive' });
      return;
    }

    const isFree = video.downloadType === 'free' || video.downloadPriceTk <= 0;
    const approved = store.payments.find(
      (p) => p.viewerId === viewerId && p.videoId === videoId && p.status === 'approved'
    );

    if (!isFree && !approved) {
      res.status(403).json({
        error: `Download locked. Pay ${video.downloadPriceTk} TK via bKash / Nagad to unlock.`,
      });
      return;
    }

    video.downloads = (video.downloads || 0) + 1;
    saveStore(store);

    if (video.videoUrl.startsWith('/uploads/')) {
      const safeName = path.basename(video.videoUrl);
      const resolved = path.resolve(UPLOADS_DIR, safeName);
      if (resolved.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(resolved)) {
        res.download(
          resolved,
          `${video.title.replace(/[^a-zA-Z0-9_-]/g, '_')}${path.extname(safeName)}`
        );
        return;
      }
    }

    res.json({
      unlocked: true,
      videoId: video.id,
      title: video.title,
      videoUrl: video.videoUrl,
      isDemoReel: Boolean(video.isDemoReel),
      thumbnailUrl: video.thumbnailUrl,
    });
  });

  // --- Admin Auth Routes ---

  app.get('/api/admin/auth/status', (req, res) => {
    const envConfigured = Boolean(process.env.ADMIN_PASSCODE?.trim());
    const needsClaim = !envConfigured && !store.adminCredentialHash;
    const authenticated = verifyAdminToken(req.headers.authorization);
    res.json({ authenticated, needsClaim, envConfigured });
  });

  app.post('/api/admin/auth/claim', (req, res) => {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode || store.adminCredentialHash) {
      res.status(409).json({ error: 'Admin passcode is already configured.' });
      return;
    }
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (passcode.length < 4 || passcode.length > 64) {
      res.status(400).json({ error: 'Passcode must be between 4 and 64 characters.' });
      return;
    }
    store.adminCredentialHash = hashPasscode(passcode);
    saveStore(store);
    const token = issueAdminToken();
    res.json({ token });
  });

  app.post('/api/admin/auth/login', (req, res) => {
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (!passcode) {
      res.status(400).json({ error: 'Passcode is required.' });
      return;
    }

    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    let valid = false;
    if (envPasscode) {
      valid = verifyEnvPasscode(passcode, envPasscode);
    } else if (store.adminCredentialHash) {
      valid = verifyPasscodeHash(passcode, store.adminCredentialHash);
    }

    if (!valid) {
      res.status(401).json({ error: 'Invalid admin passcode.' });
      return;
    }

    const token = issueAdminToken();
    res.json({ token });
  });

  // --- Protected Admin Routes ---

  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    res.json({
      stats: computeStats(),
      videos: store.videos,
      channels: store.channels,
      settings: store.settings,
      payments: store.payments,
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
    const category = typeof req.body?.category === 'string' ? req.body.category.trim().slice(0, 40) : '';
    const duration = typeof req.body?.duration === 'string' ? req.body.duration.trim().slice(0, 16) : '';
    const thumbnailUrl = typeof req.body?.thumbnailUrl === 'string' ? req.body.thumbnailUrl.trim() : '';
    const videoUrl = typeof req.body?.videoUrl === 'string' ? req.body.videoUrl.trim() : '';

    const status: VideoStatus = req.body?.status === 'inactive' ? 'inactive' : 'active';
    const downloadType: DownloadType = req.body?.downloadType === 'free' ? 'free' : 'paid';
    const rawPrice = Number(req.body?.downloadPriceTk);
    const downloadPriceTk =
      downloadType === 'free'
        ? 0
        : Number.isFinite(rawPrice) && rawPrice >= 0 && rawPrice <= 100000
          ? Math.round(rawPrice)
          : store.settings.downloadPriceTk;
    const adsEnabled = typeof req.body?.adsEnabled === 'boolean' ? req.body.adsEnabled : true;

    if (!title || !category || !duration) {
      res.status(400).json({ error: 'Title, category, and duration are required.' });
      return;
    }

    if (!isSafeUrl(thumbnailUrl, false)) {
      res.status(400).json({ error: 'Provide a valid HTTP/HTTPS or uploaded thumbnail URL.' });
      return;
    }

    if (!isSafeUrl(videoUrl, true)) {
      res.status(400).json({ error: 'Provide a valid HTTP/HTTPS video link or upload a video file.' });
      return;
    }

    const newVideo: VideoItem = {
      id: `vid_${crypto.randomBytes(6).toString('hex')}`,
      title,
      category,
      duration,
      thumbnailUrl,
      videoUrl,
      views: 0,
      downloads: 0,
      status,
      downloadType,
      downloadPriceTk,
      adsEnabled,
      createdAt: new Date().toISOString(),
      isDemoReel: videoUrl.startsWith('demo://'),
    };

    store.videos.unshift(newVideo);
    saveStore(store);

    res.status(201).json({ video: newVideo, stats: computeStats() });
  });

  // Full Edit / Partial Toggle endpoint for any existing video
  app.put('/api/admin/videos/:id', requireAdmin, (req, res) => {
    const id = req.params.id;
    const video = store.videos.find((v) => v.id === id);
    if (!video) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    if (typeof req.body?.title === 'string') {
      const t = req.body.title.trim().slice(0, 120);
      if (!t) {
        res.status(400).json({ error: 'Video title cannot be empty.' });
        return;
      }
      video.title = t;
    }

    if (typeof req.body?.category === 'string') {
      const c = req.body.category.trim().slice(0, 40);
      if (!c) {
        res.status(400).json({ error: 'Category cannot be empty.' });
        return;
      }
      video.category = c;
    }

    if (typeof req.body?.duration === 'string') {
      const d = req.body.duration.trim().slice(0, 16);
      if (!d) {
        res.status(400).json({ error: 'Duration cannot be empty.' });
        return;
      }
      video.duration = d;
    }

    if (typeof req.body?.thumbnailUrl === 'string') {
      const thumb = req.body.thumbnailUrl.trim();
      if (!isSafeUrl(thumb, false)) {
        res.status(400).json({ error: 'Provide a valid HTTP/HTTPS or uploaded thumbnail URL.' });
        return;
      }
      video.thumbnailUrl = thumb;
    }

    if (typeof req.body?.videoUrl === 'string') {
      const vUrl = req.body.videoUrl.trim();
      if (!isSafeUrl(vUrl, true)) {
        res.status(400).json({ error: 'Provide a valid HTTP/HTTPS video link or upload a video file.' });
        return;
      }
      video.videoUrl = vUrl;
      video.isDemoReel = vUrl.startsWith('demo://');
    }

    if (req.body?.status === 'active' || req.body?.status === 'inactive') {
      video.status = req.body.status;
    }

    if (req.body?.downloadType === 'free' || req.body?.downloadType === 'paid') {
      video.downloadType = req.body.downloadType;
      if (video.downloadType === 'free') {
        video.downloadPriceTk = 0;
      } else if (video.downloadPriceTk <= 0 && req.body?.downloadPriceTk === undefined) {
        video.downloadPriceTk = store.settings.downloadPriceTk;
      }
    }

    if (req.body?.downloadPriceTk !== undefined) {
      const price = Number(req.body.downloadPriceTk);
      if (!Number.isFinite(price) || price < 0 || price > 100000) {
        res.status(400).json({ error: 'Price must be between 0 and 100000 TK.' });
        return;
      }
      video.downloadPriceTk = video.downloadType === 'free' ? 0 : Math.round(price);
    }

    if (typeof req.body?.adsEnabled === 'boolean') {
      video.adsEnabled = req.body.adsEnabled;
    }

    saveStore(store);
    res.json({ video, stats: computeStats() });
  });

  app.delete('/api/admin/videos/:id', requireAdmin, (req, res) => {
    const id = req.params.id;
    const before = store.videos.length;
    store.videos = store.videos.filter((v) => v.id !== id);
    if (store.videos.length === before) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }
    saveStore(store);
    res.json({ deleted: id, stats: computeStats() });
  });

  app.post('/api/admin/channels', requireAdmin, (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
    const inviteUrl = typeof req.body?.inviteUrl === 'string' ? req.body.inviteUrl.trim() : '';
    let handle = typeof req.body?.handle === 'string' ? req.body.handle.trim().slice(0, 60) : '';
    const memberCountLabel =
      typeof req.body?.memberCountLabel === 'string' ? req.body.memberCountLabel.trim().slice(0, 30) : '';

    if (!name || !isSafeUrl(inviteUrl, false)) {
      res.status(400).json({ error: 'Channel name and valid invite link are required.' });
      return;
    }

    if (!handle) {
      handle = deriveHandleFromUrl(inviteUrl, name);
    } else if (!handle.startsWith('@')) {
      handle = `@${handle}`;
    }

    const channel: ChannelItem = {
      id: `ch_${crypto.randomBytes(5).toString('hex')}`,
      name,
      handle,
      inviteUrl,
      memberCountLabel: memberCountLabel || undefined,
    };

    store.channels.push(channel);
    saveStore(store);
    res.status(201).json({ channel, channels: store.channels });
  });

  app.delete('/api/admin/channels/:id', requireAdmin, (req, res) => {
    const id = req.params.id;
    const before = store.channels.length;
    store.channels = store.channels.filter((c) => c.id !== id);
    if (store.channels.length === before) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    saveStore(store);
    res.json({ deleted: id, channels: store.channels });
  });

  app.put('/api/admin/settings', requireAdmin, (req, res) => {
    const price =
      req.body?.downloadPriceTk !== undefined
        ? Number(req.body.downloadPriceTk)
        : store.settings.downloadPriceTk;
    const bkashNumber =
      typeof req.body?.bkashNumber === 'string'
        ? req.body.bkashNumber.trim()
        : store.settings.bkashNumber;
    const nagadNumber =
      typeof req.body?.nagadNumber === 'string'
        ? req.body.nagadNumber.trim()
        : store.settings.nagadNumber;
    const forceJoinEnabled =
      typeof req.body?.forceJoinEnabled === 'boolean'
        ? req.body.forceJoinEnabled
        : store.settings.forceJoinEnabled;
    const adsInput = Array.isArray(req.body?.ads) ? (req.body.ads as Partial<AdSlot>[]) : null;

    if (!Number.isFinite(price) || price < 0 || price > 100000) {
      res.status(400).json({ error: 'Default download price must be 0 or higher.' });
      return;
    }

    if (!bkashNumber || !nagadNumber) {
      res.status(400).json({ error: 'bKash and Nagad numbers are required.' });
      return;
    }

    let updatedAds = store.settings.ads;
    if (adsInput && adsInput.length === 3) {
      const normalized: AdSlot[] = [];
      for (let i = 0; i < 3; i++) {
        const item = adsInput[i];
        const slot = (i + 1) as 1 | 2 | 3;
        const title = typeof item?.title === 'string' ? item.title.trim().slice(0, 100) : '';
        const sponsor = typeof item?.sponsor === 'string' ? item.sponsor.trim().slice(0, 60) : '';
        const url = typeof item?.url === 'string' ? item.url.trim() : '';
        if (!title || !isSafeUrl(url, false)) {
          res.status(400).json({ error: `Ad ${slot} requires a title and valid HTTP/HTTPS link.` });
          return;
        }
        normalized.push({
          slot,
          title,
          sponsor: sponsor || `Sponsor ${slot}`,
          url,
          durationSec: 15,
        });
      }
      updatedAds = normalized;
    }

    store.settings = {
      downloadPriceTk: Math.round(price),
      bkashNumber,
      nagadNumber,
      forceJoinEnabled,
      ads: updatedAds,
    };
    saveStore(store);

    res.json({ settings: store.settings });
  });

  app.post('/api/admin/payments/:id/decision', requireAdmin, (req, res) => {
    const id = req.params.id;
    const decision =
      req.body?.decision === 'approved' || req.body?.decision === 'rejected'
        ? req.body.decision
        : null;

    if (!decision) {
      res.status(400).json({ error: 'Decision must be approved or rejected.' });
      return;
    }

    const payment = store.payments.find((p) => p.id === id);
    if (!payment) {
      res.status(404).json({ error: 'Payment request not found' });
      return;
    }

    const wasApproved = payment.status === 'approved';
    payment.status = decision;
    payment.reviewedAt = new Date().toISOString();

    if (decision === 'approved' && !wasApproved) {
      const video = store.videos.find((v) => v.id === payment.videoId);
      if (video) {
        video.downloads = (video.downloads || 0) + 1;
      }
    }

    saveStore(store);

    res.json({
      payment,
      stats: computeStats(),
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
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CineVault Bot server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
