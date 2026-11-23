import { formatSum } from '@core';
import { loc, useStore, type Product } from '../store';
import { BoxArt } from './BoxArt';
import { productImages } from './productImage';

export function ProductCard({ product, categorySlug }: { product: Product; categorySlug: string }) {
  const { lang, t } = useStore();
  const minPrice = Math.min(...product.variants.map((v) => v.price));
  const low = product.variants.find((v) => v.stock_state === 'low');
  const allOut = product.variants.every((v) => v.stock_state === 'out');
  return (
    <a className="card" data-test="product-card" href={`#/p/${product.slug}`}>
      <div className="card-img">
        {productImages(product, 'card')[0] ? <img src={productImages(product, 'card')[0]} alt={loc(lang, product, 'name')} loading="lazy" /> : <BoxArt category={categorySlug} code={product.code} />}
        {allOut ? <span className="badge">{t('out_of_stock')}</span> : low?.left ? <span className="badge">{t('left', { n: low.left })}</span> : null}
      </div>
      <div className="card-body">
        <div className="card-eyebrow">{product.code} · {lang === 'ru' ? product.name_uz : product.name_ru}</div>
        <div className="card-name">{loc(lang, product, 'name')}</div>
        <div className="card-aud">{loc(lang, product, 'audience')}</div>
        <div className="card-price">{t('from_price', { price: formatSum(minPrice, lang) })}</div>
      </div>
    </a>
  );
}
