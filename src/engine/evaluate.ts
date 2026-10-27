import { PAYING_SYMBOLS, PAYTABLE, REELS, Sym } from '../math/config';
import type { Grid, Pos, WayWin } from './types';

/** Left-to-right ways evaluation. Wilds substitute for paying symbols on reels 2-5. */
export function evaluateWays(grid: Grid): WayWin[] {
  const wins: WayWin[] = [];
  for (let s = 0; s < PAYING_SYMBOLS; s++) {
    let ways = 1;
    let length = 0;
    for (let r = 0; r < REELS; r++) {
      let count = 0;
      const col = grid[r];
      for (let i = 0; i < col.length; i++) {
        if (col[i] === s || (r > 0 && col[i] === Sym.WILD)) count++;
      }
      if (count === 0) break;
      ways *= count;
      length++;
    }
    if (length < 3) continue;
    const positions: Pos[] = [];
    for (let r = 0; r < length; r++) {
      grid[r].forEach((v, row) => {
        if (v === s || (r > 0 && v === Sym.WILD)) positions.push([r, row]);
      });
    }
    wins.push({ symbol: s, length, ways, pay: PAYTABLE[s][length - 3] * ways, positions });
  }
  return wins;
}

export function totalPay(wins: WayWin[]): number {
  let t = 0;
  for (const w of wins) t += w.pay;
  return t;
}
