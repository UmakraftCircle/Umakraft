import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';
import { PRIMARY_GREEN, MEDIUM_GREEN, DARK_GREEN, MINT } from './theme.js';

const chartJS = new ChartJSNodeCanvas({
  width: 800,
  height: 320,
  backgroundColour: 'transparent',
  chartCallback: (ChartJS) => {
    ChartJS.defaults.font.family = 'Inter';
    ChartJS.defaults.plugins.legend!.display = false;
  },
});

export interface BarChartData {
  labels: string[];
  values: number[];
}

export async function generateBarChartPNG(data: BarChartData): Promise<Buffer> {
  const config: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        data: data.values,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx } = chart;
          const gradient = canvasCtx.createLinearGradient(0, 0, 0, chart.height);
          gradient.addColorStop(0, PRIMARY_GREEN);
          gradient.addColorStop(1, MEDIUM_GREEN);
          return gradient;
        },
        borderColor: DARK_GREEN,
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 28,
        maxBarThickness: 40,
      }],
    },
    options: {
      responsive: false,
      indexAxis: 'x',
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: DARK_GREEN, font: { size: 13, weight: '500' } },
          border: { color: MINT },
        },
        y: {
          grid: { color: 'rgba(76, 175, 114, 0.12)' },
          ticks: {
            color: DARK_GREEN,
            font: { size: 12 },
            callback: (val) => {
              const v = val as number;
              if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
              if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
              return v;
            },
          },
          border: { color: MINT },
        },
      },
    },
  };
  return chartJS.renderToBuffer(config);
}