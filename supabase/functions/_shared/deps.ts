// Deno-only wiring shared by the bot and admin functions.
import { serviceClient } from './db.ts';
import { tgClient } from './telegram.ts';
import type { OrderDeps, Settings } from './types.ts';

export const sb = serviceClient();
const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';

/** Webhook secret derived from the bot token, so only one secret has to be configured. */
async function deriveSecret(token: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${token}:avera-webhook`));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 48);
}

export const env = {
  botToken,
  webhookSecret: Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? (botToken ? await deriveSecret(botToken) : ''),
  miniAppUrl: Deno.env.get('MINIAPP_URL') ?? 'https://avera-miniapp.pages.dev',
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
