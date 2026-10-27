/** All sound is synthesised with the Web Audio API: no audio files. */

export type SoundName =
  | 'spin' | 'reelStop' | 'scatter' | 'anticipation' | 'win' | 'bigWin' | 'orb' | 'orbMultiply'
  | 'ignite' | 'bonusIntro' | 'retrigger' | 'tick' | 'click' | 'maxWin';

export class Synth {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private droneGain!: GainNode;
  private droneFilter!: BiquadFilterNode;
  private droneOscs: OscillatorNode[] = [];
  private noiseBuffer!: AudioBuffer;
  private _muted = false;

  get muted() {
    return this._muted;
  }

  /** Must be called from a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this._muted ? 0 : 0.8;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.startDrone();
  }

  setMuted(m: boolean) {
    this._muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  /** Ambient: detuned low saws through a slowly breathing low-pass, plus wind. */
  private startDrone() {
    const ctx = this.ctx!;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.11;
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 260;
    this.droneFilter.Q.value = 6;
    this.droneFilter.connect(this.droneGain).connect(this.master);
    for (const [f, type] of [[55, 'sawtooth'], [55.6, 'sawtooth'], [82.4, 'triangle'], [27.5, 'sine']] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(this.droneFilter);
      o.start();
      this.droneOscs.push(o);
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(this.droneFilter.frequency);
    lfo.start();
    // wind
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 420;
    wf.Q.value = 0.8;
    const wg = ctx.createGain();
    wg.gain.value = 0.05;
    const wl = ctx.createOscillator();
    wl.frequency.value = 0.11;
    const wlg = ctx.createGain();
    wlg.gain.value = 260;
    wl.connect(wlg).connect(wf.frequency);
    wl.start();
    wind.connect(wf).connect(wg).connect(this.master);
    wind.start();
  }

  /** Raise the drone's tension during the bonus. */
  setBonusMood(on: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const ratio = on ? 1.189 : 1; // minor third up
    const base = [55, 55.6, 82.4, 27.5];
    this.droneOscs.forEach((o, i) => o.frequency.setTargetAtTime(base[i] * ratio, t, 0.8));
    this.droneGain.gain.setTargetAtTime(on ? 0.16 : 0.11, t, 0.5);
  }

  play(name: SoundName, opts: { pitch?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx || this._muted) return;
    const t = ctx.currentTime;
    const p = opts.pitch ?? 1;
    switch (name) {
      case 'spin':
        this.noise(t, 0.35, 'bandpass', 300, 2400, 0.25);
        break;
      case 'reelStop':
        this.tone(t, 'sine', 95, 45, 0.18, 0.5);
        this.noise(t, 0.05, 'highpass', 2000, 2000, 0.12);
        break;
      case 'scatter':
        for (const [f, g] of [[523.25, 0.25], [784, 0.15], [1046.5, 0.1], [1244.5, 0.06]] as const) {
          this.tone(t, 'sine', f * p, f * p, 1.4, g);
        }
        break;
      case 'anticipation':
        this.tone(t, 'sawtooth', 110, 220, 1.0, 0.07, 900);
        this.tone(t, 'sawtooth', 111, 222, 1.0, 0.07, 900);
        break;
      case 'win':
        [220, 261.6, 329.6, 440].forEach((f, i) => this.tone(t + i * 0.07, 'triangle', f * p, f * p, 0.5, 0.18));
        break;
      case 'bigWin':
        this.chord(t, [110, 164.8, 220, 261.6, 329.6], 3.2, 0.12);
        this.tone(t, 'sine', 55, 55, 3, 0.35);
        break;
      case 'orb':
        this.tone(t, 'sine', 70, 30, 0.6, 0.6);
        this.noise(t, 0.4, 'lowpass', 1200, 200, 0.3);
        this.tone(t + 0.05, 'sine', 1318 * p, 1318 * p, 0.6, 0.08);
        break;
      case 'orbMultiply':
        [329.6, 392, 493.9, 659.3, 784].forEach((f, i) => this.tone(t + i * 0.05, 'square', f, f, 0.25, 0.05, 2400));
        this.tone(t, 'sine', 60, 40, 0.8, 0.5);
        break;
      case 'ignite':
        this.noise(t, 0.3, 'lowpass', 300, 3000, 0.3);
        this.tone(t, 'triangle', 300 * p, 600 * p, 0.25, 0.12);
        break;
      case 'bonusIntro':
        this.chord(t, [73.4, 110, 146.8, 174.6, 220], 4, 0.14);
        this.tone(t, 'sine', 49, 49, 4, 0.4);
        this.noise(t, 2.5, 'bandpass', 200, 800, 0.15);
        break;
      case 'retrigger':
        [392, 523.3, 659.3].forEach((f, i) => this.tone(t + i * 0.09, 'triangle', f, f, 0.6, 0.2));
        break;
      case 'tick':
        this.tone(t, 'square', 1800 * p, 1800 * p, 0.03, 0.03, 4000);
        break;
      case 'click':
        this.tone(t, 'sine', 900, 600, 0.06, 0.12);
        break;
      case 'maxWin':
        this.chord(t, [130.8, 196, 261.6, 329.6, 392, 523.3], 5, 0.12);
        this.tone(t, 'sine', 65.4, 65.4, 5, 0.4);
        break;
    }
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, gain: number, lp?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      node = node.connect(f);
    }
    node.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, gain: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private chord(t: number, freqs: number[], dur: number, gain: number) {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.linearRampToValueAtTime(2200, t + dur * 0.3);
    f.frequency.linearRampToValueAtTime(500, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(g).connect(this.sfx);
    for (const fr of freqs) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = fr;
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
  }
}
