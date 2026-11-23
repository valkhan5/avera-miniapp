import { handleBot } from './handlers.ts';
import { env, orderDeps } from '../_shared/deps.ts';

Deno.serve(async (req) => {
  const update = await req.json().catch(() => ({}));
  const status = await handleBot(req.headers.get('x-telegram-bot-api-secret-token'), update,
    { ...orderDeps, webhookSecret: env.webhookSecret, miniAppUrl: env.miniAppUrl });
  return new Response(status === 200 ? 'ok' : 'unauthorized', { status });
});
