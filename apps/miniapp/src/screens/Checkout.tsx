import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, availableDates, formatSum, isInTashkent, normalizeUzPhone, RECIPIENTS, RECIPIENT_LABELS, tashkentParts } from '@core';
import { useStore } from '../store';
import { back, go } from '../router';
import { getLocation, haptic, requestContact, requestWriteAccess, tgUser, useBackButton } from '../telegram';
import { call, ApiError } from '../api';
import { useCheckout } from '../checkoutState';
import { cacheOrders } from '../orders';
import { hasKey } from '../i18n';
import { chipDate } from '../i18n/dates';
import { TopBar } from '../components/TopBar';
import { FulfillmentPicker } from '../components/FulfillmentPicker';
import { Totals, useTotals } from '../components/Totals';
import { BottomBar, PrimaryButton } from '../components/BottomBar';

const MapPicker = lazy(() => import('../components/MapPicker'));
type Errors = Partial<Record<'name' | 'phone' | 'location' | 'address' | 'date' | 'slot', string>>;

export default function Checkout() {
  const { t, lang, cartLines, settings, promo, setPromo, clearCart, reload } = useStore();
  const { form, set, reset } = useCheckout();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState<'idle' | 'busy' | 'failed'>('idle');
  const submitting = useRef(false);
  const placed = useRef(false);
  const onBack = useCallback(() => back('cart'), []);
  useBackButton(onBack);

  useEffect(() => { if (!form.name && tgUser()?.first_name) set('name', tgUser()!.first_name!); }, []);
  useEffect(() => { void call('track', { type: 'checkout_open', payload: {} }).catch(() => {}); }, []);
  useEffect(() => { if (!cartLines.length && !placed.current) go('cart'); }, [cartLines.length]);

  const promoCode = form.promoCode || promo?.code || '';
  const totals = useTotals(form.fulfillment, !!promoCode);
  const dates = useMemo(() => (settings ? availableDates(new Date(), settings.lastDate, settings.cutoffHour) : []), [settings]);
  const today = tashkentParts(new Date()).date;
  const delivery = form.fulfillment === 'delivery';

  const locate = async () => {
    setLocating('busy');
    const p = await getLocation();
    if (p) { set('point', p); setLocating('idle'); haptic('success'); } else { setLocating('failed'); }
  };
  const sharePhone = async () => { const p = await requestContact(); if (p) set('phone', p); };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!form.name.trim()) e.name = t('err_name');
    if (!normalizeUzPhone(form.phone)) e.phone = t('err_phone');
    if (!form.date || !dates.includes(form.date)) e.date = t('err_date');
    if (delivery) {
      if (!form.point) e.location = t('err_location');
      if (!form.address.trim()) e.address = t('err_address');
      if (!form.slot || !settings?.slots.includes(form.slot)) e.slot = t('err_slot');
    }
    return e;
  };

  const submit = async () => {
    if (submitting.current) return;
    const e = validate();
    setErrors(e); setFormError(null);
    if (Object.keys(e).length) {
      haptic('error');
      document.querySelector('.field-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    submitting.current = true; setBusy(true);
    try {
      const notify = await requestWriteAccess();
      const order = await call<any>('create_order', { order: {
        client_token: form.clientToken, items: cartLines.map((l) => ({ variant_id: l.variantId, qty: l.qty })), fulfillment: form.fulfillment,
        contact_name: form.name.trim(), contact_phone: form.phone, recipient: form.recipient || null, card_text: form.cardText.trim() || null,
        address_text: delivery ? form.address.trim() : null, landmark: delivery ? form.landmark.trim() : null,
        lat: delivery ? form.point?.lat : null, lng: delivery ? form.point?.lng : null,
        delivery_date: form.date, delivery_slot: delivery ? form.slot : null, comment: form.comment.trim() || null,
        promo_code: promoCode || null, notify_allowed: notify, expected_subtotal: totals.subtotal,
      } });
      cacheOrders([order]);
      if (order.promo_code) setPromo(null);
      placed.current = true;
      clearCart(); reset(); haptic('success');
      go(`done/${order.id}`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'NETWORK';
      const key = `e_${code}`;
      setFormError(t(hasKey(key) ? key : 'e_default'));
      haptic('error');
      if (code === 'UNAVAILABLE' || code === 'OUT_OF_STOCK' || code === 'PRICE_CHANGED') await reload();
      if (code === 'BAD_PROMO') set('promoCode', '');
      if (code === 'BAD_DATE') set('date', '');
    } finally {
      submitting.current = false; setBusy(false);
    }
  };

  const pickupAddr = lang === 'ru' ? settings?.pickup.address_ru : settings?.pickup.address_uz;
  const pickupHours = lang === 'ru' ? settings?.pickup.hours_ru : settings?.pickup.hours_uz;

  return (
    <div className="page">
      <TopBar onBack={onBack} title={t('checkout')} />
      <div className="pad">
        <section className="sec">
          <div className="eyebrow">{t('s_contact')}</div>
          <label className="field"><span>{t('name')}</span>
            <input className="input" data-test="name" value={form.name} autoComplete="name" onChange={(e) => set('name', e.target.value)} />
            {errors.name && <em className="field-error">{errors.name}</em>}
          </label>
          <label className="field"><span>{t('phone')}</span>
            <input className="input" data-test="phone" inputMode="tel" placeholder="+998 90 123 45 67" value={form.phone} autoComplete="tel" onChange={(e) => set('phone', e.target.value)} />
            {errors.phone && <em className="field-error">{errors.phone}</em>}
          </label>
          <button type="button" className="link-btn" onClick={sharePhone}>{t('share_phone')}</button>
        </section>

        <section className="sec">
          <div className="eyebrow">{t('s_recipient')}</div>
          <div className="chip-wrap">
            {RECIPIENTS.map((r) => (
              <button key={r} type="button" className={`chip${form.recipient === r ? ' on' : ''}`} aria-pressed={form.recipient === r}
                onClick={() => set('recipient', form.recipient === r ? '' : r)}>{RECIPIENT_LABELS[lang][r]}</button>
            ))}
          </div>
          <label className="field"><span>{t('card_text')}</span>
            <textarea className="input" rows={3} maxLength={200} value={form.cardText} onChange={(e) => set('cardText', e.target.value)} />
            <small className="hint">{t('card_hint')} {form.cardText.length}/200</small>
          </label>
        </section>

        <section className="sec">
          <div className="eyebrow">{t('s_receive')}</div>
          <FulfillmentPicker value={form.fulfillment} onChange={(f) => set('fulfillment', f)} />
          {delivery ? (
            <>
              <p className="hint">{t('map_hint')}</p>
              <button type="button" className="btn-secondary wide" data-test="locate" onClick={locate} disabled={locating === 'busy'}>
                {locating === 'busy' ? t('locating') : t('my_location')}
              </button>
              {locating === 'failed' && <p className="hint warn">{t('location_failed')}</p>}
              <Suspense fallback={<div className="map map-loading" />}>
                <MapPicker value={form.point} onChange={(p) => { set('point', p); setErrors((x) => ({ ...x, location: undefined })); }} />
              </Suspense>
              {form.point && <p className="hint ok" data-test="pin-set">{t('pin_set')} · {form.point.lat.toFixed(5)}, {form.point.lng.toFixed(5)}</p>}
              {form.point && !isInTashkent(form.point.lat, form.point.lng) && <p className="hint warn">{t('out_of_city')}</p>}
              {errors.location && <em className="field-error" data-test="error-location">{errors.location}</em>}
              <label className="field"><span>{t('address')}</span>
                <input className="input" data-test="address" value={form.address} onChange={(e) => set('address', e.target.value)} />
                {errors.address && <em className="field-error">{errors.address}</em>}
              </label>
              <label className="field"><span>{t('landmark')}</span>
                <input className="input" value={form.landmark} onChange={(e) => set('landmark', e.target.value)} />
              </label>
            </>
          ) : (
            <div className="pickup-box">
              <div className="eyebrow">{t('pickup_address')}</div>
              <p>{pickupAddr || t('pickup_address_soon')}</p>
              {pickupHours && <p className="hint">{pickupHours}</p>}
            </div>
          )}

          <div className="field"><span>{t('date')}</span>
            <div className="date-row">
              {dates.map((d) => {
                const c = chipDate(d, lang);
                const label = d === today ? t('today') : d === addDays(today, 1) ? t('tomorrow') : c.top;
                return (
                  <button key={d} type="button" data-test="date-chip" className={`date-chip${form.date === d ? ' on' : ''}`} aria-pressed={form.date === d} onClick={() => set('date', d)}>
                    <span>{label}</span><b>{c.bottom}</b>
                  </button>
                );
              })}
            </div>
            {errors.date && <em className="field-error">{errors.date}</em>}
          </div>
          {delivery && (
            <div className="field"><span>{t('slot')}</span>
              <div className="chip-wrap">
                {settings?.slots.map((s) => (
                  <button key={s} type="button" data-test="slot-chip" className={`chip${form.slot === s ? ' on' : ''}`} aria-pressed={form.slot === s} onClick={() => set('slot', s)}>{s}</button>
                ))}
              </div>
              {errors.slot && <em className="field-error">{errors.slot}</em>}
            </div>
          )}
        </section>

        <section className="sec">
          <div className="eyebrow">{t('s_comment')}</div>
          <textarea className="input" rows={2} placeholder={t('comment')} value={form.comment} onChange={(e) => set('comment', e.target.value)} />
        </section>

        <Totals fulfillment={form.fulfillment} hasPromo={!!promoCode} />
        {formError && <p className="form-error" data-test="form-error" role="alert">{formError}</p>}
      </div>
      <BottomBar>
        <PrimaryButton test="submit" busy={busy} onClick={submit}>{busy ? t('sending') : t('confirm_order', { sum: formatSum(totals.total, lang) })}</PrimaryButton>
      </BottomBar>
    </div>
  );
}
