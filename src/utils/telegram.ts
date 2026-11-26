export interface TelegramUserInfo {
  id: string;
  name: string;
  avatarUrl: string;
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

export const DEFAULT_AVATAR = '/src/assets/images/rewardbox_avatar_1795708537961.jpg';

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

  return {
    id: user?.id ? String(user.id) : '74920184',
    name: fullName || user?.username || 'Alex Mercer',
    avatarUrl: user?.photo_url || DEFAULT_AVATAR,
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
