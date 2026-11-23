import { describe, it, expect } from 'vitest';
import { groupOrderText, groupOrderKeyboard, customerStatusText, welcomeText, orderAcceptedText } from '../../supabase/functions/_shared/messages.ts';
import { sampleOrder, deliveryOrder } from './fixtures';

describe('messages', () => {
  it('group text carries number, tag, totals and escapes user input', () => {
    const t = groupOrderText(sampleOrder);
    expect(t).toContain('AV-1001'); expect(t).toContain('ig_dm_boks'); expect(t).toContain('416 000 сум');
    expect(t).toContain('Ali &lt;b&gt;'); expect(t).toContain('Самовывоз'); expect(t).not.toContain('270');
  });
  it('group text for delivery has a Yandex Maps link and slot', () => {
    const t = groupOrderText(deliveryOrder);
    expect(t).toContain('https://yandex.uz/maps/?pt=69.2797,41.3111&z=17'); expect(t).toContain('18:00–22:00');
  });
  it('flags out-of-city delivery', () => { expect(groupOrderText({ ...deliveryOrder, out_of_city: true })).toContain('ВНЕ ТАШКЕНТА'); });
  it('keyboard offers forward statuses and cancel, nothing when final', () => {
    const data = groupOrderKeyboard({ ...sampleOrder, status: 'new' }).inline_keyboard.flat().map((b: any) => b.callback_data);
    expect(data).toContain(`st:${sampleOrder.id}:confirmed`); expect(data).toContain(`st:${sampleOrder.id}:ready`);
    expect(data).toContain(`st:${sampleOrder.id}:cancelled`); expect(data).not.toContain(`st:${sampleOrder.id}:new`);
    expect(data.every((d: string) => d.length <= 64)).toBe(true);
    expect(groupOrderKeyboard({ ...sampleOrder, status: 'done' }).inline_keyboard).toEqual([]);
  });
  it('customer status text is localized', () => {
    expect(customerStatusText({ ...deliveryOrder, status: 'on_the_way' }, 'ru')).toContain('В пути');
    expect(customerStatusText({ ...deliveryOrder, status: 'on_the_way' }, 'uz')).toContain('Yoʻlda');
  });
  it('welcome is bilingual and order accepted mentions the promise', () => {
    const w = welcomeText(); expect(w).toContain('Avera Mobile'); expect(w).toContain('новогодние боксы'); expect(w).toContain('yangi yil');
    expect(orderAcceptedText(sampleOrder, 'ru', 'Менеджер свяжется')).toContain('Менеджер свяжется');
    expect(orderAcceptedText(sampleOrder, 'ru', 'x')).not.toMatch(/!/);
  });
});
