import { useEffect, useState } from 'react';
import { canTransition, formatPhone, formatSum, RECIPIENT_LABELS, STATUS_LABELS, statusFlow, type OrderStatus } from '@core';
import { sb, must } from '../supabase';
import { adminApi } from '../adminApi';
import { Drawer, StatusBadge, fmtDateTime, fmtDay } from '../components/ui';

export function OrderDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const [o, setO] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    const [order, hist] = await Promise.all([
      must(sb.from('orders').select('*, customer:customers(username, first_name, tg_user_id)').eq('id', id).single()),
      must(sb.from('order_status_history').select('*').eq('order_id', id).order('id')),
    ]);
    setO(order); setNote((order as any).manager_note ?? ''); setHistory(hist ?? []);
  };
  useEffect(() => { setO(null); setError(null); void load(); }, [id]);

  const setStatus = async (s: OrderStatus) => {
    if (s === 'cancelled' && !confirm(`Отменить заявку ${o.number}?`)) return;
    setBusy(true); setError(null);
    try { await adminApi.setStatus(o.id, s, o.status); await load(); onChanged(); }
    catch (e: any) { setError(e.message === 'BAD_TRANSITION' ? 'Статус уже изменился, обновили карточку.' : 'Не получилось сменить статус.'); await load(); }
    finally { setBusy(false); }
  };
  const saveNote = async () => { if (o && note !== (o.manager_note ?? '')) { await sb.from('orders').update({ manager_note: note }).eq('id', o.id); onChanged(); } };

  const next = o ? [...statusFlow(o.fulfillment), 'cancelled' as OrderStatus].filter((s) => canTransition(o.status, s, o.fulfillment)) : [];
  return (
    <Drawer open={!!id} onClose={onClose} title={o ? `Заявка ${o.number}` : 'Заявка'}>
      {!o ? <p>Загрузка…</p> : (
        <div className="order">
          <div className="row"><StatusBadge status={o.status} fulfillment={o.fulfillment} /><small>{fmtDateTime(o.created_at)}</small></div>
          <div className="status-actions">
            {next.map((s) => (
              <button key={s} className={`btn ${s === 'cancelled' ? 'danger' : 'primary'}`} disabled={busy} onClick={() => setStatus(s)}>
                {s === 'cancelled' ? 'Отменить' : STATUS_LABELS.ru[o.fulfillment as 'pickup'][s]}
              </button>
            ))}
          </div>
          {error && <p className="error">{error}</p>}

          <h3>Клиент</h3>
          <p><b>{o.contact_name}</b><br />
            <a href={`tel:${o.contact_phone}`}>{formatPhone(o.contact_phone)}</a>
            {o.customer?.username && <> · <a href={`https://t.me/${o.customer.username}`} target="_blank" rel="noreferrer">@{o.customer.username}</a></>}</p>

          <h3>{o.fulfillment === 'pickup' ? 'Самовывоз' : 'Доставка'}</h3>
          <p>{fmtDay(o.delivery_date)}{o.delivery_slot ? `, ${o.delivery_slot}` : ''}</p>
          {o.fulfillment === 'delivery' && (
            <p>{o.address_text}{o.landmark ? ` (ориентир: ${o.landmark})` : ''}<br />
              {o.lat != null && <a href={`https://yandex.uz/maps/?pt=${o.lng},${o.lat}&z=17&l=map`} target="_blank" rel="noreferrer">Открыть точку в Яндекс Картах</a>}
              {o.out_of_city && <><br /><b className="flag">Вне Ташкента — уточните условия доставки</b></>}</p>
          )}

          <h3>Состав</h3>
          <ul className="items">{o.items.map((i: any, k: number) => <li key={k}>{i.product_name_ru} · {i.variant_name_ru} × {i.qty} — {formatSum(i.price * i.qty, 'ru')}</li>)}</ul>
          <div className="sum">
            {o.pickup_discount > 0 && <div>Скидка за самовывоз: −{formatSum(o.pickup_discount, 'ru')}</div>}
            {o.promo_discount > 0 && <div>Промокод {o.promo_code}: −{formatSum(o.promo_discount, 'ru')}</div>}
            <div><b>Итого: {formatSum(o.total, 'ru')}</b> · оплата при получении</div>
          </div>

          {(o.recipient || o.card_text || o.comment) && <h3>Подарок</h3>}
          {o.recipient && <p>Кому: {(RECIPIENT_LABELS.ru as any)[o.recipient] ?? o.recipient}</p>}
          {o.card_text && <p>Открытка: «{o.card_text}»</p>}
          {o.comment && <p>Комментарий: {o.comment}</p>}

          <h3>Заметка менеджера</h3>
          <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} placeholder="Видна только менеджерам" />

          <h3>История</h3>
          <ul className="history">{history.map((h) => <li key={h.id}>{fmtDateTime(h.created_at)} — {STATUS_LABELS.ru[o.fulfillment as 'pickup'][h.to_status as OrderStatus]} · {h.actor}</li>)}</ul>
          <p><small>Метка: {o.tag ?? '—'} · первая метка: {o.first_tag ?? '—'}</small></p>
        </div>
      )}
    </Drawer>
  );
}
