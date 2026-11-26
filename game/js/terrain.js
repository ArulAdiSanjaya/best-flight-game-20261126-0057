// Skyline Run — the valley: terrain height, fields, river, town and runway,
// plus the perspective projection that turns the world into a chase view.
// The whole valley is a pure function of (x, z), so it never needs assets.

import { clamp, hash2, lerp, makeNoise2D, mulberry32 } from './util.js';

export const WORLD = {
  seed: 1337,
  // Runway: a strip along the z axis at x = 0, from z = -650 to z = +650.
  runwayHalfWidth: 16,
  runwayStartZ: -650,
  runwayEndZ: 650,
  runwayHeading: 0, // taking off toward +z (north)
};

// Field palette: patchwork farmland in one muted style.
const FIELD_COLORS = [
  '#5d7a3a', '#6b8a42', '#7d9b4a', '#4f7034',
  '#8a7a3f', '#a08c4a', '#6f8f57', '#55763c',
  '#7a6a35', '#93a05a', '#5a7d46', '#87984e',
];

const noise = makeNoise2D(WORLD.seed);
const fieldRand = mulberry32(WORLD.seed + 77);

// Height of the ground in metres at world (x, z). Flat near the runway,
// rolling hills further out, rising into ridges at the valley edges.
export function terrainHeight(x, z) {
  const dRunway = Math.abs(x);
  const along = clamp((z - WORLD.runwayStartZ) / (WORLD.runwayEndZ - WORLD.runwayStartZ), 0, 1);
  const flatness = clamp(1 - dRunway / 260, 0, 1) * (along > 0 && along < 1 ? 1 : 0.4);
  const hills = noise(x * 0.004, z * 0.004) * 26
    + noise(x * 0.012 + 40, z * 0.012) * 9
    + noise(x * 0.03, z * 0.03 + 9) * 2.5;
  const ridge = Math.pow(Math.max(0, (Math.abs(x) - 900) / 700), 2) * 160
    + Math.pow(Math.max(0, (Math.abs(z) - 1400) / 800), 2) * 140;
  const h = hills * (1 - flatness * 0.92) + ridge;
  return Math.max(0, h);
}

function fieldColor(x, z) {
  const cellX = Math.floor(x / 110);
  const cellZ = Math.floor(z / 110);
  // Deterministic hash of the cell so fields keep their colour every frame.
  const idx = hash2(cellX, cellZ, WORLD.seed) % FIELD_COLORS.length;
  return FIELD_COLORS[idx];
}

function isRiver(x, z) {
  // A lazy river meandering east of the runway.
  const centre = 420 + Math.sin(z * 0.0016) * 160 + Math.sin(z * 0.0007 + 2) * 90;
  return Math.abs(x - centre) < 26;
}

function isRoad(x, z) {
  const centre = -260 + Math.sin(z * 0.0011) * 60;
  return Math.abs(x - centre) < 7;
}

function isTown(x, z) {
  // A small town grid south-west of the field.
  return x > -620 && x < -380 && z > 700 && z < 1150;
}

function isRunway(x, z) {
  return Math.abs(x) <= WORLD.runwayHalfWidth
    && z >= WORLD.runwayStartZ && z <= WORLD.runwayEndZ;
}

// What the ground looks like at (x, z): a colour and a kind tag.
export function groundAt(x, z) {
  if (isRunway(x, z)) return { color: '#3a3f46', kind: 'runway' };
  if (isRiver(x, z)) return { color: '#3f6d8e', kind: 'river' };
  if (isRoad(x, z)) return { color: '#4a4640', kind: 'road' };
  if (isTown(x, z)) {
    const bx = Math.floor((x + 620) / 34);
    const bz = Math.floor((z - 700) / 34);
    const built = ((bx * 7 + bz * 13) % 5) < 3;
    return { color: built ? '#8d8578' : '#6d7a45', kind: built ? 'town' : 'field' };
  }
  return { color: fieldColor(x, z), kind: 'field' };
}

// Project a world point into screen space from the chase camera.
// Returns { x, y, dist } or null when behind the camera.
export function projectPoint(wx, wy, wz, cam, width, height) {
  const dx = wx - cam.x;
  const dz = wz - cam.z;
  const sinH = Math.sin(cam.heading);
  const cosH = Math.cos(cam.heading);
  // Plane frame: forward along heading, right perpendicular, up is altitude.
  const fwd = dx * sinH + dz * cosH;
  const right = dx * cosH - dz * sinH;
  const up = wy - cam.y;
  if (fwd < 4) return null;
  const focal = height * 0.92;
  const horizonY = height * 0.44 + cam.pitchPixels;
  const sx = width / 2 + (right / fwd) * focal;
  const sy = horizonY - (up / fwd) * focal;
  return { x: sx, y: sy, dist: fwd };
}

function drawSky(ctx, width, height, cam, time) {
  const horizonY = height * 0.44 + cam.pitchPixels;
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
  sky.addColorStop(0, '#2f6db3');
  sky.addColorStop(0.55, '#7fb2dd');
  sky.addColorStop(1, '#cfe4f2');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, Math.max(0, horizonY + 2));
  // Low sun, warm and fixed in the west so the light stays consistent.
  const sunX = width * 0.78;
  const sunY = horizonY - height * 0.16;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
  glow.addColorStop(0, 'rgba(255, 236, 180, 0.95)');
  glow.addColorStop(0.25, 'rgba(255, 214, 130, 0.55)');
  glow.addColorStop(1, 'rgba(255, 214, 130, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();
  // Distant ridges, two parallax layers that slide with heading.
  drawRidge(ctx, width, horizonY, cam.heading, 0.12, height * 0.10, '#7d94ad');
  drawRidge(ctx, width, horizonY, cam.heading, 0.3, height * 0.055, '#5f7d9c');
  // Drifting clouds, seeded and slow so screenshots stay recognisable.
  drawClouds(ctx, width, height, cam, time, horizonY);
}

