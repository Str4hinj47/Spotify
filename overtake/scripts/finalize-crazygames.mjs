// Turns the portal Vite build into the upload layout CrazyGames expects:
// index.html at the zip root, relative assets, one shared code bundle.
import { rename, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const out = 'dist-crazygames';
const play = path.join(out, 'play.html');
const index = path.join(out, 'index.html');
if (!existsSync(play)) throw new Error(`Missing ${play}; run "vite build --mode portal" first.`);
await rename(play, index);

let html = await readFile(index, 'utf8');
// Portal builds must not navigate back to the marketing site. The account
// element stays in the DOM (the game toggles it) but loses its link target.
const before = html;
html = html.replace(/<a class="site-link"[^>]*>[^<]*<\/a>/, '')
  .replace(/(<a id="btn-account"[^>]*?)\shref="[^"]*"/, '$1');
if (html !== before) await writeFile(index, html);
const absolute = [...html.matchAll(/(?:src|href)="(?!https?:|data:|#|\.\/)([^"]+)"/g)].map(m => m[1]);
if (absolute.length) throw new Error(`Non-relative asset paths in index.html: ${absolute.join(', ')}`);
if (!html.includes('sdk.crazygames.com/crazygames-sdk-v3.js')) throw new Error('CrazyGames SDK script is missing from index.html');
if (!html.includes('src="./assets/')) throw new Error('The game bundle is not referenced relatively');

let bytes = 0, files = 0;
const largest = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else {
      const info = await stat(full);
      bytes += info.size; files += 1;
      largest.push({ file: full, size: info.size });
    }
  }
}
await walk(out);
largest.sort((a, b) => b.size - a.size);
const mb = n => `${(n / 1024 / 1024).toFixed(1)} MB`;
if (bytes > 50 * 1024 * 1024) throw new Error(`Portal build is ${mb(bytes)}; CrazyGames initial download limit is 50 MB.`);
if (files > 1500) throw new Error(`Portal build has ${files} files; CrazyGames limit is 1500.`);

await writeFile(path.join(out, 'portal-build-report.txt'), [
  'OVERTAKE — CrazyGames portal build',
  `Entry: index.html (game), relative assets`,
  `Files: ${files}`,
  `Size: ${mb(bytes)} (limit 50 MB initial / 250 MB total / 1500 files)`,
  'Largest files:',
  ...largest.slice(0, 8).map(f => `  ${mb(f.size)}  ${path.relative(out, f.file)}`),
  '',
  'Upload the CONTENTS of this folder as a zip: index.html must be at the zip root.',
  'Ads: midgame between runs, rewarded double on results, rewarded gems in the season pass, one responsive banner in the season pass.',
  'IAP: not configured (invite-only on CrazyGames).',
].join('\n'));

console.log(`CrazyGames build ready: ${files} files, ${mb(bytes)}, largest ${path.relative(out, largest[0].file)} (${mb(largest[0].size)})`);
