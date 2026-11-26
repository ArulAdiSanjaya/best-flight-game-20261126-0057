// Skyline Run — everything the pilot reads: the HUD, the lit instruments,
// the compass, the warnings and the title / pause / end screens.

import { clamp, formatClock, formatFeet, formatKnots, radToDeg } from './util.js';

function compassLabel(headingDeg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(headingDeg / 45) % 8];
}

export function drawCompassStrip(ctx, width, plane) {
  const cy = 34;
  const deg = ((radToDeg(plane.heading) % 360) + 360) % 360;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 16, 28, 0.8)';
  ctx.beginPath();
  ctx.roundRect(width / 2 - 190, 12, 380, 44, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(width / 2 - 190, 12, 380, 44);
  ctx.clip();
  ctx.fillStyle = '#cfe6ff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let d = -120; d <= 120; d += 15) {
    const tickDeg = Math.round((deg + d) / 15) * 15;
    const norm = ((tickDeg % 360) + 360) % 360;
    const x = width / 2 + d * 2.1;
    const major = norm % 45 === 0;
    ctx.fillStyle = major ? '#ffffff' : 'rgba(207,230,255,0.7)';
    ctx.fillRect(x - (major ? 1 : 0.5), cy - (major ? 12 : 7), major ? 2 : 1, major ? 12 : 7);
    if (major) {
      ctx.fillText(norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W' : '' + norm, x, cy + 20);
    }
  }
  ctx.restore();
  // Centre caret + readout, on a small dark pill so it reads over clouds.
  ctx.fillStyle = '#ffb62e';
  ctx.beginPath();
  ctx.moveTo(width / 2 - 7, 12);
  ctx.lineTo(width / 2 + 7, 12);
  ctx.lineTo(width / 2, 22);
  ctx.closePath();
  ctx.fill();
  const label = Math.round(deg) + '° ' + compassLabel(deg);
  ctx.font = 'bold 15px system-ui, sans-serif';
  const labelW = ctx.measureText(label).width + 18;
  ctx.fillStyle = 'rgba(8, 16, 28, 0.8)';
  ctx.beginPath();
  ctx.roundRect(width / 2 - labelW / 2, 60, labelW, 22, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(label, width / 2, 76);
}

// A lit instrument: a dark bezel, a glowing face, a needle or a ball.
function gaugeFace(ctx, x, y, r, label) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#10161f';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a4a5c';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120, 200, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#9fc4e8';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 0, r - 10);
  ctx.restore();
}

export function drawArtificialHorizon(ctx, x, y, r, plane) {
  // The ball: a clipped circle, sky above the pitch line, ground below,
  // rolled with the aircraft; the fixed yellow wings stay level with the dash.
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(-plane.roll);
  const pitchShift = clamp(plane.pitch, -0.5, 0.5) * r * 1.1;
  ctx.fillStyle = '#4a90d9';
  ctx.fillRect(-r, -r + pitchShift, r * 2, r - pitchShift);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r, pitchShift, r * 2, r * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, pitchShift);
  ctx.lineTo(r, pitchShift);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#ffb62e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, 0);
  ctx.lineTo(-r * 0.2, 0);
  ctx.moveTo(r * 0.2, 0);
  ctx.lineTo(r * 0.55, 0);
  ctx.fillStyle = '#ffb62e';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Bezel and label only here: the ball itself is the face, so no dark fill.
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#3a4a5c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#9fc4e8';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', 0, r - 10);
  ctx.restore();
}

function needleGauge(ctx, x, y, r, label, value, max, unit, color) {
  gaugeFace(ctx, x, y, r, label);
  const angle = -Math.PI * 0.75 + clamp(value / max, 0, 1) * Math.PI * 1.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color || '#7ee2a8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(angle) * (r - 10), Math.sin(angle) * (r - 10));
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(value), 0, r * 0.42);
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = '#9fc4e8';
  ctx.fillText(unit, 0, r * 0.62);
  ctx.restore();
}

// The cockpit panel: a dark dash with lit gauges across the bottom.
export function drawCockpit(ctx, width, height, plane, time) {
  const panelH = 190;
  const top = height - panelH;
  ctx.fillStyle = '#141a21';
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, top + 34);
  ctx.quadraticCurveTo(width / 2, top - 26, width, top + 34);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2c3947';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Canopy struts.
  ctx.fillStyle = '#1b232d';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(46, 0);
  ctx.lineTo(120, top + 30);
  ctx.lineTo(0, top + 30);
  ctx.closePath();
  ctx.moveTo(width, 0);
  ctx.lineTo(width - 46, 0);
  ctx.lineTo(width - 120, top + 30);
  ctx.lineTo(width, top + 30);
  ctx.closePath();
  ctx.fill();
  const cy = top + 96;
  drawArtificialHorizon(ctx, width / 2, cy, 62, plane);
  needleGauge(ctx, width / 2 - 190, cy, 52, 'AIRSPEED', formatKnots(plane.speed), 220, 'KT', '#7ee2a8');
  needleGauge(ctx, width / 2 + 190, cy, 52, 'ALTITUDE', plane.alt * 3.28084, 6000, 'FT', '#8ec9ff');
  // Fuel gauge: a small vertical bar with a lit segment.
  ctx.save();
  ctx.translate(width / 2 + 300, cy - 40);
  ctx.fillStyle = '#10161f';
  ctx.beginPath();
  ctx.roundRect(0, 0, 26, 80, 5);
  ctx.fill();
  const fuelH = clamp(plane.fuel / 100, 0, 1) * 72;
  ctx.fillStyle = plane.fuel < 20 ? '#ff5a4e' : '#7ee2a8';
  ctx.fillRect(4, 76 - fuelH, 18, fuelH);
  ctx.fillStyle = '#9fc4e8';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FUEL', 13, 94);
  ctx.restore();
  // Warning lamps, lit when they mean it.
  const lamps = [
    { label: 'STALL', on: plane.speed < 26 && plane.airborne, color: '#ff5a4e' },
    { label: 'FUEL', on: plane.fuel < 20, color: '#ffb62e' },
    { label: 'GEAR', on: plane.gearDown, color: '#7ee2a8' },
  ];
  lamps.forEach((lamp, i) => {
    const lx = width - 190 + i * 52;
    const ly = top + 30;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.fillStyle = lamp.on ? lamp.color : '#232d38';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    if (lamp.on) {
      ctx.strokeStyle = lamp.color;
      ctx.globalAlpha = 0.5 + Math.sin(time * 6) * 0.3;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#dfe9f2';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(lamp.label, 0, 24);
    ctx.restore();
  });
}

