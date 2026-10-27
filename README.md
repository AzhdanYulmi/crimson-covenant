# Crimson Covenant

An original occult-horror 5x5 ways slot for personal, offline play (play money only).
All art and sound are generated in code.

## Run

```bash
npm install
npm run dev        # open http://localhost:5173
```

Controls: **Space** spins (and skips or speeds up the current round). Press **`** for the dev panel,
which can force rare outcomes (orb win, big win, retrigger, max win) and run the RTP simulator.

## Math

```bash
npm test                      # engine unit tests
npm run sim -- 10000000       # RTP / hit rate / bonus frequency for base game + both bonus buys
```

| | target | 10M-spin sim |
|---|---|---|
| Base game RTP | 96% | ~96.0–96.3% |
| Hit rate | ~25% | 25.8% |
| The Ritual (3 Grimoires) | | 1 in ~238 |
| The Dark Rite (4+ Grimoires) | | 1 in ~5,500 |
| Bonus buy RTP (100x / 300x) | 96% | ~95.6–96.1% |
| Max win | 10,000x | capped |

All tunables live in `src/math/config.ts` (paytable, reel strip specs, wild weights, scatter
rates, Blood Moon orbs, bonus rules). Rerun the simulator after any change.

## Layout

- `src/engine`: pure, seeded game logic (`playRound` returns the full round outcome)
- `src/math`: paytable, reel strips, feature config
- `src/render`: PixiJS scene, procedural textures, reel animation, effects
- `src/ui`: HTML HUD, modals, dev panel
- `src/audio`: Web Audio synth (ambient drone + SFX)
- `src/sim`: Monte Carlo simulator (CLI + web worker)
