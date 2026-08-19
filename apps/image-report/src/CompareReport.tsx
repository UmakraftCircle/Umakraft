import React from 'react';
import {
  WHITE, MINT, LIGHT_GREEN, MEDIUM_GREEN, PRIMARY_GREEN, DARK_GREEN,
  DEEP_GREEN, MUTED_GREEN, GREEN_SHADOW, GREEN_DIVIDER,
  CANVAS_WIDTH, CANVAS_HEIGHT, HEADER_HEIGHT, CARD_RADIUS, CARD_RADIUS_SM,
  FONT_FAMILY, FONT_SIZES, FONT_WEIGHTS,
} from './theme.js';

export interface CompareEntry {
  trainerId: string;
  trainerName: string;
  gain: number;
  totalFans: number;
  clubRankTier: string;
}

export interface CompareReportData {
  period: 'daily' | 'weekly' | 'monthly';
  periodLabel: string;
  trainer1: CompareEntry;
  trainer2: CompareEntry;
  summary: string;
  updatedAt: string;
}

function formatFans(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatGain(n: number): string {
  if (n <= 0) return '-';
  return `+${formatFans(n)}`;
}

function fitFontSize(value: string): number {
  const len = value.length;
  if (len <= 5) return FONT_SIZES.xl;
  if (len <= 8) return FONT_SIZES.lg;
  if (len <= 11) return FONT_SIZES.md;
  return FONT_SIZES.base;
}

const IconTrophy = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={WHITE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2"/><path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"/><path d="M6 3h12v6a6 6 0 0 1-12 0V3z"/><path d="M12 16v4"/><path d="M9 21h6"/></svg>
);
const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

function StatCard({ label, value }: { label: string; value: string }) {
  const valueFontSize = fitFontSize(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE, borderRadius: CARD_RADIUS, border: `1px solid ${MEDIUM_GREEN}`, padding: '16px 24px', width: 180, height: 96, boxShadow: `0 2px 12px ${GREEN_SHADOW}`, gap: 6 }}>
      <span style={{ fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.medium, color: MUTED_GREEN, textTransform: 'uppercase', letterSpacing: 1.5 }}>{label}</span>
      <span style={{ fontSize: valueFontSize, fontWeight: FONT_WEIGHTS.bold, color: DARK_GREEN, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{value}</span>
    </div>
  );
}

function TrainerCard({ label, entry }: { label: string; entry: CompareEntry }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, backgroundColor: WHITE, borderRadius: CARD_RADIUS, border: `1px solid ${MEDIUM_GREEN}`, boxShadow: `0 2px 12px ${GREEN_SHADOW}`, padding: '18px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 20, backgroundColor: MINT, border: `1px solid ${LIGHT_GREEN}`, fontWeight: FONT_WEIGHTS.bold, color: DARK_GREEN, fontSize: FONT_SIZES.md }}>{label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: DARK_GREEN, lineHeight: 1.1 }}>{entry.trainerName}</span>
            <span style={{ fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.regular, color: MUTED_GREEN }}>ID: {entry.trainerId}</span>
          </div>
        </div>
        {entry.clubRankTier && entry.clubRankTier !== '-' && (
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: MINT, borderRadius: 16, padding: '5px 14px', border: `1px solid ${LIGHT_GREEN}` }}>
            <span style={{ fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, color: DARK_GREEN }}>{entry.clubRankTier}</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <StatCard label="Gain" value={formatGain(entry.gain)} />
        <StatCard label="Total" value={formatFans(entry.totalFans)} />
      </div>
    </div>
  );
}

function Header({ periodLabel }: { periodLabel: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: CANVAS_WIDTH, height: HEADER_HEIGHT, background: `linear-gradient(135deg, ${DEEP_GREEN} 0%, ${PRIMARY_GREEN} 50%, ${MEDIUM_GREEN} 100%)`, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, padding: '0 40px', boxShadow: `0 4px 20px ${GREEN_SHADOW}`, position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 30%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.4) 70%, transparent 100%)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}><IconTrophy /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: FONT_SIZES.xl, fontWeight: FONT_WEIGHTS.bold, color: WHITE, lineHeight: 1.1 }}>Fan Comparison</span>
          <span style={{ fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.regular, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 }}>Fan Tracker Report</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '5px 18px', border: '1px solid rgba(255,255,255,0.3)' }}>
        <span style={{ fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, color: WHITE, textTransform: 'uppercase', letterSpacing: 1 }}>{periodLabel}</span>
      </div>
    </div>
  );
}

function Footer({ updatedAt }: { updatedAt: string }) {
  const date = new Date(updatedAt);
  const formatted = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: CANVAS_WIDTH, padding: '12px 40px 8px', borderTop: `1px solid ${GREEN_DIVIDER}` }}>
      <IconClock /><span style={{ fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.regular, color: MUTED_GREEN }}>Last updated: {formatted} · Umakraft Fan Tracker</span>
    </div>
  );
}

export function CompareReport({ data }: { data: CompareReportData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: WHITE, fontFamily: FONT_FAMILY, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -80, left: -60, width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${MINT} 0%, transparent 70%)`, opacity: 0.6 }} />
      <div style={{ position: 'absolute', bottom: -40, right: -40, width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${MINT} 0%, transparent 70%)`, opacity: 0.4 }} />

      <Header periodLabel={data.periodLabel} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 14, padding: '18px 60px 0' }}>
        <TrainerCard label="1" entry={data.trainer1} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 28, borderRadius: 14, backgroundColor: DARK_GREEN, boxShadow: `0 2px 8px ${GREEN_SHADOW}` }}>
          <span style={{ fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.bold, color: WHITE, letterSpacing: 1 }}>VS</span>
        </div>

        <TrainerCard label="2" entry={data.trainer2} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', backgroundColor: MINT, borderRadius: CARD_RADIUS_SM, border: `1px solid ${LIGHT_GREEN}`, padding: '12px 16px' }}>
          <span style={{ fontSize: FONT_SIZES.md, lineHeight: 1 }}>💬</span>
          <span style={{ fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.regular, color: DARK_GREEN, lineHeight: 1.4 }}>{data.summary}</span>
        </div>
      </div>

      <Footer updatedAt={data.updatedAt} />
    </div>
  );
}

export default CompareReport;
