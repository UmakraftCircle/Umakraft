import React from 'react';
import { PRIMARY_GREEN, MEDIUM_GREEN, DARK_GREEN, MINT, LIGHT_GREEN } from './theme.ts';

export interface BarChartData {
  labels: string[];
  values: number[];
}

function formatAxis(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

// Truncate a label to a max character length, ellipsizing on overflow. Kept in
// sync with the left list panel so the bar chart and ranked list truncate
// trainer names consistently.
function truncateLabel(label: string, maxLen = 18): string {
  return label.length > maxLen ? label.slice(0, maxLen - 1) + '\u2026' : label;
}

/**
 * Pure Satori-compatible horizontal bar chart (divs + flexbox, no SVG <text>).
 * Satori does not support raw SVG <text> nodes, so bars & labels are composed
 * from styled <div>s. This removes the native `canvas` / chart.js dependency.
 */
export function BarChart({ data, width = 480, height = 280 }: { data: BarChartData; width?: number; height?: number }) {
  const maxVal = Math.max(1, ...data.values);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width, height, backgroundColor: '#FFFFFF', borderRadius: 14, border: `1px solid ${MEDIUM_GREEN}`, padding: '14px 16px', gap: 8, overflow: 'hidden' }}>
      {data.labels.map((label, i) => {
        const val = data.values[i] || 0;
        const pct = Math.max(2, Math.min(100, (val / maxVal) * 100));
        return (
          <div key={label + i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: DARK_GREEN, whiteSpace: 'nowrap', overflow: 'hidden' }}>{truncateLabel(label)}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY_GREEN }}>{formatAxis(val)}</span>
            </div>
            <div style={{ display: 'flex', width: '100%', height: 12, borderRadius: 6, backgroundColor: LIGHT_GREEN, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: 12, borderRadius: 6, background: `linear-gradient(90deg, ${MEDIUM_GREEN} 0%, ${PRIMARY_GREEN} 100%)`, border: `1px solid ${MINT}` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
