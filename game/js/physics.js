// Skyline Run — the flight model: an arcade plane with just enough discipline
// to reward good flying. Throttle sets thrust, pitch trades speed for height,
// roll turns the nose, and slow flight near the ground ends badly.

import { clamp, lerp, makeNoise2D, wrapAngle } from './util.js';
import { terrainHeight, WORLD } from './terrain.js';

export const PLANE = {
  stallSpeed: 24,      // m/s — below this the wing stops flying
  maxSpeed: 105,       // m/s at full throttle, level flight
  cruiseSpeed: 62,
  maxPitch: 0.55,      // radians of nose up/down the pilot can command
  maxRoll: 1.15,       // radians of bank
  turnRate: 0.55,      // heading radians per second at full bank
  fuelCapacity: 100,   // arbitrary units; full throttle burns ~1.1/s
  fuelBurn: 1.1,
  takeoffSpeed: 30,    // m/s needed to lift off the runway
};

export function createPlane() {
  return {
    x: 0,
    z: WORLD.runwayStartZ + 40,
    alt: 0,                 // metres above sea level; ground is terrainHeight
    heading: 0,             // 0 = north, increases clockwise
    pitch: 0,
    roll: 0,
    speed: 0,               // m/s
    throttle: 0,
    targetThrottle: 0,
    fuel: PLANE.fuelCapacity,
    gearDown: true,
    damage: 0,              // 0..100; 100 is a crash
    verticalSpeed: 0,       // m/s, for the HUD and landing judgement
    onGround: true,
    airborne: false,
    engineOut: false,
    // Wind: strength is set by the mission (0 calm .. 1 storm). The live
    // vector and gust level are recomputed every step for the HUD.
    windStrength: 0,
    windX: 0,
    windZ: 0,
    gust: 0,
    flightTime: 0,
  };
}

// The wind field: a mostly-westerly flow whose strength swells and chops
// with seeded noise, so a given mission always blows the same way. The
// vector is hard-capped at MAX_WIND * strength metres per second.
export const MAX_WIND = 13;
const gustSwell = makeNoise2D(90210);
const gustChop = makeNoise2D(5150);

export function updateWind(plane) {
  const s = plane.windStrength || 0;
  if (s <= 0) {
    plane.windX = 0;
    plane.windZ = 0;
    plane.gust = 0;
    return;
  }
  const t = plane.flightTime;
  const swell = gustSwell(t * 0.11, 3.7);
  const chop = gustChop(t * 0.45, 9.1);
  const gustAmt = clamp(0.55 + swell * 0.45 + chop * 0.25, 0, 1.25);
  const dir = 0.9 + gustSwell(7.3, t * 0.03) * 0.7;
  let wx = -Math.cos(dir) * 11 * gustAmt * s;
  let wz = Math.sin(dir) * 6.6 * gustAmt * s;
  const mag = Math.hypot(wx, wz);
  const cap = MAX_WIND * s;
  if (mag > cap) {
    wx = (wx / mag) * cap;
    wz = (wz / mag) * cap;
  }
  plane.windX = wx;
  plane.windZ = wz;
  plane.gust = clamp(gustAmt - 0.35, 0, 1);
}

