import type { Fulfillment } from './statuses.ts';

export interface PricingSettings {
  pickupDiscountPct: number;
  promoDiscountPct: number;
  stackDiscounts: boolean;
  maxDiscountPct: number;
}

export interface PriceLine { price: number; qty: number }

export interface PriceResult {
  subtotal: number;
  pickupDiscount: number;
  promoDiscount: number;
  appliedPct: number;
  total: number;
}

/** Same rule as SQL create_order: total = subtotal × (100 − pct) / 100, rounded down to 1 000. */
export function calcTotals(lines: PriceLine[], fulfillment: Fulfillment, hasPromo: boolean, s: PricingSettings): PriceResult {
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const pickupPct = fulfillment === 'pickup' ? s.pickupDiscountPct : 0;
  const promoPct = hasPromo ? s.promoDiscountPct : 0;
  let appliedPct = s.stackDiscounts ? pickupPct + promoPct : Math.max(pickupPct, promoPct);
  appliedPct = Math.min(appliedPct, s.maxDiscountPct);
  const total = Math.floor((subtotal * (100 - appliedPct)) / 100 / 1000) * 1000;
  const discount = subtotal - total;
  // Attribute the discount: pickup first (its own %), the rest to promo.
  const pickupShare = s.stackDiscounts || pickupPct >= promoPct ? pickupPct : 0;
  const pickupDiscount = Math.min(discount, Math.round((subtotal * Math.min(pickupShare, appliedPct)) / 100));
  const promoDiscount = discount - pickupDiscount;
  return { subtotal, pickupDiscount, promoDiscount, appliedPct, total };
}
