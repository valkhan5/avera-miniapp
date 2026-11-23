export interface TgUser { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string }
export interface InitDataResult { user: TgUser; startParam: string | null; authDate: number }

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Validates Telegram Mini App initData (HMAC-SHA256 with the bot token) and its freshness. */
export async function validateInitData(initData: string, botToken: string, nowSec: number, maxAgeSec = 86400): Promise<InitDataResult | null> {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dcs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = await hmac(enc.encode('WebAppData'), botToken);
  if (!safeEqual(hex(await hmac(secret, dcs)), hash)) return null;
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || nowSec - authDate > maxAgeSec) return null;
  let user: TgUser;
  try { user = JSON.parse(params.get('user') || ''); } catch { return null; }
  if (!user || typeof user.id !== 'number') return null;
  return { user, startParam: params.get('start_param'), authDate };
}
