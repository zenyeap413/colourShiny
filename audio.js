/* Procedural background music + stingers (Web Audio, no audio files).
   A sneaky comedy-detective loop in A minor with swing; 'tense' mode adds hi-hats,
   a kick and a ticking clock for the mixing / lineup screens. */
(function (root) {
  'use strict';

  const MUTE_KEY = 'cbLineup.muted';
  const BPM = 104;
  const STEP = 60 / BPM / 4;          // one 16th note in seconds
  const SWING = STEP * 0.33;          // delay for off-beat 8ths
  const LOOKAHEAD = 0.12;             // seconds scheduled ahead

  const N = (name) => {               // note name -> frequency, e.g. 'A4', 'D#3'
    const m = /^([A-G])(#?)(\d)$/.exec(name);
    const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] ? 1 : 0);
    return 440 * Math.pow(2, (semis + (Number(m[3]) - 4) * 12) / 12);
  };

  // 4 bars x 16 steps; arrays of [step, note]
  const BASS = [
    [[0, 'A2'], [4, 'E2'], [8, 'A2'], [12, 'C3']],
    [[0, 'D3'], [4, 'A2'], [8, 'D3'], [12, 'D#3']],
    [[0, 'E3'], [4, 'B2'], [8, 'E3'], [12, 'G#2']],
    [[0, 'A2'], [4, 'E2'], [8, 'A2'], [10, 'B2'], [12, 'C3'], [14, 'C#3']],
  ];
  const MELODY = [
    [[0, 'A4'], [2, 'C5'], [4, 'B4'], [6, 'A4'], [10, 'G#4'], [12, 'A4']],
    [[0, 'D5'], [2, 'C5'], [4, 'A4'], [8, 'F4'], [10, 'E4'], [12, 'D#4']],
    [[0, 'E4'], [2, 'G#4'], [4, 'B4'], [6, 'D5'], [8, 'C5'], [10, 'B4'], [12, 'G#4']],
    [[0, 'A4'], [4, 'E4'], [6, 'F4'], [7, 'F#4'], [8, 'G4'], [9, 'G#4'], [10, 'A4']],
  ];

  let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  let mode = 'calm', playing = false, step = 0, nextTime = 0, timerId = null;
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* storage unavailable */ }

  function ensure() {
    if (ctx) return true;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.42;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.7;
    sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  // ---------- instruments ----------
  function env(gainNode, t, peak, attack, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function tone(freq, t, { type = 'square', peak = 0.2, attack = 0.005, decay = 0.2, cutoff = 2400, dest = musicBus, glideTo = null } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + attack + decay);
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    env(g, t, peak, attack, decay);
    o.connect(f); f.connect(g); g.connect(dest);
    o.start(t); o.stop(t + attack + decay + 0.05);
  }
  function noise(t, { peak = 0.12, decay = 0.05, band = 8000, q = 1, type = 'highpass', dest = musicBus } = {}) {
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = noiseBuf;
    f.type = type; f.frequency.value = band; f.Q.value = q;
    env(g, t, peak, 0.002, decay);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t); s.stop(t + decay + 0.05);
  }
  function kick(t, dest = musicBus, peak = 0.5) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    env(g, t, peak, 0.002, 0.16);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.2);
  }

  // ---------- sequencer ----------
  function scheduleStep(s, t) {
    const bar = Math.floor(s / 16) % 4, i = s % 16;
    const swung = t + (i % 4 === 2 ? SWING : 0);
    for (const [st, n] of BASS[bar]) if (st === i) tone(N(n), swung, { type: 'triangle', peak: 0.42, decay: 0.28, cutoff: 900 });
    for (const [st, n] of MELODY[bar]) if (st === i) tone(N(n), swung, { type: 'square', peak: 0.075, decay: 0.12, cutoff: 2200 });
    // finger snaps on 2 and 4
    if (i === 4 || i === 12) noise(t, { peak: 0.16, decay: 0.06, band: 2600, q: 4, type: 'bandpass' });
    if (mode === 'tense') {
      if (i % 2 === 0) noise(swung, { peak: i % 4 === 0 ? 0.07 : 0.045, decay: 0.03 });
      if (i === 0 || i === 8) kick(t);
      if (i % 4 === 0) tone(1760, t, { type: 'sine', peak: 0.05, decay: 0.03, cutoff: 6000 }); // clock tick
    }
  }
  function tick() {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(step, nextTime);
      step = (step + 1) % 64;
      nextTime += STEP;
    }
  }

  // ---------- public API ----------
  function start() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (playing) return;
    playing = true;
    step = 0;
    nextTime = ctx.currentTime + 0.08;
    timerId = setInterval(tick, 25);
  }
  function setMode(m) { mode = m; }
  function stinger(win) {
    if (!ensure() || !playing) return;
    const t = ctx.currentTime + 0.05;
    // duck the loop under the stinger
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(0.42, t);
    musicBus.gain.linearRampToValueAtTime(0.08, t + 0.1);
    musicBus.gain.linearRampToValueAtTime(0.42, t + 2.6);
    if (win) {
      ['C5', 'E5', 'G5', 'C6'].forEach((n, k) => tone(N(n), t + k * 0.11, { type: 'square', peak: 0.16, decay: k === 3 ? 0.6 : 0.14, dest: master }));
      ['C4', 'G4'].forEach((n, k) => tone(N(n), t + 0.33 + k * 0.01, { type: 'triangle', peak: 0.2, decay: 0.7, dest: master }));
    } else {
      // sad trombone: three falling notes, the last one sagging
      [['D#4', 0, 0.32], ['D4', 0.38, 0.32], ['C#4', 0.76, 0.32]].forEach(([n, d, len]) =>
        tone(N(n), t + d, { type: 'sawtooth', peak: 0.16, attack: 0.03, decay: len, cutoff: 1200, dest: master }));
      tone(N('C4'), t + 1.14, { type: 'sawtooth', peak: 0.16, attack: 0.03, decay: 1.1, cutoff: 1100, dest: master, glideTo: N('A3') });
    }
  }
  // ---------- click sound effects ----------
  let lastSfx = 0;
  function sfx(name) {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime + 0.005;
    if (name === 'pick' && t - lastSfx < 0.06) return; // avoid machine-gun blips while dragging
    lastSfx = t;
    const o = { dest: sfxBus };
    switch (name) {
      case 'select':
        tone(660, t, { ...o, type: 'square', peak: 0.12, decay: 0.06, cutoff: 3000 });
        tone(990, t + 0.06, { ...o, type: 'square', peak: 0.12, decay: 0.09, cutoff: 3000 });
        break;
      case 'start':
        [523, 659, 784].forEach((f, k) => tone(f, t + k * 0.06, { ...o, type: 'square', peak: 0.12, decay: k === 2 ? 0.18 : 0.06, cutoff: 3200 }));
        break;
      case 'pick':
        tone(1400, t, { ...o, type: 'sine', peak: 0.12, decay: 0.05, cutoff: 6000 });
        break;
      case 'slot':
        tone(700, t, { ...o, type: 'triangle', peak: 0.25, decay: 0.12, cutoff: 3000 });
        tone(1400, t, { ...o, type: 'sine', peak: 0.06, decay: 0.06, cutoff: 6000 });
        break;
      case 'reroll':
        for (let k = 0; k < 5; k++) noise(t + k * 0.045 + Math.random() * 0.015, { ...o, peak: 0.2, decay: 0.025, band: 1800 + k * 300, q: 6, type: 'bandpass' });
        break;
      case 'submit':
        for (let k = 0; k < 2; k++) tone(700, t + k * 0.24, { ...o, type: 'square', peak: 0.1, attack: 0.01, decay: 0.2, cutoff: 2600, glideTo: 1150 });
        break;
      case 'arrest':
        tone(1500, t, { ...o, type: 'square', peak: 0.1, decay: 0.05, cutoff: 4000 });
        tone(1900, t + 0.07, { ...o, type: 'square', peak: 0.1, decay: 0.08, cutoff: 4000 });
        kick(t, sfxBus, 0.25);
        break;
      case 'unarrest':
        tone(900, t, { ...o, type: 'triangle', peak: 0.2, decay: 0.16, cutoff: 3000, glideTo: 450 });
        break;
      case 'confirm':
        kick(t, sfxBus, 0.6);
        noise(t, { ...o, peak: 0.3, decay: 0.09, band: 900, q: 1.5, type: 'bandpass' });
        tone(220, t, { ...o, type: 'triangle', peak: 0.25, decay: 0.2, cutoff: 1200 });
        break;
      default: // generic button click
        tone(1200, t, { ...o, type: 'square', peak: 0.08, decay: 0.035, cutoff: 3500 });
        noise(t, { ...o, peak: 0.05, decay: 0.015, band: 4000 });
    }
  }

  function isMuted() { return muted; }
  function setMuted(v) {
    muted = v;
    try { localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch (e) { /* storage unavailable */ }
    if (master) master.gain.setTargetAtTime(v ? 0 : 0.55, ctx.currentTime, 0.05);
  }

  const state = () => ({ ctx: ctx ? ctx.state : 'none', playing, mode, muted });
  root.Music = { start, setMode, stinger, sfx, isMuted, setMuted, state };
})(window);
