import { BlurFilter, Container, Graphics, Sprite, type Texture, type Ticker } from 'pixi.js';
import { REELS, ROWS, Sym } from '../math/config';
import type { Grid, Pos } from '../engine/types';
import { ease, lerp, type Tweener } from './tween';

export const CELL = 116;
const SYMBOL_SIZE = 108;
const SPIN_SPEED = 17; // cells per second
const FILLER = [Sym.L1, Sym.L2, Sym.L3, Sym.L4, Sym.H1, Sym.H2, Sym.H3, Sym.H4, Sym.WILD];

class Reel {
  readonly container = new Container();
  readonly sprites: Sprite[] = [];
  private strip = new Map<number, number>();
  pos = 0;
  spinning = false;
  private speed = 0;
  private blur = new BlurFilter({ strengthX: 0, strengthY: 10, quality: 2 });

  constructor(private textures: Texture[], index: number) {
    this.container.x = index * CELL;
    for (let i = 0; i <= ROWS; i++) {
      const s = new Sprite(textures[0]);
      s.anchor.set(0.5);
      s.width = s.height = SYMBOL_SIZE;
      s.x = CELL / 2;
      this.container.addChild(s);
      this.sprites.push(s);
    }
  }

  private symbolAt(i: number): number {
    let s = this.strip.get(i);
    if (s === undefined) {
      s = FILLER[Math.floor(Math.random() * FILLER.length)];
      this.strip.set(i, s);
    }
    return s;
  }

  layout() {
    const base = Math.floor(this.pos);
    for (let k = 0; k <= ROWS; k++) {
      const idx = base + k;
      const s = this.sprites[k];
      s.texture = this.textures[this.symbolAt(idx)];
      s.width = s.height = SYMBOL_SIZE;
      s.y = (idx - this.pos) * CELL + CELL / 2;
    }
  }

  set(symbols: number[]) {
    this.strip.clear();
    symbols.forEach((s, r) => this.strip.set(r, s));
    this.pos = 0;
    this.layout();
  }

  start() {
    this.spinning = true;
    this.speed = 0;
    this.container.filters = [this.blur];
  }

  update(dtSec: number) {
    if (!this.spinning) return;
    this.speed = Math.min(SPIN_SPEED, this.speed + SPIN_SPEED * dtSec * 8);
    this.pos -= this.speed * dtSec;
    this.layout();
    // forget symbols far below the window
    if (this.strip.size > 40) {
      const limit = Math.floor(this.pos) + ROWS + 2;
      for (const k of this.strip.keys()) if (k > limit) this.strip.delete(k);
    }
  }

  async stop(tw: Tweener, final: number[], duration: number) {
    this.spinning = false;
    const target = Math.floor(this.pos) - ROWS - 1;
    final.forEach((s, r) => this.strip.set(target + r, s));
    const from = this.pos;
    this.container.filters = [];
    await tw.tween(duration, (t) => {
      this.pos = lerp(from, target, t);
      this.layout();
    }, ease.outBack);
    this.set(final);
  }
}

export interface StopOptions {
  /** Reel index from which remaining reels get the slow anticipation stop. */
  anticipateFrom?: number;
  onReelStop?: (reel: number) => void;
}

/** The 5x5 reel window. Children are positioned in local cell coordinates. */
export class ReelGrid extends Container {
  private reels: Reel[] = [];
  private glowLayer = new Container();
  private highlights: Graphics[] = [];
  private pulse: { sprite: Sprite; t: number }[] = [];
  private anticipation: Graphics[] = [];

  constructor(textures: Texture[], private tw: Tweener, ticker: Ticker) {
    super();
    const mask = new Graphics().rect(0, 0, CELL * REELS, CELL * ROWS).fill(0xffffff);
    const reelLayer = new Container();
    reelLayer.mask = mask;
    this.addChild(this.glowLayer, reelLayer, mask);
    for (let r = 0; r < REELS; r++) {
      const reel = new Reel(textures, r);
      this.reels.push(reel);
      reelLayer.addChild(reel.container);
      const a = new Graphics()
        .roundRect(r * CELL + 3, 3, CELL - 6, CELL * ROWS - 6, 12)
        .stroke({ width: 5, color: 0x6bff7e, alpha: 0.9 });
      a.alpha = 0;
      this.anticipation.push(a);
      this.addChild(a);
    }
    ticker.add((t) => this.update(t));
  }

