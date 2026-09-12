import { HandbookResult } from './handbook-result.js';

export interface HandbookEntry {
  section: string;
  title: string;
  content: string;
  keywords: string[];
}

export const HANDBOOK_INDEX: HandbookEntry[] = [
  {
    section: 'Fan Requirements',
    title: 'Minimum Monthly Fan Target',
    content: 'Minimum monthly fan target: 150 million fans. Members are expected to maintain this target to remain in good standing.',
    keywords: ['fan', 'minimum', '150m', 'target', 'requirement', '150 million']
  },
  {
    section: 'Activity Rules',
    title: 'Inactivity Policy',
    content: 'Inactive members may be subject to review if participation requirements are not met. Consistency in fan gain and participation in club events is expected.',
    keywords: ['inactive', 'activity', 'kick', 'review', 'participation', 'online']
  },
  {
    section: 'Membership',
    title: 'Joining Umakraft',
    content: 'Umakraft is a competitive club. Membership is granted based on fan performance and community fit. New members must link their Discord and Trainer accounts.',
    keywords: ['join', 'membership', 'apply', 'recruit', 'member']
  },
  {
    section: 'Linking',
    title: 'Account Linking Procedure',
    content: 'To link your account, provide your Trainer ID and Trainer Name to Lily. A leader will review and approve the request.',
    keywords: ['link', 'connect', 'account', 'trainer id', 'verify']
  },
  {
    section: 'Club Procedures',
    title: 'Monthly Review',
    content: 'The club conducts a monthly review of all members. Performance statistics, including fan gain and event participation, are evaluated.',
    keywords: ['review', 'monthly', 'stats', 'performance', 'procedure']
  },
  {
    section: 'FAQ',
    title: 'How are fans tracked?',
    content: 'Lily tracks fan gains daily using snapshots. You can check your progress by asking for your fan gain or deficit.',
    keywords: ['track', 'fans', 'how', 'snapshot', 'daily']
  },
  {
    section: 'FAQ',
    title: 'What is the "Link Request"?',
    content: 'A Link Request is the process of connecting your Discord identity to your Umamusume Trainer ID so Lily can track your performance.',
    keywords: ['what', 'link request', 'explanation']
  }
];

export function searchHandbook(query: string): HandbookResult[] {
  const normalizedQuery = query.toLowerCase();
  const results: (HandbookEntry & { score: number })[] = [];

  for (const entry of HANDBOOK_INDEX) {
    let score = 0;

    // Title match (high weight)
    if (entry.title.toLowerCase().includes(normalizedQuery)) {
      score += 5;
    }

    // Section match
    if (entry.section.toLowerCase().includes(normalizedQuery)) {
      score += 3;
    }

    // Keyword match
    for (const keyword of entry.keywords) {
      if (normalizedQuery.includes(keyword.toLowerCase())) {
        score += 2;
      }
    }

    // Content match
    if (entry.content.toLowerCase().includes(normalizedQuery)) {
      score += 1;
    }

    if (score > 0) {
      results.push({ ...entry, score });
    }
  }

  // Sort by score descending and map to HandbookResult
  return results
    .sort((a, b) => b.score - a.score)
    .map(r => ({
      section: r.section,
      title: r.title,
      content: r.content,
      confidence: Math.min(r.score / 10, 1.0)
    }));
}
