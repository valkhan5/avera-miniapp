// Deno-only wiring shared by the bot and admin functions.
import { serviceClient } from './db.ts';
import { tgClient } from './telegram.ts';
import type { OrderDeps, Settings } from './types.ts';

export const sb = serviceClient();
export const env = {
  botToken: Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '',
  webhookSecret: Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '',
  miniAppUrl: Deno.env.get('MINIAPP_URL') ?? '',
  projectUrl: Deno.env.get('SUPABASE_URL') ?? '',
};

export async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

export const orderDeps: OrderDeps & { updateSettings: (p: Partial<Settings>) => Promise<void>; getOrder: (id: string) => Promise<any> } = {
  rpc,
  tg: tgClient(env.botToken),
  settings: async () => (await sb.from('settings').select('*').eq('id', 1).single()).data as Settings,
  setGroupMessageId: async (orderId, messageId) => { await sb.from('orders').update({ group_message_id: messageId }).eq('id', orderId); },
  updateSettings: async (patch) => { await sb.from('settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1); },
  getOrder: async (id) => {
    const { data } = await sb.from('orders').select('*, customer:customers(tg_user_id, username, first_name, language_code)').eq('id', id).single();
    if (!data) return null;
    return { ...data, customer: { ...data.customer, lang: data.customer?.language_code === 'ru' ? 'ru' : 'uz' } };
  },
};
