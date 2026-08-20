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
 * rendered row height, and the formula omitted the list card's own chrome
 * (padding, column header, gaps, wrapper padding, and the "UmaKraft" brand
 * row). Those omissions caused tall leaderboards (notably the 60-row
 * "unified" view, where two ~30-member circles are combined) to be clipped by
 * the undersized canvas so only the top rows rendered.
 *
 * We size per-row height to the layout actually chosen and add headroom for
 * all surrounding chrome, and raise the ceiling so a full 60-entry unified
 * leaderboard renders every row.
 */
export function leaderboardCanvasHeight(rowCount: number): number {
  const showChart = rowCount <= 15;

  // FullRankRow (two lines + 10px/16px padding) vs CompactRankRow
  // (height: 36, plus an inter-row gap of 2).
  const ROW_HEIGHT = showChart ? 52 : 38;

  const HEADER = HEADER_HEIGHT;         // 140
  const FOOTER = 48;                    // "Generated …" footer
  const BRAND_ROW = 60;                 // "UmaKraft" wordmark (xxl font + padding)
  const WRAPPER_PADDING = 28;           // flex:1 wrapper `14px 36px` top+bottom
  const LIST_CARD_PADDING = showChart ? 24 : 16; // `12px 16px` vs `8px 12px` top+bottom
  const COLUMN_HEADER = showChart ? 0 : 30;       // compact column header + border
  const GAPS = showChart ? (rowCount - 1) * 4 : (rowCount - 1) * 2;
  const CHART_PANEL = showChart ? 320 : 0;        // side bar-chart card height

  const listHeights =
    HEADER +
    WRAPPER_PADDING +
    LIST_CARD_PADDING +
    COLUMN_HEADER +
    rowCount * ROW_HEIGHT +
    GAPS +
    BRAND_ROW +
    FOOTER;

  const needed = Math.max(listHeights, showChart ? HEADER + WRAPPER_PADDING + CHART_PANEL + BRAND_ROW + FOOTER : 0);

  // Cap high enough to fit a 60-row unified leaderboard (30 + 30 across two
  // circles), while still guarding against absurdly tall images.
  const MAX_CANVAS = 6000;
  return Math.max(CANVAS_HEIGHT, Math.min(needed, MAX_CANVAS));
}
