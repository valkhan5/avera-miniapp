import { useStore } from '../store';

export function TopBar({ onBack, title }: { onBack: () => void; title?: string }) {
  const { t } = useStore();
  return (
    <div className="topbar">
      <button className="back-btn" onClick={onBack} aria-label={t('back')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      {title && <div className="topbar-title">{title}</div>}
    </div>
  );
}
