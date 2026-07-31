/**
 * Regenerates every app icon asset from assets/measuresone.png.
 *
 * The source art is an "M" glyph in a blue gradient on a flat off-white
 * background (no alpha channel). This script keys out the background to
 * produce a transparent foreground for Android's adaptive icon, and pairs
 * it with a flat brand-blue background layer sampled from the glyph itself.
 *
 * Run: node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp-compact');

const ASSETS = path.join(__dirname, '..', 'assets');
const SOURCE = path.join(ASSETS, 'measuresone.png');

/** True if a pixel is close enough to white to count as background. */
function isBackground(r, g, b) {
  return r > 235 && g > 235 && b > 235;
}

/** Bounding box of non-background pixels. */
function glyphBounds(image) {
  const { width, height, data } = image.bitmap;
  let minX = width, minY = height, maxX = -1, maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (width * y + x) * 4;
      if (!isBackground(data[o], data[o + 1], data[o + 2])) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Colour a little way inside a corner of the glyph, used as a gradient stop. */
function sampleAt(image, fx, fy) {
  const x = Math.round(image.bitmap.width * fx);
  const y = Math.round(image.bitmap.height * fy);
  const c = Jimp.intToRGBA(image.getPixelColor(x, y));
  return [c.r, c.g, c.b];
}

function gradientCanvas(size, from, to) {
  const canvas = new Jimp(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x / size + y / size) / 2;
      const r = Math.round(from[0] + (to[0] - from[0]) * t);
      const g = Math.round(from[1] + (to[1] - from[1]) * t);
      const b = Math.round(from[2] + (to[2] - from[2]) * t);
      canvas.setPixelColor(Jimp.rgbaToInt(r, g, b, 255), x, y);
    }
  }
  return canvas;
}

async function main() {
  if (!fs.existsSync(SOURCE)) throw new Error(`Missing source art: ${SOURCE}`);

  const source = await Jimp.read(SOURCE);
  const box = glyphBounds(source);
  console.log(`source ${source.bitmap.width}x${source.bitmap.height} → glyph ${box.w}x${box.h}`);

  const from = sampleAt(source, box.x / source.bitmap.width + 0.05, box.y / source.bitmap.height + 0.05);
  const to = sampleAt(source, (box.x + box.w) / source.bitmap.width - 0.05, (box.y + box.h) / source.bitmap.height - 0.05);
  console.log('gradient', from, '→', to);

  // --- icon.png / splash-icon.png: glyph padded down to ~55% of the canvas
  // on a white background. The source's own margin (~66%) reads as too
  // large once iOS/Android apply their corner rounding on top of it. ---
  const ICON = 1024;
  const iconSafe = Math.round(ICON * 0.55);
  const iconScale = iconSafe / Math.max(box.w, box.h);
  const iw = Math.round(box.w * iconScale);
  const ih = Math.round(box.h * iconScale);
  const iconGlyph = source.clone().crop(box.x, box.y, box.w, box.h).resize(iw, ih);
  const iconCanvas = new Jimp(ICON, ICON, 0xFFFFFFFF);
  iconCanvas.composite(iconGlyph, Math.round((ICON - iw) / 2), Math.round((ICON - ih) / 2));
  await iconCanvas.clone().writeAsync(path.join(ASSETS, 'icon.png'));
  await iconCanvas.clone().writeAsync(path.join(ASSETS, 'splash-icon.png'));

  // --- favicon ---
  await iconCanvas.clone().resize(48, 48).writeAsync(path.join(ASSETS, 'favicon.png'));

  // --- Glyph with background keyed out to transparency, cropped tight ---
  const glyph = source.clone().crop(box.x, box.y, box.w, box.h);
  const { width: gw, height: gh, data: gd } = glyph.bitmap;
  for (let i = 0; i < gw * gh; i++) {
    const o = i * 4;
    if (isBackground(gd[o], gd[o + 1], gd[o + 2])) gd[o + 3] = 0;
  }

  // --- Android adaptive foreground: glyph fitted inside the safe zone.
  // 0.45 rather than the 0.66 safe-zone maximum — the launcher crops to a
  // circle/squircle, so a glyph sized to the full safe zone reads as
  // oversized and crowds the mask edge. ---
  const FG = 512;
  const safe = Math.round(FG * 0.45);
  const scale = safe / Math.max(gw, gh);
  const fgw = Math.round(gw * scale);
  const fgh = Math.round(gh * scale);
  const foreground = new Jimp(FG, FG, 0x00000000);
  foreground.composite(glyph.clone().resize(fgw, fgh), Math.round((FG - fgw) / 2), Math.round((FG - fgh) / 2));
  await foreground.writeAsync(path.join(ASSETS, 'android-icon-foreground.png'));

  // --- Android adaptive background: flat white, matching the source art's
  // own background. A blue background would make the blue glyph vanish
  // into it once the two layers are composited (blue-on-blue). ---
  const background = new Jimp(512, 512, 0xFFFFFFFF);
  await background.writeAsync(path.join(ASSETS, 'android-icon-background.png'));

  // --- Monochrome (themed icons): white silhouette on transparent ---
  const MONO = 432;
  const monoSafe = Math.round(MONO * 0.45);
  const monoScale = monoSafe / Math.max(gw, gh);
  const mw2 = Math.round(gw * monoScale);
  const mh2 = Math.round(gh * monoScale);
  const monoArt = glyph.clone().resize(mw2, mh2);
  const md = monoArt.bitmap.data;
  for (let i = 0; i < mw2 * mh2; i++) {
    const o = i * 4;
    md[o] = md[o + 1] = md[o + 2] = 255;
  }
  const mono = new Jimp(MONO, MONO, 0x00000000);
  mono.composite(monoArt, Math.round((MONO - mw2) / 2), Math.round((MONO - mh2) / 2));
  await mono.writeAsync(path.join(ASSETS, 'android-icon-monochrome.png'));

  console.log('icons written');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
