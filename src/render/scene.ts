import { Application, Container, Graphics, Sprite, Text, TilingSprite, type TextStyleOptions } from 'pixi.js';
import { BONUS, MAX_WIN_X, REELS, Sym, type BonusType } from '../math/config';
import type { BaseSpin, Bonus, FreeSpin, Grid, Pos } from '../engine/types';
import type { Synth } from '../audio/synth';
import { CELL, ReelGrid } from './grid';
import { DISPLAY_FONT, GRID_PX, UI_FONT, type Art } from './textures';
import { ease, lerp, Tweener } from './tween';

/** Design-space layouts; the root container is scaled to fit the screen. */
interface Layout {
  w: number;
  h: number;
  grid: [number, number];
  meter: [number, number];
  info: [number, number];
  titleY: number;
}
const LANDSCAPE: Layout = { w: 1280, h: 720, grid: [350, 92], meter: [172, 400], info: [1108, 380], titleY: 44 };
const PORTRAIT: Layout = { w: 720, h: 1120, grid: [70, 132], meter: [190, 935], info: [530, 915], titleY: 62 };

export const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function style(size: number, opts: Partial<TextStyleOptions> = {}): TextStyleOptions {
  return {
    fontFamily: DISPLAY_FONT,
    fontWeight: '900',
    fontSize: size,
    fill: '#f6d27a',
    stroke: { color: '#1a0205', width: Math.max(3, size / 9), join: 'round' },
    dropShadow: { color: '#ff2233', blur: size / 4, distance: 0, alpha: 0.7, angle: 0 },
    align: 'center',
    ...opts,
  };
}

const BONUS_INFO: Record<BonusType, { title: string; lines: string }> = {
  ritual: {
    title: 'THE RITUAL',
    lines: `${BONUS.ritual.spins} FREE SPINS\nMultiplier starts at x${BONUS.ritual.startMult}\nand grows +${BONUS.ritual.step} with every winning spin`,
  },
  rite: {
    title: 'THE DARK RITE',
    lines: `${BONUS.rite.spins} FREE SPINS\nMultiplier starts at x${BONUS.rite.startMult}\nand grows +${BONUS.rite.step} with every winning spin`,
  },
};

// ---------------------------------------------------------------------------

/** Spiral of candles that ignite one by one as the bonus multiplier grows. */
class CandleMeter extends Container {
  private candles: { body: Sprite; flame: Sprite; lit: boolean; phase: number }[] = [];
  private caption: Text;
  private value: Text;
  private ring: Graphics;
  private lit = 0;
  active = false;

  constructor(private art: Art, private tw: Tweener, private synth: Synth) {
    super();
    this.ring = new Graphics();
    this.addChild(this.ring);
    const N = 22;
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + i * 0.62;
      const r = 128 - i * 4.4;
      const x = Math.cos(a) * r, y = Math.sin(a) * r + 12;
      const body = new Sprite(art.candleUnlit);
      body.anchor.set(0.5, 1);
      body.scale.set(0.42 - i * 0.006);
      body.position.set(x, y + 22);
      const flame = new Sprite(art.flame);
      flame.anchor.set(0.5, 0.75);
      flame.scale.set(0.42 - i * 0.006);
      flame.position.set(x, y - 4);
      flame.blendMode = 'add';
      flame.visible = false;
      this.addChild(body, flame);
      this.candles.push({ body, flame, lit: false, phase: Math.random() * 10 });
    }
    this.ring.circle(0, 12, 54).fill({ color: 0x000000, alpha: 0.55 }).stroke({ width: 3, color: 0x7a1020 });
    this.caption = new Text({ text: 'BONUS\nMULTIPLIER', style: style(16, { fill: '#c9a96a', dropShadow: false, lineHeight: 18 }) });
    this.caption.anchor.set(0.5);
    this.caption.y = -178;
    this.value = new Text({ text: 'x1', style: style(44) });
    this.value.anchor.set(0.5);
    this.value.y = 12;
    this.addChild(this.caption, this.value);
    this.setActive(false);
  }

  tick(t: number) {
    for (const c of this.candles) {
      if (!c.lit) continue;
      const f = 0.9 + 0.12 * Math.sin(t * 0.012 + c.phase) + 0.06 * Math.sin(t * 0.031 + c.phase * 2);
      c.flame.scale.y = c.body.scale.x * f;
      c.flame.alpha = 0.8 + 0.2 * Math.sin(t * 0.02 + c.phase);
    }
  }

  setActive(on: boolean, startMult = 1) {
    this.active = on;
    this.lit = 0;
    for (const c of this.candles) {
      c.lit = false;
      c.flame.visible = false;
      c.body.texture = this.art.candleUnlit;
    }
    this.alpha = on ? 1 : 0.75;
    this.value.text = `x${startMult}`;
  }

  async grow(multiplier: number) {
    this.synth.play('ignite', { pitch: 1 + Math.min(this.lit, 20) * 0.04 });
    const c = this.candles[Math.min(this.lit, this.candles.length - 1)];
    this.lit++;
    if (!c.lit) {
      c.lit = true;
      c.flame.visible = true;
      c.body.texture = this.art.candleLit;
    }
    const base = c.body.scale.x;
    this.value.text = `x${multiplier}`;
    await this.tw.tween(420, (t) => {
      const k = 1 + 0.6 * Math.sin(t * Math.PI);
      this.value.scale.set(1 + 0.35 * Math.sin(t * Math.PI));
      c.flame.scale.set(base * k);
    }, ease.outQuad);
  }
}

