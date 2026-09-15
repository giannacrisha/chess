/**
 * gichess — the sound of a piece going down.
 *
 * The sounds are synthesised in the browser rather than downloaded. A wooden
 * knock is a short burst of noise over a quick pitch-dropping thump, which the
 * Web Audio API can make from nothing in about twenty lines. That means no
 * audio files to fetch, nothing to go stale in a cache, and it works offline.
 *
 * Nothing makes a sound until the visitor has interacted with the page — both
 * because browsers refuse to allow it, and because it would be rude.
 */

const STORAGE_KEY = 'gichess-sound';

export class Sound {
  constructor() {
    this.enabled = this.readPreference();
    this.ctx = null;
    this.noise = null;
  }

  readPreference() {
    try {
      // On by default. Silence should be something you choose.
      return localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch (e) { return true; }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    try { localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off'); } catch (e) { /* fine */ }
    if (enabled) this.wake();
  }

  /** Build the audio machinery. Only ever called from inside a real click. */
  wake() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    this.ctx = new AudioContextClass();

    // A quarter-second of white noise, reused for every knock.
    const frames = Math.floor(this.ctx.sampleRate * 0.25);
    this.noise = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    return this.ctx;
  }

  /**
   * One knock: a short thump with a click of noise on top of it.
   * Lower and longer reads as heavier — which is how a capture is told apart
   * from a quiet move without either of them being a different instrument.
   */
  knock({ pitch, decay, click, level }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(pitch * 2.4, now);
    body.frequency.exponentialRampToValueAtTime(pitch, now + 0.035);

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(level, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    body.connect(bodyGain).connect(ctx.destination);
    body.start(now);
    body.stop(now + decay + 0.02);

    const tap = ctx.createBufferSource();
    tap.buffer = this.noise;

    // Wood is mostly midrange; filtering the noise is what stops it sounding
    // like static.
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = pitch * 9;
    filter.Q.value = 1.1;

    const tapGain = ctx.createGain();
    tapGain.gain.setValueAtTime(click, now);
    tapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    tap.connect(filter).connect(tapGain).connect(ctx.destination);
    tap.start(now);
    tap.stop(now + 0.09);
  }

  /** A clear two-note figure, so check is never mistaken for an ordinary move. */
  chime(notes, level = 0.13) {
    const ctx = this.ctx;
    if (!ctx) return;
    notes.forEach((hz, index) => {
      const at = ctx.currentTime + index * 0.11;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(hz, at);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(level, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.38);
    });
  }

  /** @param {'move'|'capture'|'check'|'end'} kind */
  play(kind) {
    if (!this.enabled || !this.wake()) return;
    switch (kind) {
      case 'move':    return this.knock({ pitch: 190, decay: 0.09, click: 0.16, level: 0.22 });
      case 'capture': return this.knock({ pitch: 125, decay: 0.16, click: 0.30, level: 0.34 });
      case 'check':   return this.chime([740, 988]);
      case 'end':     return this.chime([588, 494, 392], 0.15);
    }
  }
}
