import { useEffect, useState } from 'react';
import { sb, must } from '../supabase';
import { Drawer, Field, PageHead } from '../components/ui';
import { uploadImage } from './ProductEditor';

const blank = { id: null, title_ru: '', title_uz: '', text_ru: '', text_uz: '', image_url: null, style: 'dark', action: 'none', action_value: null, sort: 10, active: true, starts_at: null, ends_at: null };

export function Banners() {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = async () => setRows(await must(sb.from('banners').select('*').order('sort')) as any[]);
  useEffect(() => { void load(); }, []);
  const set = (k: string, v: any) => setEdit((x: any) => ({ ...x, [k]: v }));
  const save = async () => {
    const { id, ...f } = edit;
    const row = { ...f, sort: Number(f.sort) || 0, starts_at: f.starts_at || null, ends_at: f.ends_at || null, action_value: f.action_value || null };
    const { error } = id ? await sb.from('banners').update(row).eq('id', id) : await sb.from('banners').insert(row);
    if (error) { setMsg(error.message); return; }
    setEdit(null); setMsg(null); await load();
  };
  const remove = async () => { if (edit?.id && confirm('Удалить баннер?')) { await sb.from('banners').delete().eq('id', edit.id); setEdit(null); await load(); } };

  return (
    <div>
      <PageHead eyebrow="04 · БАННЕРЫ" title="Баннеры и УТП" actions={<button className="btn primary" onClick={() => setEdit({ ...blank })}>Добавить баннер</button>} />
      <div className="banner-list">
        {rows.map((b) => (
          <button key={b.id} className={`banner-prev b-${b.style}${b.active ? '' : ' hidden'}`} onClick={() => setEdit({ ...b, starts_at: b.starts_at?.slice(0, 10) ?? null, ends_at: b.ends_at?.slice(0, 10) ?? null })}>
            <b>{b.title_ru}</b><span>{b.text_ru}</span><small>{b.title_uz}{!b.active && ' · скрыт'}</small>
          </button>
        ))}
      </div>
      {edit && (
        <Drawer open onClose={() => setEdit(null)} title={edit.id ? 'Баннер' : 'Новый баннер'}>
          <div className="form">
            <div className="grid2">
              <Field label="Заголовок RU"><input className="input" value={edit.title_ru} onChange={(e) => set('title_ru', e.target.value)} /></Field>
              <Field label="Заголовок UZ"><input className="input" value={edit.title_uz} onChange={(e) => set('title_uz', e.target.value)} /></Field>
              <Field label="Текст RU"><textarea className="input" rows={2} value={edit.text_ru} onChange={(e) => set('text_ru', e.target.value)} /></Field>
              <Field label="Текст UZ"><textarea className="input" rows={2} value={edit.text_uz} onChange={(e) => set('text_uz', e.target.value)} /></Field>
              <Field label="Стиль"><select className="input" value={edit.style} onChange={(e) => set('style', e.target.value)}><option value="dark">Тёмный</option><option value="beige">Бежевый</option><option value="light">Светлый</option></select></Field>
              <Field label="Куда ведёт"><select className="input" value={edit.action} onChange={(e) => set('action', e.target.value)}><option value="none">Никуда</option><option value="product">На бокс</option><option value="game">В игру</option></select></Field>
              {edit.action === 'product' && <Field label="Код бокса" hint="Например flagman"><input className="input" value={edit.action_value ?? ''} onChange={(e) => set('action_value', e.target.value)} /></Field>}
              <Field label="Порядок"><input className="input" type="number" value={edit.sort} onChange={(e) => set('sort', e.target.value)} /></Field>
              <Field label="Показывать с"><input className="input" type="date" value={edit.starts_at ?? ''} onChange={(e) => set('starts_at', e.target.value)} /></Field>
              <Field label="Показывать до"><input className="input" type="date" value={edit.ends_at ?? ''} onChange={(e) => set('ends_at', e.target.value)} /></Field>
            </div>
            <label className="check"><input type="checkbox" checked={edit.active} onChange={(e) => set('active', e.target.checked)} /> Показывать</label>
            <Field label="Картинка (необязательно)">
              <div className="photos">{edit.image_url && <div className="photo"><img src={edit.image_url} alt="" /><button className="btn sm" onClick={() => set('image_url', null)}>Убрать</button></div>}
                <label className="btn">Загрузить<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) set('image_url', await uploadImage('banners', f)); }} /></label></div>
            </Field>
            {msg && <p className="error">{msg}</p>}
            <div className="form-actions"><button className="btn primary" onClick={save}>Сохранить</button>{edit.id && <button className="btn danger" onClick={remove}>Удалить</button>}</div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
