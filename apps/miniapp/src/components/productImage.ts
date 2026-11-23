// Default AI-generated brand photos shipped with the app; real photos uploaded in the admin take priority.
const BUNDLED = new Set(['start', 'energiya', 'planshet', 'flagman', 'aloqada', 'oqish-va-oyin', 'selfi', 'nafosat']);

export function productImages(p: { slug: string; images: string[] }, size: 'card' | 'full'): string[] {
  if (p.images.length) return p.images;
  if (BUNDLED.has(p.slug)) return [`./boxes/${p.slug}${size === 'card' ? '-400' : ''}.webp`];
  return [];
}
