export type Tg = (method: string, payload?: Record<string, unknown>) => Promise<any>;

/** Minimal Bot API client. Throws with Telegram's description on failure. */
export function tgClient(token: string, f: typeof fetch = fetch): Tg {
  return async (method, payload = {}) => {
    const res = await f(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? res.status}`);
    return json.result;
  };
}
