import { Application } from 'pixi.js';
import './style.css';
import { Synth } from './audio/synth';
import { createRng } from './engine/rng';
import { generateGrid, playRound } from './engine/spin';
import type { RoundMode, RoundResult } from './engine/types';
import { BASE_WEIGHTS, BET_LEVELS, BONUS, DEFAULT_BET_INDEX, START_BALANCE, type BonusType } from './math/config';
import { Scene } from './render/scene';
import { createArt, loadFonts } from './render/textures';
import { mountDevPanel, type ForceKind } from './ui/devpanel';
import { Hud } from './ui/hud';

async function boot() {
  await loadFonts();
  const stage = document.getElementById('stage')!;
  const app = new Application();
  await app.init({ resizeTo: stage, background: '#050103', antialias: true, resolution: Math.min(2, devicePixelRatio), autoDensity: true });
  stage.appendChild(app.canvas);

  const synth = new Synth();
  const art = createArt();
  const scene = new Scene(app, art, synth);
  const rng = createRng();
  scene.setInitialGrid(generateGrid(rng, BASE_WEIGHTS, []));

  const state = { balance: START_BALANCE, betIndex: DEFAULT_BET_INDEX, busy: false, autoLeft: 0, turbo: false, muted: false };
  const bet = () => BET_LEVELS[state.betIndex];

  const hud = new Hud(document.getElementById('hud')!, {
    spin: () => void play('spin'),
    bet: (d) => {
      state.betIndex = Math.max(0, Math.min(BET_LEVELS.length - 1, state.betIndex + d));
      synth.unlock();
      synth.play('click');
      refresh();
    },
    turbo: () => {
      state.turbo = !state.turbo;
      scene.setTurbo(state.turbo);
      refresh();
    },
    autoplay: (n) => {
      state.autoLeft = n;
      void play('spin');
    },
    stopAutoplay: () => {
      state.autoLeft = 0;
      refresh();
    },
    buy: (type: BonusType) => void play(type === 'ritual' ? 'buy-ritual' : 'buy-rite'),
    mute: () => {
      synth.unlock();
      state.muted = !state.muted;
      synth.setMuted(state.muted);
      refresh();
    },
    refill: () => {
      state.balance = START_BALANCE;
      refresh();
    },
  }, art.symbolUrls);

  function refresh() {
    hud.setBalance(state.balance);
    hud.setBet(bet(), state.betIndex === 0, state.betIndex === BET_LEVELS.length - 1);
    hud.setTurbo(state.turbo);
    hud.setMuted(state.muted);
    hud.setBusy(state.busy, state.autoLeft);
  }

  scene.onWin = (amount) => hud.setWin(amount);

  async function play(mode: RoundMode, forced?: RoundResult) {
    synth.unlock();
    if (state.busy) {
      scene.hurry();
      return;
    }
    const b = bet();
    const cost = mode === 'spin' ? b : b * BONUS[mode === 'buy-ritual' ? 'ritual' : 'rite'].buyCost;
    if (state.balance + 1e-9 < cost) {
      state.autoLeft = 0;
      refresh();
      hud.showOutOfCredits();
      return;
    }
    state.busy = true;
    if (state.autoLeft > 0) state.autoLeft--;
    state.balance -= cost;
    refresh();

    const result = forced ?? playRound(rng, b, mode);
    if (result.bonus) state.autoLeft = 0; // autoplay stops on bonus
    const auto = state.autoLeft > 0;
    await scene.presentBase(result.base, b);
    if (result.bonus) {
      refresh();
      await scene.presentBonus(result.bonus, b, result.base.win, false);
    } else if (result.maxWinHit) {
      await scene.presentMaxWin(result.totalWin);
    } else {
      await scene.presentBigWin(result.totalX, result.totalWin, auto);
    }
    hud.setWin(result.totalWin);
    state.balance += result.totalWin;
    scene.endRound();
    state.busy = false;
    refresh();

    if (state.autoLeft > 0) {
      await scene.tw.wait(state.turbo ? 150 : 400);
      if (state.autoLeft > 0 && !state.busy) void play('spin');
    }
  }

  const resize = () => scene.resize(app.screen.width, app.screen.height);
  app.renderer.on('resize', resize);
  resize();
  refresh();
  /** Dev panel: search fresh rounds until one shows the requested feature, then play it. */
  const FORCE: Record<ForceKind, [RoundMode, (r: RoundResult) => boolean]> = {
    orbs: ['spin', (r) => r.base.orbMultiplier > 1 && !r.bonus],
    bigwin: ['spin', (r) => r.totalX >= 50 && !r.bonus],
    trigger: ['spin', (r) => r.bonus?.type === 'ritual'],
    retrigger: ['buy-ritual', (r) => !!r.bonus?.spins.some((s) => s.extraSpins > 0) && r.totalX > 50],
    maxwin: ['buy-rite', (r) => r.maxWinHit],
  };
  mountDevPanel((kind) => {
    if (state.busy) return;
    const [mode, pred] = FORCE[kind];
    const search = createRng();
    for (let i = 0; i < 3_000_000; i++) {
      const r = playRound(search, bet(), mode);
      if (pred(r)) return void play(mode, r);
    }
  });
  document.getElementById('loading')!.remove();
  window.addEventListener('pointerdown', () => synth.unlock(), { once: true });
}

void boot();
