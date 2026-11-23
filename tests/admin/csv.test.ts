import { describe, it, expect } from 'vitest';
import { toCsv } from '../../apps/admin/src/lib/csv';
describe('toCsv', () => {
  it('uses ; separator, BOM and escapes quotes and separators', () => {
    expect(toCsv([{ a: 'x;y', b: '"q"' }], [{ key: 'a', title: 'A' }, { key: 'b', title: 'B' }])).toBe('﻿A;B\r\n"x;y";"""q"""\r\n');
  });
  it('renders null as empty and numbers plainly', () => {
    expect(toCsv([{ a: null, b: 5 }], [{ key: 'a', title: 'A' }, { key: 'b', title: 'B' }])).toBe('﻿A;B\r\n;5\r\n');
  });
});
