import { useEffect, useState } from 'react';
import { sb, must } from '../supabase';
import { resizeToWebp } from '../lib/image';
import { Drawer, Field } from '../components/ui';

const emptyVariant = (sort: number) => ({ id: null, kind: sort === 1 ? 'base' : 'full', name_ru: sort === 1 ? 'Базовый' : 'Полный', name_uz: sort === 1 ? 'Bazaviy' : 'Toʻliq', items_ru: [], items_uz: [], price: 0, cost: null, stock: null, sort, active: true });

export async function uploadImage(folder: string, file: File): Promise<string> {
  const blob = await resizeToWebp(file);
  const path = `${folder}/${Date.now()}.webp`;
  const { error } = await sb.storage.from('product-images').upload(path, blob, { contentType: 'image/webp', upsert: false });
  if (error) throw new Error(error.message);
  return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}

export function ProductEditor({ id, categories, onClose, onSaved }: { id: string; categories: any[]; onClose: () => void; onSaved: () => void }) {
  const [p, setP] = useState<any>(null);
  const [vs, setVs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (id === 'new') {
        setP({ id: null, category_id: categories[0]?.id, slug: '', code: '', name_ru: '', name_uz: '', audience_ru: '', audience_uz: '', description_ru: '', description_uz: '', images: [], sort: 99, active: true });
        setVs([emptyVariant(1), emptyVariant(2)]);
      } else {
        setP(await must(sb.from('products').select('*').eq('id', id).single()));
        setVs(await must(sb.from('product_variants').select('*').eq('product_id', id).order('sort')) as any[]);
      }
    })();
  }, [id]);
  if (!p) return <Drawer open onClose={onClose} title="Бокс"><p>Загрузка…</p></Drawer>;

  const set = (k: string, v: any) => setP((x: any) => ({ ...x, [k]: v }));
  const setV = (i: number, k: string, v: any) => setVs((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      if (!p.slug || !p.name_ru || !p.name_uz) throw new Error('Заполните код (латиницей) и названия на двух языках');
      const { id: pid, created_at, ...fields } = p;
      const saved: any = pid ? await must(sb.from('products').update(fields).eq('id', pid).select().single()) : await must(sb.from('products').insert(fields).select().single());
      for (const v of vs) {
        const { id: vid, ...vf } = v;
        const row = { ...vf, product_id: saved.id, price: Number(v.price) || 0, cost: v.cost === '' || v.cost == null ? null : Number(v.cost), stock: v.stock === '' || v.stock == null ? null : Number(v.stock), sort: Number(v.sort) || 0 };
        if (vid) await must(sb.from('product_variants').update(row).eq('id', vid)); else await must(sb.from('product_variants').insert(row));
      }
      setMsg('Сохранено'); onSaved();
      if (!pid) onClose();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const addPhoto = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try { const urls = []; for (const f of Array.from(files)) urls.push(await uploadImage(p.id ?? 'new', f)); set('images', [...p.images, ...urls]); setMsg('Фото загружено — не забудьте сохранить'); }
    catch (e: any) { setMsg(`Не удалось загрузить фото: ${e.message}`); } finally { setBusy(false); }
  };

  return (
    <Drawer open onClose={onClose} title={p.id ? `Бокс ${p.code} · ${p.name_ru}` : 'Новый бокс'}>
      <div className="form">
        <div className="grid2">
          <Field label="Код ссылки (латиницей)" hint="Например nafosat"><input className="input" value={p.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} /></Field>
          <Field label="Номер на карточке"><input className="input" value={p.code} onChange={(e) => set('code', e.target.value)} /></Field>
          <Field label="Название RU"><input className="input" value={p.name_ru} onChange={(e) => set('name_ru', e.target.value)} /></Field>
          <Field label="Название UZ"><input className="input" value={p.name_uz} onChange={(e) => set('name_uz', e.target.value)} /></Field>
          <Field label="Для кого RU"><input className="input" value={p.audience_ru} onChange={(e) => set('audience_ru', e.target.value)} /></Field>
          <Field label="Для кого UZ"><input className="input" value={p.audience_uz} onChange={(e) => set('audience_uz', e.target.value)} /></Field>
          <Field label="Описание RU"><textarea className="input" rows={2} value={p.description_ru} onChange={(e) => set('description_ru', e.target.value)} /></Field>
          <Field label="Описание UZ"><textarea className="input" rows={2} value={p.description_uz} onChange={(e) => set('description_uz', e.target.value)} /></Field>
          <Field label="Категория"><select className="input" value={p.category_id} onChange={(e) => set('category_id', e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name_ru}</option>)}</select></Field>
          <Field label="Порядок"><input className="input" type="number" value={p.sort} onChange={(e) => set('sort', Number(e.target.value))} /></Field>
        </div>
        <label className="check"><input type="checkbox" checked={p.active} onChange={(e) => set('active', e.target.checked)} /> Показывать в приложении</label>

        <h3>Фото</h3>
        <div className="photos">
          {p.images.map((src: string, i: number) => (
            <div key={src} className="photo"><img src={src} alt="" /><button className="btn sm" onClick={() => set('images', p.images.filter((_: string, j: number) => j !== i))}>Убрать</button></div>
          ))}
          <label className="btn">Загрузить фото<input type="file" accept="image/*" multiple hidden onChange={(e) => void addPhoto(e.target.files)} /></label>
        </div>
        {!p.images.length && <small className="muted">Пока фото нет, в приложении показывается фирменное фото по умолчанию.</small>}

        <h3>Варианты состава</h3>
        {vs.map((v, i) => (
          <div key={v.id ?? `n${i}`} className="variant">
            <div className="grid3">
              <Field label="Название RU"><input className="input" value={v.name_ru} onChange={(e) => setV(i, 'name_ru', e.target.value)} /></Field>
              <Field label="Название UZ"><input className="input" value={v.name_uz} onChange={(e) => setV(i, 'name_uz', e.target.value)} /></Field>
              <Field label="Цена, сум"><input className="input" type="number" value={v.price} onChange={(e) => setV(i, 'price', e.target.value)} /></Field>
              <Field label="Себестоимость" hint="Видна только в админке"><input className="input" type="number" value={v.cost ?? ''} onChange={(e) => setV(i, 'cost', e.target.value)} /></Field>
              <Field label="Остаток" hint="Пусто — без учёта"><input className="input" type="number" value={v.stock ?? ''} onChange={(e) => setV(i, 'stock', e.target.value)} /></Field>
              <Field label="Порядок"><input className="input" type="number" value={v.sort} onChange={(e) => setV(i, 'sort', e.target.value)} /></Field>
            </div>
            <div className="grid2">
              <Field label="Состав RU (по строке)"><textarea className="input" rows={5} value={(v.items_ru ?? []).join('\n')} onChange={(e) => setV(i, 'items_ru', lines(e.target.value))} /></Field>
              <Field label="Состав UZ (по строке)"><textarea className="input" rows={5} value={(v.items_uz ?? []).join('\n')} onChange={(e) => setV(i, 'items_uz', lines(e.target.value))} /></Field>
            </div>
            <label className="check"><input type="checkbox" checked={v.active} onChange={(e) => setV(i, 'active', e.target.checked)} /> Продаётся</label>
          </div>
        ))}
        <button className="btn" onClick={() => setVs((xs) => [...xs, emptyVariant(xs.length + 1)])}>Добавить вариант</button>

        {msg && <p className="msg">{msg}</p>}
        <div className="form-actions"><button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Сохраняем…' : 'Сохранить'}</button></div>
        <small className="muted">Боксы с заявками не удаляются — снимите «Показывать», чтобы скрыть.</small>
      </div>
    </Drawer>
  );
}
