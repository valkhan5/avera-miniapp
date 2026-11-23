import type { Tg } from './telegram.ts';

export interface Settings {
  manager_chat_id: number | null; bind_code: string;
  pickup_discount_pct: number; promo_discount_pct: number; stack_discounts: boolean; max_discount_pct: number;
  delivery_slots: string[]; last_delivery_date: string; same_day_cutoff_hour: number; game_threshold: number; promo_valid_until: string;
  pickup_address_ru: string; pickup_address_uz: string; pickup_hours_ru: string; pickup_hours_uz: string;
  pickup_lat: number | null; pickup_lng: number | null; contact_promise_ru: string; contact_promise_uz: string;
}

export type Rpc = (fn: string, args: Record<string, unknown>) => Promise<any>;

export interface OrderDeps {
  rpc: Rpc;
  tg: Tg;
  settings: () => Promise<Settings>;
  setGroupMessageId: (orderId: string, messageId: number) => Promise<void>;
}

/** Business error codes raised by SQL functions; anything else is a server error. */
export const KNOWN_CODES = new Set([
  'EMPTY_CART', 'BAD_QTY', 'UNAVAILABLE', 'OUT_OF_STOCK', 'BAD_PHONE', 'NEED_NAME', 'NEED_LOCATION', 'NEED_ADDRESS', 'BAD_DATE',
  'BAD_SLOT', 'CARD_TOO_LONG', 'BAD_PROMO', 'BAD_FULFILLMENT', 'RATE_LIMIT', 'BAD_TOKEN', 'NO_CUSTOMER', 'CANNOT_CANCEL',
  'BAD_TRANSITION', 'BAD_SCORE', 'BAD_EVENT', 'NOT_FOUND',
]);

export function errorCode(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const code = msg.match(/[A-Z_]{4,}/)?.[0] ?? '';
  return KNOWN_CODES.has(code) ? code : 'SERVER';
}

/** Customer-safe view of an order: no cost, no internal fields. */
export function publicOrder(o: any): any {
  if (!o) return o;
  const { manager_note, group_message_id, customer_id, client_token, ...rest } = o;
  return { ...rest, items: (o.items ?? []).map(({ cost, ...line }: any) => line) };
}
