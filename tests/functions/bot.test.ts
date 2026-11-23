import { describe, it, expect, vi } from 'vitest';
import { handleBot, type BotDeps } from '../../supabase/functions/bot/handlers.ts';
import { handleAdmin, type AdminDeps } from '../../supabase/functions/admin/handlers.ts';
import { sampleOrder } from './fixtures';

const S: any = { manager_chat_id: -100500, bind_code: 'CODE1234', contact_promise_ru: '', contact_promise_uz: '' };

function deps(over: Partial<BotDeps & AdminDeps> = {}) {
  const calls: any[] = [];
  const d: any = {
    calls, webhookSecret: 'whsec', miniAppUrl: 'https://avera-miniapp.pages.dev', projectUrl: 'https://ref.supabase.co',
    settings: async () => S,
    updateSettings: vi.fn(async () => {}),
    setGroupMessageId: vi.fn(async () => {}),
    getOrder: vi.fn(async () => ({ ...sampleOrder, status: 'cancelled', group_message_id: 9, notify_allowed: true })),
    getUser: vi.fn(async (h: string | null) => (h === 'Bearer good' ? { id: 'u1', email: 'm@avera.uz' } : null)),
    rpc: vi.fn(async (fn: string, args: any) => { calls.push(['rpc', fn, args]); return { ...sampleOrder, status: args.p_status ?? 'new', group_message_id: 9, notify_allowed: true }; }),
    tg: vi.fn(async (method: string, payload: any) => { calls.push(['tg', method, payload]); return { message_id: 1, username: 'AveraMobileBot' }; }),
    ...over,
  };
  return d;
}

const cb = (data: string, chatId = -100500) => ({ callback_query: { id: 'cq1', data, from: { id: 5, username: 'manager' }, message: { message_id: 9, chat: { id: chatId } } } });

describe('bot webhook', () => {
  it('rejects requests without the secret header', async () => { expect(await handleBot(null, {}, deps())).toBe(401); });

  it('greets on /start with a Mini App button and records the tag', async () => {
    const d = deps();
    await handleBot('whsec', { message: { text: '/start ig_bio', chat: { id: 111, type: 'private' }, from: { id: 111, first_name: 'Ali' } } }, d);
    expect(d.calls.find((c: any) => c[1] === 'bootstrap_customer')[2]).toMatchObject({ p_tag: 'ig_bio', p_event: 'bot_start' });
    const send = d.calls.find((c: any) => c[1] === 'sendMessage')[2];
    expect(send.reply_markup.inline_keyboard[0][0].web_app.url).toBe('https://avera-miniapp.pages.dev');
  });

  it('binds the group only with the right code', async () => {
    const d = deps();
    await handleBot('whsec', { message: { text: '/bind WRONG', chat: { id: -42, type: 'supergroup' }, from: { id: 5 } } }, d);
    expect(d.updateSettings).not.toHaveBeenCalled();
    await handleBot('whsec', { message: { text: '/bind@AveraMobileBot CODE1234', chat: { id: -42, type: 'supergroup' }, from: { id: 5 } } }, d);
    expect(d.updateSettings).toHaveBeenCalledWith({ manager_chat_id: -42 });
  });

  it('changes status from a group button, edits the message and notifies the customer', async () => {
    const d = deps();
    await handleBot('whsec', cb(`st:${sampleOrder.id}:new:confirmed`), d);
    expect(d.calls.find((c: any) => c[1] === 'set_order_status')[2]).toMatchObject({ p_order_id: sampleOrder.id, p_status: 'confirmed', p_actor: '@manager', p_expected: 'new' });
    expect(d.calls.some((c: any) => c[1] === 'editMessageText')).toBe(true);
    expect(d.calls.some((c: any) => c[1] === 'sendMessage' && c[2].chat_id === 111)).toBe(true);
    expect(d.calls.some((c: any) => c[1] === 'answerCallbackQuery')).toBe(true);
  });

  it('answers politely on a stale button and does not notify the customer', async () => {
    const d = deps({ rpc: vi.fn(async () => { throw new Error('BAD_TRANSITION'); }) as any });
    await handleBot('whsec', cb(`st:${sampleOrder.id}:confirmed:packing`), d);
    expect(d.calls.find((c: any) => c[1] === 'answerCallbackQuery')[2].text).toBe('Статус уже изменён');
    expect(d.calls.some((c: any) => c[1] === 'sendMessage')).toBe(false);
  });

  it('still accepts buttons drawn before the from-status was added', async () => {
    const d = deps();
    await handleBot('whsec', cb(`st:${sampleOrder.id}:confirmed`), d);
    expect(d.calls.find((c: any) => c[1] === 'set_order_status')[2]).toMatchObject({ p_status: 'confirmed', p_expected: null });
  });

  it('ignores buttons pressed outside the manager group', async () => {
    const d = deps();
    await handleBot('whsec', cb(`st:${sampleOrder.id}:done`, -999), d);
    expect(d.rpc).not.toHaveBeenCalled();
  });
});

describe('admin function', () => {
  it('requires a signed-in manager', async () => {
    expect((await handleAdmin('Bearer bad', { action: 'set_status' }, deps())).status).toBe(401);
  });
  it('sets status with the manager email as actor', async () => {
    const d = deps();
    const r = await handleAdmin('Bearer good', { action: 'set_status', order_id: sampleOrder.id, status: 'packing' }, d);
    expect(r.status).toBe(200);
    expect(d.calls.find((c: any) => c[1] === 'set_order_status')[2].p_actor).toBe('m@avera.uz');
    await handleAdmin('Bearer good', { action: 'set_status', order_id: sampleOrder.id, status: 'done', expected: 'packing' }, d);
    expect(d.calls.filter((c: any) => c[1] === 'set_order_status')[1][2].p_expected).toBe('packing');
  });
  it('sets up the webhook, menu button and commands', async () => {
    const d = deps();
    await handleAdmin('Bearer good', { action: 'setup_bot' }, d);
    const wh = d.calls.find((c: any) => c[1] === 'setWebhook')[2];
    expect(wh).toMatchObject({ url: 'https://ref.supabase.co/functions/v1/bot', secret_token: 'whsec' });
    expect(d.calls.find((c: any) => c[1] === 'setChatMenuButton')[2].menu_button.web_app.url).toBe('https://avera-miniapp.pages.dev');
  });
});
