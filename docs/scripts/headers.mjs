// Writes .vitepress/dist/_headers (Cloudflare Pages) after `vitepress build`.
// VitePress puts a few small inline scripts in every page (theme, platform, hash map). Instead of allowing
// every inline script ('unsafe-inline'), the CSP lists the SHA-256 of exactly the ones this build produced.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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

const hashes = new Set();
for (const f of await htmlFiles(DIST)) {
  const html = await readFile(f, 'utf8');
  for (const [, body] of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
}

const csp = [
  "default-src 'self'",
  `script-src 'self' ${[...hashes].join(' ')}`,
  // Vue sets style attributes at runtime (e.g. the sidebar); no stylesheets or fonts from other origins.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: https://img.buymeacoffee.com",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const headers = `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=63072000

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
await writeFile(path.join(DIST, '_headers'), headers);
console.log(`_headers written (${hashes.size} inline script hashes)`);