// The in-flight HUD: big readable numbers, throttle and fuel bars, score.
export function drawHUD(ctx, width, height, game) {
  const plane = game.plane;
  const cockpit = game.camera === 'cockpit';
  ctx.textBaseline = 'alphabetic';
  drawCompassStrip(ctx, width, plane);

  const panel = (x, y, w, h) => {
    ctx.fillStyle = 'rgba(8, 16, 28, 0.78)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
  };

  // Left: altitude, speed, heading.
  panel(16, 76, 208, 108);
  ctx.fillStyle = '#9fc4e8';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ALTITUDE', 28, 98);
  ctx.fillText('SPEED', 28, 132);
  ctx.fillText('HEADING', 28, 166);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(formatFeet(plane.alt) + ' FT', 212, 100);
  ctx.fillText(formatKnots(plane.speed) + ' KT', 212, 134);
  ctx.fillText(Math.round(((radToDeg(plane.heading) % 360) + 360) % 360) + '°', 212, 168);

  // Right: mission, rings, timer, score.
  const m = game.mission;
  panel(width - 224, 76, 208, 108);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9fc4e8';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(m.name.toUpperCase(), width - 212, 98);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('RINGS ' + game.ringsPassed + ' / ' + game.rings.length, width - 212, 126);
  if (m.timeLimit) {
    ctx.fillStyle = game.timeLeft < 30 ? '#ff5a4e' : '#ffffff';
    ctx.fillText('TIME ' + formatClock(game.timeLeft), width - 212, 152);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillText('FUEL ' + Math.round(plane.fuel) + '%', width - 212, 152);
  }
  ctx.fillStyle = '#ffb62e';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('SCORE ' + game.score, width - 212, 176);

  // Bottom left: throttle + fuel bars. Kept clear of the canvas edge.
  const barY = height - (cockpit ? 214 : 66);
  panel(16, barY - 8, 240, 58);
  ctx.fillStyle = '#9fc4e8';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('THR', 28, barY + 12);
  ctx.fillText('FUEL', 28, barY + 36);
  ctx.fillStyle = '#22303f';
  ctx.fillRect(76, barY + 2, 160, 10);
  ctx.fillRect(76, barY + 26, 160, 10);
  ctx.fillStyle = '#7ee2a8';
  ctx.fillRect(76, barY + 2, 160 * clamp(plane.throttle, 0, 1), 10);
  ctx.fillStyle = plane.fuel < 20 ? '#ff5a4e' : '#ffb62e';
  ctx.fillRect(76, barY + 26, 160 * clamp(plane.fuel / 100, 0, 1), 10);

  // Centre: flight-path marker + stall warning.
  const cx = width / 2;
  const cy = height * 0.52;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.moveTo(cx - 20, cy);
  ctx.lineTo(cx - 12, cy);
  ctx.moveTo(cx + 12, cy);
  ctx.lineTo(cx + 20, cy);
  ctx.moveTo(cx, cy - 20);
  ctx.lineTo(cx, cy - 12);
  ctx.stroke();
  if (plane.speed < 26 && plane.airborne) {
    ctx.fillStyle = Math.sin(game.time * 8) > 0 ? '#ff5a4e' : '#ffffff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STALL — NOSE DOWN, ADD POWER', cx, 120);
  }
  if (plane.fuel <= 0) {
    ctx.fillStyle = '#ff5a4e';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FUEL EMPTY — GLIDING', cx, 148);
  }
  if (game.message) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.message, cx, height - (cockpit ? 230 : 90));
  }
}

// A centred text screen over a dimmed world: title, pause, landing, crash.
export function drawScreen(ctx, width, height, lines, accent) {
  ctx.fillStyle = 'rgba(6, 12, 22, 0.55)';
  ctx.fillRect(0, 0, width, height);
  let y = height * 0.2;
  ctx.textAlign = 'center';
  for (const line of lines) {
    if (line.kind === 'title') {
      ctx.fillStyle = accent || '#ffb62e';
      ctx.font = 'bold 64px system-ui, sans-serif';
      ctx.fillText(line.text, width / 2, y);
      y += 84;
    } else if (line.kind === 'sub') {
      ctx.fillStyle = '#dfe9f2';
      ctx.font = '24px system-ui, sans-serif';
      ctx.fillText(line.text, width / 2, y);
      y += 40;
    } else if (line.kind === 'body') {
      ctx.fillStyle = '#b9c9d8';
      ctx.font = '17px system-ui, sans-serif';
      ctx.fillText(line.text, width / 2, y);
      y += 30;
    } else if (line.kind === 'key') {
      ctx.fillStyle = '#ffb62e';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(line.text, width / 2, y);
      y += 34;
    } else if (line.kind === 'gap') {
      y += 22;
    }
  }
}
