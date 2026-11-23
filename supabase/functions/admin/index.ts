import { handleAdmin } from './handlers.ts';
import { env, orderDeps, sb } from '../_shared/deps.ts';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization, apikey, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS' };

async function getUser(authHeader: string | null) {
  const jwt = authHeader?.replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data } = await sb.auth.getUser(jwt);
  return data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const body = await req.json().catch(() => ({}));
  const res = await handleAdmin(req.headers.get('authorization'), body,
    { ...orderDeps, getUser, projectUrl: env.projectUrl, webhookSecret: env.webhookSecret, miniAppUrl: env.miniAppUrl });
  return new Response(JSON.stringify(res.body), { status: res.status, headers: { ...cors, 'content-type': 'application/json' } });
});
