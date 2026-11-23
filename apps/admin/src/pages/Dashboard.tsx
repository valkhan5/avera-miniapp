import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatNumber, formatSum, STATUS_LABELS } from '@core';
import { sb } from '../supabase';
import { PageHead } from '../components/ui';

const C = { hazel: '#39271D', almond: '#644E40', beige: '#B6906B', sand: '#E3D9CF', gold: '#CFA884' };
const tk = (d: Date) => new Date(d.getTime() + 5 * 3600e3).toISOString().slice(0, 10);
const PERIODS: Record<string, () => [string, string]> = {
  today: () => [`${tk(new Date())}T00:00:00+05:00`, `${tk(new Date(Date.now() + 86400e3))}T00:00:00+05:00`],
  week: () => [`${tk(new Date(Date.now() - 6 * 86400e3))}T00:00:00+05:00`, `${tk(new Date(Date.now() + 86400e3))}T00:00:00+05:00`],
  december: () => ['2026-12-01T00:00:00+05:00', '2027-01-01T00:00:00+05:00'],
  all: () => ['2026-11-01T00:00:00+05:00', `${tk(new Date(Date.now() + 86400e3))}T00:00:00+05:00`],
};
const FUNNEL: Record<string, string> = { opened: 'Открыли', cart: 'Корзина', requests: 'Заявки', orders: 'Заказы', sales: 'Продажи' };

export function Dashboard() {
  const [period, setPeriod] = useState('december');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [attr, setAttr] = useState<'last' | 'first'>('last');
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const range = useMemo<[string, string]>(() => (period === 'custom' && custom.from && custom.to
    ? [`${custom.from}T00:00:00+05:00`, `${tk(new Date(new Date(`${custom.to}T00:00:00Z`).getTime() + 86400e3))}T00:00:00+05:00`] : PERIODS[period === 'custom' ? 'all' : period]()), [period, custom]);
  useEffect(() => {
    void sb.rpc('dashboard', { p_from: range[0], p_to: range[1], p_attr: attr }).then(({ data, error }) => { if (error) setError(error.message); else { setError(null); setD(data); } });
  }, [range, attr]);

  const k = d?.kpi ?? {};
  const cards: [string, string, string?][] = [
    ['Лиды', formatNumber(k.leads ?? 0), 'открыли приложение'], ['Тёплые лиды', formatNumber(k.warm_leads ?? 0), 'корзина или игра'],
    ['Заявки', formatNumber(k.requests ?? 0)], ['Заказы', formatNumber(k.orders ?? 0), 'подтверждены'], ['Продажи', formatNumber(k.sales ?? 0), 'доставлены / выданы'],
    ['Выручка', formatSum(k.revenue ?? 0, 'ru')], ['Средний чек', formatSum(k.avg_check ?? 0, 'ru')], ['Валовая прибыль', formatSum(k.gross_profit ?? 0, 'ru'), 'по себестоимости'],
    ['Сыграли', formatNumber(k.players ?? 0)], ['Промокодов выдано', formatNumber(k.promos_issued ?? 0)], ['Промокодов использовано', formatNumber(k.promos_used ?? 0)],
  ];
  const days = (d?.by_day ?? []).map((x: any) => ({ ...x, label: x.day.slice(8, 10) + '.' + x.day.slice(5, 7) }));

  return (
    <div>
      <PageHead eyebrow="00 · ДАШБОРД" title="Дашборд" actions={
        <div className="seg">{[['today', 'Сегодня'], ['week', '7 дней'], ['december', 'Декабрь'], ['custom', 'Период']].map(([v, l]) => <button key={v} className={period === v ? 'on' : ''} onClick={() => setPeriod(v)}>{l}</button>)}</div>} />
      {period === 'custom' && <div className="filters"><input className="input" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /><input className="input" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></div>}
      {error && <p className="error">{error}</p>}
      <div className="kpis" data-test="kpis">{cards.map(([label, value, note]) => <div key={label} className="kpi"><small>{label}</small><b>{value}</b>{note && <span>{note}</span>}</div>)}</div>
      <div className="charts">
        <section className="card"><h3>Заявки и продажи по дням</h3>
          <ResponsiveContainer width="100%" height={240}><LineChart data={days}><CartesianGrid stroke={C.sand} vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} /><Tooltip />
            <Line type="monotone" dataKey="requests" name="Заявки" stroke={C.beige} strokeWidth={2} dot={false} /><Line type="monotone" dataKey="sales" name="Продажи" stroke={C.hazel} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
        </section>
        <section className="card"><h3>Воронка</h3>
          <ResponsiveContainer width="100%" height={240}><BarChart data={(d?.funnel ?? []).map((f: any) => ({ ...f, name: FUNNEL[f.step] }))} layout="vertical" margin={{ left: 16 }}><XAxis type="number" hide allowDecimals={false} /><YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="n" name="Человек" fill={C.beige} /></BarChart></ResponsiveContainer>
        </section>
        <section className="card"><h3>Заявки по статусам</h3>
          <ResponsiveContainer width="100%" height={220}><BarChart data={(d?.by_status ?? []).map((s: any) => ({ ...s, name: STATUS_LABELS.ru.delivery[s.status as 'new'] }))}><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} /><YAxis allowDecimals={false} width={28} /><Tooltip /><Bar dataKey="n" name="Заявок" fill={C.almond} /></BarChart></ResponsiveContainer>
        </section>
        <section className="card"><h3>Продажи по боксам</h3>
          <ResponsiveContainer width="100%" height={220}><BarChart data={d?.by_product ?? []}><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} /><YAxis allowDecimals={false} width={28} /><Tooltip /><Bar dataKey="qty" name="Штук" fill={C.hazel} /></BarChart></ResponsiveContainer>
        </section>
      </div>
      <div className="page-head small"><h3 className="sub">По меткам</h3>
        <div className="seg"><button className={attr === 'last' ? 'on' : ''} onClick={() => setAttr('last')}>Последняя</button><button className={attr === 'first' ? 'on' : ''} onClick={() => setAttr('first')}>Первая</button></div></div>
      <div className="table-wrap"><table className="table"><thead><tr><th>Метка</th><th className="num">Лиды</th><th className="num">Заявки</th><th className="num">Продажи</th><th className="num">Выручка</th></tr></thead>
        <tbody>{(d?.by_tag ?? []).map((r: any) => <tr key={r.tag}><td>{r.tag}</td><td className="num">{r.leads}</td><td className="num">{r.requests}</td><td className="num">{r.sales}</td><td className="num">{formatSum(r.revenue, 'ru')}</td></tr>)}</tbody></table></div>
    </div>
  );
}
