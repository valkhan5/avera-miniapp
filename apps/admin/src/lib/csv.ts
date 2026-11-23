export interface Column { key: string; title: string }

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Excel-friendly CSV: UTF-8 BOM, `;` separator, CRLF. */
export function toCsv(rows: Record<string, unknown>[], columns: Column[]): string {
  const lines = [columns.map((c) => cell(c.title)).join(';'), ...rows.map((r) => columns.map((c) => cell(r[c.key])).join(';'))];
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function downloadCsv(name: string, rows: Record<string, unknown>[], columns: Column[]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
