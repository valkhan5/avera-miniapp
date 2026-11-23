import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import logo from '@brand/logos/avera-logo-horizontal-reverse.svg';
import { sb } from './supabase';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Orders } from './pages/Orders';
import { Customers } from './pages/Customers';
import { Catalog } from './pages/Catalog';
import { Banners } from './pages/Banners';
import { Tags } from './pages/Tags';
import { Settings } from './pages/Settings';

const PAGES = [['dashboard', 'Дашборд', Dashboard], ['orders', 'Заявки', Orders], ['customers', 'Клиенты', Customers], ['catalog', 'Каталог', Catalog],
  ['banners', 'Баннеры', Banners], ['tags', 'Метки', Tags], ['settings', 'Настройки', Settings]] as const;
const current = () => location.hash.replace(/^#\/?/, '') || 'orders';

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [page, setPage] = useState(current);
  useEffect(() => {
    void sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    const on = () => setPage(current());
    window.addEventListener('hashchange', on);
    return () => { data.subscription.unsubscribe(); window.removeEventListener('hashchange', on); };
  }, []);
  if (session === undefined) return null;
  if (!session) return <Login />;
  const Page = (PAGES.find(([k]) => k === page) ?? PAGES[1])[2];
  return (
    <div className="shell">
      <nav className="side">
        <img src={logo} alt="AVERA" className="side-logo" />
        <div className="side-sub">Mobile · Админка</div>
        {PAGES.map(([k, label]) => <a key={k} href={`#/${k}`} className={page === k ? 'on' : ''}>{label}</a>)}
        <div className="side-foot"><small>{session.user.email}</small><button className="btn ghost" onClick={() => void sb.auth.signOut()}>Выйти</button></div>
      </nav>
      <main className="main"><Page /></main>
    </div>
  );
}
