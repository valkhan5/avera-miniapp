import { useCallback, useEffect, useState } from 'react';
import { formatSum, STATUS_LABELS } from '@core';
import { useStore } from '../store';
import { back } from '../router';
import { tg, useBackButton, haptic } from '../telegram';
import { call } from '../api';
import { cachedOrder, cacheOrders } from '../orders';
import { fmtDate } from '../i18n/dates';
import { TopBar } from '../components/TopBar';
import { StatusTimeline } from '../components/StatusTimeline';
import { Loading } from './Status';

function confirmCancel(text: string): Promise<boolean> {
  const w = tg();
  if (w?.showConfirm) return new Promise((r) => w.showConfirm(text, (ok: boolean) => r(ok)));
  return Promise.resolve(true);
}

export default function OrderDetail({ id }: { id: string }) {
  const { t, lang } = useStore();
  const [order, setOrder] = useState<any>(() => cachedOrder(id));
  const [busy, setBusy] = useState(false);
  const onBack = useCallback(() => back('orders'), []);
  useBackButton(onBack);
  useEffect(() => { void call<any[]>('my_orders').then((l) => { cacheOrders(l); setOrder(cachedOrder(id)); }).catch(() => {}); }, [id]);
  if (!order) return <Loading />;

  const cancel = async () => {
    if (busy || !(await confirmCancel(t('cancel_confirm', { n: order.number })))) return;
    setBusy(true);
    try { const o = await call<any>('cancel_order', { order_id: order.id }); cacheOrders([o]); setOrder(o); haptic('success'); }
    catch { haptic('error'); }
    finally { setBusy(false); }
  };
  const label = STATUS_LABELS[lang][order.fulfillment as 'pickup'][order.status as 'new'];

  return (
    <div className="page">
      <TopBar onBack={onBack} title={`${t('order')} ${order.number}`} />
      <div className="pad">
        <div className="od-head">
          <h2>{order.number}</h2>
          <span className={`status-chip s-${order.status}`} data-test="order-status-current">{label}</span>
        </div>
        <p className="hint">{order.fulfillment === 'pickup' ? t('pickup_on', { date: fmtDate(order.delivery_date, lang) }) : t('delivery_on', { date: fmtDate(order.delivery_date, lang), slot: order.delivery_slot ?? '' })}</p>
        <div className="eyebrow section-gap">{t('status_history')}</div>
        <StatusTimeline status={order.status} fulfillment={order.fulfillment} history={order.history ?? []} />
        <div className="eyebrow section-gap">{t('items')}</div>
        <ul className="comp">
          {order.items.map((it: any, i: number) => (
            <li key={i}><span className="dot">·</span>{lang === 'ru' ? it.product_name_ru : it.product_name_uz} · {lang === 'ru' ? it.variant_name_ru : it.variant_name_uz} × {it.qty}</li>
          ))}
        </ul>
        <div className="summary">
          {order.pickup_discount > 0 && <div className="tl"><span>{t('discount_pickup')}</span><span>−{formatSum(order.pickup_discount, lang)}</span></div>}
          {order.promo_discount > 0 && <div className="tl"><span>{t('discount_promo')}</span><span>−{formatSum(order.promo_discount, lang)}</span></div>}
          <div className="tl total"><span>{t('total')}</span><span>{formatSum(order.total, lang)}</span></div>
          <div className="tl muted"><span>{t('cod')}</span></div>
        </div>
        {order.status === 'new' && <button className="btn-danger" data-test="cancel-order" disabled={busy} onClick={cancel}>{t('cancel_order')}</button>}
      </div>
    </div>
  );
}
