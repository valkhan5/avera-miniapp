import { useEffect, useState } from 'react';
import { formatSum } from '@core';
import { sb, must } from '../supabase';
import { PageHead } from '../components/ui';
import { ProductEditor } from './ProductEditor';

export function Catalog() {
  const [cats, setCats] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [edit, setEdit] = useState<string | 'new' | null>(null);
  const load = async () => {
    const [c, p, v] = await Promise.all([must(sb.from('categories').select('*').order('sort')), must(sb.from('products').select('*').order('sort')), must(sb.from('product_variants').select('*').order('sort'))]);
    setCats(c as any[]); setProducts(p as any[]); setVariants(v as any[]);
  };
  useEffect(() => { void load(); }, []);

  const saveCat = async (c: any) => { await sb.from('categories').update({ name_ru: c.name_ru, name_uz: c.name_uz, sort: Number(c.sort) || 0, active: c.active }).eq('id', c.id); await load(); };
  const addCat = async () => {
    const slug = prompt('Код категории латиницей, например 8-mart');
    if (!slug) return;
    const { error } = await sb.from('categories').insert({ slug: slug.trim().toLowerCase(), name_ru: 'Новая категория', name_uz: 'Yangi kategoriya', sort: cats.length + 1 });
    if (error) alert(error.message); await load();
  };
  const upd = (id: string, patch: any) => setCats((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <div>
      <PageHead eyebrow="03 · КАТАЛОГ" title="Каталог" actions={<><button className="btn" onClick={addCat}>Добавить категорию</button><button className="btn primary" onClick={() => setEdit('new')}>Добавить бокс</button></>} />
      <h3 className="sub">Категории</h3>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Код</th><th>Название RU</th><th>Название UZ</th><th>Порядок</th><th>Показывать</th><th /></tr></thead>
          <tbody>{cats.map((c) => (
            <tr key={c.id}>
              <td><small>{c.slug}</small></td>
              <td><input className="input sm" value={c.name_ru} onChange={(e) => upd(c.id, { name_ru: e.target.value })} /></td>
              <td><input className="input sm" value={c.name_uz} onChange={(e) => upd(c.id, { name_uz: e.target.value })} /></td>
              <td><input className="input sm num" type="number" value={c.sort} onChange={(e) => upd(c.id, { sort: e.target.value })} /></td>
              <td><input type="checkbox" checked={c.active} onChange={(e) => upd(c.id, { active: e.target.checked })} /></td>
              <td><button className="btn sm" onClick={() => saveCat(c)}>Сохранить</button></td>
            </tr>))}
          </tbody>
        </table>
      </div>
      {cats.map((c) => (
        <section key={c.id} className="cat-block">
          <h3 className="sub">{c.name_ru}{!c.active && <span className="flag">скрыта</span>}</h3>
          <div className="product-grid">
            {products.filter((p) => p.category_id === c.id).map((p) => {
              const vs = variants.filter((v) => v.product_id === p.id);
              return (
                <button key={p.id} className={`product-tile${p.active ? '' : ' hidden'}`} onClick={() => setEdit(p.id)}>
                  <div className="thumb">{p.images[0] ? <img src={p.images[0]} alt="" /> : <span>фото по умолчанию</span>}</div>
                  <b>{p.code} · {p.name_ru}</b>
                  <small>{vs.map((v) => `${v.name_ru}: ${formatSum(v.price, 'ru')}${v.stock != null ? ` (ост. ${v.stock})` : ''}`).join(' · ')}</small>
                  {!p.active && <span className="flag">скрыт</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {edit && <ProductEditor id={edit} categories={cats} onClose={() => setEdit(null)} onSaved={load} />}
    </div>
  );
}
