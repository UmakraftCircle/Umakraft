/**
 * Green & White premium game UI theme.
 */
export const WHITE = '#FFFFFF';
export const MINT = '#E8F8EE';
export const LIGHT_GREEN = '#D4F0DF';
export const MEDIUM_GREEN = '#A8DDBB';
export const PRIMARY_GREEN = '#4CAF72';
export const DARK_GREEN = '#245C3A';
export const DEEP_GREEN = '#1B4630';
export const MUTED_GREEN = '#6A9A7A';
export const SOFT_GREEN = '#35704D';
export const GREEN_SHADOW = 'rgba(36, 92, 58, 0.12)';
export const GREEN_SHADOW_MEDIUM = 'rgba(36, 92, 58, 0.20)';
export const GREEN_GLOW = 'rgba(76, 175, 114, 0.15)';
export const GREEN_DIVIDER = 'rgba(76, 175, 114, 0.20)';
export const GREEN_OVERLAY_LIGHT = 'rgba(232, 248, 238, 0.60)';
export const HEADER_GRADIENT = [DEEP_GREEN, PRIMARY_GREEN, MEDIUM_GREEN] as const;
export const CARD_BG = WHITE;
export const CARD_BORDER = MEDIUM_GREEN;
export const CARD_RADIUS = 20;
export const CARD_RADIUS_SM = 14;
export const FONT_FAMILY = 'Inter';
export const FONT_SIZES = { xs: 13, sm: 15, base: 18, md: 20, lg: 26, xl: 34, xxl: 48, hero: 60 } as const;
export const FONT_WEIGHTS = { regular: 400, medium: 500, bold: 700 } as const;
export const SPACING = { xs: 6, sm: 12, md: 20, lg: 28, xl: 36, xxl: 48 } as const;
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 675;
export const HEADER_HEIGHT = 140;
export function leaderboardCanvasHeight(rowCount: number): number {
  const ROW_HEIGHT = 38;
  const HEADER = HEADER_HEIGHT;
  const FOOTER = 48;
  const BRAND_ROW = 56;
  const PADDING = 36;
  const needed = HEADER + PADDING + rowCount * ROW_HEIGHT + BRAND_ROW + FOOTER;
  return Math.max(CANVAS_HEIGHT, Math.min(needed, 3200));
}