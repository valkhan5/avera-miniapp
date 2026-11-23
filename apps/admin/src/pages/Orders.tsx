import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatPhone, formatSum, STATUS_LABELS, type OrderStatus } from '@core';
import { sb, must } from '../supabase';
import { downloadCsv } from '../lib/csv';
import { PageHead, StatusBadge, fmtDateTime, fmtDay } from '../components/ui';
import { OrderDrawer } from './OrderDrawer';

const STATUSES: OrderStatus[] = ['new', 'confirmed', 'packing', 'on_the_way', 'ready', 'done', 'cancelled'];

export function Orders() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ status: '', fulfillment: '', tag: '', q: '', from: '', to: '' });
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await must(sb.from('orders').select('*, customer:customers(username, first_name, tg_user_id)').order('created_at', { ascending: false }).limit(1000));
    setRows(data ?? []); setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const ch = sb.channel('orders-live').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load()).subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [load]);

  const visible = useMemo(() => rows.filter((o) =>
    (!f.status || o.status === f.status) && (!f.fulfillment || o.fulfillment === f.fulfillment)
    && (!f.tag || (o.tag ?? '').includes(f.tag.toLowerCase()))
    && (!f.from || o.created_at.slice(0, 10) >= f.from) && (!f.to || o.created_at.slice(0, 10) <= f.to)
    && (!f.q || `${o.number} ${o.contact_name} ${o.contact_phone} ${o.customer?.username ?? ''}`.toLowerCase().includes(f.q.toLowerCase()))), [rows, f]);

  const exportCsv = () => downloadCsv('avera-zayavki.csv', visible.map((o) => ({ ...o, status_ru: STATUS_LABELS.ru[o.fulfillment as 'pickup'][o.status as OrderStatus],
    items_text: o.items.map((i: any) => `${i.product_name_ru} ${i.variant_name_ru} x${i.qty}`).join(', '), username: o.customer?.username ?? '' })), [
    { key: 'number', title: 'Номер' }, { key: 'created_at', title: 'Создана' }, { key: 'status_ru', title: 'Статус' }, { key: 'fulfillment', title: 'Получение' },
    { key: 'delivery_date', title: 'Дата' }, { key: 'delivery_slot', title: 'Интервал' }, { key: 'contact_name', title: 'Имя' }, { key: 'contact_phone', title: 'Телефон' },
    { key: 'username', title: 'Telegram' }, { key: 'items_text', title: 'Состав' }, { key: 'total', title: 'Итого' }, { key: 'promo_code', title: 'Промокод' },
    { key: 'address_text', title: 'Адрес' }, { key: 'landmark', title: 'Ориентир' }, { key: 'tag', title: 'Метка' }, { key: 'manager_note', title: 'Заметка' }]);

  return (
    <div>
      <PageHead eyebrow="01 · ЗАЯВКИ" title="Заявки" actions={<button className="btn" onClick={exportCsv}>Выгрузить CSV</button>} />
      <div className="filters">
        <input className="input" placeholder="Поиск: номер, имя, телефон" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="">Все статусы</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS.ru.delivery[s]}{s === 'ready' ? ' (самовывоз)' : ''}</option>)}
        </select>
        <select className="input" value={f.fulfillment} onChange={(e) => setF({ ...f, fulfillment: e.target.value })}>
          <option value="">Доставка и самовывоз</option><option value="delivery">Доставка</option><option value="pickup">Самовывоз</option>
        </select>
        <input className="input" placeholder="Метка" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} />
        <input className="input" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        <input className="input" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Номер</th><th>Создана</th><th>Статус</th><th>Клиент</th><th>Получение</th><th className="num">Итого</th><th>Метка</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7}>Загрузка…</td></tr>}
            {!loading && !visible.length && <tr><td colSpan={7}>Заявок нет</td></tr>}
            {visible.map((o) => (
              <tr key={o.id} className="clickable" onClick={() => setOpenId(o.id)}>
                <td><b>{o.number}</b>{o.out_of_city && <span className="flag">вне Ташкента</span>}</td>
                <td>{fmtDateTime(o.created_at)}</td>
                <td><StatusBadge status={o.status} fulfillment={o.fulfillment} /></td>
                <td>{o.contact_name}<br /><small>{formatPhone(o.contact_phone)}</small></td>
                <td>{o.fulfillment === 'pickup' ? 'Самовывоз' : 'Доставка'}<br /><small>{fmtDay(o.delivery_date)}{o.delivery_slot ? `, ${o.delivery_slot}` : ''}</small></td>
                <td className="num">{formatSum(o.total, 'ru')}</td>
                <td><small>{o.tag ?? '—'}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <OrderDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />
    </div>
  );
}
