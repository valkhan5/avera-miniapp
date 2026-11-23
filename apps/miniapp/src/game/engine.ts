// Pure game logic for «Эльфы Avera» — no DOM, deterministic with an injected rng.
export type Target = 'dlya-neyo' | 'detyam' | 'vzroslym';
export interface GameBox { name: string; category: Target; golden?: boolean }
export interface CurrentBox { name: string; category: Target; golden: boolean; ttlMs: number; maxTtlMs: number; id: number }
export interface GameEvent { type: 'hit' | 'miss' | 'expire'; points: number; target: Target; box: CurrentBox }
export interface GameState {
  timeLeftMs: number; elapsedMs: number; score: number; streak: number; multiplier: number; delivered: number;
  current: CurrentBox | null; finished: boolean;
}
export interface Game { state: GameState; step(dtMs: number): GameEvent[]; dispatch(target: Target): GameEvent | null }

export const ROUND_MS = 60000;
const TTL_START = 3000, TTL_STEP = 40, TTL_MIN = 1200, GOLDEN_CHANCE = 0.08, BASE_POINTS = 10;

export function createGame(boxes: GameBox[], rng: () => number = Math.random): Game {
  const regular = boxes.filter((b) => !b.golden || boxes.length === 1);
  const goldenPool = boxes.filter((b) => b.golden);
  let nextId = 1;
  const state: GameState = { timeLeftMs: ROUND_MS, elapsedMs: 0, score: 0, streak: 0, multiplier: 1, delivered: 0, current: null, finished: false };

  const ttl = () => Math.max(TTL_MIN, TTL_START - TTL_STEP * state.delivered);
  const spawn = () => {
    const goldenRoll = rng();
    let box: GameBox; let golden = false;
    if (goldenPool.length && goldenRoll < GOLDEN_CHANCE) { box = goldenPool[Math.floor(rng() * goldenPool.length) % goldenPool.length]; golden = true; }
    else { const pool = regular.length ? regular : boxes; box = pool[Math.floor(goldenRoll * pool.length) % pool.length]; }
    const t = ttl();
    state.current = { name: box.name, category: box.category, golden, ttlMs: t, maxTtlMs: t, id: nextId++ };
  };
  const updateMultiplier = () => { state.multiplier = Math.min(1 + Math.floor(state.streak / 5), 3); };

  spawn();

  return {
    state,
    step(dtMs) {
      const events: GameEvent[] = [];
      if (state.finished) return events;
      const dt = Math.min(dtMs, state.timeLeftMs);
      state.timeLeftMs -= dt; state.elapsedMs += dt;
      if (state.current) {
        state.current.ttlMs -= dt;
        if (state.current.ttlMs <= 0) {
          events.push({ type: 'expire', points: 0, target: state.current.category, box: state.current });
          state.streak = 0; updateMultiplier(); spawn();
        }
      }
      if (state.timeLeftMs <= 0) { state.finished = true; state.current = null; }
      return events;
    },
    dispatch(target) {
      if (state.finished || !state.current) return null;
      const box = state.current;
      let ev: GameEvent;
      if (target === box.category) {
        const points = BASE_POINTS * state.multiplier * (box.golden ? 2 : 1);
        state.score += points; state.streak += 1; state.delivered += 1;
        ev = { type: 'hit', points, target, box };
      } else {
        state.streak = 0;
        ev = { type: 'miss', points: 0, target, box };
      }
      updateMultiplier(); spawn();
      return ev;
    },
  };
}