// ---------------------------------------------------------------------------

interface Ember { s: Sprite; vx: number; vy: number; life: number; max: number }

export class Scene {
  readonly root = new Container();
  readonly tw: Tweener;
  readonly grid: ReelGrid;
  private gridLayer = new Container();
  private fxLayer = new Container();
  private overlayLayer = new Container();
  private emberLayer = new Container();
  private embers: Ember[] = [];
  private fog: TilingSprite;
  private bg: Sprite;
  private frame: Sprite;
  private title: Text;
  private L: Layout = LANDSCAPE;
  private moon: Sprite;
  private bgTint: Graphics;
  private meter: CandleMeter;
  private info = new Container();
  private infoBase: Container;
  private infoBonus: Container;
  private spinsText: Text;
  private bonusWinText: Text;
  /** Click handler of the open overlay card, so the spin button / space can advance it. */
  private overlayTap: (() => void) | null = null;
  /** Reports the current round win (credits) to the HUD. */
  onWin: (amount: number) => void = () => {};

  constructor(app: Application, private art: Art, private synth: Synth) {
    this.tw = new Tweener(app.ticker);
    app.stage.addChild(this.root);

    // background + red tint live on the stage so they always cover the whole screen
    this.bg = new Sprite(art.background);
    this.bg.anchor.set(0.5);
    this.bgTint = new Graphics().rect(0, 0, 1, 1).fill(0x8a0010);
    this.bgTint.alpha = 0;
    this.bgTint.blendMode = 'multiply';
    this.moon = new Sprite(art.moon);
    this.moon.anchor.set(0.5);
    this.moon.scale.set(1.2);
    this.moon.visible = false;
    this.fog = new TilingSprite({ texture: art.fog, width: 1280, height: 256 });
    this.fog.alpha = 0.9;
    app.stage.addChildAt(this.bgTint, 0);
    app.stage.addChildAt(this.bg, 0);
    this.root.addChild(this.moon, this.emberLayer, this.fog);

    // title
    this.title = new Text({ text: 'CRIMSON COVENANT', style: style(46, { letterSpacing: 6 }) });
    this.title.anchor.set(0.5);
    this.root.addChild(this.title);

    // reels
    this.frame = new Sprite(art.frame);
    this.grid = new ReelGrid(art.symbols, this.tw, app.ticker);
    this.gridLayer.addChild(this.grid, this.fxLayer);
    this.root.addChild(this.frame, this.gridLayer);

    // meter (left)
    this.meter = new CandleMeter(art, this.tw, synth);
    this.root.addChild(this.meter);

    // info (right)
    this.infoBase = this.buildBaseInfo();
    this.infoBonus = new Container();
    const fsLabel = new Text({ text: 'FREE SPINS', style: style(22, { fill: '#c9a96a', dropShadow: false }) });
    fsLabel.anchor.set(0.5);
    fsLabel.y = -120;
    this.spinsText = new Text({ text: '10', style: style(76) });
    this.spinsText.anchor.set(0.5);
    this.spinsText.y = -60;
    const bwLabel = new Text({ text: 'BONUS WIN', style: style(22, { fill: '#c9a96a', dropShadow: false }) });
    bwLabel.anchor.set(0.5);
    bwLabel.y = 30;
    this.bonusWinText = new Text({ text: '0.00', style: style(40, { fontFamily: UI_FONT, fontWeight: '700' }) });
    this.bonusWinText.anchor.set(0.5);
    this.bonusWinText.y = 76;
    this.infoBonus.addChild(fsLabel, this.spinsText, bwLabel, this.bonusWinText);
    this.infoBonus.visible = false;
    this.info.addChild(this.infoBase, this.infoBonus);
    this.root.addChild(this.info);

    this.root.addChild(this.overlayLayer);
    app.ticker.add((t) => this.tick(t.deltaMS));
  }

