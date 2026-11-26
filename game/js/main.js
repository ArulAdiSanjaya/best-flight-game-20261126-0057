// Skyline Run — the game itself: state machine, camera, render loop,
// ring checks, landings, screens and the ?shot= presets the screenshots use.

import { clamp, lerp, mulberry32 } from './util.js';
import { drawWorld, drawGround, projectPoint, terrainHeight, WORLD } from './terrain.js';
import { createPlane, stepPlane, PLANE } from './physics.js';
import { drawAircraft, drawRing, drawRunwayMarkers, drawPlaneShadow } from './aircraft.js';
import { drawHUD, drawCockpit, drawScreen } from './hud.js';
import { MISSIONS, missionById, landingPoints, scoreRing, gradeFor } from './missions.js';
import { createParticles, spawnRingBurst, spawnDust, spawnContrails, updateParticles, drawParticles } from './particles.js';
import { createInput, readFlightControls, wasPressed, clearPressed } from './input.js';
import { createAudio } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const WIDTH = 1280;
const HEIGHT = 800;

const game = {
  state: 'title', // title | flying | paused | landed | crashed | complete | timeout
  mission: MISSIONS[0],
  missionIndex: 0,
  plane: createPlane(),
  rings: [],
  ringsPassed: 0,
  score: 0,
  time: 0,
  timeLeft: 0,
  message: '',
  messageUntil: 0,
  camera: 'chase', // chase | cockpit
  audio: createAudio(),
  demoRand: mulberry32(20261126),
  clickZones: [],
  stats: { rings: 0, landings: 0, crashes: 0 },
  combo: 0, // consecutive clean rings; a crash resets it
  particles: createParticles(),
  gradeResult: null,
  bests: {}, // mission id -> { score, grade }, kept in localStorage
};

