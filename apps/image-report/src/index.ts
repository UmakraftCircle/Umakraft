import { renderToPNG } from './renderer.js';
import { GainReport, type GainReportData } from './GainReport.js';
import { LeaderboardReport, type LeaderboardReportData } from './LeaderboardReport.js';
import { generateBarChartPNG, type BarChartData } from './charts.js';
import { leaderboardCanvasHeight } from './theme.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ImageReport');

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
    let chartBuffer: Buffer | null = null;
    if (data.entries.length > 0) {
      try {
        const chartData: BarChartData = {
          labels: data.entries.map((e) => e.trainerName),
          values: data.entries.map((e) => {
            switch (data.period) {
              case 'daily': return e.dailyGain;
              case 'weekly': return e.weeklyGain;
              default: return e.monthlyFans;
            }
          }),
        };
        chartBuffer = await generateBarChartPNG(chartData);
      } catch (chartErr: any) {
        logger.warn(`Chart generation failed, continuing without chart: ${chartErr.message}`);
      }
    }
    return await renderToPNG(
      <LeaderboardReport data={{ ...data, chartBuffer }} />,
      leaderboardCanvasHeight(data.entries.length),
    );
  } catch (err: any) {
    logger.error(`renderLeaderboardReport failed: ${err.message}`);
    throw new Error(`Leaderboard report render failed: ${err.message}`);
  }
}

export type { GainReportData } from './GainReport.js';
export type { LeaderboardReportData, LeaderboardEntry } from './LeaderboardReport.js';
export type { BarChartData } from './charts.js';