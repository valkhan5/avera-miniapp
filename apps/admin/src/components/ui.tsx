import type { ReactNode } from 'react';
import { STATUS_LABELS, type Fulfillment, type OrderStatus } from '@core';

export function StatusBadge({ status, fulfillment }: { status: OrderStatus; fulfillment: Fulfillment }) {
  return <span className={`badge st-${status}`}>{STATUS_LABELS.ru[fulfillment][status]}</span>;
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <header className="drawer-head"><h2>{title}</h2><button className="btn ghost" onClick={onClose}>Закрыть</button></header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function PageHead({ eyebrow, title, actions }: { eyebrow: string; title: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' });
export const fmtDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
