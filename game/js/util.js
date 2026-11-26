// Skyline Run — small shared helpers: seeded randomness, clamps and formatting.
// Everything here is deterministic: the same seed always builds the same valley.

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function degToRad(d) {
  return (d * Math.PI) / 180;
}

export function radToDeg(r) {
  return (r * 180) / Math.PI;
}

// Wrap an angle to [-PI, PI].
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// mulberry32: a tiny deterministic PRNG so the valley, rings and weather
// look identical on every load.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise in [-1, 1] from a seeded hash of integer cells.
export function makeNoise2D(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = base[i];
    base[i] = base[j];
    base[j] = tmp;
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  function hash(ix, iz) {
    return perm[(perm[ix & 255] + iz) & 255] / 255;
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  return function noise(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const a = hash(ix, iz);
    const b = hash(ix + 1, iz);
    const c = hash(ix, iz + 1);
    const d = hash(ix + 1, iz + 1);
    const u = smooth(fx);
    const v = smooth(fz);
    const val = lerp(lerp(a, b, u), lerp(c, d, u), v);
    return val * 2 - 1;
  };
}

export function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
}

export function formatFeet(meters) {
  return Math.round(meters * 3.28084).toLocaleString('en-US');
}

export function formatKnots(mps) {
  return Math.round(mps * 1.94384);
}

// A deterministic 32-bit hash of an integer cell, for stable per-cell
// choices (field colours, town blocks) that never change between frames.
export function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263) ^ (seed | 0);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
