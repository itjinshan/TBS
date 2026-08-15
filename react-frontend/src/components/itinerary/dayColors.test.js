import { DAY_COLORS } from './dayColors';

// Compact OKLab distance + WCAG contrast math (sRGB -> linear -> OKLab),
// self-contained rather than a dependency — same formulas the dataviz
// skill's validate_palette.js uses, so a failure here means the palette
// would also fail that validator's "normal-vision floor" / contrast checks.
function s2lin(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function hexToLin(hex) {
  hex = hex.replace('#', '');
  return [0, 2, 4].map((i) => s2lin(parseInt(hex.slice(i, i + 2), 16) / 255));
}

function oklabFromLin([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  ];
}

// OKLab distance, scaled by 100 to match the dataviz skill's convention.
function deltaE(hexA, hexB) {
  const a = oklabFromLin(hexToLin(hexA));
  const b = oklabFromLin(hexToLin(hexB));
  return 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToLin(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastVsWhite(hex) {
  return 1.05 / (relativeLuminance(hex) + 0.05);
}

// The palette was searched to clear a 15.0 worst-pair floor (see
// dayColors.js) — pinned a hair below that as the regression floor so a
// future edit can't silently let two days' colors drift close enough to be
// hard to tell apart, while leaving room for the exact value to move a
// little if the palette is intentionally re-tuned.
const NORMAL_VISION_FLOOR = 14.5;
const WHITE_CONTRAST_FLOOR = 3.0; // badge's white visit-order number/border must stay legible

test('DAY_COLORS has 14 unique colors', () => {
  expect(DAY_COLORS).toHaveLength(14);
  expect(new Set(DAY_COLORS).size).toBe(14);
});

test('every pair of day colors is distinguishable under normal vision', () => {
  const tooClose = [];
  for (let i = 0; i < DAY_COLORS.length; i++) {
    for (let j = i + 1; j < DAY_COLORS.length; j++) {
      const d = deltaE(DAY_COLORS[i], DAY_COLORS[j]);
      if (d < NORMAL_VISION_FLOOR) tooClose.push([DAY_COLORS[i], DAY_COLORS[j], d.toFixed(1)]);
    }
  }
  expect(tooClose).toEqual([]);
});

test('every day color keeps enough contrast for white badge text/border', () => {
  const tooLow = DAY_COLORS
    .map((hex) => [hex, contrastVsWhite(hex)])
    .filter(([, ratio]) => ratio < WHITE_CONTRAST_FLOOR);
  expect(tooLow).toEqual([]);
});
