import React from 'react';
/**
 * @ai-agent-platform/image-report
 *
 * Server-side image report rendering for Fan Tracker.
 * Uses Satori + @resvg/resvg-js — no browser required, no native `canvas`.
 *
 * Public API:
 *   renderGainReport(data) → Buffer  — /fan gain stat card
 *   renderLeaderboardReport(data) → Buffer — /fan leaderboard card
 */
import { renderToPNG } from './renderer.js';
import { GainReport, type GainReportData } from './GainReport.js';
import { LeaderboardReport, type LeaderboardReportData } from './LeaderboardReport.js';
import { leaderboardCanvasHeight } from './theme.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ImageReport');

// ── Public API ──

export async function renderGainReport(data: GainReportData): Promise<Buffer> {
  try {
    return await renderToPNG(<GainReport data={data} />);
  } catch (err: any) {
    logger.error(`renderGainReport failed: ${err.message}`);
    throw new Error(`Gain report render failed: ${err.message}`);
  }
}

export async function renderLeaderboardReport(data: LeaderboardReportData): Promise<Buffer> {
  try {
    return await renderToPNG(
      <LeaderboardReport data={data} />,
      leaderboardCanvasHeight(data.entries.length),
    );
  } catch (err: any) {
    logger.error(`renderLeaderboardReport failed: ${err.message}`);
    throw new Error(`Leaderboard report render failed: ${err.message}`);
  }
}

// Re-export types
export type { GainReportData } from './GainReport.js';
export type { LeaderboardReportData, LeaderboardEntry } from './LeaderboardReport.js';
export type { BarChartData } from './charts.js';
