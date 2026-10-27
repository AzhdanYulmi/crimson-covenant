import { describe, expect, it } from 'vitest';
import { evaluateWays } from '../src/engine/evaluate';
import { Sym, PAYTABLE } from '../src/math/config';
import type { Grid } from '../src/engine/types';

/** Grid of non-paying filler (scatters never pay as ways). */
function blank(): Grid {
  return Array.from({ length: 5 }, () => Array<number>(5).fill(Sym.SCATTER));
}

describe('evaluateWays', () => {
  it('pays 3 of a kind on one way', () => {
    const g = blank();
    g[0][0] = g[1][2] = g[2][4] = Sym.L1;
    const wins = evaluateWays(g);
    expect(wins).toHaveLength(1);
    expect(wins[0]).toMatchObject({ symbol: Sym.L1, length: 3, ways: 1 });
    expect(wins[0].pay).toBeCloseTo(PAYTABLE[Sym.L1][0]);
    expect(wins[0].positions).toHaveLength(3);
  });

  it('multiplies ways by symbol counts per reel', () => {
    const g = blank();
    g[0][0] = g[0][1] = Sym.H4;
    g[1][0] = g[1][3] = Sym.H4;
    g[2][2] = Sym.H4;
    g[3][1] = Sym.H4;
    const [win] = evaluateWays(g);
    expect(win).toMatchObject({ symbol: Sym.H4, length: 4, ways: 4 });
    expect(win.pay).toBeCloseTo(PAYTABLE[Sym.H4][1] * 4);
  });

  it('lets wilds substitute on reels 2-5', () => {
    const g = blank();
    g[0][0] = Sym.H2;
    g[1][0] = Sym.WILD;
    g[2][0] = Sym.H2;
    g[3][0] = Sym.WILD;
    g[4][0] = Sym.H2;
    const wins = evaluateWays(g);
    expect(wins).toHaveLength(1);
    expect(wins[0]).toMatchObject({ symbol: Sym.H2, length: 5, ways: 1 });
  });

  it('a wild counts toward every symbol that starts on reel 1', () => {
    const g = blank();
    g[0][0] = Sym.L1;
    g[0][1] = Sym.L2;
    g[1][0] = g[2][0] = Sym.WILD;
    const wins = evaluateWays(g);
    expect(wins.map((w) => w.symbol).sort()).toEqual([Sym.L1, Sym.L2]);
  });

  it('ignores runs shorter than 3 and runs not starting on reel 1', () => {
    const g = blank();
    g[0][0] = g[1][0] = Sym.H1;
    g[1][1] = g[2][1] = g[3][1] = g[4][1] = Sym.H3;
    expect(evaluateWays(g)).toEqual([]);
  });

  it('scatters never substitute', () => {
    const g = blank();
    g[0][0] = g[2][0] = Sym.L3;
    expect(evaluateWays(g)).toEqual([]);
  });
});
