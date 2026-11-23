import { describe, it, expect } from 'vitest';
import { statusFlow, canTransition, STATUS_LABELS } from '../../supabase/functions/_shared/core/statuses.ts';
describe('statuses', () => {
  it('pickup flow ends with ready and done', () => { expect(statusFlow('pickup')).toEqual(['new', 'confirmed', 'packing', 'ready', 'done']); });
  it('delivery flow uses on_the_way', () => { expect(statusFlow('delivery')).toEqual(['new', 'confirmed', 'packing', 'on_the_way', 'done']); });
  it('allows cancel, forbids leaving final states and foreign statuses', () => {
    expect(canTransition('new', 'cancelled', 'delivery')).toBe(true);
    expect(canTransition('cancelled', 'new', 'delivery')).toBe(false);
    expect(canTransition('done', 'packing', 'delivery')).toBe(false);
    expect(canTransition('packing', 'ready', 'delivery')).toBe(false);
    expect(canTransition('new', 'new', 'delivery')).toBe(false);
  });
  it('has ru labels per fulfillment', () => {
    expect(STATUS_LABELS.ru.pickup.done).toBe('Выдан');
    expect(STATUS_LABELS.ru.delivery.on_the_way).toBe('В пути');
    expect(STATUS_LABELS.ru.delivery.done).toBe('Доставлена');
  });
});