// Best scores live in localStorage when the browser allows it; the game
// runs happily without them (file:// in a strict browser, headless tests).
function loadBest(id) {
  try {
    const raw = window.localStorage.getItem('skyline-best-' + id);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function saveBest(id, score, grade) {
  const prev = game.bests[id];
  if (prev && prev.score >= score) return prev;
  const rec = { score, grade };
  game.bests[id] = rec;
  try {
    window.localStorage.setItem('skyline-best-' + id, JSON.stringify(rec));
  } catch (err) { /* bests are a nicety, never a blocker */ }
  return rec;
}

for (const m of MISSIONS) {
  const best = loadBest(m.id);
  if (best) game.bests[m.id] = best;
}

const input = createInput(canvas);

function showMessage(text, seconds) {
  game.message = text;
  game.messageUntil = game.time + (seconds || 2.5);
}

function startMission(index) {
  game.missionIndex = index;
  game.mission = MISSIONS[index];
  game.plane = createPlane();
  const s = game.mission.start;
  game.plane.x = s.x;
  game.plane.z = s.z;
  game.plane.alt = terrainHeight(s.x, s.z);
  game.plane.heading = s.heading;
  game.plane.speed = s.speed;
  game.plane.throttle = s.throttle;
  game.plane.targetThrottle = s.throttle;
  game.plane.windStrength = game.mission.wind || 0;
  game.rings = game.mission.buildRings();
  game.ringsPassed = 0;
  game.score = 0;
  game.combo = 0;
  game.gradeResult = null;
  game.particles = createParticles();
  game.timeLeft = game.mission.timeLimit || 0;
  game.state = 'flying';
  game.camera = 'chase';
  showMessage(game.mission.name.toUpperCase() + ' — ' + game.mission.short.toUpperCase(), 3.5);
  game.audio.ensure();
}

function nextRing() {
  return game.rings[game.ringsPassed] || null;
}

function checkRings() {
  const ring = nextRing();
  if (!ring) return;
  const dx = game.plane.x - ring.x;
  const dy = game.plane.alt - ring.y;
  const dz = game.plane.z - ring.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < ring.radius + 5) {
    ring.passed = true;
    game.ringsPassed += 1;
    game.combo += 1;
    const scored = scoreRing(game.plane, ring, dist, game.combo);
    game.score += scored.points;
    spawnRingBurst(game.particles, ring);
    game.audio.ringChime();
    if (game.ringsPassed >= game.rings.length) {
      if (game.mission.needsLanding) {
        showMessage('ALL RINGS — NOW LAND ON THE RUNWAY', 4);
      } else {
        finishMission(true);
      }
    } else {
      let msg = 'RING ' + game.ringsPassed + '/' + game.rings.length + '  +' + scored.points;
      if (scored.multiplier > 1) msg += '  ×' + scored.multiplier.toFixed(2) + ' COMBO';
      if (scored.nearMiss) msg += '  · NEAR MISS +25';
      showMessage(msg, 2);
    }
  }
}

function applyGrade() {
  game.gradeResult = gradeFor(game.mission, game.score);
  saveBest(game.mission.id, game.score, game.gradeResult.grade);
}

function finishMission(success) {
  if (success) {
    if (game.mission.timeLimit) {
      const bonus = Math.round(game.timeLeft) * 5;
      game.score += bonus;
      showMessage('TIME BONUS +' + bonus, 2);
    }
    applyGrade();
    game.state = 'complete';
  }
}

function handleTouchdown(result) {
  if (!result) return;
  if (result.kind === 'landed') {
    game.stats.landings += 1;
    game.audio.landThud();
    const groundY = terrainHeight(game.plane.x, game.plane.z);
    spawnDust(game.particles, game.plane.x, groundY + 0.5, game.plane.z, 22, 6);
    const ringsDone = game.ringsPassed >= game.rings.length;
    if (game.mission.needsLanding && ringsDone) {
      const pts = landingPoints(game.plane, result.onRunway);
      game.score += pts;
      applyGrade();
      game.state = 'complete';
      showMessage('LANDED +' + pts, 3);
    } else if (game.state === 'flying') {
      game.state = 'landed';
    }
  } else if (result.kind === 'crash') {
    game.stats.crashes += 1;
    game.combo = 0; // a bent plane breaks the streak
    game.audio.crashSound();
    const groundY = terrainHeight(game.plane.x, game.plane.z);
    spawnDust(game.particles, game.plane.x, groundY + 0.5, game.plane.z, 30, 9);
    if (game.plane.damage >= 100) {
      game.state = 'crashed';
    } else {
      showMessage('ROUGH TOUCHDOWN — DAMAGE ' + Math.round(game.plane.damage) + '%', 2.5);
    }
  }
}

function update(dt) {
  game.time += dt;
  if (game.time > game.messageUntil) game.message = '';

  if (game.state === 'title') {
    return;
  }
  if (game.state !== 'flying') {
    return;
  }

  // Global keys.
  if (wasPressed(input, 'p') || wasPressed(input, 'Escape')) {
    game.state = 'paused';
    return;
  }
  if (wasPressed(input, 'c')) {
    game.camera = game.camera === 'chase' ? 'cockpit' : 'chase';
  }
  if (wasPressed(input, 'g')) {
    game.plane.gearDown = !game.plane.gearDown;
    showMessage(game.plane.gearDown ? 'GEAR DOWN' : 'GEAR UP', 1.5);
  }
  if (wasPressed(input, 'm')) {
    const muted = game.audio.toggleMute();
    showMessage(muted ? 'SOUND OFF' : 'SOUND ON', 1.2);
  }
  if (wasPressed(input, 'r')) {
    startMission(game.missionIndex);
    return;
  }

  const controls = readFlightControls(input, dt);
  const result = stepPlane(game.plane, controls, dt);
  game.audio.update(game.plane);
  checkRings();
  handleTouchdown(result);

  // Particles: bursts age, contrails stream off the wingtips in a hard
  // bank, and a fast ground roll kicks up dust behind the wheels.
  updateParticles(game.particles, dt);
  const P = game.particles;
  if (game.plane.airborne && Math.abs(game.plane.roll) > 0.72 && game.plane.speed > 42) {
    P.trailAcc += dt;
    while (P.trailAcc > 0.03) {
      P.trailAcc -= 0.03;
      spawnContrails(P, game.plane);
    }
  } else {
    P.trailAcc = 0;
  }
  if (game.plane.onGround && game.plane.speed > 12) {
    P.dustAcc += dt;
    while (P.dustAcc > 0.09) {
      P.dustAcc -= 0.09;
      spawnDust(P, game.plane.x, terrainHeight(game.plane.x, game.plane.z) + 0.4, game.plane.z, 2, 3);
    }
  } else {
    P.dustAcc = 0;
  }

  if (game.mission.timeLimit) {
    game.timeLeft -= dt;
    if (game.timeLeft <= 0) {
      game.timeLeft = 0;
      game.state = 'timeout';
    }
  }
  if (game.state === 'flying' && game.plane.damage >= 100) {
    game.state = 'crashed';
  }
}

function cameraForPlane(plane) {
  const back = 26;
  const sinH = Math.sin(plane.heading);
  const cosH = Math.cos(plane.heading);
  return {
    x: plane.x - sinH * back,
    y: plane.alt + 8,
    z: plane.z - cosH * back,
    heading: plane.heading,
    pitchPixels: plane.pitch * 380,
    sunset: !!(game.mission && game.mission.sunset),
  };
}

function render() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  if (game.state === 'title') {
    // A slow cinematic pan over the home strip behind the title.
    const cam = {
      x: Math.sin(game.time * 0.05) * 120,
      y: 55,
      z: -780,
      heading: Math.sin(game.time * 0.05) * 0.18,
      pitchPixels: 0,
      sunset: false,
    };
    drawWorld(ctx, WIDTH, HEIGHT, cam, game.time);
    drawRunwayMarkers(ctx, WIDTH, HEIGHT, cam);
    drawTitleScreen();
    return;
  }

  const cam = cameraForPlane(game.plane);
  drawWorld(ctx, WIDTH, HEIGHT, cam, game.time);
  drawRunwayMarkers(ctx, WIDTH, HEIGHT, cam);

  // Rings, far first so near ones overlap them.
  const sorted = game.rings
    .map((ring, i) => ({ ring, i, d: Math.hypot(ring.x - game.plane.x, ring.z - game.plane.z) }))
    .sort((a, b) => b.d - a.d);
  for (const { ring, i } of sorted) {
    if (ring.passed) continue;
    drawRing(ctx, WIDTH, HEIGHT, cam, ring, game.time, i === game.ringsPassed);
  }

  drawPlaneShadow(ctx, WIDTH, HEIGHT, cam, game.plane);
  drawParticles(ctx, WIDTH, HEIGHT, cam, game.particles);
  if (game.camera === 'chase') {
    drawAircraft(ctx, WIDTH, HEIGHT, game.plane, game.time);
  }

  if (game.state === 'flying' || game.state === 'paused') {
    if (game.camera === 'cockpit') drawCockpit(ctx, WIDTH, HEIGHT, game.plane, game.time);
    drawHUD(ctx, WIDTH, HEIGHT, game);
  }

  if (game.state === 'paused') {
    drawScreen(ctx, WIDTH, HEIGHT, [
      { kind: 'title', text: 'PAUSED' },
      { kind: 'sub', text: game.mission.name + ' — score ' + game.score },
      { kind: 'gap' },
      { kind: 'body', text: 'P or Esc to keep flying · R to restart the sortie · M to mute' },
    ]);
  } else if (game.state === 'landed') {
    drawScreen(ctx, WIDTH, HEIGHT, [
      { kind: 'title', text: 'ON THE GROUND' },
      { kind: 'sub', text: 'You put her down in one piece. Score ' + game.score },
      { kind: 'gap' },
      { kind: 'body', text: 'Rings ' + game.ringsPassed + ' of ' + game.rings.length + ' · Fuel ' + Math.round(game.plane.fuel) + '%' },
      { kind: 'gap' },
      { kind: 'key', text: 'R — FLY AGAIN      T — BACK TO THE HANGAR' },
    ]);
  } else if (game.state === 'crashed') {
    drawScreen(ctx, WIDTH, HEIGHT, [
      { kind: 'title', text: 'CRASHED' },
      { kind: 'sub', text: 'The valley wins this round. Score ' + game.score },
      { kind: 'gap' },
      { kind: 'body', text: 'Rings ' + game.ringsPassed + ' of ' + game.rings.length + ' · Damage 100%' },
      { kind: 'body', text: 'Slow down before the ground, and never fly slower than stall speed.' },
      { kind: 'gap' },
      { kind: 'key', text: 'R — FLY AGAIN      T — BACK TO THE HANGAR' },
    ], '#ff5a4e');
  } else if (game.state === 'complete') {
    const g = game.gradeResult;
    const best = game.bests[game.mission.id];
    const lines = [
      { kind: 'title', text: 'SORTIE COMPLETE' },
      { kind: 'sub', text: game.mission.name + ' — final score ' + game.score },
      { kind: 'gap' },
    ];
    if (g) {
      lines.push({ kind: 'sub', text: 'GRADE ' + g.grade + ' — ' + g.medal });
    }
    lines.push(
      { kind: 'body', text: 'Rings ' + game.ringsPassed + ' of ' + game.rings.length + ' · Fuel left ' + Math.round(game.plane.fuel) + '%' },
      { kind: 'body', text: best ? 'Best on this sortie: ' + best.score + ' (grade ' + best.grade + ')' : 'Try another sortie, or fly this one again for a better score.' },
      { kind: 'gap' },
      { kind: 'key', text: 'R — FLY AGAIN      T — BACK TO THE HANGAR      1/2/3/4 — OTHER SORTIE' },
    );
    drawScreen(ctx, WIDTH, HEIGHT, lines, '#7ee2a8');
  } else if (game.state === 'timeout') {
    drawScreen(ctx, WIDTH, HEIGHT, [
      { kind: 'title', text: 'OUT OF TIME' },
      { kind: 'sub', text: 'The clock ran out with ' + (game.rings.length - game.ringsPassed) + ' rings still to fly. Score ' + game.score },
      { kind: 'gap' },
      { kind: 'body', text: 'Full throttle on the straights, gentle banks in the turns.' },
      { kind: 'gap' },
      { kind: 'key', text: 'R — FLY AGAIN      T — BACK TO THE HANGAR' },
    ], '#ffb62e');
  }
}