function drawRidge(ctx, width, horizonY, heading, parallax, amp, color) {
  const shift = ((heading * parallax) % (Math.PI * 2)) / (Math.PI * 2) * width;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-20, horizonY + 2);
  for (let x = -20; x <= width + 20; x += 40) {
    const t = (x + shift) * 0.006;
    const y = horizonY - (Math.abs(Math.sin(t * 1.7)) * 0.6 + Math.abs(Math.sin(t * 0.9 + 2)) * 0.4) * amp;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width + 20, horizonY + 2);
  ctx.closePath();
  ctx.fill();
}

const CLOUDS = [];
{
  const r = mulberry32(WORLD.seed + 5);
  for (let i = 0; i < 26; i++) {
    CLOUDS.push({
      x: (r() - 0.5) * 5200,
      y: 260 + r() * 320,
      z: (r() - 0.5) * 5200,
      s: 60 + r() * 130,
    });
  }
}

function drawClouds(ctx, width, height, cam, time, horizonY) {
  ctx.save();
  for (const c of CLOUDS) {
    const drift = time * 2;
    const p = projectPoint(c.x + drift, c.y, c.z, cam, width, height);
    if (!p || p.dist > 4200 || p.dist < 350) continue;
    const s = (c.s / p.dist) * height * 0.6;
    if (s < 4) continue;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s, s * 0.36, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x - s * 0.55, p.y + s * 0.08, s * 0.6, s * 0.26, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x + s * 0.55, p.y + s * 0.08, s * 0.6, s * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// The ground: a perspective grid of quads sampled ahead of the camera.
// Near rows are dense, far rows sparse — the classic way to fake a landscape.
export function drawGround(ctx, width, height, cam) {
  const horizonY = height * 0.44 + cam.pitchPixels;
  ctx.fillStyle = '#6d8a4a';
  ctx.fillRect(0, horizonY, width, height - horizonY);
  const sinH = Math.sin(cam.heading);
  const cosH = Math.cos(cam.heading);
  const distances = [18, 26, 38, 54, 76, 106, 148, 205, 285, 395, 545, 750, 1030, 1400];
  const halfSpans = [60, 85, 120, 165, 225, 300, 400, 520, 680, 880, 1120, 1420, 1780, 2200];
  for (let r = 0; r < distances.length - 1; r++) {
    const d0 = distances[r];
    const d1 = distances[r + 1];
    const w0 = halfSpans[r];
    const w1 = halfSpans[r + 1];
    const cols = 14;
    for (let c = 0; c < cols; c++) {
      const t0 = c / cols;
      const t1 = (c + 1) / cols;
      const l0a = lerp(-w0, w0, t0);
      const l0b = lerp(-w0, w0, t1);
      const l1a = lerp(-w1, w1, t0);
      const l1b = lerp(-w1, w1, t1);
      const p00 = groundPoint(cam, d0, l0a, sinH, cosH);
      const p01 = groundPoint(cam, d0, l0b, sinH, cosH);
      const p10 = groundPoint(cam, d1, l1a, sinH, cosH);
      const p11 = groundPoint(cam, d1, l1b, sinH, cosH);
      const mid = groundPoint(cam, (d0 + d1) / 2, (l0a + l0b + l1a + l1b) / 4, sinH, cosH);
      const g = groundAt(mid.x, mid.z);
      const q0 = projectPoint(p00.x, p00.y, p00.z, cam, width, height);
      const q1 = projectPoint(p01.x, p01.y, p01.z, cam, width, height);
      const q2 = projectPoint(p11.x, p11.y, p11.z, cam, width, height);
      const q3 = projectPoint(p10.x, p10.y, p10.z, cam, width, height);
      if (!q0 || !q1 || !q2 || !q3) continue;
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.moveTo(q0.x, q0.y);
      ctx.lineTo(q1.x, q1.y);
      ctx.lineTo(q2.x, q2.y);
      ctx.lineTo(q3.x, q3.y);
      ctx.closePath();
      ctx.fill();
      if (g.kind === 'runway') {
        // White edge lines and a dashed centreline on the strip.
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(q0.x, q0.y);
        ctx.lineTo(q3.x, q3.y);
        ctx.moveTo(q1.x, q1.y);
        ctx.lineTo(q2.x, q2.y);
        ctx.stroke();
      }
    }
  }
}

function groundPoint(cam, fwd, right, sinH, cosH) {
  const wx = cam.x + sinH * fwd + cosH * right;
  const wz = cam.z + cosH * fwd - sinH * right;
  return { x: wx, y: terrainHeight(wx, wz), z: wz };
}

// Draw the whole world behind the aircraft: sky, then ground.
export function drawWorld(ctx, width, height, cam, time) {
  drawSky(ctx, width, height, cam, time);
  drawGround(ctx, width, height, cam);
}
