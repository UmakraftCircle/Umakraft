import React from 'react';
import { WHITE, MINT, LIGHT_GREEN, MEDIUM_GREEN, PRIMARY_GREEN, DARK_GREEN, DEEP_GREEN, MUTED_GREEN, GREEN_SHADOW, GREEN_GLOW, GREEN_DIVIDER, CANVAS_WIDTH, HEADER_HEIGHT, CARD_RADIUS, FONT_FAMILY, FONT_SIZES, FONT_WEIGHTS, leaderboardCanvasHeight } from './theme.js';
import { BarChart, type BarChartData } from './charts.js';

export interface LeaderboardEntry { rank: number; trainerName: string; dailyGain: number; weeklyGain: number; monthlyFans: number; totalFans: number; clubRankTier: string; }
export interface LeaderboardReportData { entries: LeaderboardEntry[]; period: 'daily' | 'weekly' | 'monthly'; periodLabel: string; chartData?: BarChartData | null; }

function formatFans(n: number): string { if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`; if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`; return String(n); }
function formatGain(n: number): string { if (n <= 0) return '-'; return `+${formatFans(n)}`; }
function getGainValue(entry: LeaderboardEntry, period: string): number { switch (period) { case 'daily': return entry.dailyGain; case 'weekly': return entry.weeklyGain; case 'monthly': default: return entry.monthlyFans; } }
function getGainDisplay(entry: LeaderboardEntry, period: string): string { return formatGain(getGainValue(entry, period)); }
function rankEmoji(rank: number): string { if (rank === 1) return '🥇'; if (rank === 2) return '🥈'; if (rank === 3) return '🥉'; return `#${rank}`; }

const IconTrophy = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={WHITE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2"/><path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"/><path d="M6 3h12v6a6 6 0 0 1-12 0V3z"/><path d="M12 16v4"/><path d="M9 21h6"/></svg>);
const IconClock = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);

