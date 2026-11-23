import { describe, it, expect } from 'vitest';
import { normalizeTag, buildTag, miniAppLink } from '../../supabase/functions/_shared/core/tags.ts';
describe('tags', () => {
  it('normalizes valid tags to lowercase', () => { expect(normalizeTag('IG_DM_BOKS')).toBe('ig_dm_boks'); });
  it('rejects spaces, dashes, too long and empty', () => {
    expect(normalizeTag('ig dm')).toBeNull(); expect(normalizeTag('ig-dm')).toBeNull();
    expect(normalizeTag('a'.repeat(65))).toBeNull(); expect(normalizeTag('')).toBeNull(); expect(normalizeTag(null)).toBeNull();
  });
  it('builds tags with transliteration', () => {
    expect(buildTag(['ig', 'dm', 'Бокс'])).toBe('ig_dm_boks');
    expect(buildTag(['IG', 'Story', '12.07'])).toBe('ig_story_1207');
  });
  it('builds the mini app link', () => {
    expect(miniAppLink('AveraMobileBot', 'ig_bio')).toBe('https://t.me/AveraMobileBot?startapp=ig_bio');
    expect(miniAppLink('AveraMobileBot')).toBe('https://t.me/AveraMobileBot?startapp');
  });
});
