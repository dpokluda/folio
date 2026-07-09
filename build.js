// Bundles the renderer (markdown-it + CodeMirror 6 + highlight.js) into a single
// IIFE that index.html loads. Run via `npm run build:renderer` (or with --watch).
const esbuild = require('esbuild');
const path = require('path');

const watch = process.argv.includes('--watch');

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
