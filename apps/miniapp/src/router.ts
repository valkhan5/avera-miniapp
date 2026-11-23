import { useEffect, useState } from 'react';

const parse = () => location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);

export function useRoute(): string[] {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path: string) {
  location.hash = `#/${path.replace(/^\//, '')}`;
}

export function back(fallback = '') {
  if (history.length > 1) history.back();
  else go(fallback);
}
