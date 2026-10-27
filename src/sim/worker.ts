import type { RoundMode } from '../engine/types';
import { formatStats, simulate } from './simulate';

self.onmessage = (e: MessageEvent<{ mode: RoundMode; rounds: number }>) => {
  const { mode, rounds } = e.data;
  const t = performance.now();
  const stats = simulate(mode, rounds, undefined, (done) => self.postMessage({ progress: done / rounds }));
  const secs = ((performance.now() - t) / 1000).toFixed(1);
  self.postMessage({ done: true, text: `${formatStats(stats)}\ntime          ${secs}s` });
};