function drawTitleScreen() {
  game.clickZones = [];
  const lines = [
    { kind: 'title', text: 'SKYLINE RUN' },
    { kind: 'sub', text: 'A little bush plane, one valley, four sorties.' },
    { kind: 'gap' },
  ];
  drawScreen(ctx, WIDTH, HEIGHT, lines);
  // Mission rows, clickable.
  let y = HEIGHT * 0.42;
  ctx.textAlign = 'center';
  MISSIONS.forEach((m, i) => {
    const selected = i === game.missionIndex;
    const rowY = y;
    ctx.fillStyle = selected ? 'rgba(255, 182, 46, 0.18)' : 'rgba(8, 16, 28, 0.45)';
    ctx.beginPath();
    ctx.roundRect(WIDTH / 2 - 320, rowY - 26, 640, 52, 10);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = '#ffb62e';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = selected ? '#ffb62e' : '#dfe9f2';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText((i + 1) + '  ' + m.name.toUpperCase() + '  —  ' + m.short, WIDTH / 2, rowY + 2);
    const best = game.bests[m.id];
    if (best) {
      ctx.fillStyle = selected ? '#ffd98a' : '#8fa8bd';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('BEST ' + best.score + ' · GRADE ' + best.grade, WIDTH / 2, rowY + 19);
    }
    game.clickZones.push({ x0: WIDTH / 2 - 320, y0: rowY - 26, x1: WIDTH / 2 + 320, y1: rowY + 26, mission: i });
    y += 64;
  });
  ctx.fillStyle = '#b9c9d8';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('W / S throttle · Arrow keys or mouse to steer · Q / E rudder · Space airbrake', WIDTH / 2, y + 8);
  ctx.fillText('G gear · C cockpit view · P pause · M mute · R restart', WIDTH / 2, y + 34);
  ctx.fillStyle = '#ffb62e';
  ctx.font = 'italic 16px system-ui, sans-serif';
  ctx.fillText(MISSIONS[game.missionIndex].tip, WIDTH / 2, y + 62);
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('CLICK A SORTIE OR PRESS ENTER TO FLY', WIDTH / 2, y + 96);
  game.clickZones.push({ x0: 0, y0: 0, x1: WIDTH, y1: HEIGHT, mission: game.missionIndex, start: true });
}

