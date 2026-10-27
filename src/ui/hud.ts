import { BONUS, PAYTABLE, Sym, SYMBOL_NAMES, type BonusType } from '../math/config';
import { SYMBOL_ORDER_FOR_PAYTABLE } from '../render/textures';
import { fmt } from '../render/scene';

const ICON = {
  spin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  turbo: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 2l3 3-3 3"/><path d="M3 11V9a4 4 0 0 1 4-4h13"/><path d="M7 22l-3-3 3-3"/><path d="M21 13v2a4 4 0 0 1-4 4H4"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
};

export interface HudHandlers {
  spin(): void;
  bet(delta: number): void;
  turbo(): void;
  autoplay(count: number): void;
  stopAutoplay(): void;
  buy(type: BonusType): void;
  mute(): void;
  refill(): void;
}

export class Hud {
  private el: Record<string, HTMLElement> = {};
  private busy = false;
  private autoLeft = 0;
  private balance = 0;
  private bet = 1;

  constructor(root: HTMLElement, h: HudHandlers, private symbolUrls: string[]) {
    root.innerHTML = `
      <div class="bar">
        <div class="group left">
          <button class="icon-btn" data-k="info" title="Paytable & rules">${ICON.info}</button>
          <button class="icon-btn" data-k="sound" title="Sound">${ICON.soundOn}</button>
          <div class="stat"><span class="k">BALANCE</span><span class="v" data-k="balance"></span></div>
          <button class="buy" data-k="buy">BUY BONUS</button>
        </div>
        <div class="group center">
          <button class="icon-btn" data-k="auto" title="Autoplay">${ICON.auto}</button>
          <button class="spin" data-k="spin" title="Spin (space)">${ICON.spin}</button>
          <button class="icon-btn" data-k="turbo" title="Turbo">${ICON.turbo}</button>
        </div>
        <div class="group right">
          <div class="stat win"><span class="k">WIN</span><span class="v" data-k="win">0.00</span></div>
          <div class="bet">
            <button class="icon-btn" data-k="betDown">−</button>
            <div class="stat"><span class="k">BET</span><span class="v" data-k="bet"></span></div>
            <button class="icon-btn" data-k="betUp">+</button>
          </div>
        </div>
      </div>
      <div class="modal" data-k="buyModal"><div class="card">
        <button class="close">×</button>
        <h2>BUY BONUS</h2><p class="sub">Skip straight to the free spins</p>
        <div class="offers">
          <button class="offer" data-k="buyRitual"><div class="t">THE RITUAL</div>
            <div class="d">${BONUS.ritual.spins} free spins<br>multiplier x${BONUS.ritual.startMult}, +${BONUS.ritual.step} per win</div>
            <div class="p" data-k="ritualPrice"></div></button>
          <button class="offer" data-k="buyRite"><div class="t">THE DARK RITE</div>
            <div class="d">${BONUS.rite.spins} free spins<br>multiplier x${BONUS.rite.startMult}, +${BONUS.rite.step} per win</div>
            <div class="p" data-k="ritePrice"></div></button>
        </div>
      </div></div>
      <div class="modal" data-k="autoModal"><div class="card" style="max-width:420px">
        <button class="close">×</button>
        <h2>AUTOPLAY</h2><p class="sub">Stops automatically when a bonus triggers</p>
        <div class="chips">${[10, 25, 50, 100].map((n) => `<button class="chip" data-auto="${n}">${n}</button>`).join('')}</div>
      </div></div>
      <div class="modal" data-k="creditModal"><div class="card" style="max-width:420px;text-align:center">
        <h2>THE OFFERING IS SPENT</h2><p class="sub">Not enough credits for this bet.</p>
        <div class="chips"><button class="chip" data-k="refill" style="padding:0 20px">REFILL 1,000</button></div>
      </div></div>
      <div class="modal" data-k="infoModal"><div class="card">
        <button class="close">×</button>
        <h2>PAYTABLE</h2><p class="sub" data-k="paySub"></p>
        <div class="pays" data-k="pays"></div>
        <div class="rules">${this.rulesHtml()}</div>
      </div></div>`;
    root.querySelectorAll<HTMLElement>('[data-k]').forEach((e) => (this.el[e.dataset.k!] = e));

    this.el.spin.onclick = () => (this.autoLeft > 0 ? h.stopAutoplay() : h.spin());
    this.el.betDown.onclick = () => h.bet(-1);
    this.el.betUp.onclick = () => h.bet(1);
    this.el.turbo.onclick = () => h.turbo();
    this.el.sound.onclick = () => h.mute();
    this.el.auto.onclick = () => (this.autoLeft > 0 ? h.stopAutoplay() : this.open('autoModal'));
    this.el.buy.onclick = () => this.open('buyModal');
    this.el.info.onclick = () => {
      this.renderPays();
      this.open('infoModal');
    };
    this.el.buyRitual.onclick = () => {
      this.closeAll();
      h.buy('ritual');
    };
    this.el.buyRite.onclick = () => {
      this.closeAll();
      h.buy('rite');
    };
    this.el.refill.onclick = () => {
      this.closeAll();
      h.refill();
    };
    root.querySelectorAll<HTMLElement>('[data-auto]').forEach((b) => (b.onclick = () => {
      this.closeAll();
      h.autoplay(Number(b.dataset.auto));
    }));
    root.querySelectorAll<HTMLElement>('.modal').forEach((m) => {
      m.addEventListener('click', (e) => {
        if (e.target === m || (e.target as HTMLElement).classList.contains('close')) this.closeAll();
      });
    });
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || this.anyOpen()) return;
      e.preventDefault();
      this.el.spin.click();
    });
  }

  private open(k: string) {
    if (this.busy) return;
    if (k === 'buyModal') {
      const r = this.bet * BONUS.ritual.buyCost, d = this.bet * BONUS.rite.buyCost;
      this.el.ritualPrice.textContent = fmt(r);
      this.el.ritePrice.textContent = fmt(d);
      (this.el.buyRitual as HTMLButtonElement).disabled = r > this.balance + 1e-9;
      (this.el.buyRite as HTMLButtonElement).disabled = d > this.balance + 1e-9;
    }
    this.el[k].classList.add('open');
  }

  private anyOpen() {
    return !!document.querySelector('.modal.open');
  }

  closeAll() {
    document.querySelectorAll('.modal.open').forEach((m) => m.classList.remove('open'));
  }

  showOutOfCredits() {
    this.closeAll();
    this.el.creditModal.classList.add('open');
  }

  setBalance(v: number) {
    this.balance = v;
    this.el.balance.textContent = fmt(v);
  }

  setWin(v: number) {
    this.el.win.textContent = fmt(v);
  }

  setBet(v: number, atMin: boolean, atMax: boolean) {
    this.bet = v;
    this.el.bet.textContent = fmt(v);
    (this.el.betDown as HTMLButtonElement).disabled = atMin || this.busy;
    (this.el.betUp as HTMLButtonElement).disabled = atMax || this.busy;
  }

  setTurbo(on: boolean) {
    this.el.turbo.classList.toggle('on', on);
  }

  setMuted(m: boolean) {
    this.el.sound.innerHTML = m ? ICON.soundOff : ICON.soundOn;
    this.el.sound.classList.toggle('on', !m);
  }

  /** Busy = a round is playing. Bet, buy and autoplay menus lock; spin hurries the round. */
  setBusy(busy: boolean, autoLeft: number) {
    this.busy = busy;
    this.autoLeft = autoLeft;
    const spin = this.el.spin;
    spin.classList.toggle('busy', busy && autoLeft === 0);
    spin.classList.toggle('auto', autoLeft > 0);
    spin.innerHTML = autoLeft > 0 ? String(autoLeft) : ICON.spin;
    this.el.auto.classList.toggle('on', autoLeft > 0);
    for (const k of ['betDown', 'betUp', 'buy', 'info']) (this.el[k] as HTMLButtonElement).disabled = busy;
  }

  private renderPays() {
    this.el.paySub.textContent = `Values per way at your bet of ${fmt(this.bet)}`;
    this.el.pays.innerHTML = SYMBOL_ORDER_FOR_PAYTABLE.map((s) => {
      const p = PAYTABLE[s];
      const row = (n: number, v: number) => `<b>${n}</b> ${fmt(v * this.bet)}`;
      return `<div class="pay" title="${SYMBOL_NAMES[s]}"><img src="${this.symbolUrls[s]}" alt="${SYMBOL_NAMES[s]}">
        <div>${row(5, p[2])}<br>${row(4, p[1])}<br>${row(3, p[0])}</div></div>`;
    }).join('');
  }

  private rulesHtml() {
    return `
      <h3>3,125 WAYS</h3>
      <p>Wins pay for 3 or more matching symbols on adjacent reels from the leftmost reel, in any row.
      Each combination counts as a separate way, so stacked symbols multiply the win.</p>
      <div class="row"><img src="${this.symbolUrls[Sym.WILD]}" alt=""><p><b>ALL-SEEING EYE</b>: wild on reels 2–5, substitutes for every symbol except the Grimoire.</p></div>
      <div class="row"><img src="${this.symbolUrls[Sym.SCATTER]}" alt=""><p><b>GRIMOIRE</b>: 3 trigger THE RITUAL (${BONUS.ritual.spins} spins, x${BONUS.ritual.startMult} +${BONUS.ritual.step} per winning spin).
      4 or more trigger THE DARK RITE (${BONUS.rite.spins} spins, x${BONUS.rite.startMult} +${BONUS.rite.step} per winning spin).
      2 in free spins award +${BONUS.retriggerSpins} spins. The multiplier never resets during the bonus.</p></div>
      <h3>BLOOD MOON</h3>
      <p>On any base spin the moon may rise and drop 1–3 sigil orbs (x2 to x100). If the spin wins, the orb values are added together and multiply the win.</p>
      <h3>MAX WIN</h3>
      <p>10,000x the bet. The round ends immediately when it is reached. Theoretical RTP ≈ 96.3%. Play money only.</p>`;
  }
}
