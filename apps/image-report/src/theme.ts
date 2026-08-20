/**
 * Green & White premium game UI theme.
 */
export const WHITE = '#FFFFFF';
export const MINT = '#E8F8EE';
export const LIGHT_GREEN = '#D4F0DF';
export const MEDIUM_GREEN = '#A8DDBA';
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

/**
 * Compute the SVG canvas height for a leaderboard card given the number of
 * rows to render.
 *
 * The previously hardcoded ROW_HEIGHT of 38px did not match the actual
 * rendered row height (FullRankRow renders two lines with 10px/16px padding,
 * ~52px tall), which caused tall leaderboards (“Top 10”) to be clipped by the
 * undersized 675px canvas — only ~6 rows would appear even though all entries
 * were present.
 *
 * We now size per-row height to the layout actually chosen and add headroom
 * for the side bar-chart panel when it is shown (count <= 15).
 */
export function leaderboardCanvasHeight(rowCount: number): number {
  const showChart = rowCount <= 15;
  const ROW_HEIGHT = showChart ? 52 : 44; // FullRankRow vs CompactRankRow
  const HEADER = HEADER_HEIGHT;
  const FOOTER = 48;
  const BRAND_ROW = 56;
  const PADDING = 36;
  const CHART_PANEL = showChart ? 320 : 0; // bar-chart card occupies vertical space
  const listHeights = HEADER + PADDING + rowCount * ROW_HEIGHT + BRAND_ROW + FOOTER;
  const needed = Math.max(listHeights, showChart ? HEADER + PADDING + CHART_PANEL + BRAND_ROW + FOOTER : 0);
  return Math.max(CANVAS_HEIGHT, Math.min(needed, 3200));
}
