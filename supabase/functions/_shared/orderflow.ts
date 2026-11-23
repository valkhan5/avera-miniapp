import { groupOrderText, groupOrderKeyboard, customerStatusText } from './messages.ts';
import type { OrderDeps } from './types.ts';
import type { OrderStatus } from './core/statuses.ts';

async function safe(p: Promise<unknown>) { try { await p; } catch (e) { console.error(e); } }

/** Refresh the order's message in the manager group (text + buttons). */
export async function refreshGroupMessage(order: any, d: Pick<OrderDeps, 'tg' | 'settings'>): Promise<void> {
  const s = await d.settings().catch(() => null);
  if (!s?.manager_chat_id || !order?.group_message_id) return;
  await safe(d.tg('editMessageText', { chat_id: s.manager_chat_id, message_id: order.group_message_id, parse_mode: 'HTML',
    text: groupOrderText(order), reply_markup: groupOrderKeyboard(order), link_preview_options: { is_disabled: true } }));
}

/** One path for every status change (admin or group button): DB rule check, group message, customer message.
 *  `expected` is the status the person was looking at; the change is refused if the order has moved since. */
export async function applyStatus(orderId: string, status: OrderStatus, actor: string, d: OrderDeps, expected: OrderStatus | null = null): Promise<any> {
  const order = await d.rpc('set_order_status', { p_order_id: orderId, p_status: status, p_actor: actor, p_expected: expected });
  await refreshGroupMessage(order, d);
  if (order.notify_allowed && order.customer?.tg_user_id) {
    await safe(d.tg('sendMessage', { chat_id: order.customer.tg_user_id, parse_mode: 'HTML', text: customerStatusText(order, order.customer.lang ?? 'uz') }));
  }
  return order;
}
