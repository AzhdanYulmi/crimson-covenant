/** Seeded PRNG (sfc32). Deterministic for tests and simulation. */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, n). */
  int(n: number): number;
}

export function createRng(seed: number = (Math.random() * 2 ** 32) >>> 0): Rng {
  let a = 0x9e3779b9;
  let b = 0x243f6a88;
  let c = 0xb7e15162;
  let d = seed >>> 0;
  const raw = (): number => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 15; i++) raw();
  return { next: raw, int: (n) => Math.floor(raw() * n) };
}

/** Pick an index from a weight array. */
export function pickWeighted(rng: Rng, weights: readonly number[], total?: number): number {
  const sum = total ?? weights.reduce((s, w) => s + w, 0);
  let r = rng.next() * sum;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}
