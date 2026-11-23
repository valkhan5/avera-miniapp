import { useCallback, useState } from 'react';
import { formatSum } from '@core';
import { loc, useStore } from '../store';
import { back, go } from '../router';
import { useBackButton } from '../telegram';
import { useCheckout } from '../checkoutState';
import { TopBar } from '../components/TopBar';
import { Stepper } from '../components/Stepper';
import { FulfillmentPicker } from '../components/FulfillmentPicker';
import { Totals } from '../components/Totals';
import { BottomBar, PrimaryButton } from '../components/BottomBar';
import { productImages } from '../components/productImage';

export default function Cart() {
  const { t, lang, cartLines, setQty, removeLine, promo, settings } = useStore();
  const { form, set } = useCheckout();
  const [code, setCode] = useState('');
  const onBack = useCallback(() => back(''), []);
  useBackButton(onBack);
  const promoCode = form.promoCode || promo?.code || '';

  if (!cartLines.length) {
    return (
      <div className="page"><TopBar onBack={onBack} title={t('cart')} />
        <div className="empty"><p>{t('cart_empty')}</p><button className="btn-secondary" onClick={() => go('')}>{t('to_catalog')}</button></div>
      </div>
    );
  }

  return (
    <div className="page">
      <TopBar onBack={onBack} title={t('cart')} />
      <div className="pad">
        <ul className="lines">
          {cartLines.map((l) => (
            <li key={l.variantId} className="line">
              <div className="line-img">{productImages(l.product, 'card')[0] ? <img src={productImages(l.product, 'card')[0]} alt="" /> : null}</div>
              <div className="line-main">
                <div className="line-name">{loc(lang, l.product, 'name')}</div>
                <div className="line-var">{loc(lang, l.variant, 'name')} · {formatSum(l.variant.price, lang)}</div>
                <div className="line-ctrl">
                  <Stepper value={l.qty} onChange={(n) => setQty(l.variantId, n)} />
                  <button className="link-btn" onClick={() => removeLine(l.variantId)}>{t('remove')}</button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="eyebrow section-gap">{t('fulfillment')}</div>
        <FulfillmentPicker value={form.fulfillment} onChange={(f) => set('fulfillment', f)} />

        <div className="eyebrow section-gap">{t('promo')}</div>
        {promoCode ? (
          <div className="promo-chip">{t('promo_applied', { code: promoCode, pct: settings?.pricing.promoDiscountPct ?? 5 })}</div>
        ) : (
          <div className="promo-row">
            <input className="input" value={code} placeholder={t('promo_placeholder')} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <button className="btn-secondary" disabled={!code.trim()} onClick={() => set('promoCode', code.trim())}>{t('apply')}</button>
          </div>
        )}

        <Totals fulfillment={form.fulfillment} hasPromo={!!promoCode} />
      </div>
      <BottomBar><PrimaryButton test="to-checkout" onClick={() => go('checkout')}>{t('checkout')}</PrimaryButton></BottomBar>
    </div>
  );
}
