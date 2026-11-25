// Build the offline entry using only files shipped beside this entrypoint.
import { copyFileSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, parse, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const source = dirname(fileURLToPath(import.meta.url));
const output = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
const trees = ['game', 'screenshots'];

// An output path must never overwrite this entry or either input tree.
if (output === parse(output).root || source === output || source.startsWith(output + sep)) {
  throw new Error('Choose an output directory separate from the source repository');
}
for (const name of [...trees, 'vendor']) {
  const input = join(source, name);
  if (output === input || output.startsWith(input + sep)) throw new Error('Output overlaps ' + name);
}

function copyTree(from: string, to: string): void {
  const info = lstatSync(from);
  if (info.isFile()) {
    copyFileSync(from, to);
    return;
  }
  if (!info.isDirectory()) throw new Error('Only regular files and directories are allowed: ' + from);
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from).sort()) copyTree(join(from, name), join(to, name));
}

mkdirSync(output, { recursive: true });
for (const name of trees) {
  const destination = join(output, name);
  rmSync(destination, { recursive: true, force: true });
  copyTree(join(source, name), destination);
}

const dossier = buildDossier(output, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(output, 'dossier.json'), dossier);
console.log('Simmer & Serve: game, four screenshots and deterministic dossier written.');
