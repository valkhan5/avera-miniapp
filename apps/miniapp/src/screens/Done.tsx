import { useEffect, useState } from 'react';
import icon from '@brand/logos/avera-icon.svg';
import { formatSum } from '@core';
import { useStore } from '../store';
import { go } from '../router';
import { call } from '../api';
import { cachedOrder, cacheOrders } from '../orders';
import { fmtDate } from '../i18n/dates';
import { BottomBar, PrimaryButton } from '../components/BottomBar';

export default function Done({ id }: { id: string }) {
  const { t, lang, settings } = useStore();
  const [order, setOrder] = useState<any>(() => cachedOrder(id));
  useEffect(() => {
    if (order) return;
    void call<any[]>('my_orders').then((list) => { cacheOrders(list); setOrder(cachedOrder(id)); }).catch(() => {});
  }, [id]);

  return (
    <div className="page done">
      <div className="done-hero">
        <img src={icon} alt="" width={56} />
        <div className="eyebrow">{t('done_title')}</div>
        <h1 data-test="done-number">{order?.number ?? '…'}</h1>
        <p>{lang === 'ru' ? settings?.promise.ru : settings?.promise.uz}</p>
      </div>
      {order && (
        <div className="pad">
          <div className="summary">
            <div className="tl"><span>{order.fulfillment === 'pickup' ? t('pickup_on', { date: fmtDate(order.delivery_date, lang) }) : t('delivery_on', { date: fmtDate(order.delivery_date, lang), slot: order.delivery_slot ?? '' })}</span></div>
            <div className="tl total"><span>{t('total')}</span><span>{formatSum(order.total, lang)}</span></div>
            <div className="tl muted"><span>{t('cod')}</span></div>
          </div>
        </div>
      )}
      <BottomBar>
        <PrimaryButton test="track" onClick={() => go(`orders/${id}`)}>{t('track')}</PrimaryButton>
        <button className="btn-ghost" onClick={() => go('')}>{t('to_catalog')}</button>
      </BottomBar>
    </div>
  );
}
