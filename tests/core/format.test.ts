import { describe, it, expect } from 'vitest';
import { formatSum } from '../../supabase/functions/_shared/core/format.ts';
describe('formatSum', () => {
  it('formats ru with nbsp groups', () => { expect(formatSum(490000, 'ru')).toBe('490 000 сум'); });
  it('formats uz with soʻm', () => { expect(formatSum(4490000, 'uz')).toBe('4 490 000 soʻm'); });
});
