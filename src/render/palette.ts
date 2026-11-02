import colors from "../data/palettes.json";
export type AlternatePalette = "amber" | "violet";
const rgb = (color: string) => parseInt(color.slice(1), 16);
const source = colors.red.map(rgb);
/** Exact indexed-ramp swap: skin, face, hair, steel, geometry and alpha survive. */
export function swapPalette(
  pixels: Uint8ClampedArray,
  palette: AlternatePalette,
) {
  const target = colors[palette].map(rgb);
  for (let i = 0; i < pixels.length; i += 4) {
    if (!pixels[i + 3]) continue;
    const at = source.indexOf(
      (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2],
    );
    if (at < 0) continue;
    pixels[i] = target[at] >> 16;
    pixels[i + 1] = (target[at] >> 8) & 255;
    pixels[i + 2] = target[at] & 255;
  }
  return pixels;
}
/** Goku's alternate changes only the gi ramp. Skin, hair and blue accessories
 * stay exact; a whole-sprite hue filter would recolour his face too. */
export function swapGokuPalette(pixels: Uint8ClampedArray) {
  const source = [
      "#542119",
      "#883116",
      "#ac3c0b",
      "#d95208",
      "#f67a14",
      "#ff9b2b",
      "#ffbc57",
    ].map(rgb),
    target = [
      "#102f3b",
      "#155064",
      "#16748c",
      "#2495ad",
      "#4ab9c6",
      "#7cdae0",
      "#b4f2ec",
    ].map(rgb);
  for (let i = 0; i < pixels.length; i += 4) {
    if (!pixels[i + 3]) continue;
    const at = source.indexOf(
      (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2],
    );
    if (at < 0) continue;
    pixels[i] = target[at] >> 16;
    pixels[i + 1] = (target[at] >> 8) & 255;
    pixels[i + 2] = target[at] & 255;
  }
  return pixels;
}
