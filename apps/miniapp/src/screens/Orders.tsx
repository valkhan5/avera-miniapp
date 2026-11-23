import { useCallback, useEffect, useState } from 'react';
import { formatSum, STATUS_LABELS } from '@core';
import { useStore } from '../store';
import { back, go } from '../router';
import { useBackButton } from '../telegram';
import { call } from '../api';
import { cacheOrders } from '../orders';
import { fmtDate } from '../i18n/dates';
import { TopBar } from '../components/TopBar';
import { Loading } from './Status';

export default function Orders() {
  const { t, lang } = useStore();
  const [list, setList] = useState<any[] | null>(null);
  const onBack = useCallback(() => back(''), []);
  useBackButton(onBack);
  useEffect(() => { void call<any[]>('my_orders').then((l) => { cacheOrders(l); setList(l); }).catch(() => setList([])); }, []);
  if (!list) return <Loading />;
  return (
    <div className="page">
      <TopBar onBack={onBack} title={t('my_orders')} />
      <div className="pad">
        {!list.length && <div className="empty"><p>{t('orders_empty')}</p><button className="btn-secondary" onClick={() => go('')}>{t('to_catalog')}</button></div>}
        <ul className="order-list">
          {list.map((o) => (
            <li key={o.id}>
              <button className="order-row" data-test="order-row" onClick={() => go(`orders/${o.id}`)}>
                <span className="or-num">{o.number}</span>
                <span className={`status-chip s-${o.status}`} data-test="order-status">{STATUS_LABELS[lang][o.fulfillment as 'pickup'][o.status as 'new']}</span>
                <span className="or-meta">{fmtDate(o.delivery_date, lang)} · {formatSum(o.total, lang)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
