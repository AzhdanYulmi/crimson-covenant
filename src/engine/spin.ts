import {
  BASE_WEIGHTS, BLOOD_MOON, BONUS, MAX_WIN_X, REELS, RITE_WEIGHTS, RITUAL_WEIGHTS, ROWS, Sym,
  type BonusType, type ModeWeights,
} from '../math/config';
import { evaluateWays, totalPay } from './evaluate';
import { pickWeighted, type Rng } from './rng';
import type { BaseSpin, Bonus, FreeSpin, Grid, Orb, Pos, RoundMode, RoundResult } from './types';

/**
 * Spin each reel strip to a random stop, then drop at most one scatter per reel.
 * `forcedScatterReels` replaces the random scatter roll (used by bonus buys).
 */
export function generateGrid(rng: Rng, weights: ModeWeights, forcedScatterReels?: number[]): Grid {
  const grid: Grid = [];
  for (let r = 0; r < REELS; r++) {
    const strip = weights.strips[r];
    const stop = rng.int(strip.length);
    const col: number[] = [];
    for (let row = 0; row < ROWS; row++) col.push(strip[(stop + row) % strip.length]);
    const hasScatter = forcedScatterReels
      ? forcedScatterReels.includes(r)
      : rng.next() < weights.scatterPerReel;
    if (hasScatter) col[rng.int(ROWS)] = Sym.SCATTER;
    grid.push(col);
  }
  return grid;
}

export function findScatters(grid: Grid): Pos[] {
  const out: Pos[] = [];
  grid.forEach((col, r) => col.forEach((v, row) => v === Sym.SCATTER && out.push([r, row])));
  return out;
}

export function triggerFor(scatterCount: number): BonusType | null {
  if (scatterCount >= 4) return 'rite';
  if (scatterCount === 3) return 'ritual';
  return null;
}

function rollOrbs(rng: Rng): Orb[] {
  if (rng.next() >= BLOOD_MOON.chance) return [];
  const count = pickWeighted(rng, BLOOD_MOON.countWeights) + 1;
  const orbs: Orb[] = [];
  const used = new Set<number>();
  while (orbs.length < count) {
    const cell = rng.int(REELS * ROWS);
    if (used.has(cell)) continue;
    used.add(cell);
    const value = BLOOD_MOON.values[pickWeighted(rng, BLOOD_MOON.valueWeights)];
    orbs.push({ value, pos: [Math.floor(cell / ROWS), cell % ROWS] });
  }
  return orbs;
}

function pickReels(rng: Rng, n: number): number[] {
  const reels = [0, 1, 2, 3, 4];
  for (let i = reels.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [reels[i], reels[j]] = [reels[j], reels[i]];
  }
  return reels.slice(0, n);
}

export function playBaseSpin(rng: Rng, forced?: BonusType): BaseSpin {
  const forcedReels = forced ? pickReels(rng, forced === 'rite' ? 4 : 3) : undefined;
  const grid = generateGrid(rng, BASE_WEIGHTS, forcedReels);
  const wins = evaluateWays(grid);
  const rawWin = totalPay(wins);
  const orbs = forced ? [] : rollOrbs(rng);
  const orbMultiplier = rawWin > 0 && orbs.length ? orbs.reduce((s, o) => s + o.value, 0) : 1;
  const scatters = findScatters(grid);
  return {
    grid, wins, rawWin, orbs, orbMultiplier,
    win: Math.min(rawWin * orbMultiplier, MAX_WIN_X),
    scatters,
    trigger: triggerFor(scatters.length),
  };
}

/**
 * Play a whole free-spins bonus. `nextGrid` supplies each spin's grid so tests can script it.
 * `cap` is the remaining win allowed (x bet) in this round.
 */
export function playBonus(type: BonusType, nextGrid: () => Grid, cap: number): Bonus & { capped: boolean } {
  const cfg = BONUS[type];
  let spinsLeft: number = cfg.spins;
  let mult: number = cfg.startMult;
  let bonusTotal = 0;
  let capped = false;
  const spins: FreeSpin[] = [];
  while (spinsLeft > 0) {
    spinsLeft--;
    const grid = nextGrid();
    const wins = evaluateWays(grid);
    const rawWin = totalPay(wins);
    const multiplier = mult;
    let win = rawWin * multiplier;
    if (rawWin > 0) mult += cfg.step;
    if (bonusTotal + win >= cap) {
      win = cap - bonusTotal;
      capped = true;
    }
    bonusTotal += win;
    const scatters = findScatters(grid);
    const extraSpins = !capped && scatters.length >= BONUS.retriggerScatters ? BONUS.retriggerSpins : 0;
    spinsLeft += extraSpins;
    spins.push({
      grid, wins, rawWin, multiplier, multiplierAfter: mult, win, scatters, extraSpins,
      spinsLeft: capped ? 0 : spinsLeft, bonusTotal,
    });
    if (capped) break;
  }
  return { type, spins, total: bonusTotal, capped };
}

export function playRound(rng: Rng, bet: number, mode: RoundMode = 'spin'): RoundResult {
  const forced: BonusType | undefined =
    mode === 'buy-ritual' ? 'ritual' : mode === 'buy-rite' ? 'rite' : undefined;
  const cost = forced ? bet * BONUS[forced].buyCost : bet;
  const base = playBaseSpin(rng, forced);
  let totalX = base.win;
  let maxWinHit = totalX >= MAX_WIN_X;
  let bonus: Bonus | null = null;
  if (base.trigger && !maxWinHit) {
    const weights = base.trigger === 'rite' ? RITE_WEIGHTS : RITUAL_WEIGHTS;
    const played = playBonus(base.trigger, () => generateGrid(rng, weights), MAX_WIN_X - totalX);
    bonus = { type: played.type, spins: played.spins, total: played.total };
    totalX += played.total;
    maxWinHit = played.capped;
  }
  return { mode, bet, cost, base, bonus, totalX, totalWin: totalX * bet, maxWinHit };
}
