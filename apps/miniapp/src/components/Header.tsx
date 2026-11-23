import logo from '@brand/logos/avera-logo-horizontal-reverse.svg';
import { useStore } from '../store';
import { go } from '../router';

export function Header() {
  const { lang, setLang, t } = useStore();
  return (
    <header className="header">
      <button className="logo-btn" onClick={() => go('')} aria-label="Avera Mobile"><img src={logo} alt="AVERA" height={22} /></button>
      <div className="header-right">
        <button className="icon-btn" onClick={() => go('orders')} aria-label={t('my_orders')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M6 7h12l-1 13H7L6 7Z" /><path d="M9 7V6a3 3 0 0 1 6 0v1" /><path d="M9.5 12h5M9.5 15.5h5" /></svg>
        </button>
        <div className="seg" role="group" aria-label="Til · Язык">
          {(['uz', 'ru'] as const).map((l) => (
            <button key={l} className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
          ))}
        </div>
      </div>
    </header>
  );
}
