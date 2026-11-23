import icon from '@brand/logos/avera-icon.svg';
import { loc, useStore, type Banner } from '../store';
import { go } from '../router';

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const { lang, t } = useStore();
  const open = (b: Banner) => {
    if (b.action === 'game') go('game');
    else if (b.action === 'product' && b.action_value) go(`p/${b.action_value}`);
  };
  return (
    <div className="banners" aria-label="Avera">
      {banners.map((b) => (
        <div key={b.id} data-test="banner" className={`banner banner-${b.style}${b.action !== 'none' ? ' clickable' : ''}`} onClick={() => open(b)}
          style={b.image_url ? { backgroundImage: `linear-gradient(90deg, rgba(15,14,12,.85), rgba(15,14,12,.2)), url(${b.image_url})` } : undefined}>
          <div className="banner-title">{loc(lang, b, 'title')}</div>
          <div className="banner-text">{loc(lang, b, 'text')}</div>
          {b.action === 'game' && <span className="banner-cta">{t('play')}</span>}
          <img className="banner-mark" src={icon} alt="" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
