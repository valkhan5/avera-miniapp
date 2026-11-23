import { describe, it, expect } from 'vitest';
import { availableDates } from '../../supabase/functions/_shared/core/dates.ts';
describe('availableDates', () => {
  it('includes today before cutoff (Tashkent time)', () => { expect(availableDates(new Date('2026-11-30T10:00:00Z'), '2026-12-31', 16)[0]).toBe('2026-11-30'); });
  it('starts tomorrow after cutoff', () => { expect(availableDates(new Date('2026-11-30T12:00:00Z'), '2026-12-31', 16)[0]).toBe('2026-12-01'); });
  it('ends on the last date', () => { expect(availableDates(new Date('2026-11-30T10:00:00Z'), '2026-12-31', 16).at(-1)).toBe('2026-12-31'); });
  it('is empty after the last date', () => { expect(availableDates(new Date('2027-01-01T05:00:00Z'), '2026-12-31', 16)).toEqual([]); });
});