function Header({ count, periodLabel }: { count: number; periodLabel: string }) {
  return (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: CANVAS_WIDTH, height: HEADER_HEIGHT, background: `linear-gradient(135deg, ${DEEP_GREEN} 0%, ${PRIMARY_GREEN} 50%, ${MEDIUM_GREEN} 100%)`, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, padding: '0 40px', boxShadow: `0 4px 20px ${GREEN_SHADOW}`, position: 'relative' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 30%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.4) 70%, transparent 100%)` }}/>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}><IconTrophy/></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: FONT_SIZES.xl, fontWeight: FONT_WEIGHTS.bold, color: WHITE, lineHeight: 1.1 }}>Fan Leaderboard</span>
        <span style={{ fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.regular, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 }}>Top {count} · {periodLabel}</span>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '5px 18px', border: '1px solid rgba(255,255,255,0.3)' }}>
      <span style={{ fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, color: WHITE, textTransform: 'uppercase', letterSpacing: 1 }}>{periodLabel}</span>
    </div>
  </div>);
}

function CompactRankRow({ entry, period }: { entry: LeaderboardEntry; period: string }) {
  const isTop3 = entry.rank <= 3;
  return (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 14px', borderRadius: 6, backgroundColor: isTop3 ? MINT : 'transparent', border: isTop3 ? `1px solid ${LIGHT_GREEN}` : 'none', height: 36 }}>
    <span style={{ fontSize: FONT_SIZES.sm, fontWeight: isTop3 ? FONT_WEIGHTS.bold : FONT_WEIGHTS.medium, color: isTop3 ? DARK_GREEN : MUTED_GREEN, width: 50, flexShrink: 0 }}>{rankEmoji(entry.rank)}</span>
    <span style={{ fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, color: DARK_GREEN, flex: 1, overflow: 'hidden' }}>{entry.trainerName}</span>
    <span style={{ fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.regular, color: MUTED_GREEN, width: 90, textAlign: 'right', flexShrink: 0 }}>{formatFans(entry.totalFans)}</span>
    <span style={{ fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.medium, color: isTop3 ? PRIMARY_GREEN : MUTED_GREEN, width: 100, textAlign: 'center', flexShrink: 0 }}>{entry.clubRankTier !== '-' ? entry.clubRankTier : '—'}</span>
    <span style={{ fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, color: DARK_GREEN, width: 80, textAlign: 'right', flexShrink: 0 }}>{getGainDisplay(entry, period)}</span>
  </div>);
}

function FullRankRow({ entry, period }: { entry: LeaderboardEntry; period: string }) {
  const isTop3 = entry.rank <= 3;
  return (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderRadius: 10, backgroundColor: isTop3 ? MINT : 'transparent', border: isTop3 ? `1px solid ${LIGHT_GREEN}` : 'none' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 60 }}><span style={{ fontSize: FONT_SIZES.md, fontWeight: isTop3 ? FONT_WEIGHTS.bold : FONT_WEIGHTS.medium, color: isTop3 ? DARK_GREEN : MUTED_GREEN }}>{rankEmoji(entry.rank)}</span></div>
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column' }}>
      <span style={{ fontSize: FONT_SIZES.base, fontWeight: FONT_WEIGHTS.bold, color: DARK_GREEN }}>{entry.trainerName}</span>
      <span style={{ fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.regular, color: MUTED_GREEN }}>{entry.clubRankTier !== '-' ? entry.clubRankTier : '—'} · Total {formatFans(entry.totalFans)}</span>
    </div>
    <span style={{ fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: DARK_GREEN }}>{getGainDisplay(entry, period)}</span>
  </div>);
}

function Footer() {
  const now = new Date();
  const formatted = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: CANVAS_WIDTH, padding: '12px 40px 8px', borderTop: `1px solid ${GREEN_DIVIDER}` }}>
    <IconClock/><span style={{ fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.regular, color: MUTED_GREEN }}>Generated {formatted} · UmaKraft Fan Tracker</span>
  </div>);
}

export function LeaderboardReport({ data }: { data: LeaderboardReportData }) {
  const count = data.entries.length;
  const canvasHeight = leaderboardCanvasHeight(count);
  const isCompact = count > 15;
  const chartValues: number[] = data.chartData
    ? data.chartData.values
    : data.entries.map((e) => {
        switch (data.period) {
          case 'daily': return e.dailyGain;
          case 'weekly': return e.weeklyGain;
          default: return e.monthlyFans;
        }
      });
  const showChart = count <= 15;

  return (<div style={{ display: 'flex', flexDirection: 'column', width: CANVAS_WIDTH, height: canvasHeight, backgroundColor: WHITE, fontFamily: FONT_FAMILY, position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: -80, left: -60, width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${MINT} 0%, transparent 70%)`, opacity: 0.6 }}/>
    <Header count={count} periodLabel={data.periodLabel.toUpperCase()}/>
    <div style={{ display: 'flex', flex: 1, padding: '14px 36px', gap: showChart ? 20 : 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: showChart ? 1 : 1, gap: isCompact ? 2 : 4, backgroundColor: WHITE, borderRadius: CARD_RADIUS, border: `1px solid ${MEDIUM_GREEN}`, padding: isCompact ? '8px 12px' : '12px 16px', boxShadow: `0 2px 12px ${GREEN_SHADOW}`, overflow: 'hidden' }}>
        {isCompact && (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 14px 6px', borderBottom: `1px solid ${GREEN_DIVIDER}`, marginBottom: 2 }}>
          <span style={{ fontSize: 11, fontWeight: FONT_WEIGHTS.medium, color: MUTED_GREEN, width: 50 }}>RANK</span>
          <span style={{ fontSize: 11, fontWeight: FONT_WEIGHTS.medium, color: MUTED_GREEN, flex: 1 }}>TRAINER</span>
          <span style={{ fontSize: 11, fontWeight: FONT_WEIGHTS.medium, color: MUTED_GREEN, width: 90, textAlign: 'right' }}>TOTAL</span>
          <span style={{ fontSize: 11, fontWeight: FONT_WEIGHTS.medium, color: MUTED_GREEN, width: 100, textAlign: 'center' }}>TIER</span>
          <span style={{ fontSize: 11, fontWeight: FONT_WEIGHTS.medium, color: MUTED_GREEN, width: 80, textAlign: 'right' }}>GAIN</span>
        </div>)}
        {data.entries.map((entry) => isCompact ? (<CompactRankRow key={entry.rank} entry={entry} period={data.period}/>) : (<FullRankRow key={entry.rank} entry={entry} period={data.period}/>))}
      </div>
      {showChart && (<div style={{ display: 'flex', flex: 1, backgroundColor: WHITE, borderRadius: CARD_RADIUS, border: `1px solid ${MEDIUM_GREEN}`, boxShadow: `0 2px 12px ${GREEN_SHADOW}`, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: '10px' }}><BarChart data={{ labels: data.entries.map((e) => e.trainerName), values: chartValues }} width={480} height={280} /></div>)}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 40px 4px' }}>
      <span style={{ fontSize: FONT_SIZES.xxl, fontWeight: FONT_WEIGHTS.bold, color: DARK_GREEN, letterSpacing: 3, textShadow: `0 2px 8px ${GREEN_GLOW}` }}>UmaKraft</span>
    </div>
    <Footer/>
  </div>);
}

export default LeaderboardReport;