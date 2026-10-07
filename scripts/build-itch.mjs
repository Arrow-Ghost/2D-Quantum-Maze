/**
 * Build an itch.io-ready ZIP of the site.
 *
 * itch.io serves HTML games from a sub-path inside an iframe
 * (e.g. https://html-classic.itch.zone/html/12345/index.html), so Astro's
 * root-absolute URLs like "/_astro/app.js" or "/levels" would 404 there.
 * This script builds the site, copies it to dist-itch/site, rewrites every
 * root-absolute URL to a relative one, and zips it with index.html at the
 * ZIP root (which itch.io requires).
 *
 *   npm run build:itch   ->   dist-itch/quantum-maze-itch.zip
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const outDir = path.join(root, 'dist-itch');
const site = path.join(outDir, 'site');
const zipPath = path.join(outDir, 'quantum-maze-itch.zip');

console.log('> astro build');
execFileSync(process.execPath, [path.join(root, 'node_modules', 'astro', 'astro.js'), 'build'], {
  cwd: root,
  stdio: 'inherit',
});

// Replace only the build output; anything else in dist-itch/ (e.g. screenshots) is kept.
fs.rmSync(site, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.cpSync(dist, site, { recursive: true });

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

/** "/levels?x=1" -> "<prefix>levels/index.html?x=1"; "/_astro/a.js" -> "<prefix>_astro/a.js" */
function toRelative(url, prefix) {
  const m = url.match(/^\/([^?#]*)([?#].*)?$/);
  if (!m) return url;
  let p = m[1];
  const tail = m[2] || '';
  if (p === '') p = 'index.html';
  else if (!/\.[a-z0-9]+$/i.test(p.split('/').pop())) p = p.replace(/\/?$/, '/index.html');
  return prefix + p + tail;
}

let htmlCount = 0;
for (const file of walk(site).filter((f) => f.endsWith('.html'))) {
  const depth = path.relative(site, path.dirname(file)).split(path.sep).filter(Boolean).length;
  const prefix = depth === 0 ? './' : '../'.repeat(depth);
  const src = fs.readFileSync(file, 'utf8');
  const out = src.replace(/\b(href|src|action)="(\/(?!\/)[^"]*)"/g, (_, attr, url) => `${attr}="${toRelative(url, prefix)}"`);
  fs.writeFileSync(file, out);
  htmlCount++;
}

// The game page's "Next sector" button navigates from JS. That script only runs
// on game/index.html, so the targets are relative to that page.
let jsFixed = 0;
for (const file of walk(path.join(site, '_astro')).filter((f) => f.endsWith('.js'))) {
  const src = fs.readFileSync(file, 'utf8');
  const out = src.replace(/`\/game\?level=/g, '`index.html?level=').replace(/"\/levels"/g, '"../levels/index.html"');
  if (out !== src) {
    fs.writeFileSync(file, out);
    jsFixed++;
  }
}

// Fail loudly if anything root-absolute survived.
const leftovers = walk(site)
  .filter((f) => /\.(html|js|css)$/.test(f))
  .flatMap((f) => {
    const s = fs.readFileSync(f, 'utf8');
    const hits = s.match(/(?:href|src|action)="\/(?!\/)[^"]*"|["'`]\/(?:_astro|game|levels|lab|tutorial|leaderboard|settings)\b[^"'`]*["'`]/g) || [];
    return hits.map((h) => `${path.relative(site, f)}: ${h}`);
  });
if (leftovers.length) {
  console.error('Root-absolute URLs remain:\n' + leftovers.join('\n'));
  process.exit(1);
}

// Zip with forward-slash entry names and index.html at the root. (Windows
// PowerShell's Compress-Archive writes backslashes, which itch.io can't read.)
const entries = fs.readdirSync(site);
if (process.platform === 'win32') {
  execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-a', '-cf', zipPath, ...entries], { cwd: site });
} else {
  try {
    execFileSync('zip', ['-qr', zipPath, ...entries], { cwd: site });
  } catch {
    execFileSync('tar', ['-a', '-cf', zipPath, ...entries], { cwd: site });
  }
}
const magic = fs.readFileSync(zipPath).subarray(0, 2).toString();
if (magic !== 'PK') {
  console.error(`${zipPath} is not a ZIP archive.`);
  process.exit(1);
}

const kb = Math.round(fs.statSync(zipPath).size / 1024);
console.log(`\nRewrote ${htmlCount} HTML files and ${jsFixed} JS file(s).`);
console.log(`itch.io ZIP ready: ${path.relative(root, zipPath)} (${kb} KB)`);
