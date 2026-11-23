import { handle } from './handlers.ts';
import { serviceClient } from '../_shared/db.ts';
import { tgClient } from '../_shared/telegram.ts';

const sb = serviceClient();
const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization, apikey, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS' };

async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

const deps = {
  botToken,
  nowSec: () => Math.floor(Date.now() / 1000),
  rpc,
  tg: tgClient(botToken),
  query: {
    settings: async () => (await sb.from('settings').select('*').eq('id', 1).single()).data,
    catalog: async () => {
      const [categories, products, variants, banners] = await Promise.all([
        sb.from('categories').select('*'), sb.from('products').select('*'),
        sb.from('product_variants').select('id, product_id, kind, name_uz, name_ru, items_uz, items_ru, price, stock, sort, active'),
        sb.from('banners').select('*'),
      ]);
      return { categories: categories.data ?? [], products: products.data ?? [], variants: variants.data ?? [], banners: banners.data ?? [] };
    },
    setGroupMessageId: async (orderId: string, messageId: number) => { await sb.from('orders').update({ group_message_id: messageId }).eq('id', orderId); },
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const body = await req.json().catch(() => ({}));
  const res = await handle(body, deps as any);
  return new Response(JSON.stringify(res.body), { status: res.status, headers: { ...cors, 'content-type': 'application/json' } });
});
