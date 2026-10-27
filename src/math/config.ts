/** All game math lives here. Values in "x" are multiples of the total bet. */

export const REELS = 5;
export const ROWS = 5;

export const enum Sym {
  L1 = 0, // ash rune
  L2 = 1, // bone rune
  L3 = 2, // rust rune
  L4 = 3, // moss rune
  H1 = 4, // black candle
  H2 = 5, // ritual dagger
  H3 = 6, // blood chalice
  H4 = 7, // masked cultist
  WILD = 8, // all-seeing eye
  SCATTER = 9, // grimoire
}

export const PAYING_SYMBOLS = 8;
export const SYMBOL_COUNT = 10;

export const SYMBOL_NAMES = [
  'Ash Rune', 'Bone Rune', 'Rust Rune', 'Moss Rune',
  'Black Candle', 'Ritual Dagger', 'Blood Chalice', 'Masked Cultist',
  'All-Seeing Eye', 'Grimoire',
];

/** Pay per way, indexed [symbol][matchLength 3,4,5]. */
export const PAYTABLE: readonly (readonly [number, number, number])[] = [
  [0.02, 0.05, 0.1],
  [0.02, 0.05, 0.1],
  [0.02, 0.06, 0.12],
  [0.04, 0.08, 0.15],
  [0.05, 0.12, 0.35],
  [0.08, 0.2, 0.5],
  [0.1, 0.25, 0.75],
  [0.12, 0.4, 1.25],
];

/**
 * Reel strips: each reel is a looping strip of stacked symbols; a spin shows 5 consecutive
 * positions. Stacks make wins rarer but bigger. Scatter is overlaid separately.
 */
export interface ModeWeights {
  /** [reel][position] symbol ids. */
  strips: number[][];
  /** Chance per reel that a scatter lands somewhere on it. */
  scatterPerReel: number;
}

export interface StripSpec {
  /** Weights for symbols 0..8 (wild ignored on reel 1). */
  symbols: number[];
  /** Weights for stack heights 1, 2, 3, ... */
  stacks: number[];
  /** Number of stacks per strip. */
  length: number;
  /** Let wilds stack like other symbols (bonus strips). */
  stackWilds?: boolean;
}

/** Tiny deterministic LCG so strips are identical on every load. */
function lcg(seed: number) {
  let x = seed >>> 0;
  return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function pick(r: () => number, weights: number[]): number {
  let v = r() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < weights.length; i++) if ((v -= weights[i]) < 0) return i;
  return weights.length - 1;
}

export function buildStrips(spec: StripSpec, seed: number): number[][] {
  const strips: number[][] = [];
  for (let reel = 0; reel < REELS; reel++) {
    const r = lcg(seed * 31 + reel);
    const symbols = spec.symbols.map((w, i) => (reel === 0 && i === Sym.WILD ? 0 : w));
    const strip: number[] = [];
    let prev = -1;
    for (let i = 0; i < spec.length; i++) {
      let s = pick(r, symbols);
      if (s === prev) s = pick(r, symbols); // fewer merged stacks
      const h = s === Sym.WILD && !spec.stackWilds ? 1 : pick(r, spec.stacks) + 1;
      for (let k = 0; k < h; k++) strip.push(s);
      prev = s;
    }
    strips.push(strip);
  }
  return strips;
}

const LOW = [30, 30, 28, 26];
const HIGH = [16, 13, 11, 8];
const RICH_HIGH = HIGH.map((v) => v * 1.5);
const STACKS = [2, 3, 4, 4, 2];

export const BASE_SPEC: StripSpec = { symbols: [...LOW, ...HIGH, 5], stacks: STACKS, length: 80 };
export const RITUAL_SPEC: StripSpec = {
  symbols: [...LOW, ...RICH_HIGH, 21.5], stacks: STACKS, length: 80, stackWilds: true,
};
export const RITE_SPEC: StripSpec = {
  symbols: [...LOW, ...RICH_HIGH, 22.4], stacks: STACKS, length: 80, stackWilds: true,
};

export const BASE_WEIGHTS: ModeWeights = { strips: buildStrips(BASE_SPEC, 1), scatterPerReel: 0.079 };
export const RITUAL_WEIGHTS: ModeWeights = { strips: buildStrips(RITUAL_SPEC, 2), scatterPerReel: 0.05 };
export const RITE_WEIGHTS: ModeWeights = { strips: buildStrips(RITE_SPEC, 3), scatterPerReel: 0.05 };

export type BonusType = 'ritual' | 'rite';

export const BONUS = {
  ritual: { spins: 10, startMult: 1, step: 1, buyCost: 100 },
  rite: { spins: 12, startMult: 3, step: 2, buyCost: 300 },
  retriggerScatters: 2,
  retriggerSpins: 3,
} as const;

/** Base-game Blood Moon modifier. */
export const BLOOD_MOON = {
  chance: 1 / 60,
  countWeights: [60, 30, 10], // 1, 2, 3 orbs
  values: [2, 3, 5, 10, 25, 50, 100],
  valueWeights: [40, 25, 18, 10, 5, 1.5, 0.5],
};

export const MAX_WIN_X = 10_000;

export const BET_LEVELS = [0.1, 0.2, 0.4, 0.6, 0.8, 1, 2, 4, 6, 8, 10, 20, 50, 100];
export const DEFAULT_BET_INDEX = 5;
export const START_BALANCE = 1000;
