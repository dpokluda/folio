// Bundles the renderer (markdown-it + CodeMirror 6 + highlight.js) into a single
// IIFE that index.html loads. Run via `npm run build:renderer` (or with --watch).
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');

// Vendor KaTeX's stylesheet + web fonts next to the bundle so math renders
// offline (no CDN, CSP-friendly). These are generated assets — like bundle.js
// they're gitignored and recreated on every build. Only woff2 is copied: every
// modern Chromium (incl. the headless one used for PDF export) supports it, and
// katex.min.css always lists a woff2 source first, so woff/ttf are never fetched.
function copyKatexAssets() {
  const src = path.join(__dirname, 'node_modules', 'katex', 'dist');
  const dest = path.join(__dirname, 'src', 'renderer', 'katex');
  const fontsSrc = path.join(src, 'fonts');
  const fontsDest = path.join(dest, 'fonts');
  fs.mkdirSync(fontsDest, { recursive: true });
  fs.copyFileSync(path.join(src, 'katex.min.css'), path.join(dest, 'katex.min.css'));
  for (const f of fs.readdirSync(fontsSrc)) {
    if (f.endsWith('.woff2')) fs.copyFileSync(path.join(fontsSrc, f), path.join(fontsDest, f));
  }
  console.log('[folio] KaTeX assets copied.');
}

const options = {
  entryPoints: [path.join(__dirname, 'src', 'renderer', 'renderer.js')],
  bundle: true,
  outfile: path.join(__dirname, 'src', 'renderer', 'bundle.js'),
  platform: 'browser',
  format: 'iife',
  target: ['chrome120'],
  sourcemap: true,
  logLevel: 'info',
};

async function run() {
  copyKatexAssets();
  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log('[folio] esbuild watching renderer…');
  } else {
    await esbuild.build(options);
    console.log('[folio] renderer bundle built.');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
