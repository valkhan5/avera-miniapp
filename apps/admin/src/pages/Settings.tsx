import { useEffect, useState } from 'react';
import { sb, must } from '../supabase';
import { adminApi } from '../adminApi';
import { Field, PageHead } from '../components/ui';

export function Settings() {
  const [s, setS] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [managers, setManagers] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const load = async () => {
    setS(await must(sb.from('settings').select('*').eq('id', 1).single()));
    setManagers(((await must(sb.from('managers').select('email').order('email'))) as any[]).map((m) => m.email));
  };
  const addManager = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setMsg('Проверьте почту'); return; }
    const { error } = await sb.from('managers').insert({ email });
    setMsg(error ? error.message : `Доступ открыт для ${email}. Создайте этому человеку пользователя в Supabase → Authentication → Users.`); setNewEmail(''); await load();
  };
  const removeManager = async (email: string) => { if (confirm(`Закрыть доступ для ${email}?`)) { await sb.from('managers').delete().eq('email', email); await load(); } };
  useEffect(() => { void load(); }, []);
  if (!s) return <p>Загрузка…</p>;
  const set = (k: string, v: any) => setS((x: any) => ({ ...x, [k]: v }));
  const num = (k: string) => <input className="input" type="number" value={s[k] ?? ''} onChange={(e) => set(k, e.target.value === '' ? null : Number(e.target.value))} />;
  const txt = (k: string, rows = 0) => rows ? <textarea className="input" rows={rows} value={s[k] ?? ''} onChange={(e) => set(k, e.target.value)} /> : <input className="input" value={s[k] ?? ''} onChange={(e) => set(k, e.target.value)} />;
  const save = async () => {
    const { id, manager_chat_id, bind_code, updated_at, ...f } = s;
    const { error } = await sb.from('settings').update({ ...f, delivery_slots: String(f.delivery_slots).split(',').map((x: string) => x.trim()).filter(Boolean), updated_at: new Date().toISOString() }).eq('id', 1);
    setMsg(error ? error.message : 'Сохранено'); if (!error) await load();
  };
  const run = async (fn: () => Promise<any>, ok: string) => { setMsg(null); try { const r = await fn(); setMsg(r?.bot ? `${ok}: @${r.bot}` : ok); } catch (e: any) { setMsg(`Ошибка: ${e.message}`); } };

  return (
    <div>
      <PageHead eyebrow="06 · НАСТРОЙКИ" title="Настройки" actions={<button className="btn primary" onClick={save}>Сохранить</button>} />
      {msg && <p className="msg">{msg}</p>}
      <section className="card">
        <h3>Бот и группа менеджеров</h3>
        <p>Группа: {s.manager_chat_id ? <b>привязана ({s.manager_chat_id})</b> : <b className="flag">не привязана</b>}</p>
        <p>Код привязки: <code className="code">/bind {s.bind_code}</code> — отправьте эту команду в группе, где бот — администратор.</p>
        <div className="form-actions">
          <button className="btn" onClick={() => run(adminApi.setupBot, 'Бот подключён')}>Подключить бота</button>
          <button className="btn" onClick={() => run(adminApi.testGroup, 'Сообщение отправлено в группу')}>Тестовое сообщение в группу</button>
        </div>
      </section>
      <section className="card">
        <h3>Менеджеры с доступом к админке</h3>
        <ul className="items">{managers.map((m) => <li key={m}>{m} <button className="btn sm" onClick={() => removeManager(m)}>Убрать</button></li>)}</ul>
        <div className="form-actions"><input className="input" style={{ maxWidth: 320 }} type="email" placeholder="почта менеджера" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /><button className="btn" onClick={addManager}>Добавить</button></div>
      </section>
      <section className="card grid3">
        <Field label="Скидка за самовывоз, %">{num('pickup_discount_pct')}</Field>
        <Field label="Скидка по промокоду игры, %">{num('promo_discount_pct')}</Field>
        <Field label="Максимальная скидка, %">{num('max_discount_pct')}</Field>
        <label className="check"><input type="checkbox" checked={s.stack_discounts} onChange={(e) => set('stack_discounts', e.target.checked)} /> Суммировать скидки</label>
        <Field label="Порог игры, очков">{num('game_threshold')}</Field>
        <Field label="Промокоды действуют до"><input className="input" type="datetime-local" value={String(s.promo_valid_until).slice(0, 16)} onChange={(e) => set('promo_valid_until', `${e.target.value}:00+05:00`)} /></Field>
      </section>
      <section className="card grid3">
        <Field label="Интервалы доставки" hint="Через запятую">{<input className="input" value={Array.isArray(s.delivery_slots) ? s.delivery_slots.join(', ') : s.delivery_slots} onChange={(e) => set('delivery_slots', e.target.value)} />}</Field>
        <Field label="Заказы на сегодня — до, час">{num('same_day_cutoff_hour')}</Field>
        <Field label="Последний день доставки"><input className="input" type="date" value={s.last_delivery_date} onChange={(e) => set('last_delivery_date', e.target.value)} /></Field>
      </section>
      <section className="card grid2">
        <Field label="Адрес шоурума RU">{txt('pickup_address_ru')}</Field>
        <Field label="Адрес шоурума UZ">{txt('pickup_address_uz')}</Field>
        <Field label="Часы работы RU">{txt('pickup_hours_ru')}</Field>
        <Field label="Часы работы UZ">{txt('pickup_hours_uz')}</Field>
        <Field label="Широта шоурума">{num('pickup_lat')}</Field>
        <Field label="Долгота шоурума">{num('pickup_lng')}</Field>
        <Field label="Обещание после заказа RU">{txt('contact_promise_ru', 2)}</Field>
        <Field label="Обещание после заказа UZ">{txt('contact_promise_uz', 2)}</Field>
      </section>
    </div>
  );
}
