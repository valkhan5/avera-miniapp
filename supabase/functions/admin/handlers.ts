import { applyStatus } from '../_shared/orderflow.ts';
import { errorCode, type OrderDeps } from '../_shared/types.ts';
import type { OrderStatus } from '../_shared/core/statuses.ts';

export interface AdminDeps extends OrderDeps {
  getUser: (authHeader: string | null) => Promise<{ id: string; email?: string } | null>;
  projectUrl: string;
  webhookSecret: string;
  miniAppUrl: string;
}

type Res = { status: number; body: any };
const ok = (data: unknown): Res => ({ status: 200, body: { ok: true, data } });
const fail = (status: number, code: string): Res => ({ status, body: { ok: false, code } });

export async function handleAdmin(authHeader: string | null, body: any, d: AdminDeps): Promise<Res> {
  const user = await d.getUser(authHeader).catch(() => null);
  if (!user) return fail(401, 'AUTH');
  try {
    switch (body?.action) {
      case 'set_status':
        return ok(await applyStatus(body.order_id, body.status as OrderStatus, user.email ?? user.id, d, body.expected ?? null));
      case 'setup_bot': {
        await d.tg('setWebhook', { url: `${d.projectUrl}/functions/v1/bot`, secret_token: d.webhookSecret, allowed_updates: ['message', 'callback_query'] });
        await d.tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Открыть магазин', web_app: { url: d.miniAppUrl } } });
        await d.tg('setMyCommands', { commands: [{ command: 'start', description: 'Открыть магазин · Doʻkonni ochish' }] });
        const me = await d.tg('getMe', {});
        return ok({ bot: me?.username ?? null });
      }
      case 'test_group': {
        const s = await d.settings();
        if (!s.manager_chat_id) return fail(400, 'NO_GROUP');
        await d.tg('sendMessage', { chat_id: s.manager_chat_id, text: 'Тестовое сообщение из админки Avera Mobile. Заявки будут приходить сюда.' });
        return ok(null);
      }
      default:
        return fail(400, 'BAD_ACTION');
    }
  } catch (e) {
    const code = errorCode(e);
    if (code === 'SERVER') console.error(e);
    return fail(code === 'SERVER' ? 500 : 400, code === 'SERVER' && String(e).includes('telegram') ? 'TELEGRAM' : code);
  }
}
