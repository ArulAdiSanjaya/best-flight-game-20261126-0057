// Skyline Run — the three sorties. Each mission is a route of glowing rings
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
