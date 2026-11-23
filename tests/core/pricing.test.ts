import { describe, it, expect } from 'vitest';
import { calcTotals } from '../../supabase/functions/_shared/core/pricing.ts';
const S = { pickupDiscountPct: 10, promoDiscountPct: 5, stackDiscounts: true, maxDiscountPct: 15 };
describe('calcTotals', () => {
  it('stacks pickup and promo discounts and rounds total down to 1000', () => {
    expect(calcTotals([{ price: 490000, qty: 1 }], 'pickup', true, S)).toEqual({ subtotal: 490000, pickupDiscount: 49000, promoDiscount: 25000, appliedPct: 15, total: 416000 });
  });
  it('applies no discount for delivery without promo', () => {
    expect(calcTotals([{ price: 490000, qty: 1 }], 'delivery', false, S).total).toBe(490000);
  });
  it('applies promo only for delivery with promo', () => {
    expect(calcTotals([{ price: 1190000, qty: 2 }], 'delivery', true, S)).toMatchObject({ subtotal: 2380000, promoDiscount: 119000, total: 2261000 });
  });
  it('uses the larger discount when stacking is off', () => {
    expect(calcTotals([{ price: 490000, qty: 1 }], 'pickup', true, { ...S, stackDiscounts: false })).toMatchObject({ appliedPct: 10, promoDiscount: 0, total: 441000 });
  });
  it('caps the stacked discount at maxDiscountPct', () => {
    expect(calcTotals([{ price: 1000000, qty: 1 }], 'pickup', true, { ...S, promoDiscountPct: 10 }).appliedPct).toBe(15);
  });
});
