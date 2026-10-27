import type { Ticker } from 'pixi.js';

export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inCubic: (t: number) => t * t * t,
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number) => {
    const c1 = 1.4, c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  outElastic: (t: number) =>
    t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

interface Job {
  elapsed: number;
  duration: number;
  update: (t: number) => void;
  ease: Ease;
  resolve: () => void;
}

/**
 * Promise-based tweens driven by the Pixi ticker. `timeScale` speeds up everything
 * (turbo mode, or "slam stop" when the player taps spin mid-round).
 */
export class Tweener {
  /** Base speed (turbo). */
  baseScale = 1;
  /** Extra speed for the current round when the player hurries it. */
  hurryScale = 1;
  private jobs = new Set<Job>();

  constructor(ticker: Ticker) {
    ticker.add((t) => this.tick(t.deltaMS));
  }

  get timeScale(): number {
    return this.baseScale * this.hurryScale;
  }

  private tick(dt: number) {
    const step = dt * this.timeScale;
    for (const j of [...this.jobs]) {
      j.elapsed += step;
      const t = Math.min(1, j.elapsed / j.duration);
      j.update(j.ease(t));
      if (t >= 1) {
        this.jobs.delete(j);
        j.resolve();
      }
    }
  }

  tween(duration: number, update: (t: number) => void, easeFn: Ease = ease.outCubic): Promise<void> {
    if (duration <= 0) {
      update(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => this.jobs.add({ elapsed: 0, duration, update, ease: easeFn, resolve }));
  }

  wait(ms: number): Promise<void> {
    return this.tween(ms, () => {}, ease.linear);
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
