// Fake Telegram WebApp for ?mock=1 (local preview and e2e checks).
import data from './mockCatalog.json';
export function installMockTelegram() {
  const q = new URLSearchParams(location.search);
  const noop = () => {};
  if (q.has('cart')) {
    const v = (data as any).variants;
    try { localStorage.setItem('avera_cart_v1', JSON.stringify([{ variantId: v[0].id, qty: 1 }, { variantId: v[15].id, qty: 2 }])); } catch { /* ignore */ }
  }
  window.Telegram = {
    WebApp: {
      initData: 'mock', version: '8.0', platform: 'web',
      initDataUnsafe: { user: { id: 111, first_name: 'Ali', language_code: q.get('lang') ?? 'ru' }, start_param: 'ig_dm_boks' },
      ready: noop, expand: noop, setHeaderColor: noop, setBackgroundColor: noop, setBottomBarColor: noop, disableVerticalSwipes: noop,
      BackButton: { show: noop, hide: noop, onClick: noop, offClick: noop },
      HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop },
      requestContact: (cb: any) => cb(true, { responseUnsafe: { contact: { phone_number: '998901234567' } } }),
      requestWriteAccess: (cb: any) => cb(true),
      openTelegramLink: noop,
    },
  };
}
