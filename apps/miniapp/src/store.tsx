import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { call, setApiLang } from './api';
import { initData, tgUser } from './telegram';
import { translate, type Key, type Lang } from './i18n';
import type { PricingSettings } from '@core';

export interface Variant { id: string; product_id: string; kind: string; name_uz: string; name_ru: string; items_uz: string[]; items_ru: string[]; price: number; stock_state: 'in' | 'low' | 'out'; left?: number }
export interface Product { id: string; category_id: string; slug: string; code: string; name_uz: string; name_ru: string; audience_uz: string; audience_ru: string; description_uz: string; description_ru: string; images: string[]; variants: Variant[] }
export interface Category { id: string; slug: string; name_uz: string; name_ru: string }
export interface Banner { id: string; title_uz: string; title_ru: string; text_uz: string; text_ru: string; image_url: string | null; style: 'dark' | 'beige' | 'light'; action: 'none' | 'product' | 'category' | 'game'; action_value: string | null }
export interface Settings {
  pricing: PricingSettings; slots: string[]; lastDate: string; cutoffHour: number; threshold: number; promoValidUntil: string;
  pickup: { address_ru: string; address_uz: string; hours_ru: string; hours_uz: string; lat: number | null; lng: number | null };
  promise: { ru: string; uz: string };
}
export interface Promo { code: string; pct: number; valid_until: string; used?: boolean }
export interface CartLine { variantId: string; qty: number }

type Status = 'loading' | 'ready' | 'error' | 'outside';

const CART_KEY = 'avera_cart_v1';
const LANG_KEY = 'avera_lang';
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

function initialLang(): Lang {
  const saved = read(LANG_KEY);
  if (saved === 'ru' || saved === 'uz') return saved;
  return tgUser()?.language_code === 'ru' ? 'ru' : 'uz';
}

function useStoreValue() {
  const [status, setStatus] = useState<Status>('loading');
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [cart, setCart] = useState<CartLine[]>(() => { try { return JSON.parse(read(CART_KEY) ?? '[]'); } catch { return []; } });

  useEffect(() => { setApiLang(lang); write(LANG_KEY, lang); document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { write(CART_KEY, JSON.stringify(cart)); }, [cart]);

  const t = useCallback((key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);

  const variants = useMemo(() => {
    const m = new Map<string, { variant: Variant; product: Product }>();
    for (const p of products) for (const v of p.variants) m.set(v.id, { variant: v, product: p });
    return m;
  }, [products]);

  const load = useCallback(async () => {
    if (!initData()) { setStatus('outside'); return; }
    try {
      const d = await call<any>('bootstrap');
      setCategories(d.catalog.categories); setProducts(d.catalog.products); setBanners(d.banners);
      setSettings(d.settings); setPromo(d.promo && !d.promo.used ? d.promo : null);
      const available = new Set<string>(d.catalog.products.flatMap((p: Product) => p.variants.filter((v) => v.stock_state !== 'out').map((v) => v.id)));
      setCart((c) => c.filter((l) => available.has(l.variantId)));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const addToCart = useCallback((variantId: string, qty = 1) => setCart((c) => {
    const ex = c.find((l) => l.variantId === variantId);
    return ex ? c.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(20, l.qty + qty) } : l)) : [...c, { variantId, qty: Math.min(20, qty) }];
  }), []);
  const setQty = useCallback((variantId: string, qty: number) => setCart((c) => c.map((l) => (l.variantId === variantId ? { ...l, qty: Math.max(1, Math.min(20, qty)) } : l))), []);
  const removeLine = useCallback((variantId: string) => setCart((c) => c.filter((l) => l.variantId !== variantId)), []);
  const clearCart = useCallback(() => setCart([]), []);
  const setLang = useCallback((l: Lang) => setLangState(l), []);

  const cartLines = useMemo(() => cart.flatMap((l) => {
    const hit = variants.get(l.variantId);
    return hit ? [{ ...l, ...hit }] : [];
  }), [cart, variants]);

  return { status, lang, setLang, t, categories, products, banners, settings, promo, setPromo, cart, cartLines, variants,
    addToCart, setQty, removeLine, clearCart, reload: load };
}

export type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

export const loc = (lang: Lang, o: any, field: string): string => o?.[`${field}_${lang}`] ?? o?.[`${field}_ru`] ?? '';
