// Skyline Run — keyboard and mouse. The mouse steers like a virtual stick
// (move to bank and pitch), the wheel works the throttle, and every key
// the game needs is listed on the title screen.

import { clamp } from './util.js';

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    // Stick: -1..1 from mouse position relative to canvas centre.
    stickX: 0,
    stickY: 0,
    mouseActive: false,
    wheelDelta: 0,
    // Edge-triggered actions, consumed once by the game loop.
    pressed: new Set(),
    clicked: null, // { x, y } in canvas pixels, consumed once
  };

  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (!e.repeat) input.pressed.add(k);
    input.keys.add(k);
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(keyName(e));
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseActive = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    input.stickX = clamp((x - canvas.width / 2) / (canvas.width / 2), -1, 1);
    input.stickY = clamp((y - canvas.height / 2) / (canvas.height / 2), -1, 1);
    input.mouseActive = true;
  });
  canvas.addEventListener('mouseleave', () => {
    input.mouseActive = false;
    input.stickX = 0;
    input.stickY = 0;
  });
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    input.clicked = { x, y };
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    input.wheelDelta += e.deltaY;
  }, { passive: false });
  // A right-click is not a control: keep the menu from interrupting a flight.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return input;
}

// Read the current control demands for the flight model.
// Returns { pitch, roll, yaw, throttleDelta, brake }.
export function readFlightControls(input, dt) {
  const k = input.keys;
  let pitch = 0;
  let roll = 0;
  if (k.has('ArrowUp')) pitch += 1;
  if (k.has('ArrowDown')) pitch -= 1;
  if (k.has('ArrowLeft') || k.has('a')) roll -= 1;
  if (k.has('ArrowRight') || k.has('d')) roll += 1;
  if (input.mouseActive) {
    // The stick blends with the keys; the stronger input wins each axis.
    if (Math.abs(input.stickX) > Math.abs(roll)) roll = input.stickX;
    if (Math.abs(input.stickY) > Math.abs(pitch)) pitch = -input.stickY;
  }
  let yaw = 0;
  if (k.has('q')) yaw -= 1;
  if (k.has('e')) yaw += 1;

  let throttleDelta = 0;
  if (k.has('w') || k.has('Shift')) throttleDelta += 0.55;
  if (k.has('s') || k.has('Control')) throttleDelta -= 0.55;
  if (input.wheelDelta !== 0) {
    throttleDelta += clamp(-input.wheelDelta / 240, -1, 1) * 0.5;
    input.wheelDelta = 0;
  }
  const brake = k.has(' ') || k.has('b');
  return { pitch, roll, yaw, throttleDelta, brake };
}

// True once when the key was pressed since the last call; then forgotten.
export function wasPressed(input, key) {
  if (input.pressed.has(key)) {
    input.pressed.delete(key);
    return true;
  }
  return false;
}

export function clearPressed(input) {
  input.pressed.clear();
  input.clicked = null;
}
