// Skyline Run — sound, synthesised live with WebAudio. No audio files:
// the engine is oscillators, the wind is filtered noise, the chimes are
// little sine arpeggios. Silent until the first gesture, as browsers ask.

import { clamp } from './util.js';

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    windFilter: null,
    muted: false,
    started: false,
  };

  audio.ensure = function ensure() {
    if (audio.started) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = audio.muted ? 0 : 0.5;
      audio.master.connect(audio.ctx.destination);

      // Engine: two detuned saws through a low-pass, pitch follows throttle.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      audio.engineOsc2 = audio.ctx.createOscillator();
      audio.engineOsc2.type = 'sawtooth';
      audio.engineOsc2.frequency.value = 83;
      const engineFilter = audio.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineOsc.connect(engineFilter);
      audio.engineOsc2.connect(engineFilter);
      engineFilter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      audio.engineOsc2.start();

      // Wind: looped noise through a band-pass, loud when fast.
      const len = audio.ctx.sampleRate * 2;
      const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      audio.windSource = audio.ctx.createBufferSource();
      audio.windSource.buffer = buffer;
      audio.windSource.loop = true;
      audio.windFilter = audio.ctx.createBiquadFilter();
      audio.windFilter.type = 'bandpass';
      audio.windFilter.frequency.value = 500;
      audio.windGain = audio.ctx.createGain();
      audio.windGain.gain.value = 0;
      audio.windSource.connect(audio.windFilter);
      audio.windFilter.connect(audio.windGain);
      audio.windGain.connect(audio.master);
      audio.windSource.start();

      audio.started = true;
      // A short starter-motor rev so the first frame of sound is the engine.
      audio.tone(90, audio.ctx.currentTime, 0.5, 'sawtooth', 0.12);
      audio.tone(135, audio.ctx.currentTime + 0.15, 0.5, 'sawtooth', 0.1);
      return true;
    } catch (err) {
      return false;
    }
  };

  // Call every frame while flying: engine and wind follow the plane.
  audio.update = function update(plane) {
    if (!audio.started || !audio.ctx) return;
    const t = audio.ctx.currentTime;
    const rpm = 50 + plane.throttle * 75 + plane.speed * 0.35;
    audio.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    audio.engineOsc2.frequency.setTargetAtTime(rpm * 1.5 + 2, t, 0.08);
    const engineLevel = plane.onGround && plane.speed < 2 && plane.throttle < 0.05
      ? 0 : 0.05 + plane.throttle * 0.09;
    audio.engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
    const windLevel = clamp((plane.speed - 15) / 90, 0, 1) * 0.12;
    audio.windGain.gain.setTargetAtTime(windLevel, t, 0.15);
    audio.windFilter.frequency.setTargetAtTime(300 + plane.speed * 9, t, 0.15);
  };

  audio.tone = function tone(freq, at, dur, type, vol) {
    if (!audio.started || !audio.ctx) return;
    const osc = audio.ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(vol || 0.22, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  };

  audio.ringChime = function ringChime() {
    if (!audio.started) return;
    const t = audio.ctx.currentTime;
    audio.tone(660, t, 0.35, 'sine', 0.25);
    audio.tone(990, t + 0.09, 0.4, 'sine', 0.22);
  };

  audio.landThud = function landThud() {
    if (!audio.started) return;
    const t = audio.ctx.currentTime;
    audio.tone(70, t, 0.3, 'sine', 0.4);
    audio.tone(140, t, 0.18, 'triangle', 0.2);
  };

  audio.crashSound = function crashSound() {
    if (!audio.started) return;
    const t = audio.ctx.currentTime;
    audio.tone(55, t, 0.7, 'sawtooth', 0.35);
    audio.tone(38, t + 0.1, 0.8, 'sine', 0.4);
  };

  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.master) {
      audio.master.gain.setTargetAtTime(audio.muted ? 0 : 0.5, audio.ctx.currentTime, 0.05);
    }
    return audio.muted;
  };

  return audio;
}
