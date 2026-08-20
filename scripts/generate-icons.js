// Generates all icon formats from the SVG sources in build/icons/:
//
//   icon.svg     -> icon.png  (1024x1024, Linux + generic)
//                   icon.ico  (Windows app/executable icon)
//                   icon.icns (macOS app bundle icon)
//
//   document.svg -> document.png
//                   document.ico  (Windows .md file-type icon)
//                   document.icns (macOS .md document-type icon)
//
// The document icons are the ones Explorer/Finder show on Markdown *files*
// once Folio is registered as their handler — see `fileAssociations` in
// package.json. Keeping them distinct from the app icon means associating .md
// with Folio doesn't turn every Markdown file into an app-tile icon.
//
// Run via `npm run icons`. Requires the dev-only `sharp` and `png2icons`
// packages (installed on demand — see the npm script).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const png2icons = require('png2icons');

const dir = path.join(__dirname, '..', 'build', 'icons');
const SOURCES = ['icon', 'document'];

async function build(name) {
  const svg = path.join(dir, `${name}.svg`);
  if (!fs.existsSync(svg)) {
    throw new Error(`Missing source icon: ${svg}`);
  }

  // Master PNG at 1024 for the sharpest downscales.
  const master = await sharp(svg).resize(1024, 1024).png().toBuffer();
  fs.writeFileSync(path.join(dir, `${name}.png`), master);

  // .ico and .icns are built from the master PNG. BICUBIC keeps edges clean.
  const ico = png2icons.createICO(master, png2icons.BICUBIC, 0, false);
  if (!ico) throw new Error(`Failed to build ${name}.ico`);
  fs.writeFileSync(path.join(dir, `${name}.ico`), ico);

  const icns = png2icons.createICNS(master, png2icons.BICUBIC, 0);
  if (!icns) throw new Error(`Failed to build ${name}.icns`);
  fs.writeFileSync(path.join(dir, `${name}.icns`), icns);

  console.log(`[icons] wrote ${name}.png, ${name}.ico, ${name}.icns`);
}

async function main() {
  for (const name of SOURCES) {
    await build(name);
  }
}

main().catch((err) => {
  console.error(`[icons] ${err.message}`);
  process.exit(1);
});
