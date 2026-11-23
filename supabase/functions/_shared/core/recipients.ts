import type { Lang } from './statuses.ts';

export const RECIPIENTS = ['mom', 'wife', 'girlfriend', 'child', 'colleague', 'friend', 'self'] as const;
export type Recipient = (typeof RECIPIENTS)[number];

export const RECIPIENT_LABELS: Record<Lang, Record<Recipient, string>> = {
  ru: { mom: 'Маме', wife: 'Жене', girlfriend: 'Девушке', child: 'Ребёнку', colleague: 'Коллеге', friend: 'Другу', self: 'Себе' },
  uz: { mom: 'Onamga', wife: 'Turmush oʻrtogʻimga', girlfriend: 'Qiz doʻstimga', child: 'Farzandimga', colleague: 'Hamkasbimga', friend: 'Doʻstimga', self: 'Oʻzimga' },
};
