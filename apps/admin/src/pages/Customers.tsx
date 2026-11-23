import { useEffect, useMemo, useState } from 'react';
import { formatPhone } from '@core';
import { sb, must } from '../supabase';
import { downloadCsv } from '../lib/csv';
import { PageHead, fmtDateTime } from '../components/ui';

export function Customers() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    void (async () => {
      const [cs, os] = await Promise.all([
        must(sb.from('customers').select('*').order('last_seen_at', { ascending: false }).limit(5000)),
        must(sb.from('orders').select('customer_id, status').limit(10000)),
      ]);
      const count = new Map<string, number>(); const sales = new Map<string, number>();
      for (const o of os as any[]) { count.set(o.customer_id, (count.get(o.customer_id) ?? 0) + 1); if (o.status === 'done') sales.set(o.customer_id, (sales.get(o.customer_id) ?? 0) + 1); }
      setRows((cs as any[]).map((c) => ({ ...c, orders: count.get(c.id) ?? 0, sales: sales.get(c.id) ?? 0 })));
    })();
  }, []);
  const visible = useMemo(() => rows.filter((c) => !q || `${c.first_name} ${c.last_name ?? ''} ${c.username ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const cols = [{ key: 'first_name', title: 'Имя' }, { key: 'last_name', title: 'Фамилия' }, { key: 'username', title: 'Telegram' }, { key: 'phone', title: 'Телефон' },
    { key: 'first_tag', title: 'Первая метка' }, { key: 'last_tag', title: 'Последняя метка' }, { key: 'orders', title: 'Заявок' }, { key: 'sales', title: 'Продаж' },
    { key: 'best_score', title: 'Счёт в игре' }, { key: 'first_seen_at', title: 'Впервые' }, { key: 'last_seen_at', title: 'Последний визит' }];
  return (
    <div>
      <PageHead eyebrow="02 · КЛИЕНТЫ" title="Клиенты" actions={<button className="btn" onClick={() => downloadCsv('avera-klienty.csv', visible, cols)}>Выгрузить CSV</button>} />
      <div className="filters"><input className="input" placeholder="Поиск: имя, Telegram, телефон" value={q} onChange={(e) => setQ(e.target.value)} /><span className="muted">{visible.length} чел.</span></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Клиент</th><th>Телефон</th><th>Метки</th><th className="num">Заявок</th><th className="num">Продаж</th><th className="num">Игра</th><th>Последний визит</th></tr></thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id}>
                <td>{c.first_name} {c.last_name ?? ''}{c.username && <><br /><a href={`https://t.me/${c.username}`} target="_blank" rel="noreferrer"><small>@{c.username}</small></a></>}</td>
                <td>{c.phone ? <a href={`tel:${c.phone}`}>{formatPhone(c.phone)}</a> : '—'}</td>
                <td><small>{c.first_tag ?? '—'}{c.last_tag && c.last_tag !== c.first_tag ? ` → ${c.last_tag}` : ''}</small></td>
                <td className="num">{c.orders}</td><td className="num">{c.sales}</td><td className="num">{c.best_score || '—'}</td>
                <td>{fmtDateTime(c.last_seen_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
