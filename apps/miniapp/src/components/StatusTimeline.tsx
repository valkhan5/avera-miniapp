import { STATUS_LABELS, statusFlow, type Fulfillment, type OrderStatus } from '@core';
import { useStore } from '../store';

export function StatusTimeline({ status, fulfillment, history }: { status: OrderStatus; fulfillment: Fulfillment; history: { status: string; at: string }[] }) {
  const { lang } = useStore();
  const labels = STATUS_LABELS[lang][fulfillment];
  const at = (s: string) => history.find((h) => h.status === s)?.at;
  const time = (iso?: string) => (iso ? new Date(iso).toLocaleString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  if (status === 'cancelled') {
    return <ol className="timeline"><li className="done current"><span className="tl-dot" /><span className="tl-label">{labels.cancelled}</span><span className="tl-time">{time(at('cancelled'))}</span></li></ol>;
  }
  const flow = statusFlow(fulfillment);
  const idx = flow.indexOf(status);
  return (
    <ol className="timeline">
      {flow.map((s, i) => (
        <li key={s} className={`${i <= idx ? 'done' : ''}${i === idx ? ' current' : ''}`}>
          <span className="tl-dot" /><span className="tl-label">{labels[s as OrderStatus]}</span><span className="tl-time">{time(at(s))}</span>
        </li>
      ))}
    </ol>
  );
}
