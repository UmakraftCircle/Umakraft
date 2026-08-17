import React from 'react';
import { WHITE, MINT, LIGHT_GREEN, MEDIUM_GREEN, PRIMARY_GREEN, DARK_GREEN, DEEP_GREEN, MUTED_GREEN, GREEN_SHADOW, GREEN_GLOW, GREEN_DIVIDER, CANVAS_WIDTH, CANVAS_HEIGHT, HEADER_HEIGHT, CARD_RADIUS, CARD_RADIUS_SM, FONT_FAMILY, FONT_SIZES, FONT_WEIGHTS } from './theme.js';

export interface GainReportData { trainerName: string; trainerId: string; dailyGain: number; weeklyGain: number; monthlyFans: number; totalFans: number; clubRankTier: string; updatedAt: string; }

function formatFans(n: number): string { if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`; if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`; return String(n); }
function formatGain(n: number): string { if (n <= 0) return '-'; return `+${formatFans(n)}`; }
function fitFontSize(value: string): number { const len = value.length; if (len <= 5) return FONT_SIZES.xl; if (len <= 8) return FONT_SIZES.lg; if (len <= 11) return FONT_SIZES.md; return FONT_SIZES.base; }

const IconDaily = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PRIMARY_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>);
const IconWeekly = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PRIMARY_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>);
const IconMonthly = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PRIMARY_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>);
const IconTotal = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PRIMARY_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="6" x2="12" y2="16"/></svg>);
const IconClock = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);
const IconTrophy = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={WHITE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2"/><path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"/><path d="M6 3h12v6a6 6 0 0 1-12 0V3z"/><path d="M12 16v4"/><path d="M9 21h6"/></svg>);

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const valueFontSize = fitFontSize(value);
  return (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE, borderRadius: CARD_RADIUS, border: `1px solid ${MEDIUM_GREEN}`, padding: '24px 36px', width: 280, height: 140, boxShadow: `0 2px 12px ${GREEN_SHADOW}`, gap: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{icon}<span style={{ fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.medium, color: MUTED_GREEN, textTransform: 'uppercase', letterSpacing: 1.5 }}>{label}</span></div>
    <span style={{ fontSize: valueFontSize, fontWeight: FONT_WEIGHTS.bold, color: DARK_GREEN, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>{value}</span>
  </div>);
}

function Header({ trainerName, trainerId, clubRankTier }: Pick<GainReportData, 'trainerName' | 'trainerId' | 'clubRankTier'>) {
  return (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: CANVAS_WIDTH, height: HEADER_HEIGHT, background: `linear-gradient(135deg, ${DEEP_GREEN} 0%, ${PRIMARY_GREEN} 50%, ${MEDIUM_GREEN} 100%)`, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, padding: '0 40px', boxShadow: `0 4px 20px ${GREEN_SHADOW}`, position: 'relative' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 30%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.4) 70%, transparent 100%)` }}/>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}><IconTrophy/></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: FONT_SIZES.xl, fontWeight: FONT_WEIGHTS.bold, color: WHITE, lineHeight: 1.1 }}>{trainerName}</span>
        <span style={{ fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.regular, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 }}>Fan Tracker Report</span>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.medium, color: 'rgba(255,255,255,0.8)' }}>ID: {trainerId}</span>
      {clubRankTier && clubRankTier !== '-' && (<div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '5px 16px', border: '1px solid rgba(255,255,255,0.3)' }}><span style={{ fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, color: WHITE }}>{clubRankTier}</span></div>)}
    </div>
  </div>);
}

function Footer({ updatedAt }: { updatedAt: string }) {
  const date = new Date(updatedAt);
  const formatted = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: CANVAS_WIDTH, padding: '12px 40px 8px', borderTop: `1px solid ${GREEN_DIVIDER}` }}>
    <IconClock/><span style={{ fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.regular, color: MUTED_GREEN }}>Last updated: {formatted} · UmaKraft Fan Tracker</span>
  </div>);
}

export function GainReport({ data }: { data: GainReportData }) {
  const cards = [
    { label: 'Daily', value: formatGain(data.dailyGain), icon: <IconDaily/> },
    { label: 'Weekly', value: formatGain(data.weeklyGain), icon: <IconWeekly/> },
    { label: 'Monthly', value: formatGain(data.monthlyFans), icon: <IconMonthly/> },
    { label: 'Total', value: formatFans(data.totalFans), icon: <IconTotal/> },
  ];
  return (<div style={{ display: 'flex', flexDirection: 'column', width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: WHITE, fontFamily: FONT_FAMILY, position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: -80, left: -60, width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${MINT} 0%, transparent 70%)`, opacity: 0.6 }}/>
    <div style={{ position: 'absolute', bottom: -40, right: -40, width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${MINT} 0%, transparent 70%)`, opacity: 0.4 }}/>
    <Header trainerName={data.trainerName} trainerId={data.trainerId} clubRankTier={data.clubRankTier}/>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16, padding: '20px 60px 0' }}>
      <div style={{ display: 'flex', gap: 16 }}>{cards.slice(0, 2).map((card, i) => (<StatCard key={i} label={card.label} value={card.value} icon={card.icon}/>))}</div>
      <div style={{ display: 'flex', gap: 16 }}>{cards.slice(2, 4).map((card, i) => (<StatCard key={i} label={card.label} value={card.value} icon={card.icon}/>))}</div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 40px 4px' }}>
      <span style={{ fontSize: FONT_SIZES.xxl, fontWeight: FONT_WEIGHTS.bold, color: DARK_GREEN, letterSpacing: 3, textShadow: `0 2px 8px ${GREEN_GLOW}` }}>UmaKraft</span>
    </div>
    <Footer updatedAt={data.updatedAt}/>
  </div>);
}

export default GainReport;