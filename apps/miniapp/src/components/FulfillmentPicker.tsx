import type { Fulfillment } from '@core';
import { useStore } from '../store';

export function FulfillmentPicker({ value, onChange }: { value: Fulfillment; onChange: (f: Fulfillment) => void }) {
  const { t, settings } = useStore();
  const pct = settings?.pricing.pickupDiscountPct ?? 10;
  const opt = (f: Fulfillment, title: string, note: string) => (
    <button type="button" data-test={`fulfillment-${f}`} className={`opt${value === f ? ' on' : ''}`} aria-pressed={value === f} onClick={() => onChange(f)}>
      <span className="opt-radio" aria-hidden="true" />
      <span className="opt-title">{title}</span>
      <span className="opt-note">{note}</span>
    </button>
  );
  return (
    <div className="opts">
      {opt('delivery', t('delivery_title'), t('delivery_note'))}
      {opt('pickup', t('pickup_title'), t('pickup_note', { pct }))}
    </div>
  );
}
