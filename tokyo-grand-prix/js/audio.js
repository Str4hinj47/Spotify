// ---------------------------------------------------------------------------
// Fully synthesised audio: engine, skids, wall thunks, countdown, taiko-ish
// race drums, lap dings and a finish fanfare. No assets needed.
// ---------------------------------------------------------------------------
export class RaceAudio {
  constructor() {
    this.ok = false;
    this.muted = false;
    this.drumsOn = false;
    this.beat = 0;
  }

  init() {
    if (this.ok) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);

    // engine: saw + detuned square through a lowpass
    this.eGain = ctx.createGain(); this.eGain.gain.value = 0;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 700; this.lp.Q.value = 1.2;
    this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth'; this.o1.frequency.value = 60;
    this.o2 = ctx.createOscillator(); this.o2.type = 'square'; this.o2.frequency.value = 62;
    const g2 = ctx.createGain(); g2.gain.value = 0.4;
    this.o1.connect(this.lp);
    this.o2.connect(g2); g2.connect(this.lp);
    this.lp.connect(this.eGain); this.eGain.connect(this.master);
    this.o1.start(); this.o2.start();

    // skid: looped noise through a bandpass
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.skid = ctx.createBufferSource(); this.skid.buffer = nb; this.skid.loop = true;
    this.skidF = ctx.createBiquadFilter(); this.skidF.type = 'bandpass'; this.skidF.frequency.value = 850; this.skidF.Q.value = 0.7;
    this.skidG = ctx.createGain(); this.skidG.gain.value = 0;
    this.skid.connect(this.skidF); this.skidF.connect(this.skidG); this.skidG.connect(this.master);
    this.skid.start();

    this.ok = true;
  }

  engine(ratio, throttle, drifting) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const rev = 52 + ratio * 190 + Math.sin(t * 27) * 2.5 * ratio;
    this.o1.frequency.setTargetAtTime(rev, t, 0.04);
    this.o2.frequency.setTargetAtTime(rev * 1.5 + 3, t, 0.04);
    this.lp.frequency.setTargetAtTime(420 + ratio * 2300 + throttle * 500, t, 0.06);
    this.eGain.gain.setTargetAtTime(0.028 + ratio * 0.05 + throttle * 0.035, t, 0.08);
    this.skidG.gain.setTargetAtTime(drifting && ratio > 0.15 ? 0.10 * ratio : 0, t, 0.05);
  }

  engineOff() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.eGain.gain.setTargetAtTime(0, t, 0.1);
    this.skidG.gain.setTargetAtTime(0, t, 0.05);
  }

  _blip(f, dur, type, vol, when = 0) {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  countBeep() { this._blip(392, 0.22, 'square', 0.35); }
  goBeep() { this._blip(784, 0.55, 'square', 0.4); this._blip(988, 0.5, 'square', 0.2, 0.02); }
  lapDing() { this._blip(880, 0.14, 'sine', 0.4); this._blip(1174, 0.3, 'sine', 0.35, 0.13); }
  finalLap() {
    [880, 1046, 1174].forEach((f, i) => this._blip(f, 0.16, 'triangle', 0.35, i * 0.13));
  }
  fanfare() {
    const seq = [523, 659, 784, 1046, 784, 1046, 1318];
    seq.forEach((f, i) => this._blip(f, 0.28, 'triangle', 0.4, i * 0.16));
  }
  thunk(impact) {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.4, impact * 0.02), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random()); src.stop(t + 0.18);
  }

  // taiko-flavoured beat: kicks + hats, low in the mix
  startDrums() {
    if (!this.ok || this.drumsOn) return;
    this.drumsOn = true;
    this.beat = 0;
    this._drumInt = setInterval(() => {
      if (this.muted) return;
      const b = this.beat++ % 8;
      if (b === 0 || b === 3 || b === 5) this._kick();
      if (b % 2 === 0) this._hat();
      if (b === 7) this._kick(0.6);
    }, 250);
  }
  stopDrums() {
    this.drumsOn = false;
    if (this._drumInt) clearInterval(this._drumInt);
  }
  _kick(v = 1) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    g.gain.setValueAtTime(0.30 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.2);
  }
  _hat() {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random()); src.stop(t + 0.07);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ok) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}