function handleMenus() {
  // Title screen keys and clicks.
  if (game.state === 'title') {
    if (wasPressed(input, '1')) game.missionIndex = 0;
    if (wasPressed(input, '2')) game.missionIndex = 1;
    if (wasPressed(input, '3')) game.missionIndex = 2;
    if (wasPressed(input, '4')) game.missionIndex = 3;
    if (wasPressed(input, 'Enter') || wasPressed(input, ' ')) {
      startMission(game.missionIndex);
      return;
    }
    if (input.clicked) {
      const c = input.clicked;
      input.clicked = null;
      // Rows are listed before the full-screen zone, so a click on a row
      // flies that sortie and a click anywhere else flies the selected one.
      for (const zone of game.clickZones) {
        if (c.x >= zone.x0 && c.x <= zone.x1 && c.y >= zone.y0 && c.y <= zone.y1) {
          game.missionIndex = zone.mission;
          startMission(game.missionIndex);
          return;
        }
      }
    }
    return;
  }
  // End screens.
  if (['landed', 'crashed', 'complete', 'timeout'].includes(game.state)) {
    if (wasPressed(input, 'r')) startMission(game.missionIndex);
    else if (wasPressed(input, 't')) game.state = 'title';
    else if (game.state === 'complete' && wasPressed(input, '1')) startMission(0);
    else if (game.state === 'complete' && wasPressed(input, '2')) startMission(1);
    else if (game.state === 'complete' && wasPressed(input, '3')) startMission(2);
    else if (game.state === 'complete' && wasPressed(input, '4')) startMission(3);
    return;
  }
  if (game.state === 'paused') {
    if (wasPressed(input, 'p') || wasPressed(input, 'Escape')) game.state = 'flying';
    else if (wasPressed(input, 'r')) startMission(game.missionIndex);
    else if (wasPressed(input, 't')) game.state = 'title';
  }
}

