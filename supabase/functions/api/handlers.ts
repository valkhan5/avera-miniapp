import { validateInitData } from '../_shared/initdata.ts';
import type { Tg } from '../_shared/telegram.ts';
import { groupOrderText, groupOrderKeyboard, orderAcceptedText } from '../_shared/messages.ts';
import { errorCode, publicOrder, type Rpc, type Settings } from '../_shared/types.ts';
import type { Lang } from '../_shared/core/statuses.ts';

export interface Catalog { categories: any[]; products: any[]; variants: any[]; banners: any[] }

export interface ApiDeps {
  botToken: string;
  nowSec: () => number;
  rpc: Rpc;
  tg: Tg;
  query: {
    settings: () => Promise<Settings>;
    catalog: () => Promise<Catalog>;
    setGroupMessageId: (orderId: string, messageId: number) => Promise<void>;
  };
}

type Res = { status: number; body: any };
const ok = (data: unknown): Res => ({ status: 200, body: { ok: true, data } });
const fail = (status: number, code: string): Res => ({ status, body: { ok: false, code } });
const bySort = (a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0);

function publicSettings(s: Settings) {
  return {
    pricing: { pickupDiscountPct: s.pickup_discount_pct, promoDiscountPct: s.promo_discount_pct, stackDiscounts: s.stack_discounts, maxDiscountPct: s.max_discount_pct },
    slots: s.delivery_slots, lastDate: s.last_delivery_date, cutoffHour: s.same_day_cutoff_hour, threshold: s.game_threshold,
    promoValidUntil: s.promo_valid_until,
    pickup: { address_ru: s.pickup_address_ru, address_uz: s.pickup_address_uz, hours_ru: s.pickup_hours_ru, hours_uz: s.pickup_hours_uz, lat: s.pickup_lat, lng: s.pickup_lng },
    promise: { ru: s.contact_promise_ru, uz: s.contact_promise_uz },
  };
}

export function publicCatalog(c: Catalog, nowIso: string) {
  const categories = c.categories.filter((k) => k.active).sort(bySort);
  const activeCats = new Set(categories.map((k) => k.id));
  const products = c.products.filter((p) => p.active && activeCats.has(p.category_id)).sort(bySort).map((p) => ({
    ...p,
    variants: c.variants.filter((v) => v.product_id === p.id && v.active).sort(bySort).map(({ cost, stock, ...v }) => ({
      ...v,
      stock_state: stock == null ? 'in' : stock <= 0 ? 'out' : stock <= 3 ? 'low' : 'in',
      ...(stock != null && stock > 0 && stock <= 3 ? { left: stock } : {}),
    })),
  })).filter((p) => p.variants.length > 0);
  const banners = c.banners.filter((b) => b.active && (!b.starts_at || b.starts_at <= nowIso) && (!b.ends_at || b.ends_at >= nowIso)).sort(bySort);
  return { catalog: { categories, products }, banners };
}

async function safe(p: Promise<unknown>) { try { await p; } catch (e) { console.error(e); } }

export async function handle(body: any, d: ApiDeps): Promise<Res> {
  const auth = await validateInitData(body?.initData ?? '', d.botToken, d.nowSec());
  if (!auth) return fail(401, 'AUTH');
  const uid = auth.user.id;
  const lang: Lang = body?.lang === 'ru' || body?.lang === 'uz' ? body.lang : auth.user.language_code === 'ru' ? 'ru' : 'uz';
  try {
    switch (body.action) {
      case 'bootstrap': {
        const [boot, settings, catalog] = await Promise.all([
          d.rpc('bootstrap_customer', { p_user: auth.user, p_tag: auth.startParam, p_event: 'app_open' }),
          d.query.settings(), d.query.catalog(),
        ]);
        return ok({ customer: boot.customer, promo: boot.promo, settings: publicSettings(settings), startParam: auth.startParam,
          ...publicCatalog(catalog, new Date(d.nowSec() * 1000).toISOString()) });
      }
      case 'track':
        await d.rpc('track_event', { p_tg_user_id: uid, p_type: body.type, p_payload: body.payload ?? {} });
        return ok(null);
      case 'create_order': {
        const order = await d.rpc('create_order', { p_tg_user_id: uid, p: { ...(body.order ?? {}), tag: auth.startParam } });
        if (!order.group_message_id) {
          const s = await d.query.settings().catch(() => null);
          if (s?.manager_chat_id) {
            await safe((async () => {
              const msg = await d.tg('sendMessage', { chat_id: s.manager_chat_id, text: groupOrderText(order), parse_mode: 'HTML',
                reply_markup: groupOrderKeyboard(order), link_preview_options: { is_disabled: true } });
              await d.query.setGroupMessageId(order.id, msg.message_id);
            })());
          }
          if (order.notify_allowed) {
            await safe(d.tg('sendMessage', { chat_id: uid, parse_mode: 'HTML',
              text: orderAcceptedText(order, lang, (lang === 'ru' ? s?.contact_promise_ru : s?.contact_promise_uz) ?? '') }));
          }
        }
        return ok(publicOrder(order));
      }
      case 'my_orders': {
        const list = await d.rpc('my_orders', { p_tg_user_id: uid });
        return ok((list ?? []).map(publicOrder));
      }
      case 'cancel_order': {
        const order = await d.rpc('customer_cancel_order', { p_tg_user_id: uid, p_order_id: body.order_id });
        const s = await d.query.settings().catch(() => null);
        if (s?.manager_chat_id && order.group_message_id) {
          await safe(d.tg('editMessageText', { chat_id: s.manager_chat_id, message_id: order.group_message_id, parse_mode: 'HTML',
            text: `${groupOrderText(order)}\n\n<b>Отменён клиентом</b>`, reply_markup: { inline_keyboard: [] }, link_preview_options: { is_disabled: true } }));
        }
        return ok(publicOrder(order));
      }
      case 'game_finish':
        return ok(await d.rpc('issue_promo', { p_tg_user_id: uid, p_score: Math.round(Number(body.score)), p_duration_ms: Math.round(Number(body.duration_ms)) }));
      default:
        return fail(400, 'BAD_ACTION');
    }
  } catch (e) {
    const code = errorCode(e);
    if (code === 'SERVER') console.error(e);
    return fail(code === 'SERVER' ? 500 : 400, code);
  }
}
