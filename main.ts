// Skyline Run — the hand-in program (Node 22, standard library only).
//
// It copies the game and its screenshots from beside this file into the
// output directory and writes dossier.json there with make.fun's vendored
// library, exactly as the kit's starter does. The output is deterministic:
// the same repository always writes the same bytes, so the grader's two
// runs agree. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's caps, as in the kit: they refuse an entry the scorer would
// refuse (more than 4 screenshots or one over 256 KiB; more than 993 files
// in game/ or 48 MiB of game files in all, or a path under game/ over
// 1000 bytes). Only text_max_bytes shapes the dossier's bytes.
const dossierOptions = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Build the dossier twice and demand the same bytes: the grader runs this
// program twice and compares, so a wobble here would fail the entry.
// (buildDossier returns a Uint8Array, so compare byte by byte, not by
// object identity.)
const dossierFirst = buildDossier(outDir, dossierOptions);
const dossierSecond = buildDossier(outDir, dossierOptions);
const sameBytes = dossierFirst.length === dossierSecond.length
  && dossierFirst.every((byte, i) => byte === dossierSecond[i]);
if (!sameBytes) {
  throw new Error('dossier is not deterministic between builds');
}
writeFileSync(join(outDir, 'dossier.json'), dossierFirst);
