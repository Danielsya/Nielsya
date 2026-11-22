// Cinderport v3 — dossier builder entrypoint for make.fun gta6-01.
// Written by the agent in the v3 recording: copies the playable game and the
// screenshots into the output directory and builds dossier.json with the
// competition's caps, using the kit's own buildDossier helper.
import { buildDossier } from "./vendor/makefun-game.ts";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, "game"), { recursive: true });
cpSync("game", join(outDir, "game"), { recursive: true });
if (existsSync("screenshots")) {
  cpSync("screenshots", join(outDir, "screenshots"), { recursive: true });
}

// Caps the grader enforces for a game entry: text files, single files,
// the whole game tree, and the number of files and directories in it.
const caps = {
  text_max_bytes: 1024 * 1024,
  file_max_bytes: 1024 * 1024,
  total_max_bytes: 48 * 1024 * 1024,
  files_max: 993,
};
const dossier = await buildDossier(outDir, caps);
const dossierPath = join(outDir, "dossier.json");
// buildDossier returns the dossier as bytes; write them verbatim, not
// re-serialized, so the file the grader reads is exactly what it built.
if (dossier instanceof Uint8Array) {
  writeFileSync(dossierPath, dossier);
} else {
  writeFileSync(dossierPath, JSON.stringify(dossier, null, 2) + "\n");
}
// Read the dossier back to prove it is valid JSON before the grader runs.
const parsed = JSON.parse(readFileSync(dossierPath, "utf8"));
console.log(`Cinderport dossier written to ${dossierPath} (${Object.keys(parsed).length} top-level keys)`);
