import type { RoundMode } from '../engine/types';
import { formatStats, simulate } from './simulate';

const rounds = Number(process.argv[2] ?? 1_000_000);
const modes = (process.argv[3]?.split(',') ?? ['spin', 'buy-ritual', 'buy-rite']) as RoundMode[];
const seed = process.argv[4] ? Number(process.argv[4]) : undefined;

for (const mode of modes) {
  const n = mode === 'spin' ? rounds : Math.max(1000, Math.round(rounds / 20));
  const t = performance.now();
  const stats = simulate(mode, n, seed);
  console.log(formatStats(stats));
  console.log(`time          ${((performance.now() - t) / 1000).toFixed(1)}s\n`);
}
