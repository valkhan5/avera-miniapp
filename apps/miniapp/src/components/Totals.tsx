import { calcTotals, formatSum, type Fulfillment } from '@core';
import { useStore } from '../store';

export function useTotals(fulfillment: Fulfillment, hasPromo: boolean) {
  const { cartLines, settings } = useStore();
  const pricing = settings?.pricing ?? { pickupDiscountPct: 10, promoDiscountPct: 5, stackDiscounts: true, maxDiscountPct: 15 };
  return calcTotals(cartLines.map((l) => ({ price: l.variant.price, qty: l.qty })), fulfillment, hasPromo, pricing);
}

export function Totals({ fulfillment, hasPromo }: { fulfillment: Fulfillment; hasPromo: boolean }) {
  const { t, lang } = useStore();
  const r = useTotals(fulfillment, hasPromo);
  return (
    <div className="totals">
      <div className="tl"><span>{t('subtotal')}</span><span data-test="subtotal">{formatSum(r.subtotal, lang)}</span></div>
      {r.pickupDiscount > 0 && <div className="tl"><span>{t('discount_pickup')}</span><span>−{formatSum(r.pickupDiscount, lang)}</span></div>}
      {r.promoDiscount > 0 && <div className="tl"><span>{t('discount_promo')}</span><span>−{formatSum(r.promoDiscount, lang)}</span></div>}
      <div className="tl total"><span>{t('total')}</span><span data-test="total">{formatSum(r.total, lang)}</span></div>
      <div className="tl muted"><span>{t('cod')}</span></div>
    </div>
  );
}
