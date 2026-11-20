// Tiny WebAudio synth for Neon Shores: engine hum, sirens, pickup blips
// and crash thuds. Everything is generated, no audio files. Safe to call
// before any user gesture: the context stays suspended until one happens.
let ctx = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenTimer = 0;

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(ctx.destination);
    sirenOsc.start();
  } catch (e) {
    ctx = null;
  }
}

// speed01: 0..1 of top speed. Sets the engine hum; call every frame.
export function setEngine(speed01, driving) {
  if (!ctx || !engineOsc) return;
  const target = driving ? 0.03 + speed01 * 0.05 : 0;
  engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
  engineOsc.frequency.setTargetAtTime(55 + speed01 * 160, ctx.currentTime, 0.08);
}

// wanted: current star count. The siren wails while the law is after you.
export function setSiren(wanted, now) {
  if (!ctx || !sirenOsc) return;
  if (wanted > 0) {
    sirenGain.gain.setTargetAtTime(0.02, ctx.currentTime, 0.1);
    if (now - sirenTimer > 0.45) {
      sirenTimer = now;
      const f = sirenOsc.frequency.value > 800 ? 660 : 920;
      sirenOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.05);
    }
  } else {
    sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  }
}

function blip(freq, dur, type, vol) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur + 0.02);
}

export function playPickup() { blip(880, 0.18, 'sine', 0.09); blip(1320, 0.22, 'sine', 0.06); }
export function playCash() { blip(1046, 0.12, 'triangle', 0.09); setTimeout(() => blip(1568, 0.2, 'triangle', 0.09), 90); }
export function playCrash() { blip(70, 0.25, 'sawtooth', 0.14); }
export function playBusted() { blip(220, 0.5, 'square', 0.08); }
export function playHorn() { blip(370, 0.15, 'square', 0.05); }
