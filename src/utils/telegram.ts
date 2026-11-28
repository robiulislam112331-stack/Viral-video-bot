export interface TelegramUserInfo {
  id: string;
  name: string;
  avatarUrl: string;
  isTelegramUser: boolean;
  referrerId?: string;
}

interface TelegramWebAppWindow extends Window {
  Telegram?: {
    WebApp?: {
      ready?: () => void;
      expand?: () => void;
      isVersionAtLeast?: (ver: string) => boolean;
      setHeaderColor?: (color: string) => void;
      setBackgroundColor?: (color: string) => void;
      openTelegramLink?: (url: string) => void;
      openLink?: (url: string) => void;
      initDataUnsafe?: {
        start_param?: string;
        user?: {
          id?: number | string;
          first_name?: string;
          last_name?: string;
          username?: string;
          photo_url?: string;
        };
      };
    };
  };
  [key: string]: unknown;
}

export interface ParsedMonetagConfig {
  mode: 'sdk' | 'url';
  srcUrl?: string;
  zoneId?: string;
  sdkFunc?: string;
  directUrl?: string;
}

export function parseMonetagConfig(rawInput?: string): ParsedMonetagConfig {
  const raw = (rawInput || '').trim();
  if (!raw) {
    return {
      mode: 'sdk',
      srcUrl: 'https://libtl.com/sdk.js',
      zoneId: '12118221',
      sdkFunc: 'show_12118221',
    };
  }

  if (/^\d{4,16}$/.test(raw)) {
    return {
      mode: 'sdk',
      srcUrl: 'https://libtl.com/sdk.js',
      zoneId: raw,
      sdkFunc: `show_${raw}`,
    };
  }

  if (/^https?:\/\//i.test(raw) && !raw.includes('<')) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return { mode: 'url', directUrl: parsed.toString() };
      }
    } catch {
      // fall through
    }
  }

  const zoneMatch = raw.match(/data-zone\s*=\s*['"]?(\d{4,16})['"]?/i);
  const sdkMatch = raw.match(/data-sdk\s*=\s*['"]?([a-zA-Z0-9_]{3,64})['"]?/i);
  const srcMatch = raw.match(/src\s*=\s*['"]?([^'"\s>]+)['"]?/i);

  if (zoneMatch || sdkMatch || srcMatch) {
    const zoneId = zoneMatch?.[1] || '12118221';
    const sdkFunc = sdkMatch?.[1] || `show_${zoneId}`;
    let srcUrl = srcMatch?.[1] || 'https://libtl.com/sdk.js';
    if (srcUrl.startsWith('//')) {
      srcUrl = `https:${srcUrl}`;
    }
    try {
      const parsedSrc = new URL(srcUrl);
      if (parsedSrc.protocol === 'https:' || parsedSrc.protocol === 'http:') {
        return {
          mode: 'sdk',
          srcUrl: parsedSrc.toString(),
          zoneId,
          sdkFunc,
        };
      }
    } catch {
      // fallback below
    }
  }

  return {
    mode: 'sdk',
    srcUrl: 'https://libtl.com/sdk.js',
    zoneId: '12118221',
    sdkFunc: 'show_12118221',
  };
}

export function getMonetagDirectUrl(monetagLink?: string): string | null {
  const parsed = parseMonetagConfig(monetagLink);
  return parsed.mode === 'url' && parsed.directUrl ? parsed.directUrl : null;
}

function openDirectUrlInNewTab(url: string): void {
  const win = window as unknown as TelegramWebAppWindow;
  const tg = win.Telegram?.WebApp;
  if (tg && typeof tg.openLink === 'function') {
    try {
      tg.openLink(url);
      return;
    } catch {
      // fall through to anchor click
    }
  }
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function ensureMonetagSdkLoaded(parsed: ParsedMonetagConfig): Promise<void> {
  if (parsed.mode !== 'sdk' || !parsed.srcUrl || !parsed.sdkFunc) {
    return Promise.resolve();
  }
  const win = window as unknown as Record<string, unknown>;
  if (typeof win[parsed.sdkFunc] === 'function') {
    return Promise.resolve();
  }

  const existing = document.querySelector(
    `script[data-zone="${parsed.zoneId}"][data-sdk="${parsed.sdkFunc}"]`
  );
  if (existing) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, 450);
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = parsed.srcUrl!;
    script.async = true;
    if (parsed.zoneId) script.setAttribute('data-zone', parsed.zoneId);
    if (parsed.sdkFunc) script.setAttribute('data-sdk', parsed.sdkFunc);
    script.onload = () => window.setTimeout(resolve, 150);
    script.onerror = () => resolve();
    document.head.appendChild(script);
    window.setTimeout(resolve, 1200);
  });
}

export const DEFAULT_AVATAR = '/src/assets/images/earnmoney_avatar_1795708537961.jpg';
const GUEST_UID_KEY = 'earnmoney_guest_uid';

function getOrCreateGuestUid(): string {
  try {
    const existing = window.localStorage.getItem(GUEST_UID_KEY);
    if (existing && /^[0-9]{6,12}$/.test(existing)) {
      return existing;
    }
    const generated = String(Math.floor(10000000 + Math.random() * 89999999));
    window.localStorage.setItem(GUEST_UID_KEY, generated);
    return generated;
  } catch {
    return String(Math.floor(10000000 + Math.random() * 89999999));
  }
}

function extractReferrerId(startParam?: string): string | undefined {
  const queryRef =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('ref') ||
        new URLSearchParams(window.location.search).get('startapp')
      : null;
  const raw = startParam || queryRef || '';
  const match = raw.match(/^ref_([a-zA-Z0-9_-]{4,64})$/);
  return match ? match[1] : undefined;
}

export function initTelegramWebApp(): TelegramUserInfo {
  const win = window as unknown as TelegramWebAppWindow;
  const tg = win.Telegram?.WebApp;

  if (tg) {
    try {
      tg.ready?.();
      tg.expand?.();
      if (typeof tg.isVersionAtLeast === 'function' && tg.isVersionAtLeast('6.1')) {
        tg.setHeaderColor?.('#FFFFFF');
        tg.setBackgroundColor?.('#F2F4F7');
      }
    } catch {
      // ignore outside Telegram client
    }
  }

  const user = tg?.initDataUnsafe?.user;
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  const hasTelegramId = Boolean(user?.id);
  const resolvedId = hasTelegramId ? String(user!.id) : getOrCreateGuestUid();

  return {
    id: resolvedId,
    name: fullName || user?.username || 'Earn Money User',
    avatarUrl: user?.photo_url || DEFAULT_AVATAR,
    isTelegramUser: hasTelegramId,
    referrerId: extractReferrerId(tg?.initDataUnsafe?.start_param),
  };
}

export function openExternalTelegramLink(url: string): boolean {
  const win = window as unknown as TelegramWebAppWindow;
  const tg = win.Telegram?.WebApp;

  if (tg && typeof tg.openTelegramLink === 'function' && url.startsWith('https://t.me/')) {
    try {
      tg.openTelegramLink(url);
      return true;
    } catch {
      // fall through to anchor navigation
    }
  }

  if (tg && typeof tg.openLink === 'function') {
    try {
      tg.openLink(url);
      return true;
    } catch {
      // fall through
    }
  }

  return false;
}

export async function triggerMonetagAd(monetagLink?: string): Promise<void> {
  const parsed = parseMonetagConfig(monetagLink);
  if (parsed.mode === 'url' && parsed.directUrl) {
    openDirectUrlInNewTab(parsed.directUrl);
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    return;
  }

  await ensureMonetagSdkLoaded(parsed);
  const win = window as unknown as Record<string, unknown>;
  const fn = parsed.sdkFunc ? win[parsed.sdkFunc] : undefined;
  if (typeof fn === 'function') {
    try {
      await Promise.resolve((fn as () => Promise<unknown>)());
      return;
    } catch {
      // fallback wait if ad blocked or closed
    }
  }
  await new Promise((resolve) => window.setTimeout(resolve, 600));
}
