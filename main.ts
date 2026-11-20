// Neon Shores — the entry program for make.fun's gta6-01 bounty.
//
// It hands the game in: copies this repository's game/ (the playable
// open-world game as plain static files) and screenshots/ (four real
// renders of the game) into the grader's output directory and writes
// /output/dossier.json with the vendored make.fun library, so the sealed
// scorer can check the entry and the judge can read it.
//
// The grader runs this program twice, as an unprivileged user, against a
// read-only copy of the repository, with the output directory a locked
// mount root the program may fill but never remove. So the program never
// deletes the output directory itself: it empties only the entries inside
// it, making each one writable first (copies of a read-only tree inherit
// read-only modes, and a second run must still be able to clear them).
// It also never writes anywhere else — the repository tree is read-only
// in the grader, and nothing in this program touches it.

import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the directory this file lives in, however the
// grader checked it out; the output directory is the platform's own.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps the sealed scorer holds an entry to (the kit's reference).
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Make a path and everything under it writable, so a later clear can
// remove it even when it was copied from a read-only repository.
function makeWritable(path: string): void {
  const st = lstatSync(path);
  if (st.isDirectory()) {
    for (const child of readdirSync(path)) makeWritable(join(path, child));
    chmodSync(path, 0o755);
  } else {
    chmodSync(path, 0o644);
  }
}

// Empty the output directory's contents. The directory itself is left
// exactly where it is — removing it would fail on the grader's mount.
function emptyOutputDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const child of readdirSync(dir)) {
    const childPath = join(dir, child);
    makeWritable(childPath);
    rmSync(childPath, { recursive: true, force: true });
  }
}

function handIn(): void {
  emptyOutputDir(outputDir);
  cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  const shots = join(repoRoot, 'screenshots');
  if (existsSync(shots)) cpSync(shots, join(outputDir, 'screenshots'), { recursive: true });
  writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, dossierCaps));
  console.log(`Neon Shores handed in: game/ + screenshots/ + dossier.json in ${outputDir}`);
}

handIn();
