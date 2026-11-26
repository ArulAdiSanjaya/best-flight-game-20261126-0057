// Skyline Run — drawing the aircraft, the rings and the runway furniture.
// The plane is drawn, not loaded: every line here is original canvas art.

import { projectPoint, terrainHeight, WORLD } from './terrain.js';
import { clamp, lerp } from './util.js';

// The chase-view aeroplane, drawn from behind and slightly above, banking
// with the roll. A little high-wing bush plane: red fuselage, cream wings,
// a spinning prop disc and lit nav lights.
export function drawAircraft(ctx, width, height, plane, time) {
  const cx = width / 2;
  const cy = height * 0.62;
  const scale = height / 800;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll * 0.55);
  ctx.scale(scale, scale);
  const bob = Math.sin(time * 2.1) * 2 * (plane.airborne ? 1 : 0);

  // Propeller disc: a translucent blur that spins with the engine.
  if (plane.throttle > 0.05 || plane.speed > 5) {
    ctx.save();
    ctx.translate(0, -6 + bob);
    ctx.fillStyle = 'rgba(220, 225, 230, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    const a = time * (20 + plane.throttle * 40);
    ctx.strokeStyle = 'rgba(40, 40, 44, 0.55)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, -44);
    ctx.lineTo(0, 44);
    ctx.stroke();
    ctx.save();
    ctx.rotate(a % Math.PI);
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.lineTo(40, 0);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  // Main wing, seen from behind: cream with red tips.
  ctx.fillStyle = '#e8ddc0';
  ctx.beginPath();
  ctx.moveTo(-118, 18 + bob);
  ctx.lineTo(-30, 2 + bob);
  ctx.lineTo(30, 2 + bob);
  ctx.lineTo(118, 18 + bob);
  ctx.lineTo(112, 30 + bob);
  ctx.lineTo(-112, 30 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c8442e';
  ctx.fillRect(-118, 16 + bob, 16, 14);
  ctx.fillRect(102, 16 + bob, 16, 14);

  // Tailplane and fin.
  ctx.fillStyle = '#d8cdb2';
  ctx.beginPath();
  ctx.moveTo(-52, -34 + bob);
  ctx.lineTo(52, -34 + bob);
  ctx.lineTo(44, -22 + bob);
  ctx.lineTo(-44, -22 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c8442e';
  ctx.beginPath();
  ctx.moveTo(-6, -34 + bob);
  ctx.lineTo(6, -34 + bob);
  ctx.lineTo(14, -78 + bob);
  ctx.lineTo(-14, -78 + bob);
  ctx.closePath();
  ctx.fill();

  // Fuselage: a rounded red body with a cream stripe and a lit cabin.
  ctx.fillStyle = '#b23a28';
  ctx.beginPath();
  ctx.moveTo(-26, 26 + bob);
  ctx.quadraticCurveTo(-30, -30 + bob, -12, -52 + bob);
  ctx.lineTo(12, -52 + bob);
  ctx.quadraticCurveTo(30, -30 + bob, 26, 26 + bob);
  ctx.quadraticCurveTo(0, 40 + bob, -26, 26 + bob);
  ctx.fill();
  ctx.fillStyle = '#e8ddc0';
  ctx.fillRect(-26, -6 + bob, 52, 7);
  // Cabin windows, warm and lit from inside.
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath();
  ctx.roundRect(-18, -48 + bob, 14, 16, 4);
  ctx.roundRect(4, -48 + bob, 14, 16, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 30, 44, 0.55)';
  ctx.beginPath();
  ctx.roundRect(-18, -48 + bob, 14, 7, 4);
  ctx.roundRect(4, -48 + bob, 14, 7, 4);
  ctx.fill();

  // Nav lights: red port, green starboard, white tail — always lit.
  ctx.fillStyle = '#ff2e2e';
  ctx.beginPath();
  ctx.arc(-116, 22 + bob, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2eff5e';
  ctx.beginPath();
  ctx.arc(116, 22 + bob, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, -76 + bob, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// A target ring: a glowing hoop standing in the sky. Drawn as an ellipse
// whose size and squash follow the real 3D projection of its centre.
export function drawRing(ctx, width, height, cam, ring, time, isNext) {
  const p = projectPoint(ring.x, ring.y, ring.z, cam, width, height);
  if (!p) return;
  const focal = height * 0.92;
  const r = (ring.radius / p.dist) * focal;
  if (r < 2 || r > height * 2.2) return;
  const pulse = 1 + Math.sin(time * 4) * 0.05;
  const radius = r * pulse;
  // A ring hangs upright across the flight path, so from head-on it reads
  // as a circle; from an angle it squashes a little, never into a slit.
  const squash = clamp(0.82 + Math.abs(Math.sin(ring.faceAngle || 0)) * 0.18, 0.82, 1);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1, squash);
  if (isNext) {
    ctx.strokeStyle = 'rgba(255, 190, 60, 0.35)';
    ctx.lineWidth = radius * 0.34;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = isNext ? '#ffb62e' : 'rgba(120, 200, 120, 0.85)';
  ctx.lineWidth = Math.max(2, radius * 0.1);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(1, radius * 0.03);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  // Chevrons point the way through.
  ctx.fillStyle = isNext ? '#ffb62e' : 'rgba(160, 220, 160, 0.9)';
  const s = radius * 0.16;
  ctx.beginPath();
  ctx.moveTo(-s, -s * 0.4);
  ctx.lineTo(0, s * 0.5);
  ctx.lineTo(s, -s * 0.4);
  ctx.lineTo(s * 0.5, -s * 0.4);
  ctx.lineTo(0, s * 0.1);
  ctx.lineTo(-s * 0.5, -s * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Distance tag above the next ring.
  if (isNext) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(p.dist) + ' m', p.x, p.y - radius * squash - 12);
  }
}

// Runway furniture that reads at a glance: threshold bars, numbers and a
// windsock, all projected from the world so they sit on the strip.
export function drawRunwayMarkers(ctx, width, height, cam) {
  const corners = [
    { x: -WORLD.runwayHalfWidth, z: WORLD.runwayStartZ },
    { x: WORLD.runwayHalfWidth, z: WORLD.runwayStartZ },
    { x: WORLD.runwayHalfWidth, z: WORLD.runwayEndZ },
    { x: -WORLD.runwayHalfWidth, z: WORLD.runwayEndZ },
  ];
  const pts = corners.map((c) => projectPoint(c.x, terrainHeight(c.x, c.z) + 0.4, c.z, cam, width, height));
  if (pts.some((p) => !p)) return;
  // Centreline dashes.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  for (let z = WORLD.runwayStartZ + 40; z < WORLD.runwayEndZ - 20; z += 90) {
    const a = projectPoint(0, terrainHeight(0, z) + 0.4, z, cam, width, height);
    const b = projectPoint(0, terrainHeight(0, z + 45) + 0.4, z + 45, cam, width, height);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Threshold bars at both ends.
  for (const z of [WORLD.runwayStartZ + 8, WORLD.runwayEndZ - 8]) {
    const a = projectPoint(-12, terrainHeight(-12, z) + 0.4, z, cam, width, height);
    const b = projectPoint(12, terrainHeight(12, z) + 0.4, z, cam, width, height);
    if (!a || !b) continue;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Windsock beside the strip, leaning with a steady valley breeze.
  const sock = projectPoint(34, terrainHeight(34, 0) + 14, 0, cam, width, height);
  const sockBase = projectPoint(34, terrainHeight(34, 0), 0, cam, width, height);
  if (sock && sockBase) {
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sockBase.x, sockBase.y);
    ctx.lineTo(sock.x, sock.y);
    ctx.stroke();
    ctx.fillStyle = '#ff7a2e';
    ctx.beginPath();
    ctx.moveTo(sock.x, sock.y);
    ctx.lineTo(sock.x + 16, sock.y + 3);
    ctx.lineTo(sock.x, sock.y + 7);
    ctx.closePath();
    ctx.fill();
  }
}

// A soft shadow ellipse under the plane so landings read as landings.
export function drawPlaneShadow(ctx, width, height, cam, plane) {
  const ground = terrainHeight(plane.x, plane.z);
  const p = projectPoint(plane.x, ground + 0.5, plane.z, cam, width, height);
  if (!p) return;
  const heightAbove = Math.max(0, plane.alt - ground);
  const focal = height * 0.92;
  const r = clamp((26 / Math.max(30, p.dist)) * focal * (1 - clamp(heightAbove / 300, 0, 0.85)), 2, 55);
  ctx.fillStyle = 'rgba(0, 0, 0, ' + (0.25 * (1 - clamp(heightAbove / 300, 0, 0.8))).toFixed(2) + ')';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}