  private update(t: Ticker) {
    const dt = (t.deltaMS * this.tw.timeScale) / 1000;
    for (const r of this.reels) r.update(dt);
    for (const p of this.pulse) {
      p.t += dt * 4;
      const s = (SYMBOL_SIZE / p.sprite.texture.width) * (1 + 0.08 * Math.sin(p.t));
      p.sprite.scale.set(s);
    }
    const now = performance.now() / 120;
    this.anticipation.forEach((a, i) => {
      if (a.visible && a.alpha > 0) a.alpha = 0.6 + 0.4 * Math.sin(now + i);
    });
  }

  setGrid(grid: Grid) {
    grid.forEach((col, r) => this.reels[r].set(col));
  }

  spinAll(): Promise<void> {
    this.clearWins();
    return Promise.all(
      this.reels.map(async (reel, r) => {
        await this.tw.wait(r * 45);
        reel.start();
      }),
    ).then(() => undefined);
  }

  async stopAll(grid: Grid, opts: StopOptions = {}) {
    const anticipateFrom = opts.anticipateFrom ?? REELS;
    // Normal reels stop in a staggered cascade; anticipated reels wait for the previous
    // reel to land, glow, then stop slowly one at a time.
    let prev: Promise<void> = Promise.resolve();
    const jobs: Promise<void>[] = [];
    for (let r = 0; r < REELS; r++) {
      const after = prev;
      const job = (async () => {
        if (r >= anticipateFrom) {
          await after;
          this.anticipation[r].alpha = 1;
          await this.tw.wait(950);
        } else {
          await this.tw.wait(r * 110);
        }
        await this.reels[r].stop(this.tw, grid[r], 300);
        this.anticipation[r].alpha = 0;
        opts.onReelStop?.(r);
      })();
      jobs.push(job);
      prev = job;
    }
    await Promise.all(jobs);
  }

  spriteAt([reel, row]: Pos): Sprite {
    return this.reels[reel].sprites[row];
  }

  cellCenter([reel, row]: Pos): { x: number; y: number } {
    return { x: reel * CELL + CELL / 2, y: row * CELL + CELL / 2 };
  }

  /** Dim everything except `positions`, pulse the winners and draw a glow behind them. */
  showWins(positions: Pos[], color = 0xff3344) {
    this.clearWins();
    const keys = new Set(positions.map(([r, row]) => r * 10 + row));
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        const s = this.reels[r].sprites[row];
        if (keys.has(r * 10 + row)) {
          s.alpha = 1;
          s.tint = 0xffffff;
          this.pulse.push({ sprite: s, t: Math.random() * 0.5 });
          const g = new Graphics()
            .roundRect(r * CELL + 4, row * CELL + 4, CELL - 8, CELL - 8, 14)
            .fill({ color, alpha: 0.22 })
            .stroke({ width: 3, color, alpha: 0.9 });
          this.highlights.push(g);
          this.glowLayer.addChild(g);
        } else {
          s.tint = 0x3a3036;
        }
      }
    }
  }

  clearWins() {
    for (const p of this.pulse) p.sprite.width = p.sprite.height = SYMBOL_SIZE;
    this.pulse = [];
    for (const g of this.highlights) g.destroy();
    this.highlights = [];
    for (const reel of this.reels) for (const s of reel.sprites) {
      s.tint = 0xffffff;
      s.alpha = 1;
    }
  }

  /** A quick landing bounce on one cell (scatters). */
  async bounce(pos: Pos) {
    const s = this.spriteAt(pos);
    const base = SYMBOL_SIZE / s.texture.width;
    await this.tw.tween(380, (t) => s.scale.set(base * (1 + 0.25 * Math.sin(t * Math.PI))), ease.outQuad);
    s.scale.set(base);
  }
}
