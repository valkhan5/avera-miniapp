import { describe, it, expect } from 'vitest';
import { validateInitData } from '../../supabase/functions/_shared/initdata.ts';
import { signInitData, TOKEN } from './fixtures';

const init = signInitData({ auth_date: '1764900000', query_id: 'q', start_param: 'ig_dm_boks', user: JSON.stringify({ id: 111, first_name: 'Ali', language_code: 'uz' }) });

describe('validateInitData', () => {
  it('accepts a correctly signed payload and exposes user and start param', async () => {
    expect(await validateInitData(init, TOKEN, 1764900100)).toMatchObject({ user: { id: 111 }, startParam: 'ig_dm_boks', authDate: 1764900000 });
  });
  it('rejects tampered data', async () => { expect(await validateInitData(init.replace('Ali', 'Bob'), TOKEN, 1764900100)).toBeNull(); });
  it('rejects data older than 24 hours', async () => { expect(await validateInitData(init, TOKEN, 1764900000 + 86401)).toBeNull(); });
  it('rejects payloads without a hash or user', async () => {
    expect(await validateInitData('user=%7B%7D', TOKEN, 1)).toBeNull();
    expect(await validateInitData('', TOKEN, 1)).toBeNull();
  });
  it('rejects a payload signed with another token', async () => {
    expect(await validateInitData(signInitData({ auth_date: '1764900000', user: '{"id":1}' }, '999:other'), TOKEN, 1764900100)).toBeNull();
  });
});
