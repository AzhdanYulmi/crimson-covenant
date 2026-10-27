import { describe, expect, it } from 'vitest';
import { playBonus, playRound, triggerFor } from '../src/engine/spin';
import { createRng } from '../src/engine/rng';
import { BONUS, MAX_WIN_X, PAYTABLE, Sym } from '../src/math/config';
import type { Grid } from '../src/engine/types';

function blank(): Grid {
  return Array.from({ length: 5 }, () => Array<number>(5).fill(Sym.H1 + 100)); // non-symbol filler
}
/** One way of 5x Masked Cultist. */
function winning(): Grid {
  const g = blank();
  for (let r = 0; r < 5; r++) g[r][0] = Sym.H4;
  return g;
}
function scattered(n: number): Grid {
  const g = blank();
  for (let r = 0; r < n; r++) g[r][4] = Sym.SCATTER;
  return g;
}
function script(grids: Grid[]) {
  let i = 0;
  return () => grids[Math.min(i++, grids.length - 1)] ?? blank();
}

describe('triggerFor', () => {
  it('maps scatter counts to bonuses', () => {
    expect(triggerFor(2)).toBeNull();
    expect(triggerFor(3)).toBe('ritual');
    expect(triggerFor(4)).toBe('rite');
    expect(triggerFor(5)).toBe('rite');
  });
});

describe('playBonus', () => {
  const top = PAYTABLE[Sym.H4][2];

  it('applies the meter then grows it only on wins (Ritual)', () => {
    const grids = [winning(), blank(), winning(), ...Array(7).fill(blank())];
    const b = playBonus('ritual', script(grids), MAX_WIN_X);
    expect(b.spins).toHaveLength(BONUS.ritual.spins);
    expect(b.spins.map((s) => s.multiplier).slice(0, 4)).toEqual([1, 2, 2, 3]);
    expect(b.total).toBeCloseTo(top * 1 + top * 2);
  });

  it('Dark Rite starts at 3x and steps by 2', () => {
    const grids = [winning(), winning(), ...Array(10).fill(blank())];
    const b = playBonus('rite', script(grids), MAX_WIN_X);
    expect(b.spins).toHaveLength(BONUS.rite.spins);
    expect(b.spins[0].multiplier).toBe(3);
    expect(b.spins[1].multiplier).toBe(5);
    expect(b.spins.at(-1)!.multiplierAfter).toBe(7);
  });

  it('retriggers on 2+ scatters', () => {
    const grids = [scattered(2), ...Array(20).fill(blank())];
    const b = playBonus('ritual', script(grids), MAX_WIN_X);
    expect(b.spins[0].extraSpins).toBe(BONUS.retriggerSpins);
    expect(b.spins).toHaveLength(BONUS.ritual.spins + BONUS.retriggerSpins);
  });

  it('stops at the win cap', () => {
    const b = playBonus('ritual', () => winning(), 12);
    expect(b.capped).toBe(true);
    expect(b.total).toBeCloseTo(12);
    expect(b.spins.at(-1)!.spinsLeft).toBe(0);
  });
});

describe('playRound', () => {
  it('is deterministic for a seed', () => {
    const a = playRound(createRng(42), 1);
    const b = playRound(createRng(42), 1);
    expect(a).toEqual(b);
  });

  it('bonus buys charge the buy cost and always trigger their bonus', () => {
    const rng = createRng(7);
    for (let i = 0; i < 50; i++) {
      const r = playRound(rng, 2, 'buy-ritual');
      expect(r.cost).toBe(200);
      expect(r.bonus?.type).toBe('ritual');
      const d = playRound(rng, 2, 'buy-rite');
      expect(d.cost).toBe(600);
      expect(d.bonus?.type).toBe('rite');
    }
  });

  it('never exceeds the max win', () => {
    const rng = createRng(1);
    for (let i = 0; i < 2000; i++) {
      const r = playRound(rng, 1, 'buy-rite');
      expect(r.totalX).toBeLessThanOrEqual(MAX_WIN_X + 1e-9);
      expect(r.totalWin).toBeCloseTo(r.totalX * r.bet);
    }
  });
});
