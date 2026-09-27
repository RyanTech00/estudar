// Checks that every internal link with a #fragment points to an existing id. Run after `vitepress build`.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.vitepress', 'dist');

async function htmlFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await htmlFiles(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const pages = new Map();
for (const f of await htmlFiles(DIST)) {
  const rel = '/' + path.relative(DIST, f).replace(/\\/g, '/').replace(/index\.html$/, '').replace(/\.html$/, '');
  pages.set(rel, await readFile(f, 'utf8'));
}

let broken = 0;
for (const [from, html] of pages) {
  for (const [, href] of html.matchAll(/href="([^"]*#[^"]+)"/g)) {
    if (/^https?:/.test(href)) continue;
    const [p, frag] = href.split('#');
    const target = p === '' ? from : p.replace(/\.html$/, '');
    const page = pages.get(target) ?? pages.get(target.replace(/\/$/, '')) ?? pages.get(target + '/');
    if (!page) { console.log(`✗ ${from} → ${href} (página não existe)`); broken++; continue; }
    if (!page.includes(`id="${decodeURIComponent(frag)}"`)) { console.log(`✗ ${from} → ${href}`); broken++; }
  }
}
console.log(broken ? `${broken} âncora(s) partida(s)` : 'Todas as âncoras existem.');
process.exit(broken ? 1 : 0);
