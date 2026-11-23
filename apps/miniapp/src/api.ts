import { API_URL } from './config';
import { initData, isMock } from './telegram';

export class ApiError extends Error {
  constructor(public code: string) { super(code); }
}

let lang = 'uz';
export const setApiLang = (l: string) => { lang = l; };

export async function call<T = any>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  if (isMock) return (await import('./dev/mockApi')).mockCall(action, body) as Promise<T>;
  let json: any;
  try {
    const res = await fetch(API_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, initData: initData(), lang, ...body }),
    });
    json = await res.json();
  } catch {
    throw new ApiError('NETWORK');
  }
  if (!json?.ok) throw new ApiError(json?.code ?? 'NETWORK');
  return json.data as T;
}
