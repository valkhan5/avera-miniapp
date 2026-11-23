import { loc, useStore } from '../store';

export function CategoryChips({ value, onChange }: { value: string | null; onChange: (slug: string | null) => void }) {
  const { categories, lang, t } = useStore();
  return (
    <div className="chips">
      <button className={`chip${value === null ? ' on' : ''}`} aria-pressed={value === null} onClick={() => onChange(null)}>{t('all')}</button>
      {categories.map((c) => (
        <button key={c.id} className={`chip${value === c.slug ? ' on' : ''}`} aria-pressed={value === c.slug} onClick={() => onChange(c.slug)}>{loc(lang, c, 'name')}</button>
      ))}
    </div>
  );
}
