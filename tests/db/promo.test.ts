import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb, call, customer } from './helpers';

describe('issue_promo', () => {
  let db: PGlite;
  beforeAll(async () => { db = await freshDb(); await customer(db, 111); });

  it('gives no code below the threshold', async () => {
    const r = await call(db, 'issue_promo', 111, 250, 60000);
    expect(r).toMatchObject({ promo: null, threshold: 300, best_score: 250 });
  });
  it('issues one personal code and returns it again later', async () => {
    const p = await call(db, 'issue_promo', 111, 320, 60000);
    expect(p.promo.code).toMatch(/^ELF-[A-HJ-NP-Z2-9]{6}$/);
    expect(p.promo.pct).toBe(5);
    const again = await call(db, 'issue_promo', 111, 900, 60000);
    expect(again.promo.code).toBe(p.promo.code);
    expect(again.best_score).toBe(900);
  });
  it('rejects implausible scores and durations', async () => {
    await expect(call(db, 'issue_promo', 111, 9000, 60000)).rejects.toThrow('BAD_SCORE');
    await expect(call(db, 'issue_promo', 111, 100, 20000)).rejects.toThrow('BAD_SCORE');
  });
});
