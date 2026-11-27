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
  show_12118221?: () => Promise<unknown>;
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
  const win = window as TelegramWebAppWindow;
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
  const win = window as TelegramWebAppWindow;
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

export function triggerMonetagAd(): Promise<void> {
  const win = window as TelegramWebAppWindow;
  if (typeof win.show_12118221 === 'function') {
    return Promise.resolve(win.show_12118221())
      .then(() => undefined)
      .catch(() => undefined);
  }
  return new Promise((resolve) => {
    window.setTimeout(resolve, 600);
  });
}
