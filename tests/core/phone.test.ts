import { describe, it, expect } from 'vitest';
import { normalizeUzPhone, formatPhone } from '../../supabase/functions/_shared/core/phone.ts';
describe('phone', () => {
  it('normalizes common Uzbek formats', () => {
    for (const r of ['90 123 45 67', '+998 90 123-45-67', '998901234567', '901234567']) expect(normalizeUzPhone(r)).toBe('+998901234567');
  });
  it('rejects short numbers', () => { expect(normalizeUzPhone('12345')).toBeNull(); });
  it('formats E.164', () => { expect(formatPhone('+998901234567')).toBe('+998 90 123 45 67'); });
});
