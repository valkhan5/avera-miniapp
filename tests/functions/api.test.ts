import { describe, it, expect, vi } from 'vitest';
import { handle, type ApiDeps } from '../../supabase/functions/api/handlers.ts';
import { signInitData, TOKEN, sampleOrder } from './fixtures';

const NOW = 1764900100;
const initData = signInitData({ auth_date: '1764900000', start_param: 'ig_dm_boks', user: JSON.stringify({ id: 111, first_name: 'Ali', language_code: 'ru' }) });

function deps(over: Partial<ApiDeps> = {}): ApiDeps & { calls: any[] } {
  const calls: any[] = [];
  const d: any = {
    calls,
    botToken: TOKEN,
    nowSec: () => NOW,
    rpc: vi.fn(async (fn: string, args: any) => {
      calls.push(['rpc', fn, args]);
      if (fn === 'create_order') return { ...sampleOrder, notify_allowed: true, group_message_id: null };
      if (fn === 'bootstrap_customer') return { customer: { id: 'c1' }, promo: null };
      return null;
    }),
    tg: vi.fn(async (method: string, payload: any) => { calls.push(['tg', method, payload]); return { message_id: 77 }; }),
    query: {
      settings: async () => ({ manager_chat_id: -100500, contact_promise_ru: 'Менеджер свяжется', contact_promise_uz: 'Menejer', pickup_discount_pct: 10,
        promo_discount_pct: 5, stack_discounts: true, max_discount_pct: 15, delivery_slots: ['10:00–14:00'], last_delivery_date: '2026-12-31',
        same_day_cutoff_hour: 16, game_threshold: 300, pickup_address_ru: 'Адрес', pickup_address_uz: 'Manzil', pickup_hours_ru: '', pickup_hours_uz: '',
        pickup_lat: null, pickup_lng: null, bind_code: 'SECRET', promo_valid_until: '2026-12-31T23:59:59+05:00' }),
      catalog: async () => ({
        categories: [{ id: 'k1', slug: 'dlya-neyo', name_uz: 'Ayollarga', name_ru: 'Для неё', sort: 1, active: true }],
        products: [{ id: 'p1', category_id: 'k1', slug: 'nafosat', active: true, sort: 1, name_ru: 'Элеганс', images: [] }],
        variants: [{ id: 'v1', product_id: 'p1', kind: 'base', price: 1990000, stock: 2, active: true, sort: 1, cost: 1125000 },
                   { id: 'v2', product_id: 'p1', kind: 'full', price: 2490000, stock: null, active: true, sort: 2, cost: 1395000 }],
        banners: [{ id: 'b1', active: true, sort: 1, starts_at: null, ends_at: null }, { id: 'b2', active: true, sort: 2, starts_at: null, ends_at: '2025-01-01T00:00:00Z' }],
      }),
      setGroupMessageId: vi.fn(async () => {}),
    },
    ...over,
  };
  return d;
}

describe('api handler', () => {
  it('rejects bad initData with 401 AUTH', async () => {
    expect(await handle({ action: 'bootstrap', initData: 'hash=x' }, deps())).toEqual({ status: 401, body: { ok: false, code: 'AUTH' } });
  });

  it('bootstrap returns catalog without cost, with stock state and active banners only', async () => {
    const r = await handle({ action: 'bootstrap', initData }, deps());
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body).includes('"cost"')).toBe(false);
    expect(JSON.stringify(r.body).includes('bind_code')).toBe(false);
    const v = r.body.data.catalog.products[0].variants;
    expect(v[0]).toMatchObject({ id: 'v1', stock_state: 'low', left: 2 });
    expect(v[1]).toMatchObject({ id: 'v2', stock_state: 'in' });
    expect(v[0].stock).toBeUndefined();
    expect(r.body.data.banners.map((b: any) => b.id)).toEqual(['b1']);
  });

  it('maps business errors to 400 with the code', async () => {
    const d = deps({ rpc: vi.fn(async () => { throw new Error('OUT_OF_STOCK'); }) as any });
    expect(await handle({ action: 'create_order', initData, order: {} }, d)).toEqual({ status: 400, body: { ok: false, code: 'OUT_OF_STOCK' } });
  });

  it('creates an order, notifies the manager group once and stores the message id', async () => {
    const d = deps();
    const r = await handle({ action: 'create_order', initData, lang: 'ru', order: { items: [] } }, d);
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body).includes('"cost"')).toBe(false);
    const group = d.calls.filter((c) => c[0] === 'tg' && c[2].chat_id === -100500);
    expect(group).toHaveLength(1);
    expect(d.query.setGroupMessageId).toHaveBeenCalledWith(sampleOrder.id, 77);
    expect(d.calls.find((c) => c[0] === 'rpc' && c[1] === 'create_order')[2].p.tag).toBe('ig_dm_boks');
    expect(d.calls.some((c) => c[0] === 'tg' && c[2].chat_id === 111)).toBe(true);
  });

  it('still succeeds when Telegram fails', async () => {
    const d = deps({ tg: vi.fn(async () => { throw new Error('telegram down'); }) as any });
    expect((await handle({ action: 'create_order', initData, order: {} }, d)).status).toBe(200);
  });

  it('does not re-notify the group for a repeated (idempotent) order', async () => {
    const d = deps({ rpc: vi.fn(async () => ({ ...sampleOrder, group_message_id: 55 })) as any });
    await handle({ action: 'create_order', initData, order: {} }, d);
    expect(d.tg).not.toHaveBeenCalled();
  });

  it('rejects unknown actions', async () => {
    expect((await handle({ action: 'drop_tables', initData }, deps())).body).toEqual({ ok: false, code: 'BAD_ACTION' });
  });
});
