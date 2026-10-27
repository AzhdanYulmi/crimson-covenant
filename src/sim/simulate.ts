import { createRng } from '../engine/rng';
import { playRound } from '../engine/spin';
import type { RoundMode } from '../engine/types';

export interface SimStats {
  mode: RoundMode;
  rounds: number;
  /** Return to player as a fraction of total cost. */
  rtp: number;
  /** Share of RTP from the base spin (incl. orbs). */
  baseRtp: number;
  bonusRtp: number;
  hitRate: number;
  ritualRate: number;
  riteRate: number;
  orbWins: number;
  maxX: number;
  maxWinHits: number;
  /** Std deviation of round return, in multiples of cost. */
  stdDev: number;
}

export function simulate(mode: RoundMode, rounds: number, seed?: number, onProgress?: (done: number) => void): SimStats {
  const rng = createRng(seed);
  let cost = 0, won = 0, baseWon = 0, bonusWon = 0, hits = 0, ritual = 0, rite = 0, orbWins = 0;
  let maxX = 0, maxWinHits = 0, sumSq = 0;
  for (let i = 0; i < rounds; i++) {
    const r = playRound(rng, 1, mode);
    cost += r.cost;
    won += r.totalX;
    baseWon += r.base.win;
    if (r.base.win > 0) hits++;
    if (r.base.orbMultiplier > 1) orbWins++;
    if (r.bonus) {
      bonusWon += r.bonus.total;
      if (r.bonus.type === 'ritual') ritual++; else rite++;
    }
    if (r.totalX > maxX) maxX = r.totalX;
    if (r.maxWinHit) maxWinHits++;
    const ret = r.totalX / r.cost;
    sumSq += ret * ret;
    if (onProgress && i % 50_000 === 0) onProgress(i);
  }
  const mean = won / cost;
  return {
    mode, rounds,
    rtp: mean,
    baseRtp: baseWon / cost,
    bonusRtp: bonusWon / cost,
    hitRate: hits / rounds,
    ritualRate: ritual / rounds,
    riteRate: rite / rounds,
    orbWins,
    maxX,
    maxWinHits,
    stdDev: Math.sqrt(Math.max(0, sumSq / rounds - mean * mean)),
  };
}

export function formatStats(s: SimStats): string {
  const pct = (v: number) => (v * 100).toFixed(2) + '%';
  const oneIn = (v: number) => (v > 0 ? '1 in ' + Math.round(1 / v).toLocaleString() : 'never');
  return [
    `mode          ${s.mode}  (${s.rounds.toLocaleString()} rounds)`,
    `RTP           ${pct(s.rtp)}   base ${pct(s.baseRtp)} / bonus ${pct(s.bonusRtp)}`,
    `hit rate      ${pct(s.hitRate)}`,
    `Ritual        ${oneIn(s.ritualRate)}`,
    `Dark Rite     ${oneIn(s.riteRate)}`,
    `orb wins      ${s.orbWins.toLocaleString()}`,
    `max win       ${s.maxX.toFixed(1)}x   (cap hits: ${s.maxWinHits})`,
    `volatility    σ ≈ ${s.stdDev.toFixed(2)}`,
  ].join('\n');
}
