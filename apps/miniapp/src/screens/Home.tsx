import { useMemo, useState } from 'react';
import { formatSum } from '@core';
import { useStore } from '../store';
import { go } from '../router';
import { Header } from '../components/Header';
import { Snow } from '../components/Snow';
import { BannerCarousel } from '../components/BannerCarousel';
import { CategoryChips } from '../components/CategoryChips';
import { ProductCard } from '../components/ProductCard';
import { BottomBar, PrimaryButton } from '../components/BottomBar';
import pattern from '@brand/pattern.svg';

export function Home() {
  const { t, lang, products, categories, banners, cartLines } = useStore();
  const [cat, setCat] = useState<string | null>(null);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c.slug])), [categories]);
  const visible = products.filter((p) => !cat || catById.get(p.category_id) === cat);
  const count = cartLines.reduce((n, l) => n + l.qty, 0);
  const sum = cartLines.reduce((n, l) => n + l.qty * l.variant.price, 0);

  return (
    <div className="page">
      <Header />
      <section className="hero">
        <div className="hero-pattern" style={{ backgroundImage: `url(${pattern})` }} />
        <div className="garland" aria-hidden="true" />
        <Snow />
        <div className="hero-inner">
          <div className="eyebrow">{t('eyebrow_hero')}</div>
          <h1>{t('hero_title')}</h1>
          <p className="hero-sub">{t('hero_sub')}</p>
        </div>
      </section>
      <BannerCarousel banners={banners} />
      <CategoryChips value={cat} onChange={setCat} />
      <div className="grid">
        {visible.map((p) => <ProductCard key={p.id} product={p} categorySlug={catById.get(p.category_id) ?? ''} />)}
      </div>
      <button className="game-teaser" onClick={() => go('game')}>
        <span className="eyebrow">{t('game_card_title')}</span>
        <span className="game-teaser-text">{t('game_card_text')}</span>
        <span className="game-teaser-cta">{t('play')} →</span>
      </button>
      <footer className="footer">{t('tagline')}</footer>
      {count > 0 && (
        <BottomBar>
          <PrimaryButton test="cart-bar" onClick={() => go('cart')}>{t('cart_bar', { n: count, sum: formatSum(sum, lang) })}</PrimaryButton>
        </BottomBar>
      )}
    </div>
  );
}
