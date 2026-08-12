import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { FONT_FAMILY, CANVAS_WIDTH, CANVAS_HEIGHT } from './theme.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ASSETS_DIR = resolve(__dirname, '..', 'assets', 'fonts');

interface FontCache {
  regular: Buffer;
  medium: Buffer;
  bold: Buffer;
}

let fontCache: FontCache | null = null;

function loadFonts(): FontCache {
  if (fontCache) return fontCache;
  fontCache = {
    regular: readFileSync(resolve(ASSETS_DIR, 'Inter-Regular.ttf')),
    medium: readFileSync(resolve(ASSETS_DIR, 'Inter-Medium.ttf')),
    bold: readFileSync(resolve(ASSETS_DIR, 'Inter-Bold.ttf')),
  };
  return fontCache;
}

function getSatoriFonts() {
  const fonts = loadFonts();
  return [
    { name: FONT_FAMILY, data: fonts.regular, weight: 400, style: 'normal' },
    { name: FONT_FAMILY, data: fonts.medium, weight: 500, style: 'normal' },
    { name: FONT_FAMILY, data: fonts.bold, weight: 700, style: 'normal' },
  ] as const;
}

async function renderToPNG(
  element: React.ReactNode,
  height: number = CANVAS_HEIGHT,
): Promise<Buffer> {
  const svg = await satori(element as any, {
    width: CANVAS_WIDTH,
    height,
    fonts: getSatoriFonts() as any,
  });
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: CANVAS_WIDTH },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

export { renderToPNG };