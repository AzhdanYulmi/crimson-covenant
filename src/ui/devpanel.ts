export type ForceKind = 'orbs' | 'bigwin' | 'trigger' | 'retrigger' | 'maxwin';

const FORCE_LABELS: Record<ForceKind, string> = {
  orbs: 'Orb win', bigwin: 'Big win', trigger: 'Ritual trigger', retrigger: 'Retrigger', maxwin: 'Max win',
};

/**
 * Press ` to open. Runs the RTP simulator in a worker so the game keeps running,
 * and can force rare outcomes for testing (still charged at the normal cost).
 */
export function mountDevPanel(force: (kind: ForceKind) => void) {
  const el = document.createElement('div');
  el.className = 'dev';
  el.innerHTML = `
    <h4>FORCE NEXT ROUND</h4>
    <div class="controls force">${Object.entries(FORCE_LABELS).map(([k, l]) => `<button data-force="${k}">${l}</button>`).join('')}</div>
    <h4>RTP SIMULATOR</h4>
    <div class="controls sim">
      <select><option value="spin">Base game</option><option value="buy-ritual">Buy Ritual</option><option value="buy-rite">Buy Dark Rite</option></select>
      <input type="number" value="1000000" min="1000" step="100000">
      <button data-run>Run</button>
    </div>
    <progress max="1" value="0"></progress>
    <pre>Press Run. Rounds are played at 1x bet.</pre>`;
  document.body.appendChild(el);
  const select = el.querySelector('select')!;
  const input = el.querySelector('input')!;
  const button = el.querySelector<HTMLButtonElement>('[data-run]')!;
  const progress = el.querySelector('progress')!;
  const out = el.querySelector('pre')!;
  let worker: Worker | null = null;

  button.onclick = () => {
    worker?.terminate();
    worker = new Worker(new URL('../sim/worker.ts', import.meta.url), { type: 'module' });
    out.textContent = 'running…';
    progress.value = 0;
    worker.onmessage = (e) => {
      if (e.data.progress !== undefined) progress.value = e.data.progress;
      if (e.data.done) {
        progress.value = 1;
        out.textContent = e.data.text;
        worker?.terminate();
        worker = null;
      }
    };
    worker.postMessage({ mode: select.value, rounds: Math.max(1000, Number(input.value) || 1000) });
  };

  el.querySelectorAll<HTMLButtonElement>('[data-force]').forEach((b) => {
    b.onclick = () => force(b.dataset.force as ForceKind);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === '`') el.classList.toggle('open');
  });
}
