// Skyline Run — world-space particles: gold sparks when a ring pops,
// dust when the wheels meet the ground, and wingtip contrails that only
// stream when the plane is banked hard. All drawn through the same
// projection as the rest of the world, so they sit in the scene.

import { projectPoint } from './terrain.js';
import { clamp, mulberry32 } from './util.js';

const MAX_PARTICLES = 700;

export function createParticles() {
  return { list: [], trailAcc: 0, dustAcc: 0, rand: mulberry32(31337) };
}

function push(P, p) {
  if (P.list.length >= MAX_PARTICLES) P.list.shift();
  P.list.push(p);
}

// A burst of sparks at a ring the moment it is threaded.
export function spawnRingBurst(P, ring) {
  for (let i = 0; i < 30; i++) {
    const a = P.rand() * Math.PI * 2;
    const b = (P.rand() - 0.5) * Math.PI;
    const sp = 5 + P.rand() * 12;
    push(P, {
      x: ring.x, y: ring.y, z: ring.z,
      vx: Math.cos(a) * Math.cos(b) * sp,
      vy: Math.sin(b) * sp + 2,
      vz: Math.sin(a) * Math.cos(b) * sp,
      life: 0.7 + P.rand() * 0.6, maxLife: 1.3,
      size: 1.6 + P.rand() * 1.6,
      color: P.rand() < 0.6 ? [255, 190, 70] : [255, 240, 200],
      grav: -3, drag: 0.6,
    });
  }
}

// A cloud of dust kicked up at a touchdown (or while rolling fast).
export function spawnDust(P, x, y, z, count, spread) {
  for (let i = 0; i < count; i++) {
    const a = P.rand() * Math.PI * 2;
    const sp = (1 + P.rand() * (spread || 5));
    push(P, {
      x: x + (P.rand() - 0.5) * 6, y: y + P.rand() * 1.5, z: z + (P.rand() - 0.5) * 6,
      vx: Math.cos(a) * sp, vy: 1 + P.rand() * 2.4, vz: Math.sin(a) * sp,
      life: 0.8 + P.rand() * 0.9, maxLife: 1.7,
      size: 3 + P.rand() * 4,
      color: [198, 172, 132],
      grav: 0.6, drag: 1.4,
    });
  }
}

// Soft white puffs from both wingtips during a hard turn.
export function spawnContrails(P, plane) {
  const cosH = Math.cos(plane.heading);
  const sinH = Math.sin(plane.heading);
  for (const side of [-1, 1]) {
    push(P, {
      x: plane.x + cosH * 11 * side, y: plane.alt + 1, z: plane.z - sinH * 11 * side,
      vx: -sinH * plane.speed * 0.12, vy: -0.4, vz: -cosH * plane.speed * 0.12,
      life: 0.9 + P.rand() * 0.4, maxLife: 1.3,
      size: 2.4 + P.rand() * 1.6,
      color: [245, 248, 252],
      grav: 0, drag: 0.4,
    });
  }
}

export function updateParticles(P, dt) {
  const list = P.list;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list[i] = list[list.length - 1];
      list.pop();
      continue;
    }
    const dragK = Math.max(0, 1 - p.drag * dt);
    p.vx *= dragK;
    p.vz *= dragK;
    p.vy = p.vy * dragK + p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
  }
}

export function drawParticles(ctx, width, height, cam, P) {
  const focal = height * 0.92;
  for (const p of P.list) {
    const q = projectPoint(p.x, p.y, p.z, cam, width, height);
    if (!q || q.dist > 1600) continue;
    const r = clamp((p.size / q.dist) * focal, 0.7, 26);
    const alpha = clamp(p.life / p.maxLife, 0, 1) * 0.85;
    ctx.fillStyle = 'rgba(' + p.color[0] + ',' + p.color[1] + ',' + p.color[2] + ',' + alpha.toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
