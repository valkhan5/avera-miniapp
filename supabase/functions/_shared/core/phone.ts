export function normalizeUzPhone(raw: string): string | null {
  const d = (raw || '').replace(/\D/g, '');
  const local = d.length === 12 && d.startsWith('998') ? d.slice(3) : d.length === 9 ? d : null;
  return local && /^\d{9}$/.test(local) ? `+998${local}` : null;
}

export function formatPhone(e164: string): string {
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}
