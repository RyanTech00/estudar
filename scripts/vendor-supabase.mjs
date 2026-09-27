// Bundles the Supabase client into public/vendor/supabase.js, so the app never loads code from a CDN at runtime.
// The version is pinned in package.json (devDependencies); run `npm run vendor` after upgrading it.
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const { version } = JSON.parse(await readFile(new URL('../node_modules/@supabase/supabase-js/package.json', import.meta.url), 'utf8'));
await build({
  stdin: { contents: "export { createClient } from '@supabase/supabase-js';", resolveDir: process.cwd() },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'eof',
  banner: { js: `// @supabase/supabase-js ${version} (MIT) — bundled by scripts/vendor-supabase.mjs` },
  outfile: 'public/vendor/supabase.js',
});
console.log(`public/vendor/supabase.js ← @supabase/supabase-js ${version}`);