// One physics step. `input` carries the pilot's demands for this frame:
// { pitch: -1..1 (1 = pull up), roll: -1..1, throttleDelta, brake }.
export function stepPlane(plane, input, dt) {
  const ground = terrainHeight(plane.x, plane.z);
  plane.onGround = plane.alt <= ground + 0.05;
  const wasOnGround = plane.onGround;
  plane.flightTime += dt;
  updateWind(plane);

  // Throttle follows the lever, unless the tanks are dry.
  plane.targetThrottle = clamp(plane.targetThrottle + input.throttleDelta * dt, 0, 1);
  if (plane.fuel <= 0) {
    plane.targetThrottle = 0;
    plane.engineOut = true;
  }
  plane.throttle = lerp(plane.throttle, plane.targetThrottle, clamp(dt * 1.6, 0, 1));
  if (plane.fuel > 0) {
    plane.fuel = Math.max(0, plane.fuel - plane.throttle * PLANE.fuelBurn * dt);
  }

  // Pitch and roll ease toward what the pilot asks for.
  const targetPitch = input.pitch * PLANE.maxPitch;
  const targetRoll = input.roll * PLANE.maxRoll;
  plane.pitch = lerp(plane.pitch, targetPitch, clamp(dt * 2.2, 0, 1));
  plane.roll = lerp(plane.roll, targetRoll, clamp(dt * 2.6, 0, 1));

  // Speed: thrust pushes, drag and climbs pull back, descents add speed.
  // The divisor keeps acceleration brisk but not twitchy: full throttle
  // lifts the plane off the strip in about six seconds.
  const thrust = plane.throttle * PLANE.maxSpeed;
  const drag = plane.speed * 0.55;
  const climbCost = Math.sin(plane.pitch) * 34;
  let accel = (thrust - drag - climbCost) / 18;
  if (input.brake) accel -= 14;
  plane.speed = Math.max(0, plane.speed + accel * dt);

  // Turning is banked: the nose follows the roll, faster when faster.
  const speedFactor = clamp(plane.speed / PLANE.cruiseSpeed, 0.25, 1.4);
  plane.heading = wrapAngle(
    plane.heading + Math.sin(plane.roll) * PLANE.turnRate * speedFactor * dt
      + (input.yaw || 0) * 0.35 * dt,
  );

  // Lift: the wing flies above stall speed; below it the plane sinks.
  const stalled = plane.speed < PLANE.stallSpeed;
  let vs;
  if (plane.onGround && plane.speed < PLANE.takeoffSpeed) {
    vs = 0;
  } else if (stalled) {
    vs = -6 - (PLANE.stallSpeed - plane.speed) * 0.35 + Math.sin(plane.pitch) * plane.speed * 0.4;
  } else {
    vs = Math.sin(plane.pitch) * plane.speed * 0.92;
  }
  if (input.brake && plane.onGround) vs = 0;
  // Gust turbulence: a bounded vertical bump while airborne in rough air.
  if (!plane.onGround && plane.gust > 0) {
    vs += Math.sin(plane.flightTime * 7.3) * plane.gust * 1.8;
  }
  plane.verticalSpeed = vs;
  plane.alt += vs * dt;

  // Move across the valley. The wind only pushes a plane that is actually
  // in the air — a parked plane sits still, a flying one drifts.
  const dx = Math.sin(plane.heading) * plane.speed * dt;
  const dz = Math.cos(plane.heading) * plane.speed * dt;
  const drift = plane.onGround ? 0 : 1;
  plane.x += dx + plane.windX * drift * dt;
  plane.z += dz + plane.windZ * drift * dt;
  plane.airborne = !plane.onGround && plane.alt > ground + 2;

  // The ground is hard — but only a real arrival counts as a touchdown.
  // A plane sitting or taxiing on the strip must not be "landing" every frame.
  const newGround = terrainHeight(plane.x, plane.z);
  if (plane.alt <= newGround) {
    plane.alt = newGround;
    const wasAirborne = !wasOnGround;
    if (wasAirborne || vs < -1) {
      return judgeTouchdown(plane, vs, newGround, dt);
    }
    return null;
  }
  return null;
}

// Called when the wheels (or the belly) meet the ground.
function judgeTouchdown(plane, vs, ground, dt) {
  const onRunway = Math.abs(plane.x) <= WORLD.runwayHalfWidth + 4
    && plane.z >= WORLD.runwayStartZ && plane.z <= WORLD.runwayEndZ;
  // Gentle means a flare, not a dive: a normal approach sinks about
  // 2–4 m/s, so the limit sits just above that.
  const gentle = Math.abs(vs) < 4.5;
  const aligned = Math.abs(wrapAngle(plane.heading - WORLD.runwayHeading)) < 0.35
    || Math.abs(wrapAngle(plane.heading - WORLD.runwayHeading - Math.PI)) < 0.35;
  const slowEnough = plane.speed < 52;
  if (onRunway && gentle && aligned && slowEnough && plane.gearDown) {
    // A landing: bleed speed, stay on the strip.
    plane.speed = Math.max(0, plane.speed - 26 * dt);
    return { kind: 'landed', vs, onRunway: true };
  }
  if (plane.speed < 8 && Math.abs(vs) < 1.5 && plane.gearDown) {
    // Rolling to a stop on grass: survivable, but no style points.
    plane.speed = Math.max(0, plane.speed - 10 * dt);
    return { kind: 'landed', vs, onRunway: false };
  }
  // Anything else is a crash. Hard hits hurt more.
  const impact = Math.abs(vs) * 9 + plane.speed * 0.55;
  plane.damage = Math.min(100, plane.damage + impact);
  plane.speed = Math.max(0, plane.speed * 0.4);
  return { kind: 'crash', vs, damage: plane.damage, onRunway };
}
