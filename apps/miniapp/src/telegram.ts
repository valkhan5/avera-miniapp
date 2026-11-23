import { useEffect } from 'react';

declare global {
  interface Window { Telegram?: any; __mockCalls?: any[]; __game?: any }
}

export const isMock = new URLSearchParams(location.search).has('mock');

export function tg(): any | null {
  const w = window.Telegram?.WebApp;
  return w && w.initData ? w : null;
}
export const initData = (): string => tg()?.initData ?? '';
export const startParam = (): string | null => tg()?.initDataUnsafe?.start_param ?? null;
export const tgUser = (): { id: number; first_name?: string; language_code?: string } | null => tg()?.initDataUnsafe?.user ?? null;

export function setupTelegram() {
  const w = tg();
  if (!w) return;
  try {
    w.ready(); w.expand?.();
    w.setHeaderColor?.('#0F0E0C'); w.setBackgroundColor?.('#0F0E0C'); w.setBottomBarColor?.('#0F0E0C');
    w.disableVerticalSwipes?.();
  } catch { /* older clients */ }
}

export function haptic(kind: 'light' | 'success' | 'error' | 'select') {
  const h = tg()?.HapticFeedback;
  if (!h) return;
  try {
    if (kind === 'success' || kind === 'error') h.notificationOccurred(kind);
    else if (kind === 'select') h.selectionChanged();
    else h.impactOccurred('light');
  } catch { /* ignore */ }
}

/** Shows Telegram's native back button while mounted. */
export function useBackButton(onBack: (() => void) | null) {
  useEffect(() => {
    const b = tg()?.BackButton;
    if (!b || !onBack) return;
    b.onClick(onBack); b.show();
    return () => { b.offClick(onBack); b.hide(); };
  }, [onBack]);
}

export function requestContact(): Promise<string | null> {
  const w = tg();
  if (!w?.requestContact) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      w.requestContact((ok: boolean, res: any) => resolve(ok ? res?.responseUnsafe?.contact?.phone_number ?? null : null));
    } catch { resolve(null); }
  });
}

export function requestWriteAccess(): Promise<boolean> {
  const w = tg();
  if (!w?.requestWriteAccess) return Promise.resolve(false);
  return new Promise((resolve) => { try { w.requestWriteAccess((ok: boolean) => resolve(!!ok)); } catch { resolve(false); } });
}

function browserLocation(): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}

/** Telegram LocationManager → browser geolocation → null (caller lets the user drop a pin). */
export async function getLocation(): Promise<{ lat: number; lng: number } | null> {
  const lm = tg()?.LocationManager;
  if (lm?.init) {
    const viaTelegram = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
      try {
        lm.init(() => {
          if (!lm.isLocationAvailable) return resolve(null);
          lm.getLocation((d: any) => resolve(d ? { lat: d.latitude, lng: d.longitude } : null));
        });
      } catch { resolve(null); }
      setTimeout(() => resolve(null), 10000);
    });
    if (viaTelegram) return viaTelegram;
  }
  return browserLocation();
}

export function openTelegramLink(url: string) {
  const w = tg();
  if (w?.openTelegramLink) w.openTelegramLink(url);
  else window.open(url, '_blank');
}
