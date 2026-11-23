import { describe, it, expect } from 'vitest';
import { fitSize } from '../../apps/admin/src/lib/image';
describe('fitSize', () => {
  it('scales large images down to 1200 on the long side', () => { expect(fitSize(4000, 3000)).toEqual({ w: 1200, h: 900 }); });
  it('keeps small images', () => { expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 }); });
  it('handles portrait', () => { expect(fitSize(1500, 3000)).toEqual({ w: 600, h: 1200 }); });
});
