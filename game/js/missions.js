// Skyline Run — the four sorties. Each mission is a route of glowing rings
// over the same valley, with its own goal, scoring and briefing text.

import { mulberry32 } from './util.js';

// A ring the pilot must fly through: a world position, a height and a radius.
export function makeRing(x, y, z, radius) {
  return { x, y, z, radius, passed: false, faceAngle: 0 };
}

export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    short: 'Fly all 8 rings over the valley',
    tip: 'Tip: trim the throttle to cruise and bank gently — the rings reward smooth lines.',
    timeLimit: 0,
    wind: 0,
    sunset: false,
    par: { S: 1650, A: 1350, B: 1050 },
    briefing: 'Eight rings hang over the valley. Thread them all, in order,',
    briefing2: 'and mind your fuel — a dead stick landing still counts.',
    start: { x: 0, z: -610, alt: 0, heading: 0, speed: 0, throttle: 0 },
    buildRings() {
      const rand = mulberry32(9001);
      const rings = [];
      let x = 0;
      let z = -200;
      let heading = 0;
      for (let i = 0; i < 8; i++) {
        heading += (rand() - 0.5) * 0.9;
        const dist = 420 + rand() * 260;
        x += Math.sin(heading) * dist;
        z += Math.cos(heading) * dist;
        x = Math.max(-900, Math.min(900, x));
        z = Math.max(-1200, Math.min(1500, z));
        rings.push(makeRing(x, 90 + rand() * 130, z, 20));
      }
      return rings;
    },
  },
  {
    id: 'valley-dash',
    name: 'Valley Dash',
    short: '10 rings against a 2:30 clock',
    tip: 'Tip: full throttle on the straights, and cut the corners — the clock pays 5 points a second.',
    timeLimit: 150,
    wind: 0.35,
    sunset: false,
    par: { S: 2300, A: 1900, B: 1450 },
    briefing: 'Ten rings, two and a half minutes. Full throttle, clean lines,',
    briefing2: 'and every second left on the clock is worth 5 points.',
    start: { x: 0, z: -610, alt: 0, heading: 0, speed: 0, throttle: 0 },
    buildRings() {
      const rand = mulberry32(4242);
      const rings = [];
      let x = 0;
      let z = -100;
      let heading = 0.2;
      for (let i = 0; i < 10; i++) {
        heading += (rand() - 0.5) * 1.1;
        const dist = 380 + rand() * 220;
        x += Math.sin(heading) * dist;
        z += Math.cos(heading) * dist;
        x = Math.max(-1000, Math.min(1000, x));
        z = Math.max(-1300, Math.min(1600, z));
        rings.push(makeRing(x, 80 + rand() * 150, z, 18));
      }
      return rings;
    },
  },
  {
    id: 'runway-return',
    name: 'Runway Return',
    short: 'Take off, thread 3 rings, land back on the strip',
    tip: 'Tip: land slow and on the centreline — a gentle runway touchdown is worth 250 plus your fuel.',
    timeLimit: 0,
    wind: 0,
    sunset: false,
    par: { S: 800, A: 680, B: 540 },
    briefing: 'Take off from Runway 36, thread the three guide rings, then',
    briefing2: 'bring her home: gentle, slow, on the centreline. Gear down!',
    start: { x: 0, z: -610, alt: 0, heading: 0, speed: 0, throttle: 0 },
    buildRings() {
      return [
        makeRing(120, 150, 100, 22),
        makeRing(-260, 220, 620, 22),
        makeRing(-60, 130, 300, 22),
      ];
    },
    needsLanding: true,
  },
  {
    id: 'storm-ridge',
    name: 'Storm Ridge',
    short: '7 tight rings in gusting wind, 2:00 clock',
    tip: 'Tip: the gusts shove you sideways — crab into them, aim upwind of each ring, and keep the combo alive.',
    timeLimit: 120,
    wind: 1,
    sunset: true,
    par: { S: 1700, A: 1400, B: 1050 },
    briefing: 'A storm front is rolling over the ridge at golden hour. Seven',
    briefing2: 'tight rings, a short clock, and a crosswind with teeth. Good luck.',
    start: { x: 0, z: -610, alt: 0, heading: 0, speed: 0, throttle: 0 },
    buildRings() {
      const rand = mulberry32(777);
      const rings = [];
      let x = 0;
      let z = -200;
      let heading = 0.3;
      for (let i = 0; i < 7; i++) {
        heading += (rand() - 0.5) * 1.3;
        const dist = 300 + rand() * 120;
        x += Math.sin(heading) * dist;
        z += Math.cos(heading) * dist;
        x = Math.max(-1000, Math.min(1000, x));
        z = Math.max(-1200, Math.min(1700, z));
        rings.push(makeRing(x, 120 + rand() * 160, z, 14));
      }
      return rings;
    },
  },
];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}

// Points for a ring: base plus a bonus for keeping speed up through it.
export function ringPoints(plane) {
  return 100 + Math.round(plane.speed);
}

// Points for a landing: base plus what is left in the tanks.
export function landingPoints(plane, onRunway) {
  const base = onRunway ? 250 : 60;
  return base + Math.round(plane.fuel);
}

// Combo scoring: consecutive clean rings build a multiplier. The first
// ring of a streak pays ×1, each next one adds ×0.25, capped at ×3.
// A crash breaks the streak back to zero.
export function comboMultiplier(combo) {
  if (combo <= 1) return 1;
  return Math.min(3, 1 + 0.25 * (combo - 1));
}

// Score one ring pass. `dist` is the 3D distance from the ring centre at
// the moment of the pass: threading the very edge (a near miss) pays a
// flat bonus on top of the multiplied base points.
export function scoreRing(plane, ring, dist, combo) {
  const multiplier = comboMultiplier(combo);
  const nearMiss = dist >= ring.radius * 0.72;
  const points = Math.round(ringPoints(plane) * multiplier) + (nearMiss ? 25 : 0);
  return { points, multiplier, nearMiss };
}

// End-of-mission grade against the mission's par scores, with the medal
// line the debrief screen shows. Only a completed sortie is graded.
export function gradeFor(mission, score) {
  const par = mission.par || { S: Infinity, A: Infinity, B: Infinity };
  if (score >= par.S) return { grade: 'S', medal: 'GOLD MEDAL' };
  if (score >= par.A) return { grade: 'A', medal: 'SILVER MEDAL' };
  if (score >= par.B) return { grade: 'B', medal: 'BRONZE MEDAL' };
  return { grade: 'C', medal: 'FINISHER' };
}
