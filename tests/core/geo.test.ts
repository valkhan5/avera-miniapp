import { describe, it, expect } from 'vitest';
import { isInTashkent } from '../../supabase/functions/_shared/core/geo.ts';
describe('isInTashkent', () => {
  it('accepts the center', () => { expect(isInTashkent(41.3111, 69.2797)).toBe(true); });
  it('rejects Chirchiq and Samarkand', () => { expect(isInTashkent(41.47, 69.58)).toBe(false); expect(isInTashkent(39.65, 66.96)).toBe(false); });
});
