const TAG_RE = /^[a-z0-9_]{1,64}$/;

export function normalizeTag(raw?: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  return TAG_RE.test(t) ? t : null;
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

function sanitizePart(part: string): string {
  return [...part.toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join('').replace(/[^a-z0-9]/g, '');
}

export function buildTag(parts: string[]): string {
  return parts.map(sanitizePart).filter(Boolean).join('_').slice(0, 64).replace(/_+$/, '');
}

export function miniAppLink(bot: string, tag?: string | null): string {
  const t = normalizeTag(tag);
  return `https://t.me/${bot}?startapp${t ? `=${t}` : ''}`;
}
