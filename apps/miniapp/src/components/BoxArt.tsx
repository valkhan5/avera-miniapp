// Brand-styled gift box illustration used until real photos are uploaded in the admin.
const PALETTES: Record<string, { bg: string; box: string; lid: string; ribbon: string; ink: string }> = {
  vzroslym: { bg: '#39271D', box: '#B6906B', lid: '#CFA884', ribbon: '#0F0E0C', ink: '#E3D9CF' },
  'dlya-neyo': { bg: '#E3D9CF', box: '#FAF9F6', lid: '#F3ECE4', ribbon: '#B6906B', ink: '#644E40' },
  detyam: { bg: '#644E40', box: '#E3D9CF', lid: '#F3ECE4', ribbon: '#B6906B', ink: '#E3D9CF' },
};

export function BoxArt({ category, code }: { category: string; code: string }) {
  const p = PALETTES[category] ?? PALETTES.vzroslym;
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" role="img" aria-hidden="true" style={{ display: 'block', background: p.bg }}>
      <text x="14" y="34" fill={p.ink} opacity="0.55" fontFamily="Bounded, Arial" fontWeight="800" fontSize="22">{code}</text>
      <ellipse cx="100" cy="168" rx="62" ry="7" fill="#000" opacity="0.18" />
      <rect x="44" y="84" width="112" height="82" fill={p.box} />
      <rect x="36" y="70" width="128" height="20" fill={p.lid} />
      <rect x="92" y="70" width="16" height="96" fill={p.ribbon} />
      <path d="M100 70 C 82 46, 58 52, 70 66 C 76 72, 92 72, 100 70 Z" fill="none" stroke={p.ribbon} strokeWidth="7" strokeLinejoin="round" />
      <path d="M100 70 C 118 46, 142 52, 130 66 C 124 72, 108 72, 100 70 Z" fill="none" stroke={p.ribbon} strokeWidth="7" strokeLinejoin="round" />
      <g transform="translate(122 104)" fill="none" stroke={p.ribbon} strokeWidth="2.4" opacity="0.85">
        <path d="M0 40 V16 C0 7 7 0 12 -4 C17 0 24 7 24 16 V40" />
        <path d="M6 40 V22 M12 40 V12 M18 40 V22" />
        <circle cx="12" cy="9" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="19" r="2" />
      </g>
    </svg>
  );
}