  private buildBaseInfo(): Container {
    const c = new Container();
    const card = (y: number, head: string, body: string, color: string) => {
      const bg = new Graphics()
        .roundRect(-130, y - 70, 260, 140, 14)
        .fill({ color: 0x000000, alpha: 0.5 })
        .stroke({ width: 2, color: 0x6b1020 });
      const h = new Text({ text: head, style: style(22, { fill: color }) });
      h.anchor.set(0.5);
      h.y = y - 38;
      const b = new Text({
        text: body,
        style: style(15, {
          fontFamily: UI_FONT, fontWeight: '500', fill: '#e9dcc6', dropShadow: false,
          stroke: { color: '#000', width: 3 }, lineHeight: 21,
        }),
      });
      b.anchor.set(0.5, 0);
      b.y = y - 16;
      c.addChild(bg, h, b);
    };
    card(-95, 'BLOOD MOON', 'Sigil orbs may fall on any spin.\nTheir values add up and\nmultiply the win, up to x300.', '#ff5a4a');
    card(70, 'GRIMOIRES', '3 trigger THE RITUAL\n4+ trigger THE DARK RITE\n2 in free spins: +3 spins', '#8dff96');
    return c;
  }

  private tick(dt: number) {
    const now = performance.now();
    this.fog.tilePosition.x -= dt * 0.012;
    this.meter.tick(now);
    // ambient embers
    if (this.embers.length < 70 && Math.random() < dt / 70) this.spawnEmber(Math.random() * this.L.w, this.L.h + 10, 1);
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.life += dt;
      e.s.x += e.vx * dt * 0.06 + Math.sin((e.life + i * 300) / 400) * 0.3;
      e.s.y += e.vy * dt * 0.06;
      e.vy += 0.0015 * dt; // buoyancy decays
      const k = e.life / e.max;
      e.s.alpha = k < 0.1 ? k * 10 : 1 - k;
      if (e.life >= e.max) {
        e.s.destroy();
        this.embers.splice(i, 1);
      }
    }
  }

  private spawnEmber(x: number, y: number, power: number) {
    const s = new Sprite(this.art.ember);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    s.scale.set(0.3 + Math.random() * 0.5 * power);
    s.position.set(x, y);
    this.emberLayer.addChild(s);
    const a = Math.random() * Math.PI * 2;
    this.embers.push({
      s,
      vx: power > 1 ? Math.cos(a) * power * 2 : (Math.random() - 0.5) * 0.6,
      vy: power > 1 ? Math.sin(a) * power * 2 - 2 : -(1 + Math.random() * 1.5),
      life: 0,
      max: 2500 + Math.random() * 3000,
    });
  }

  burst(n = 120) {
    for (let i = 0; i < n; i++) this.spawnEmber(this.L.w / 2, this.L.h / 2, 2 + Math.random() * 3);
  }

  resize(width: number, height: number) {
    const L = (this.L = height > width * 1.15 ? PORTRAIT : LANDSCAPE);
    this.title.position.set(L.w / 2, L.titleY);
    this.frame.position.set(L.grid[0] - 26, L.grid[1] - 26);
    this.gridLayer.position.set(...L.grid);
    this.meter.position.set(...L.meter);
    this.info.position.set(...L.info);
    this.moon.x = L.w / 2;
    if (!this.moon.visible) this.moon.y = -260;
    this.fog.width = L.w;
    this.fog.y = L.h - 230;
    const scale = Math.min(width / L.w, height / L.h);
    this.root.scale.set(scale);
    this.root.position.set((width - L.w * scale) / 2, (height - L.h * scale) / 2);
    this.bg.position.set(width / 2, height / 2);
    this.bg.scale.set(Math.max(width / this.bg.texture.width, height / this.bg.texture.height));
    this.bgTint.width = width;
    this.bgTint.height = height;
  }

  setTurbo(on: boolean) {
    this.tw.baseScale = on ? 2.2 : 1;
  }

  /** Player tapped spin mid-round: advance an open card, otherwise speed up the round. */
  hurry() {
    if (this.overlayTap) this.overlayTap();
    else this.tw.hurryScale = 4;
  }

  endRound() {
    this.tw.hurryScale = 1;
  }

  setInitialGrid(grid: Grid) {
    this.grid.setGrid(grid);
  }

  // -------------------------------------------------------------------------
  // base game

  async presentBase(spin: BaseSpin, bet: number) {
    this.onWin(0);
    const orbsComing = spin.orbs.length > 0;
    const spinning = this.grid.spinAll();
    this.synth.play('spin');
    if (orbsComing) void this.bloodMoon(true);
    await spinning;
    await this.tw.wait(orbsComing ? 900 : 250);
    await this.stopReels(spin.grid, true);

    let orbSprites: Container[] = [];
    if (orbsComing) orbSprites = await this.dropOrbs(spin);

    if (spin.wins.length) {
      await this.showWins(spin.wins.flatMap((w) => w.positions), spin.rawWin * bet);
      if (spin.orbMultiplier > 1) {
        await this.mergeOrbs(orbSprites, spin.orbMultiplier, spin.rawWin * bet, spin.win * bet);
        orbSprites = [];
      }
      this.onWin(spin.win * bet);
    }
    if (orbSprites.length) await this.fadeOrbs(orbSprites);
    if (orbsComing) void this.bloodMoon(false);

    if (spin.trigger) {
      this.grid.showWins(spin.scatters, 0x3bff6a);
      this.synth.play('scatter', { pitch: 1.5 });
      await this.tw.wait(1300);
    }
  }

  private async stopReels(grid: Grid, anticipate: boolean) {
    let anticipateFrom: number | undefined;
    if (anticipate) {
      let count = 0;
      for (let r = 0; r < REELS; r++) {
        if (count >= 2) {
          anticipateFrom = r;
          break;
        }
        if (grid[r].includes(Sym.SCATTER)) count++;
      }
    }
    let landed = 0;
    await this.grid.stopAll(grid, {
      anticipateFrom,
      onReelStop: (r) => {
        this.synth.play('reelStop');
        if (anticipateFrom !== undefined && r + 1 >= anticipateFrom && r < REELS - 1) this.synth.play('anticipation');
        grid[r].forEach((s, row) => {
          if (s !== Sym.SCATTER) return;
          landed++;
          this.synth.play('scatter', { pitch: 1 + landed * 0.12 });
          void this.grid.bounce([r, row]);
        });
      },
    });
  }

  private async bloodMoon(on: boolean) {
    if (on) this.moon.visible = true;
    const fromY = this.moon.y, toY = on ? 90 : -260;
    const fromA = this.bgTint.alpha, toA = on ? 0.55 : 0;
    await this.tw.tween(on ? 900 : 700, (t) => {
      this.moon.y = lerp(fromY, toY, t);
      this.bgTint.alpha = lerp(fromA, toA, t);
    }, ease.inOutSine);
    if (!on) this.moon.visible = false;
  }

  private async dropOrbs(spin: BaseSpin): Promise<Container[]> {
    const out: Container[] = [];
    for (const orb of spin.orbs) {
      const c = new Container();
      const s = new Sprite(this.art.orb);
      s.anchor.set(0.5);
      s.scale.set(0.62);
      const label = new Text({ text: `x${orb.value}`, style: style(orb.value >= 25 ? 34 : 30, { fill: '#fff4dc' }) });
      label.anchor.set(0.5);
      c.addChild(s, label);
      const { x, y } = this.grid.cellCenter(orb.pos);
      c.position.set(x, -120);
      this.fxLayer.addChild(c);
      out.push(c);
      this.synth.play('orb', { pitch: 1 + out.length * 0.15 });
      await this.tw.tween(520, (t) => {
        c.y = lerp(-120, y, t);
        c.scale.set(lerp(1.6, 1, t));
      }, ease.outBack);
      await this.tw.wait(160);
    }
    await this.tw.wait(300);
    return out;
  }

  private async fadeOrbs(orbs: Container[]) {
    await this.tw.tween(400, (t) => orbs.forEach((o) => {
      o.alpha = 1 - t;
      o.scale.set(1 + t * 0.4);
    }));
    orbs.forEach((o) => o.destroy({ children: true }));
  }

  private async mergeOrbs(orbs: Container[], total: number, rawAmount: number, finalAmount: number) {
    const cx = (CELL * 5) / 2, cy = (CELL * 5) / 2 - 70;
    const starts = orbs.map((o) => ({ x: o.x, y: o.y }));
    await this.tw.tween(500, (t) => orbs.forEach((o, i) => {
      o.x = lerp(starts[i].x, cx, t);
      o.y = lerp(starts[i].y, cy, t);
    }), ease.inCubic);
    orbs.slice(1).forEach((o) => o.destroy({ children: true }));
    const main = orbs[0];
    (main.children[1] as Text).text = `x${total}`;
    this.synth.play('orbMultiply');
    await this.tw.tween(450, (t) => main.scale.set(1 + 0.6 * Math.sin(t * Math.PI)), ease.outQuad);
    // the orb dives into the win popup
    const popup = this.winPopup(rawAmount);
    await this.tw.tween(350, (t) => {
      main.y = lerp(cy, cy + 120, t);
      main.alpha = 1 - t;
    }, ease.inCubic);
    main.destroy({ children: true });
    await this.rollText(popup, rawAmount, finalAmount, 900);
    await this.tw.wait(500);
    await this.fadeAndDestroy(popup);
  }

  private winPopup(amount: number): Text {
    const t = new Text({ text: fmt(amount), style: style(64, { fontFamily: UI_FONT, fontWeight: '700' }) });
    t.anchor.set(0.5);
    t.position.set(GRID_PX / 2, GRID_PX / 2 + 50);
    this.fxLayer.addChild(t);
    return t;
  }

  private async rollText(t: Text, from: number, to: number, ms: number) {
    let lastTick = 0;
    await this.tw.tween(ms, (k) => {
      t.text = fmt(lerp(from, to, k));
      t.scale.set(1 + 0.15 * Math.sin(k * Math.PI));
      const now = performance.now();
      if (now - lastTick > 70) {
        lastTick = now;
        this.synth.play('tick', { pitch: 1 + k * 0.5 });
      }
    }, ease.outQuad);
    t.text = fmt(to);
  }

  private async fadeAndDestroy(d: Container) {
    await this.tw.tween(250, (t) => (d.alpha = 1 - t));
    d.destroy();
  }

  private async showWins(positions: Pos[], amount: number) {
    this.grid.showWins(positions);
    this.synth.play('win');
    const popup = this.winPopup(amount);
    popup.scale.set(0.2);
    await this.tw.tween(350, (t) => popup.scale.set(lerp(0.2, 1, t)), ease.outBack);
    await this.tw.wait(700);
    await this.fadeAndDestroy(popup);
  }

  // -------------------------------------------------------------------------
  // free spins

  async presentBonus(bonus: Bonus, bet: number, baseWin: number, autoContinue: boolean) {
    const info = BONUS_INFO[bonus.type];
    this.synth.play('bonusIntro');
    await this.overlay(info.title, info.lines, null, autoContinue ? 2500 : 0);
    this.synth.setBonusMood(true);
    this.grid.clearWins();
    const cfg = BONUS[bonus.type];
    this.meter.setActive(true, cfg.startMult);
    this.infoBase.visible = false;
    this.infoBonus.visible = true;
    this.bonusWinText.text = fmt(0);
    this.spinsText.text = String(cfg.spins);
    await this.tw.tween(500, (t) => (this.bgTint.alpha = 0.35 * t));

    for (const fs of bonus.spins) {
      await this.presentFreeSpin(fs, bet, baseWin);
    }

    const capped = bonus.total + baseWin >= MAX_WIN_X - 1e-9;
    if (capped) await this.presentMaxWin((baseWin + bonus.total) * bet);
    await this.tw.wait(400);
    const title = bonus.type === 'ritual' ? 'RITUAL COMPLETE' : 'THE RITE IS DONE';
    this.synth.play('bigWin');
    await this.overlay(title, `${bonus.spins.length} free spins played`, bonus.total * bet, autoContinue ? 3000 : 0);
    this.synth.setBonusMood(false);
    this.meter.setActive(false);
    this.infoBase.visible = true;
    this.infoBonus.visible = false;
    await this.tw.tween(500, (t) => (this.bgTint.alpha = 0.35 * (1 - t)));
  }

  private async presentFreeSpin(fs: FreeSpin, bet: number, baseWin: number) {
    this.spinsText.text = String(fs.spinsLeft - fs.extraSpins);
    const spinning = this.grid.spinAll();
    this.synth.play('spin');
    await spinning;
    await this.tw.wait(300);
    await this.stopReels(fs.grid, false);
    if (fs.wins.length) {
      this.grid.showWins(fs.wins.flatMap((w) => w.positions));
      this.synth.play('win');
      const popup = this.winPopup(fs.rawWin * bet);
      popup.scale.set(0.2);
      await this.tw.tween(300, (t) => popup.scale.set(lerp(0.2, 1, t)), ease.outBack);
      if (fs.multiplier > 1) {
        const m = new Text({ text: `x${fs.multiplier}`, style: style(54, { fill: '#ff5a4a' }) });
        m.anchor.set(0.5);
        m.position.set(GRID_PX / 2, GRID_PX / 2 - 40);
        this.fxLayer.addChild(m);
        await this.tw.tween(300, (t) => m.scale.set(lerp(2, 1, t)), ease.outBack);
        await this.rollText(popup, fs.rawWin * bet, fs.win * bet, 600);
        await this.fadeAndDestroy(m);
      } else {
        await this.tw.wait(400);
      }
      this.bonusWinText.text = fmt(fs.bonusTotal * bet);
      this.onWin((baseWin + fs.bonusTotal) * bet);
      await this.meter.grow(fs.multiplierAfter);
      await this.fadeAndDestroy(popup);
    }
    if (fs.extraSpins) {
      this.grid.showWins(fs.scatters, 0x3bff6a);
      this.synth.play('retrigger');
      const t = new Text({ text: `+${fs.extraSpins} FREE SPINS`, style: style(56, { fill: '#9dff9f' }) });
      t.anchor.set(0.5);
      t.position.set(GRID_PX / 2, GRID_PX / 2);
      this.fxLayer.addChild(t);
      await this.tw.tween(400, (k) => t.scale.set(lerp(0.3, 1, k)), ease.outBack);
      this.spinsText.text = String(fs.spinsLeft);
      await this.tw.wait(800);
      await this.fadeAndDestroy(t);
    }
    this.spinsText.text = String(fs.spinsLeft);
    await this.tw.wait(250);
  }

  // -------------------------------------------------------------------------
  // overlays

  /**
   * Full-screen card. Resolves on click, or after `autoMs` when > 0.
   * Clicking during the count-up skips straight to the final amount.
   */
  private overlay(title: string, body: string, amount: number | null, autoMs: number): Promise<void> {
    return new Promise((resolve) => {
      const c = new Container();
      const { w: W, h: H } = this.L;
      const dim = new Graphics().rect(-W, -H, W * 3, H * 3).fill({ color: 0x050002, alpha: 0.82 });
      dim.eventMode = 'static';
      dim.cursor = 'pointer';
      const sigil = new Sprite(this.art.glow);
      sigil.anchor.set(0.5);
      sigil.tint = 0xff2233;
      sigil.scale.set(7);
      sigil.position.set(W / 2, H / 2);
      sigil.alpha = 0.35;
      const t = new Text({ text: title, style: style(84, { letterSpacing: 4 }) });
      t.anchor.set(0.5);
      t.position.set(W / 2, H / 2 - 120);
      const fit = Math.min(1, (W - 60) / t.width);
      const b = new Text({
        text: body,
        style: style(26, { fontFamily: UI_FONT, fontWeight: '500', fill: '#e9dcc6', dropShadow: false, lineHeight: 36 }),
      });
      b.anchor.set(0.5);
      b.position.set(W / 2, H / 2 + (amount === null ? 10 : -30));
      c.addChild(dim, sigil, t, b);
      let amountText: Text | null = null;
      if (amount !== null) {
        amountText = new Text({ text: fmt(0), style: style(96, { fontFamily: UI_FONT, fontWeight: '700' }) });
        amountText.anchor.set(0.5);
        amountText.position.set(W / 2, H / 2 + 70);
        c.addChild(amountText);
      }
      const hint = new Text({
        text: autoMs > 0 ? '' : 'CLICK TO CONTINUE',
        style: style(18, { fontFamily: UI_FONT, fill: '#a08a6a', dropShadow: false }),
      });
      hint.anchor.set(0.5);
      hint.position.set(W / 2, H - 90);
      c.addChild(hint);
      c.alpha = 0;
      this.overlayLayer.addChild(c);

      let counting = amount !== null;
      let done = false;
      const finish = async () => {
        if (done) return;
        done = true;
        await this.tw.tween(300, (k) => (c.alpha = 1 - k));
        c.destroy({ children: true });
        this.overlayTap = null;
        resolve();
      };
      const tap = () => {
        this.synth.play('click');
        if (counting && amountText) {
          counting = false;
          amountText.text = fmt(amount!);
          return;
        }
        void finish();
      };
      this.overlayTap = tap;
      dim.on('pointertap', tap);
      void (async () => {
        await this.tw.tween(350, (k) => {
          c.alpha = k;
          t.scale.set(fit * lerp(1.3, 1, k));
        }, ease.outCubic);
        if (amountText) {
          let last = 0;
          await this.tw.tween(1600, (k) => {
            if (!counting) return;
            amountText!.text = fmt(amount! * k);
            const now = performance.now();
            if (now - last > 80) {
              last = now;
              this.synth.play('tick', { pitch: 1 + k });
            }
          }, ease.outQuad);
          counting = false;
          amountText.text = fmt(amount!);
          this.burst(60);
        }
        if (autoMs > 0) {
          await this.tw.wait(autoMs);
          void finish();
        }
      })();
    });
  }

  async presentBigWin(totalX: number, amount: number, autoContinue: boolean) {
    const tiers = [
      { x: 10, title: 'BIG WIN' },
      { x: 50, title: 'MEGA WIN' },
      { x: 200, title: 'EPIC WIN' },
      { x: 1000, title: 'UNHOLY WIN' },
    ].filter((t) => totalX >= t.x);
    if (!tiers.length) return;
    this.synth.play('bigWin');
    this.burst(150);
    await this.overlay(tiers.at(-1)!.title, `${totalX.toFixed(1)}x your bet`, amount, autoContinue ? 2500 : 0);
  }

  async presentMaxWin(amount: number) {
    this.synth.play('maxWin');
    this.burst(250);
    await this.overlay('MAX WIN', `${MAX_WIN_X.toLocaleString()}x reached. The covenant is fulfilled.`, amount, 0);
  }

  async message(title: string, body: string) {
    await this.overlay(title, body, null, 0);
  }
}
