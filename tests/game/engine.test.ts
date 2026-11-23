import { describe, it, expect } from 'vitest';
import { createGame, type GameBox } from '../../apps/miniapp/src/game/engine';

const BOXES: GameBox[] = [
  { name: 'Элеганс', category: 'dlya-neyo' },
  { name: 'На связи', category: 'detyam' },
  { name: 'Флагман', category: 'vzroslym', golden: true },
];
const fixed = (v: number) => () => v; // rng
const normal = fixed(0.5); // never golden (0.5 > 0.08), picks BOXES[1]

describe('game engine', () => {
  it('scores 10 per correct box, multiplier 2 from the 6th in a row', () => {
    const g = createGame(BOXES, normal);
    for (let i = 0; i < 5; i++) g.dispatch(g.state.current!.category);
    expect(g.state.score).toBe(50);
    expect(g.state.multiplier).toBe(2);
    g.dispatch(g.state.current!.category);
    expect(g.state.score).toBe(70);
  });

  it('wrong dispatch resets the streak', () => {
    const g = createGame(BOXES, normal);
    for (let i = 0; i < 6; i++) g.dispatch(g.state.current!.category);
    g.dispatch('vzroslym'); // current is detyam
    expect(g.state.streak).toBe(0);
    expect(g.state.multiplier).toBe(1);
  });

  it('expired box resets the streak and spawns the next', () => {
    const g = createGame(BOXES, normal);
    g.dispatch(g.state.current!.category);
    const before = g.state.current;
    g.step(3000);
    expect(g.state.streak).toBe(0);
    expect(g.state.current).not.toBe(before);
    expect(g.state.current!.ttlMs).toBeGreaterThan(0);
  });

  it('golden box at multiplier 3 gives 60', () => {
    let golden = false;
    const g = createGame(BOXES, () => (golden ? 0 : 0.5));
    for (let i = 0; i < 10; i++) g.dispatch(g.state.current!.category);
    expect(g.state.multiplier).toBe(3);
    golden = true;
    g.dispatch(g.state.current!.category); // spawns the next box as golden
    expect(g.state.current).toMatchObject({ golden: true, category: 'vzroslym' });
    const s = g.state.score;
    g.dispatch('vzroslym');
    expect(g.state.score - s).toBe(60);
  });

  it('finishes after 60 seconds and ignores input afterwards', () => {
    const g = createGame(BOXES, normal);
    for (let t = 0; t < 60000; t += 500) g.step(500);
    expect(g.state.finished).toBe(true);
    expect(g.state.timeLeftMs).toBe(0);
    const s = g.state.score;
    g.dispatch('detyam');
    expect(g.state.score).toBe(s);
    expect(g.state.elapsedMs).toBe(60000);
  });

  it('box time-to-live shrinks with deliveries but never below 1200 ms', () => {
    const g = createGame(BOXES, normal);
    expect(g.state.current!.ttlMs).toBe(3000);
    for (let i = 0; i < 100; i++) g.dispatch(g.state.current!.category);
    expect(g.state.current!.ttlMs).toBe(1200);
  });
});
