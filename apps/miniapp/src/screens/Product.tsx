import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatSum } from '@core';
import { loc, useStore } from '../store';
import { back, go } from '../router';
import { haptic, useBackButton } from '../telegram';
import { call } from '../api';
import { BoxArt } from '../components/BoxArt';
import { productImages } from '../components/productImage';
import { BottomBar, PrimaryButton } from '../components/BottomBar';
import { Stepper } from '../components/Stepper';
import { TopBar } from '../components/TopBar';

export function ProductScreen({ slug }: { slug: string }) {
  const { products, categories, lang, t, addToCart, cart } = useStore();
  const product = products.find((p) => p.slug === slug);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const onBack = useCallback(() => back(''), []);
  useBackButton(onBack);

  useEffect(() => { if (product) void call('track', { type: 'product_view', payload: { slug } }).catch(() => {}); }, [product?.id]);
  const variant = useMemo(() => product?.variants.find((v) => v.id === variantId) ?? product?.variants[0], [product, variantId]);
  if (!product || !variant) return <div className="page"><TopBar onBack={onBack} /><p className="empty">{t('error_title')}</p></div>;

  const cat = categories.find((c) => c.id === product.category_id);
  const base = product.variants[0];
  const baseItems = new Set(loc(lang, base, 'items') as unknown as string[]);
  const items = (variant as any)[`items_${lang}`] as string[];
  const inCart = cart.some((l) => l.variantId === variant.id);
  const out = variant.stock_state === 'out';

  const add = () => {
    if (inCart) { go('cart'); return; }
    addToCart(variant.id, qty);
    haptic('success');
    void call('track', { type: 'add_to_cart', payload: { variant_id: variant.id, qty } }).catch(() => {});
  };

  return (
    <div className="page">
      <TopBar onBack={onBack} />
      <div className="p-hero">
        {productImages(product, 'full').length ? (
          <div className="p-gallery">{productImages(product, 'full').map((src) => <img key={src} src={src} alt={loc(lang, product, 'name')} />)}</div>
        ) : <BoxArt category={cat?.slug ?? ''} code={product.code} />}
      </div>
      <div className="p-body">
        <div className="eyebrow">{product.code} · {cat ? loc(lang, cat, 'name').toUpperCase() : ''}</div>
        <h2 className="p-title">{loc(lang, product, 'name')}</h2>
        <p className="p-aud">{loc(lang, product, 'audience')}</p>
        {loc(lang, product, 'description') && <p className="p-desc">{loc(lang, product, 'description')}</p>}

        {product.variants.length > 1 && (
          <div className="vt" role="group">
            {product.variants.map((v) => (
              <button key={v.id} className={v.id === variant.id ? 'on' : ''} aria-pressed={v.id === variant.id} onClick={() => { setVariantId(v.id); haptic('select'); }}>
                <span className="vt-name">{loc(lang, v, 'name')}</span>
                <span className="vt-price">{formatSum(v.price, lang)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="p-price-row">
          <div className="p-price" data-test="variant-price">{formatSum(variant.price, lang)}</div>
          {variant.stock_state === 'low' && variant.left ? <span className="badge static">{t('left', { n: variant.left })}</span> : null}
          {out && <span className="badge static">{t('out_of_stock')}</span>}
        </div>

        <div className="eyebrow section-gap">{t('composition')}</div>
        <ul className="comp">
          {items.map((it, i) => <li key={i}><span className={baseItems.has(it) || variant.id === base.id ? 'dot' : 'plus'}>{baseItems.has(it) || variant.id === base.id ? '·' : '+'}</span>{it}</li>)}
        </ul>
        <p className="note">{t('smartphone_note')}</p>

        <div className="qty-row">
          <span>{t('qty')}</span>
          <Stepper value={qty} onChange={setQty} min={1} max={20} />
        </div>
        {qty >= 10 && <p className="note">{t('corporate_hint')}</p>}
      </div>
      <BottomBar>
        <PrimaryButton test="add-to-cart" disabled={out} onClick={add}>
          {inCart ? t('in_cart_go') : t('add_to_cart', { sum: formatSum(variant.price * qty, lang) })}
        </PrimaryButton>
      </BottomBar>
    </div>
  );
}
