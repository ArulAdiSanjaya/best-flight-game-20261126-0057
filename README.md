# Skyline Run — Flight Game

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057/entries)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete, original, offline flight game for the [make.fun bounty](https://make.fun/bounty/best-flight-game-20261126-0057): fly a little red bush plane over a procedurally built valley, thread glowing rings, mind your fuel, and bring her home onto the strip.

## How to play

Open `game/index.html` in desktop Chrome (or serve `game/` with any static
server). No network, no build step, no assets to download — everything is
drawn in code.

| Control | What it does |
| --- | --- |
| W / S or Shift / Ctrl | Throttle up / down (mouse wheel works too) |
| Arrow keys or mouse | Steer — the mouse is a virtual stick |
| Q / E | Rudder (yaw) |
| Space | Airbrake |
| G | Landing gear up / down |
| C | Chase view / cockpit view (lit instruments) |
| P | Pause · M mute · R restart |

## The three sorties

1. **Ring Run** — thread all 8 rings over the valley, in order.
2. **Valley Dash** — 10 rings against a 2:30 clock; seconds left are worth points.
3. **Runway Return** — take off from Runway 36, thread 3 guide rings, then land back on the centreline: gentle, slow, gear down.

Flying rewards throttle and turn discipline: below stall speed the wing stops
flying, climbs bleed speed, and a hard or misaligned touchdown is a crash.
Fuel is finite — an empty tank means a glide home. Rings pay 100 points plus
your speed through them; a gentle runway landing pays 250 plus fuel left.

## Layout

- `game/` — the playable game as static files (`index.html` + ES modules)
  - `js/main.js` — state machine, camera, render loop, `?shot=` presets
  - `js/physics.js` — the flight model (throttle, lift, stall, landings)
  - `js/terrain.js` — the valley: height, fields, river, town, runway, sky
  - `js/aircraft.js` — the plane, the rings and the runway furniture
  - `js/hud.js` — HUD, lit cockpit instruments, compass and screens
  - `js/missions.js` — the three sorties and their scoring
  - `js/input.js` — keyboard + mouse
  - `js/audio.js` — synthesised engine, wind and chimes (WebAudio, no files)
  - `js/util.js` — seeded randomness and formatting
- `screenshots/` — 4 real renders of the game's own code
- `main.ts` — the hand-in program (Node 22, standard library only)
- `vendor/makefun-game.ts` — make.fun's dossier library, copied from the kit unchanged

## Hand-in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with `buildDossier` from `vendor/makefun-game.ts`. Running it
twice writes byte-identical output.
