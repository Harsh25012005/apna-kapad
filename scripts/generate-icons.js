/**
 * Regenerates every app icon asset from assets/iconlogo.png.
 *
 * The source art is a rounded blue square on a transparent margin. Both iOS
 * and Android apply their own mask, so shipping that shape directly would
 * leave transparent corners inside their mask (a small icon floating in a
 * void). Instead the artwork is bled to the edges: the transparent margin is
 * trimmed, then the rounded corners are filled with a diagonal gradient
 * sampled from the art itself, so the seam is invisible.
 *
 * Run: node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp-compact');

const ASSETS = path.join(__dirname, '..', 'assets');
const SOURCE = path.join(ASSETS, 'iconlogo.png');

/** Bounding box of pixels with meaningful alpha, i.e. the rounded square. */
function opaqueBounds(image) {
  const { width, height, data } = image.bitmap;
  let minX = width, minY = height, maxX = -1, maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(width * y + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Colour a little way inside a corner, used as a gradient stop. */
function sampleAt(image, fx, fy) {
  const x = Math.round(image.bitmap.width * fx);
  const y = Math.round(image.bitmap.height * fy);
  const c = Jimp.intToRGBA(image.getPixelColor(x, y));
  return [c.r, c.g, c.b];
}

/** Solid canvas carrying the same top-left → bottom-right gradient as the art. */
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
  const box = opaqueBounds(source);
  const art = source.clone().crop(box.x, box.y, box.w, box.h);
  console.log(`source ${source.bitmap.width}x${source.bitmap.height} → art ${box.w}x${box.h}`);

  // Sample just inside the rounded square, away from the white t-shirt.
  const from = sampleAt(art, 0.12, 0.08);
  const to = sampleAt(art, 0.88, 0.94);
  console.log('gradient', from, '→', to);

  // --- icon.png / splash-icon.png: full-bleed, no transparency ---
  const full = gradientCanvas(1024, from, to);
  full.composite(art.clone().resize(1024, 1024), 0, 0);
  await full.clone().writeAsync(path.join(ASSETS, 'icon.png'));
  await full.clone().writeAsync(path.join(ASSETS, 'splash-icon.png'));

  // --- favicon ---
  await full.clone().resize(48, 48).writeAsync(path.join(ASSETS, 'favicon.png'));

  // --- Android adaptive foreground ---
  // Only the garment belongs here — the blue plate is supplied by the
  // background layer. Leaving the plate in would show its rounded corners
  // inside the system's circular mask. Pixels are kept by luminance: the
  // plate sits near 0.37, the dashed stitch line near 0.70, white at 1.0.
  const KEEP_LUMA = 0.55;
  const garment = art.clone();
  const { width: gw, height: gh, data: gd } = garment.bitmap;
  for (let i = 0; i < gw * gh; i++) {
    const o = i * 4;
    const luma = (0.299 * gd[o] + 0.587 * gd[o + 1] + 0.114 * gd[o + 2]) / 255;
    if (luma < KEEP_LUMA) gd[o + 3] = 0;
  }

  // Trim to the garment's own bounds first — otherwise it keeps the plate's
  // generous padding and ends up tiny inside the system mask.
  const gBox = opaqueBounds(garment);
  const garmentOnly = garment.clone().crop(gBox.x, gBox.y, gBox.w, gBox.h);

  // Android crops to a circle/squircle; only the middle ~66% is guaranteed
  // visible, so the garment is fitted inside that safe zone.
  const FG = 512;
  const safe = Math.round(FG * 0.6);
  const scale = safe / Math.max(gBox.w, gBox.h);
  const gw2 = Math.round(gBox.w * scale);
  const gh2 = Math.round(gBox.h * scale);
  const foreground = new Jimp(FG, FG, 0x00000000);
  foreground.composite(
    garmentOnly.resize(gw2, gh2),
    Math.round((FG - gw2) / 2),
    Math.round((FG - gh2) / 2)
  );
  await foreground.writeAsync(path.join(ASSETS, 'android-icon-foreground.png'));

  // --- Android adaptive background: flat brand blue ---
  const background = gradientCanvas(512, from, to);
  await background.writeAsync(path.join(ASSETS, 'android-icon-background.png'));

  // --- Monochrome (themed icons): white silhouette on transparent ---
  const MONO = 432;
  const monoSafe = Math.round(MONO * 0.6);
  const monoScale = monoSafe / Math.max(gBox.w, gBox.h);
  const mw2 = Math.round(gBox.w * monoScale);
  const mh2 = Math.round(gBox.h * monoScale);
  const monoArt = garmentOnly.clone().resize(mw2, mh2);
  const md = monoArt.bitmap.data;
  for (let i = 0; i < mw2 * mh2; i++) {
    const o = i * 4;
    // Themed icons are tinted by the system, so flatten to pure white and
    // let alpha carry the shape.
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