// ?shot= presets: deterministic states for the maker's screenshots.
// shot=flight (rings, chase), shot=cockpit (rings, cockpit), shot=takeoff
// (on the strip, rolling), shot=landing (final approach, gear down),
// shot=storm (Storm Ridge at golden hour, banked into the first ring).
function applyShotPreset() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return;
  if (shot === 'storm') {
    startMission(3);
    const r0 = game.rings[0];
    const dx = r0.x - 0;
    const dz = r0.z - (-200);
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    const p = game.plane;
    p.x = r0.x - ux * 170;
    p.z = r0.z - uz * 170;
    p.alt = r0.y + 4;
    p.heading = Math.atan2(ux, uz);
    p.speed = 64;
    p.throttle = 0.85;
    p.targetThrottle = 0.85;
    p.pitch = 0.05;
    p.roll = 0.95; // hard bank: the contrails start streaming at once
    spawnRingBurst(game.particles, r0);
    showMessage('STORM RIDGE — GUSTING CROSSWIND', 6);
  } else if (shot === 'flight' || shot === 'cockpit') {
    startMission(0);
    // Line the plane up 260 m behind the first ring, nose on it, so the
    // ring sits ahead in frame: the cover shot is a real moment of play.
    const r0 = game.rings[0];
    const dx = r0.x - 0;
    const dz = r0.z - (-200);
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    const p = game.plane;
    p.x = r0.x - ux * 260;
    p.z = r0.z - uz * 260;
    p.alt = r0.y;
    p.heading = Math.atan2(ux, uz);
    p.speed = 58;
    p.throttle = 0.68;
    p.targetThrottle = 0.68;
    p.pitch = 0.06;
    if (shot === 'cockpit') game.camera = 'cockpit';
    showMessage('', 0);
  } else if (shot === 'takeoff') {
    startMission(2);
    const p = game.plane;
    p.speed = 30;
    p.throttle = 0.9;
    p.targetThrottle = 0.9;
    showMessage('', 0);
  } else if (shot === 'landing') {
    startMission(2);
    game.rings.forEach((r) => { r.passed = true; });
    game.ringsPassed = game.rings.length;
    game.score = 420;
    const p = game.plane;
    p.x = 8;
    p.z = -420;
    p.alt = 42;
    p.heading = 0.02;
    p.speed = 40;
    p.throttle = 0.32;
    p.targetThrottle = 0.32;
    p.pitch = -0.04;
    p.gearDown = true;
    showMessage('FINAL — RUNWAY 36 AHEAD', 6);
  }
}

let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  handleMenus();
  update(dt);
  render();
  clearPressed(input);
  requestAnimationFrame(frame);
}

applyShotPreset();
requestAnimationFrame(frame);

// A small handle for headless play-testing: window.SKYLINE exposes the live
// game object so an automated check can read state without touching the DOM.
window.SKYLINE = game;

// And one for the screenshot script: re-arm the new-mission effects on cue.
window.SKYLINE_FX = {
  burstNextRing() {
    const ring = nextRing();
    if (ring) spawnRingBurst(game.particles, ring);
  },
  bankHard() {
    game.plane.roll = 0.95;
  },
};
