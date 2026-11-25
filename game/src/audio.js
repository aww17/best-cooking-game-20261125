// WebAudio synth sound effects, all built from oscillators and filtered noise: a pickup
// blip, a cooking sizzle loop, a bright serve ding, a wrong-serve buzz, a soft urgency tick
// and a game-over chime. Nothing is loaded from a file. The context is created or resumed
// only on a real user gesture (the browser's autoplay policy); in shot mode every call is
// guarded and the module stays silent, so a screenshot never needs audio.

export function createAudio(enabledStorage) {
  let ctx = null;
  let master = null;
  let sizzle = null;
  let muted = false;
  let shot = false;

  function ensure() {
    if (shot || !enabledStorage) return null;
    if (ctx === null) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.32;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(freq, duration, type, volume, when, slideTo) {
    const audio = ensure();
    if (audio === null || master === null) return;
    const at = audio.currentTime + (when ?? 0);
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(slideTo, at + duration);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  function whoosh(duration, volume, cutoff, when) {
    const audio = ensure();
    if (audio === null || master === null) return;
    const frames = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buffer = audio.createBuffer(1, frames, audio.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < frames; i += 1) {
      const white = Math.random() * 2 - 1;
      last = 0.85 * last + 0.15 * white;
      data[i] = last;
    }
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 0.9;
    const gain = audio.createGain();
    const at = audio.currentTime + (when ?? 0);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(at);
    source.stop(at + duration);
  }

  function stopSizzle() {
    if (sizzle === null) return;
    try {
      sizzle.source.stop();
      sizzle.source.disconnect();
      sizzle.gain.disconnect();
    } catch {
      // Already stopped: nothing to do.
    }
    sizzle = null;
  }

  return {
    setShotMode(value) {
      shot = value;
    },
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
      if (master !== null) master.gain.value = muted ? 0 : 0.32;
      if (muted) stopSizzle();
    },
    isMuted() {
      return muted;
    },
    blip() {
      if (muted || shot) return;
      tone(660, 0.09, 'sine', 0.5, 0, 960);
    },
    ding() {
      if (muted || shot) return;
      tone(880, 0.5, 'sine', 0.4, 0, 1320);
      tone(1320, 0.6, 'sine', 0.26, 0.06);
      tone(1760, 0.4, 'triangle', 0.13, 0.12);
    },
    buzz() {
      if (muted || shot) return;
      tone(150, 0.32, 'sawtooth', 0.38, 0, 88);
      tone(110, 0.32, 'square', 0.2, 0.02);
    },
    tick() {
      if (muted || shot) return;
      tone(1200, 0.05, 'square', 0.12, 0);
    },
    chime() {
      if (muted || shot) return;
      tone(523, 0.5, 'sine', 0.38, 0);
      tone(659, 0.5, 'sine', 0.34, 0.12);
      tone(784, 0.7, 'sine', 0.32, 0.24);
    },
    sizzleOn() {
      const audio = ensure();
      if (audio === null || shot || sizzle !== null) return;
      const frames = Math.floor(audio.sampleRate * 1.5);
      const buffer = audio.createBuffer(1, frames, audio.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < frames; i += 1) {
        const white = Math.random() * 2 - 1;
        last = 0.7 * last + 0.3 * white;
        data[i] = last * (0.5 + 0.5 * Math.sin((i / frames) * Math.PI));
      }
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = audio.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1800;
      const gain = audio.createGain();
      gain.gain.value = 0;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
      sizzle = { source, gain };
    },
    sizzleLevel(level) {
      if (sizzle === null) return;
      const now = sizzle.gain.context.currentTime;
      const target = Math.max(0, Math.min(0.13, level)) * (muted ? 0 : 1);
      sizzle.gain.gain.setTargetAtTime(target, now, 0.05);
    },
    sizzleOff() {
      stopSizzle();
    },
  };
}
