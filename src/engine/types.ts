import type { BonusType } from '../math/config';

/** Symbol ids indexed [reel][row], row 0 at the top. */
export type Grid = number[][];
export type Pos = [reel: number, row: number];

export interface WayWin {
  symbol: number;
  length: number;
  ways: number;
  /** Win in multiples of bet, before any multiplier. */
  pay: number;
  positions: Pos[];
}

export interface Orb {
  value: number;
  /** Cell the orb lands on (purely visual). */
  pos: Pos;
}

export interface BaseSpin {
  grid: Grid;
  wins: WayWin[];
  /** Sum of way wins (x bet) before orbs. */
  rawWin: number;
  orbs: Orb[];
  /** Sum of orb values when orbs apply to a win, else 1. */
  orbMultiplier: number;
  /** x bet, after orbs and cap. */
  win: number;
  scatters: Pos[];
  trigger: BonusType | null;
}

export interface FreeSpin {
  grid: Grid;
  wins: WayWin[];
  rawWin: number;
  /** Multiplier applied to this spin's win. */
  multiplier: number;
  /** Meter value after this spin. */
  multiplierAfter: number;
  /** x bet, after multiplier and cap. */
  win: number;
  scatters: Pos[];
  extraSpins: number;
  spinsLeft: number;
  bonusTotal: number;
}

export interface Bonus {
  type: BonusType;
  spins: FreeSpin[];
  /** x bet */
  total: number;
}

export type RoundMode = 'spin' | 'buy-ritual' | 'buy-rite';

export interface RoundResult {
  mode: RoundMode;
  bet: number;
  /** Credits charged. */
  cost: number;
  base: BaseSpin;
  bonus: Bonus | null;
  /** Total round win in x bet. */
  totalX: number;
  /** Total round win in credits. */
  totalWin: number;
  maxWinHit: boolean;
}
