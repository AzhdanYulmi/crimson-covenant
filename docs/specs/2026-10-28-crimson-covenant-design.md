# Crimson Covenant — original occult-horror slot (design + build plan)

## Context
The user wants a personal, offline casino slot with the look and feel of a Hacksaw Gaming title (gritty, dark, high volatility, punchy minimal UI). It is an **original game**, not a clone of "Dark Spiral": its own name, symbols, theme and features. Play money only. The project folder `/Users/azhdanyulmi/Desktop/captain claw` is empty, so everything is greenfield.

Decisions from the user:
- Browser app: Vite + TypeScript + PixiJS, run locally
- Theme: occult / cult horror (candles, sigils, masked cultists, blood-red/black)
- Mechanic: 5x5 ways-to-win grid with a growing multiplier in the bonus
- Art and sound generated in code (no external assets)
- High volatility, 10,000x max win, target RTP ~96%
- Extras: bonus buy, autoplay + turbo, Web Audio sound/music, RTP simulator panel
- Balance: 1,000 credits, reset on every load (no persistence)

## Game design
**Grid:** 5 reels x 5 rows = 3,125 ways. Wins pay left to right for 3+ adjacent reels; the payout is paytable × number of ways × bet.

**Symbols (all drawn with Pixi Graphics, plus glow/filters):**
- Low: 4 carved rune stones (ash, bone, rust, moss)
- High: Black Candle, Ritual Dagger, Blood Chalice, Masked Cultist (top)
- Wild "All-Seeing Eye": reels 2–5, substitutes for everything except Scatter
- Scatter "Grimoire": any reel

**Base game, "Blood Moon" modifier:** on about 1 in 60 spins, 1–3 Sigil Orbs land on top of the grid. Each carries a multiplier (2x–100x). If the spin wins, the orbs' values are added together and the total multiplies that spin's win.

**Free spins:**
- 3 Grimoires → **The Ritual**: 10 spins. A global multiplier starts at 1x and rises by +1 after every winning spin. It never resets during the bonus.
- 4+ Grimoires → **The Dark Rite**: 12 spins. The multiplier starts at 3x and rises by +2 per win.
- 2 Grimoires during the bonus → +3 spins (retrigger).
- The multiplier meter is shown as a spiralling ring of candles that ignite as it grows (an original visual).
- Total win is capped at 10,000x the bet; when the cap is reached the round ends with a "MAX WIN" screen.

**Bonus buy:** The Ritual for 100x the bet; The Dark Rite for 300x.

**UI (Hacksaw-style minimal):** a bottom bar with balance, bet −/+ (0.10–100), a big spin button, turbo toggle, autoplay (10/25/50/100, stop on bonus), bonus buy, and a sound toggle. Win counters roll up; big/mega/epic win tiers at 10x/50x/200x. A dev panel opens with `` ` ``.

## Architecture
Keep the math engine pure and deterministic, completely separate from rendering. The simulator and the tests reuse it.

```
src/
  engine/   rng.ts (seeded PRNG), reels.ts (strip spin), evaluate.ts (ways),
            features.ts (orbs, free spins, multiplier), spin.ts (→ SpinResult)
  math/     config.ts (paytable, reel strips base/fs, weights, caps)
  render/   app.ts (Pixi setup), symbols.ts (procedural symbol textures),
            grid.ts (reel spin/stop anims), effects.ts (win lines, particles,
            candle meter, big-win screens), background.ts
  ui/       hud.ts (HTML/CSS overlay controls), state.ts (balance, bet, autoplay)
  audio/    synth.ts (Web Audio drone, spin ticks, win stingers)
  sim/      simulate.ts (shared), worker.ts (browser dev panel), cli.ts (node)
tests/      evaluate.test.ts, features.test.ts, spin.test.ts (Vitest)
```

Flow: the HUD's spin button calls `engine.spin(bet, state)`, which returns a complete `SpinResult` (grid, wins, orbs, feature events, total). The renderer plays the result back as animation. Game outcomes never depend on rendering.

## Build steps
1. Scaffold Vite + TS + PixiJS v8 + Vitest; write the spec to `docs/specs/2026-10-28-crimson-covenant-design.md`.
2. Engine: seeded RNG, reel strips, ways evaluator (TDD), features, and `spin()`.
3. Simulator CLI (`npm run sim -- 10000000`). Tune the reel strips and orb weights to RTP 96% ±0.3%, a hit rate around 25%, and free spins about 1 in 200 (bonus buys tuned so each is close to 96% too).
4. Renderer: background, procedural symbols, reel spin/stop animations, win highlights.
5. Feature visuals: Blood Moon orbs, bonus intro, candle-spiral multiplier, big-win and max-win screens.
6. HUD: bet, balance, autoplay, turbo, bonus buy, sound toggle; dev panel with the simulator running in a worker.
7. Audio synth, then a polish pass.

## Verification
- `npm test`: evaluator and feature unit tests pass.
- `npm run sim -- 10000000`: reports RTP, hit rate, bonus frequency and max win, all inside the targets above.
- `npm run dev`, then play in the built-in browser pane: base spins, a forced bonus via bonus buy, retrigger, max-win cap, autoplay stopping on a bonus, and turbo. Check there are no console errors.
