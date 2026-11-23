import { welcomeText } from '../_shared/messages.ts';
import { applyStatus, refreshGroupMessage } from '../_shared/orderflow.ts';
import { errorCode, type OrderDeps, type Settings } from '../_shared/types.ts';
import { STATUS_LABELS, type OrderStatus } from '../_shared/core/statuses.ts';

export interface BotDeps extends OrderDeps {
  webhookSecret: string;
  miniAppUrl: string;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  getOrder: (id: string) => Promise<any>;
}

const STATUSES = new Set(['new', 'confirmed', 'packing', 'on_the_way', 'ready', 'done', 'cancelled']);

function command(text: string): { cmd: string; arg: string } | null {
  const m = /^\/([a-z_]+)(?:@\w+)?(?:\s+(.*))?$/i.exec(text.trim());
  return m ? { cmd: m[1].toLowerCase(), arg: (m[2] ?? '').trim() } : null;
}

export async function handleBot(secretHeader: string | null, update: any, d: BotDeps): Promise<number> {
  if (!secretHeader || secretHeader !== d.webhookSecret) return 401;
  try {
    if (update.message?.text) await onMessage(update.message, d);
    else if (update.callback_query) await onCallback(update.callback_query, d);
  } catch (e) {
    console.error(e);
  }
  return 200; // always 200 so Telegram does not retry storms
}

async function onMessage(msg: any, d: BotDeps) {
  const c = command(msg.text);
  if (!c) return;
  const chat = msg.chat;
  if (c.cmd === 'start' && chat.type === 'private') {
    await d.rpc('bootstrap_customer', { p_user: msg.from, p_tag: c.arg || null, p_event: 'bot_start' }).catch((e) => console.error(e));
    await d.tg('sendMessage', { chat_id: chat.id, text: welcomeText(), parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: 'Ochish · Открыть', web_app: { url: d.miniAppUrl } }]] } });
    return;
  }
  if (c.cmd === 'bind' && (chat.type === 'group' || chat.type === 'supergroup')) {
    const s = await d.settings();
    if (c.arg && c.arg === s.bind_code) {
      await d.updateSettings({ manager_chat_id: chat.id });
      await d.tg('sendMessage', { chat_id: chat.id, text: 'Группа привязана. Сюда будут приходить заявки Avera Mobile.' });
    } else {
      await d.tg('sendMessage', { chat_id: chat.id, text: 'Код не подошёл. Возьмите код в админке: Настройки → Группа менеджеров.' });
    }
  }
}

async function onCallback(q: any, d: BotDeps) {
  // st:<order id>:<status the button was drawn for>:<target>; buttons drawn before the middle part existed have no from-status.
  const m = /^st:([0-9a-f-]{36}):(?:([a-z_]+):)?([a-z_]+)$/.exec(q.data ?? '');
  const s = await d.settings();
  if (!m || !STATUSES.has(m[3]) || (m[2] && !STATUSES.has(m[2])) || q.message?.chat?.id !== s.manager_chat_id) {
    await d.tg('answerCallbackQuery', { callback_query_id: q.id }).catch(() => {});
    return;
  }
  const actor = q.from?.username ? `@${q.from.username}` : (q.from?.first_name ?? `tg:${q.from?.id}`);
  try {
    const order = await applyStatus(m[1], m[3] as OrderStatus, actor, d, (m[2] as OrderStatus | undefined) ?? null);
    await d.tg('answerCallbackQuery', { callback_query_id: q.id, text: `${order.number}: ${STATUS_LABELS.ru[order.fulfillment as 'pickup' | 'delivery'][order.status as OrderStatus]}` });
  } catch (e) {
    if (errorCode(e) === 'BAD_TRANSITION') {
      await d.tg('answerCallbackQuery', { callback_query_id: q.id, text: 'Статус уже изменён' });
      const current = await d.getOrder(m[1]).catch(() => null);
      if (current) await refreshGroupMessage(current, d);
    } else {
      await d.tg('answerCallbackQuery', { callback_query_id: q.id, text: 'Не получилось, попробуйте ещё раз' }).catch(() => {});
      throw e;
    }
  }
}
