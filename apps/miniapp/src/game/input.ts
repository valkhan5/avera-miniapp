import type { Target } from './engine';

/** Swipe left/up/right or tap a third of the screen; arrow keys on desktop. */
export function attachInput(el: HTMLElement, onTarget: (t: Target) => void): () => void {
  let sx = 0, sy = 0, active = false;
  const down = (e: PointerEvent) => { active = true; sx = e.clientX; sy = e.clientY; };
  const up = (e: PointerEvent) => {
    if (!active) return; active = false;
    const dx = e.clientX - sx, dy = e.clientY - sy, r = el.getBoundingClientRect();
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) onTarget(dx < 0 ? 'dlya-neyo' : 'vzroslym');
    else if (dy < -30) onTarget('detyam');
    else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      const third = (e.clientX - r.left) / r.width;
      onTarget(third < 1 / 3 ? 'dlya-neyo' : third < 2 / 3 ? 'detyam' : 'vzroslym');
    }
  };
  const key = (e: KeyboardEvent) => {
    const m: Record<string, Target> = { ArrowLeft: 'dlya-neyo', ArrowUp: 'detyam', ArrowRight: 'vzroslym' };
    if (m[e.key]) { e.preventDefault(); onTarget(m[e.key]); }
  };
  el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); window.addEventListener('keydown', key);
  return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointerup', up); window.removeEventListener('keydown', key); };
}
