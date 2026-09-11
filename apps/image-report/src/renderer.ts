import React from 'react';
import { readFileSync, existsSync } from 'fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { FONT_FAMILY, CANVAS_WIDTH, CANVAS_HEIGHT } from './theme.js';

function resolvePath(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

const ASSETS_DIR = existsSync(resolvePath(process.cwd(), 'apps/image-report/assets/fonts'))
  ? resolvePath(process.cwd(), 'apps/image-report/assets/fonts')
  : resolvePath(process.cwd(), 'assets/fonts');

interface FontCache {
  regular: Buffer;
  medium: Buffer;
  bold: Buffer;
}

let fontCache: FontCache | null = null;

function loadFonts(): FontCache {
  if (fontCache) return fontCache;
  fontCache = {
    regular: readFileSync(resolvePath(ASSETS_DIR, 'Inter-Regular.ttf')),
    medium: readFileSync(resolvePath(ASSETS_DIR, 'Inter-Medium.ttf')),
    bold: readFileSync(resolvePath(ASSETS_DIR, 'Inter-Bold.ttf')),
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
