import { sb } from './supabase';

async function invoke<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.functions.invoke('admin', { body });
  if (error) {
    let code = 'SERVER';
    try { code = (await (error as any).context?.json?.())?.code ?? code; } catch { /* ignore */ }
    throw new Error(code);
  }
  return (data as any)?.data as T;
}

export const adminApi = {
  setStatus: (orderId: string, status: string) => invoke({ action: 'set_status', order_id: orderId, status }),
  setupBot: () => invoke<{ bot: string | null }>({ action: 'setup_bot' }),
  testGroup: () => invoke({ action: 'test_group' }),
};
