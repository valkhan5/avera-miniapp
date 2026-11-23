import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import logoUrl from '@brand/logos/avera-logo-horizontal-reverse.svg';
import { miniAppLink } from '@core';
import { loc, useStore } from '../store';
import { back, go } from '../router';
import { haptic, isMock, openTelegramLink, useBackButton } from '../telegram';
import { call } from '../api';
import { BOT_USERNAME } from '../config';
import { createGame, ROUND_MS, type Game as Engine, type GameBox, type Target } from '../game/engine';
import { makeScene, render, TARGETS, type Scene } from '../game/render';
import { attachInput } from '../game/input';
import { TopBar } from '../components/TopBar';

type Result = { score: number; best_score: number; threshold: number; promo: { code: string; pct: number } | null };
const HINT_KEY = 'avera_game_hint_seen';

export default function GameScreen() {
  const { t, lang, products, categories, settings, setPromo } = useStore();
  const [phase, setPhase] = useState<'intro' | 'playing' | 'result'>('intro');
  const [result, setResult] = useState<Result | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hud = { score: useRef<HTMLSpanElement>(null), mult: useRef<HTMLSpanElement>(null), time: useRef<HTMLSpanElement>(null) };
  const engineRef = useRef<Engine | null>(null);
  const finishedRef = useRef(false);
  const onBack = useCallback(() => back(''), []);
  useBackButton(onBack);

  const boxes: GameBox[] = useMemo(() => {
    const slugById = new Map(categories.map((c) => [c.id, c.slug]));
    return products.flatMap((p) => {
      const cat = slugById.get(p.category_id) as Target | undefined;
      return cat && (TARGETS as string[]).includes(cat) ? [{ name: loc(lang, p, 'name'), category: cat, golden: p.slug === 'flagman' }] : [];
    });
  }, [products, categories, lang]);
  const labels = useMemo(() => ({ 'dlya-neyo': t('house_dlya_neyo'), detyam: t('house_detyam'), vzroslym: t('house_vzroslym') }) as Record<Target, string>, [t]);

  const finish = useCallback(async (score: number, elapsed: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    try {
      const r = await call<any>('game_finish', { score, duration_ms: elapsed });
      if (r.promo && !r.promo.used) setPromo(r.promo);
      setResult({ score, best_score: r.best_score, threshold: r.threshold, promo: r.promo && !r.promo.used ? r.promo : null });
    } catch {
      setResult({ score, best_score: score, threshold: settings?.threshold ?? 300, promo: null });
    }
    haptic('success');
    setPhase('result');
  }, [setPromo, settings]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    const logo = new Image(); logo.src = logoUrl;
    const scene: Scene = makeScene(canvas.clientWidth, canvas.clientHeight, labels, logo);
    const game = createGame(boxes);
    engineRef.current = game; finishedRef.current = false;
    let showHint = true; try { showHint = !localStorage.getItem(HINT_KEY); localStorage.setItem(HINT_KEY, '1'); } catch { /* ignore */ }
    const hintUntil = performance.now() + 4000;

    const onTarget = (target: Target) => {
      const ev = game.dispatch(target);
      if (!ev) return;
      const now = performance.now();
      if (ev.type === 'hit') {
        scene.fx.push({ kind: 'fly', target, t0: now, dur: 380, golden: ev.box.golden, cat: ev.box.category });
        scene.fx.push({ kind: 'float', target, t0: now + 300, dur: 700, text: `+${ev.points}` });
        haptic('light');
      } else {
        scene.fx.push({ kind: 'shake', target, t0: now, dur: 350 });
        scene.fx.push({ kind: 'float', target: ev.box.category, t0: now, dur: 700, text: '×', color: '#F3C9A8' });
        haptic('error');
      }
    };
    const detach = attachInput(canvas, onTarget);

    let raf = 0, last = performance.now(), hidden = false;
    const onVis = () => { hidden = document.hidden; last = performance.now(); };
    document.addEventListener('visibilitychange', onVis);
    const tick = (now: number) => {
      const dt = Math.min(50, now - last); last = now;
      if (!hidden) {
        for (const ev of game.step(dt)) if (ev.type === 'expire') { scene.fx.push({ kind: 'shake', target: ev.box.category, t0: now, dur: 300 }); haptic('error'); }
        render(ctx, scene, game.state, now, dt, showHint && now < hintUntil);
        const s = game.state;
        if (hud.score.current) hud.score.current.textContent = String(s.score);
        if (hud.mult.current) hud.mult.current.textContent = `×${s.multiplier}`;
        if (hud.time.current) hud.time.current.textContent = `0:${String(Math.ceil(s.timeLeftMs / 1000)).padStart(2, '0')}`;
      }
      if (game.state.finished) { void finish(game.state.score, game.state.elapsedMs); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('resize', resize);
    if (isMock) window.__game = { autoplay: (ms = ROUND_MS) => { for (let el = 0; el < ms && !game.state.finished; el += 700) { if (game.state.current) game.dispatch(game.state.current.category); game.step(700); } } };
    return () => { cancelAnimationFrame(raf); detach(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('resize', resize); };
  }, [phase]);

  const start = () => { setResult(null); setPhase('playing'); void call('track', { type: 'game_start', payload: {} }).catch(() => {}); };
  const share = () => openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(miniAppLink(BOT_USERNAME, 'game_share'))}&text=${encodeURIComponent(t('share_text'))}`);
  const threshold = settings?.threshold ?? 300;
  const pct = settings?.pricing.promoDiscountPct ?? 5;

  return (
    <div className="game-page">
      <TopBar onBack={onBack} title={t('game_title')} />
      {phase === 'playing' && (
        <>
          <div className="game-hud">
            <div><small>{t('game_score')}</small><span ref={hud.score}>0</span></div>
            <div className="mult"><span ref={hud.mult}>×1</span></div>
            <div><small>{t('game_time')}</small><span ref={hud.time}>1:00</span></div>
          </div>
          <canvas ref={canvasRef} className="game-canvas" aria-label={t('game_rules')} />
        </>
      )}
      {phase === 'intro' && (
        <div className="game-card">
          <div className="eyebrow">AVERA MOBILE · {t('game_title')}</div>
          <h1>{t('game_title')}</h1>
          <p>{t('game_rules')}</p>
          <p className="goal">{t('game_goal', { n: threshold, pct })}</p>
          <div className="houses-legend">
            {TARGETS.map((k, i) => <span key={k}><b>{['←', '↑', '→'][i]}</b>{labels[k]}</span>)}
          </div>
          <button className="btn-primary" data-test="game-start" onClick={start}>{t('game_start')}</button>
        </div>
      )}
      {phase === 'result' && result && (
        <div className="game-card">
          <div className="eyebrow">{t('game_score')}</div>
          <h1 className="big-score">{result.score}</h1>
          <p>{t('game_best')}: {result.best_score}</p>
          {result.promo ? (
            <div className="promo-card" data-test="game-promo">
              <div className="eyebrow">{t('game_promo_title')}</div>
              <div className="promo-code">{result.promo.code}</div>
              <p>{t('game_promo_text', { pct: result.promo.pct })}</p>
            </div>
          ) : result.score < result.threshold ? (
            <p className="goal">{t('game_promo_almost', { n: result.threshold - result.score })}</p>
          ) : null}
          <button className="btn-primary" onClick={() => go('')}>{t('game_to_catalog')}</button>
          <div className="row2">
            <button className="btn-secondary" onClick={start}>{t('game_again')}</button>
            <button className="btn-secondary" onClick={share}>{t('share')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
