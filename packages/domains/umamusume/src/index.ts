import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';
import * as dns from 'dns/promises';
import {
  RequestCategory,
  CATEGORY_SOURCE_MAP,
  classifyRequest,
  getSource,
  SOURCE_REGISTRY,
} from './sources.js';

const logger = createLogger('UmamusumeDomain');

// ── SSRF protection (mirrors packages/tools/src/web.ts) ──

const BLOCKED_HOSTS = new Set([
  'localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]',
  'metadata.google.internal', '169.254.169.254',
]);

function isPrivateIPv4(addr: string): boolean {
  const o = addr.split('.').map(Number);
  if (o.length !== 4) return false;
  if (o[0] === 10) return true;
  if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;
  if (o[0] === 192 && o[1] === 168) return true;
  if (o[0] === 127) return true;
  if (o[0] === 169 && o[1] === 254) return true;
  if (o[0] === 0) return true;
  return false;
}

function isPrivateIPv6(addr: string): boolean {
  const l = addr.toLowerCase();
  return l === '::1' || l.startsWith('fe80:');
}

function validateUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: "${raw}"`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`Only HTTPS URLs are allowed. Got: ${url.protocol}`);
  }
  if (BLOCKED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`URL hostname is blocked: ${url.hostname}`);
  }
  return url;
}

async function validateUrlWithDns(raw: string): Promise<URL> {
  const url = validateUrl(raw);
  const v4 = await dns.resolve4(url.hostname).catch(() => [] as string[]);
  for (const a of v4) {
    if (isPrivateIPv4(a)) throw new Error(`DNS of ${url.hostname} resolved to private IP: ${a}`);
  }
  const v6 = await dns.resolve6(url.hostname).catch(() => [] as string[]);
  for (const a of v6) {
    if (isPrivateIPv6(a)) throw new Error(`DNS of ${url.hostname} resolved to private IPv6: ${a}`);
  }
  return url;
}

// ── HTML → text extraction (mirrors web.ts) ──

function stripHtml(html: string, contentType: string): string {
  if (contentType.includes('application/json')) {
    return html;
  }
  if (contentType.includes('text/html')) {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return html;
}

/**
 * Result shape returned for every successful source fetch. Other tools
 * (search, compile) consume this shape so they can share the same fetch logic.
 */
export interface SourceFetchResult {
  success: true;
  sourceKey: string;
  sourceLabel: string;
  sourceUrl: string;
  finalUrl: string;
  contentType: string;
  note: string | null;
  truncated: boolean;
  length: number;
  text: string;
}

/**
 * Fetches an approved source URL with redirect-target validation and graceful
 * handling of sources that block non-browser agents (notably umamusume.fandom.com).
 */
async function fetchApprovedSource(urlStr: string, maxLength = 30000): Promise<SourceFetchResult> {
  const url = await validateUrlWithDns(urlStr);
  let current = url;
  let response: Response | null = null;

  for (let hop = 0; hop < 5; hop++) {
    response = await fetch(current.href, {
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'user-agent': 'UmakraftDataMiner/1.0 (+https://github.com/UmakraftCircle/Umakraft)',
        accept: 'text/html,application/json,text/plain',
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const loc = response.headers.get('location');
      if (!loc) throw new Error(`Redirect (${response.status}) without Location header`);
      current = await validateUrlWithDns(new URL(loc, current).href);
      continue;
    }
    break;
  }

  if (!response) throw new Error('No response received');
  if (response.status >= 300 && response.status < 400) throw new Error('Too many redirects (max 5)');
  if (!response.ok) {
    // Graceful handling: some approved lore/community sources (notably
    // umamusume.fandom.com) block non-browser agents with HTTP 403. Surface a
    // clear reason and let the caller fall back to the next source instead of
    // treating it as an unhelpful generic failure.
    const detail = response.status === 403
      ? `HTTP 403 Forbidden — source may block non-browser agents`
      : `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(detail);
  }

  const contentType = response.headers.get('content-type') || '';
  let text: string;
  if (contentType.includes('application/json')) {
    text = JSON.stringify(await response.json(), null, 2);
  } else {
    text = await response.text();
    text = stripHtml(text, contentType);
  }

  const truncated = text.length > maxLength;
  return {
    success: true,
    sourceKey: '',
    sourceLabel: '',
    sourceUrl: urlStr,
    finalUrl: current.href,
    contentType,
    note: null,
    truncated,
    length: text.length,
    text: truncated ? text.slice(0, maxLength) + '\n\n[... truncated ...]' : text,
  };
}

/**
 * Resolves the ordered list of source entries for a category.
 * Returns both the unique keys and the resolved SourceEntry objects.
 */
function resolveSources(category: RequestCategory) {
  const keys = CATEGORY_SOURCE_MAP[category] ?? CATEGORY_SOURCE_MAP.general;
  const sources = keys.map(getSource).filter((s): s is NonNullable<typeof s> => Boolean(s));
  return { keys, sources };
}

// ── Tool definitions ──

/**
 * Tool 1 — Data Miner: classify a request and fetch the single highest-priority
 * approved source (falls back down the chain, including uma.guide characters).
 * Embeds the skill's "classify → direct source" step at the tool level.
 */
export const umamusumeDataMiner: ToolDefinition = {
  slug: 'umamusume-data-miner',
  name: 'Umamusume Data Miner',
  description:
    'Retrieves Umamusume: Pretty Derby information strictly from approved sources ' +
    '(uma.guide primary, gametora secondary, fandom for lore, reddit for community). ' +
    'Classifies the request, routes it to the highest-priority approved source, fetches it, ' +
    'and returns trimmed text plus source metadata. Falls back to uma.guide character data ' +
    'when the lore source is unavailable. Never scrapes unrelated websites.',
  parameters: {
    query: {
      type: 'string',
      description: 'The subject or question to look up (e.g. "Special Week", "what is the current Champion Meeting guide?").',
      required: true,
    },
    category: {
      type: 'string',
      description: 'Optional explicit request category. If omitted, it is auto-classified.',
      required: false,
      enum: [
        'character', 'support-card', 'skill', 'track', 'game-mechanic', 'scenario',
        'guide', 'tool', 'event', 'lore', 'community', 'comparison', 'general',
      ],
    },
    maxLength: {
      type: 'number',
      description: 'Maximum characters of fetched text to return (default 30000).',
      required: false,
    },
  },
  handler: async (args) => {
    const query = String(args['query'] ?? '').trim();
    if (!query) throw new Error('query is required');

    const category: RequestCategory = (args['category'] as RequestCategory) ?? classifyRequest(query);
    const maxLength = Number(args['maxLength']) || 30000;

    logger.info(`umamusume-data-miner query="${query}" category=${category}`);

    const { sources } = resolveSources(category);

    const errors: string[] = [];
    for (const src of sources) {
      try {
        const fetched = await fetchApprovedSource(src.url, maxLength);
        return {
          success: true,
          query,
          category,
          sourceKey: src.key,
          sourceLabel: src.label,
          sourceUrl: src.url,
          finalUrl: fetched.finalUrl,
          contentType: fetched.contentType,
          note: src.note ?? null,
          truncated: fetched.truncated,
          text: fetched.text,
        };
      } catch (err: any) {
        logger.warn(`Source ${src.key} failed: ${err.message}`);
        errors.push(`${src.key}: ${err.message}`);
      }
    }

    // No approved source succeeded.
    return {
      success: false,
      query,
      category,
      message: 'I could not find confirmed information for that in the supported sources.',
      sourceErrors: errors,
    };
  },
};

/**
 * Tool 2 — Search: targeted keyword search across the approved source(s) for a
 * category, returning the lines/segments that actually contain the query term.
 * Embeds the skill's "targeted search" step.
 */
export const umamusumeSearch: ToolDefinition = {
  slug: 'umamusume-search',
  name: 'Umamusume Search',
  description:
    'Performs a targeted keyword search across approved Umamusume sources and returns the ' +
    'matching excerpts (not the whole page). Routes by category to the right approved source ' +
    'and falls back through the source chain on failure. Never searches unrelated websites.',
  parameters: {
    query: {
      type: 'string',
      description: 'The keyword(s) to search for (e.g. "Parallel Lesson", "Special Week").',
      required: true,
    },
    category: {
      type: 'string',
      description: 'Optional explicit request category. If omitted, it is auto-classified.',
      required: false,
      enum: [
        'character', 'support-card', 'skill', 'track', 'game-mechanic', 'scenario',
        'guide', 'tool', 'event', 'lore', 'community', 'comparison', 'general',
      ],
    },
    contextLines: {
      type: 'number',
      description: 'How much surrounding text to include per match (default 1 sentence each side).',
      required: false,
    },
  },
  handler: async (args) => {
    const query = String(args['query'] ?? '').trim();
    if (!query) throw new Error('query is required');

    const category: RequestCategory = (args['category'] as RequestCategory) ?? classifyRequest(query);
    const contextSize = Number(args['contextLines']) || 1;

    logger.info(`umamusume-search query="${query}" category=${category}`);

    const { sources } = resolveSources(category);

    for (const src of sources) {
      try {
        const fetched = await fetchApprovedSource(src.url, 60_000);
        const lowerText = fetched.text.toLowerCase();
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

        // Split into sentences and keep those containing any search term.
        const sentences = fetched.text.split(/(?<=[.!?])\s+/);
        const matches = sentences.filter((s) =>
          terms.some((term) => s.toLowerCase().includes(term))
        );

        // If sentence split found nothing, fall back to substring windows.
        const excerpts = matches.length
          ? matches.slice(0, 20)
          : terms.slice(0, 1).flatMap((term) => {
            const idx = lowerText.indexOf(term);
            if (idx < 0) return [];
            const start = Math.max(0, idx - contextSize * 120);
            const end = Math.min(fetched.text.length, idx + term.length + contextSize * 120);
            return [fetched.text.slice(start, end)];
          });

        return {
          success: true,
          query,
          category,
          sourceKey: src.key,
          sourceLabel: src.label,
          sourceUrl: src.url,
          matchCount: excerpts.length,
          excerpts,
        };
      } catch (err: any) {
        logger.warn(`Search source ${src.key} failed: ${err.message}`);
      }
    }

    return {
      success: false,
      query,
      category,
      message: 'No approved source could be searched for that query.',
    };
  },
};

/**
 * Tool 3 — Compile: verify and compile already-retrieved Umamusume data into a
 * clean, structured answer block. Takes raw text (from data-miner/search) plus
 * source metadata and returns a normalized summary with a source trace.
 * Embeds the skill's "verify → compile" step.
 */
export const umamusumeCompile: ToolDefinition = {
  slug: 'umamusume-compile',
  name: 'Umamusume Compile',
  description:
    'Verifies and compiles raw Umamusume data (typically produced by the data-miner or search ' +
    'tools) into a clean structured answer with a source trace. Confirms the data came from an ' +
    'approved source and preserves attribution. Does not fetch new content.',
  parameters: {
    text: {
      type: 'string',
      description: 'The raw retrieved text to compile.',
      required: true,
    },
    sourceKey: {
      type: 'string',
      description: 'The approved source key the text came from (e.g. "characters", "fandom-wiki").',
      required: false,
    },
    sourceUrl: {
      type: 'string',
      description: 'The exact source URL (used for attribution).',
      required: false,
    },
    topic: {
      type: 'string',
      description: 'A short label for the topic being compiled (defaults to "Umamusume info").',
      required: false,
    },
  },
  handler: async (args) => {
    const text = String(args['text'] ?? '').trim();
    if (!text) throw new Error('text is required');

    const sourceKey = args['sourceKey'] ? String(args['sourceKey']) : null;
    const sourceUrl = args['sourceUrl'] ? String(args['sourceUrl']) : null;
    const topic = args['topic'] ? String(args['topic']) : 'Umamusume info';

    // Verify the source is in the approved registry (or leave untraced).
    const registered = sourceKey ? getSource(sourceKey) : undefined;
    const trusted = Boolean(registered);

    // If a URL was provided but not in the registry, flag it as unverified.
    const unverifiedUrl = sourceUrl && !trusted;

    // Lightweight compile: strip excess whitespace, cap length, preserve meaning.
    const normalized = text.replace(/\s{2,}/g, ' ').trim();

    return {
      success: true,
      topic,
      compiled: normalized,
      source: {
        key: registered?.key ?? sourceKey,
        label: registered?.label ?? null,
        url: registered?.url ?? sourceUrl ?? null,
        trusted,
        unverified: unverifiedUrl,
      },
      note: trusted
        ? 'Compiled from an approved Umamusume source.'
        : 'Could not verify this data against the approved source registry.',
    };
  },
};

/**
 * Lists the approved source registry so the agent (or a caller) can inspect
 * available sources without a live request.
 */
export const umamusumeListSources: ToolDefinition = {
  slug: 'umamusume-list-sources',
  name: 'Umamusume: List Sources',
  description: 'Lists the approved Umamusume source registry (priority, url, use).',
  parameters: {},
  handler: async () => {
    return {
      success: true,
      sources: SOURCE_REGISTRY.map(({ key, priority, url, label, useFor }) => ({
        key, priority, url, label, useFor,
      })),
    };
  },
};

/**
 * Tool 5 — Pure-DB Parent Search: Generates direct search links and structured criteria
 * for uma.pure-db.com parent, rental, and inheritance factor search.
 */
export const umamusumePureDbSearch: ToolDefinition = {
  slug: 'umamusume-puredb-search',
  name: 'Umamusume: Pure-DB Parent Search',
  description:
    'Generates direct search URLs for uma.pure-db.com parent, rental, and inheritance factor searching. ' +
    'Supports filtering by character, blue/red/green/white/scenario/race factors, support card, and server region.',
  parameters: {
    character: {
      type: 'string',
      description: 'Umamusume character name or card ID (e.g. "Special Week", "Oguri Cap", "100101").',
      required: false,
    },
    blueFactor: {
      type: 'string',
      description: 'Blue factor stat: speed, stamina, power, guts, wisdom, any.',
      required: false,
      enum: ['speed', 'stamina', 'power', 'guts', 'wisdom', 'any'],
    },
    blueStars: {
      type: 'number',
      description: 'Minimum blue factor star count (1, 2, 3). Default is 3.',
      required: false,
    },
    redFactor: {
      type: 'string',
      description: 'Red factor aptitude: turf, dirt, short, mile, middle, long, runner, leading, betweener, chaser.',
      required: false,
      enum: ['turf', 'dirt', 'short', 'mile', 'middle', 'long', 'runner', 'leading', 'betweener', 'chaser'],
    },
    redStars: {
      type: 'number',
      description: 'Minimum red factor star count (1, 2, 3). Default is 3.',
      required: false,
    },
    greenFactor: {
      type: 'string',
      description: 'Green factor / unique skill name or ID (e.g. "Shooting Star", "Red Shift").',
      required: false,
    },
    scenarioFactor: {
      type: 'string',
      description: 'Scenario factor: ura, unity, climax, grand_concert.',
      required: false,
      enum: ['ura', 'unity', 'climax', 'grand_concert'],
    },
    raceFactor: {
      type: 'string',
      description: 'G1 Race factor name or ID (e.g. "Japanese Derby", "Tenno Sho", "Arima Kinen").',
      required: false,
    },
    skillFactor: {
      type: 'string',
      description: 'White/common skill factor name or ID (e.g. "Right-Handed ○", "Tail Held High").',
      required: false,
    },
    supportCard: {
      type: 'string',
      description: 'Equipped support card name or ID (e.g. "Special Week", "Silence Suzuka").',
      required: false,
    },
    server: {
      type: 'string',
      description: 'Game server region: global or japan. Default is global.',
      required: false,
      enum: ['global', 'japan'],
    },
    targetScope: {
      type: 'string',
      description: 'Target scope: all, representative (Parent 1), inheritance (Grandparents). Default is all.',
      required: false,
      enum: ['all', 'representative', 'inheritance'],
    },
  },
  handler: async (args) => {
    const character = args['character'] ? String(args['character']) : undefined;
    const blue = args['blueFactor'] ? String(args['blueFactor']) : undefined;
    const blueStars = Number(args['blueStars']) || 3;
    const red = args['redFactor'] ? String(args['redFactor']) : undefined;
    const redStars = Number(args['redStars']) || 3;
    const green = args['greenFactor'] ? String(args['greenFactor']) : undefined;
    const scenario = args['scenarioFactor'] ? String(args['scenarioFactor']) : undefined;
    const race = args['raceFactor'] ? String(args['raceFactor']) : undefined;
    const skill = args['skillFactor'] ? String(args['skillFactor']) : undefined;
    const support = args['supportCard'] ? String(args['supportCard']) : undefined;
    const server = (args['server'] as 'global' | 'japan') || 'global';
    const targetScope = String(args['targetScope'] || 'all');

    let searchType = 0;
    if (targetScope === 'representative') searchType = 1;
    else if (targetScope === 'inheritance') searchType = 2;

    const {
      buildPureDbSearchUrl,
      BLUE_FACTORS,
      RED_FACTORS,
      SCENARIO_FACTORS,
      PURE_DB_CARDS,
      PURE_DB_GREEN_FACTORS,
      PURE_DB_RACE_FACTORS,
      PURE_DB_COMMON_SKILL_FACTORS,
      PURE_DB_SUPPORT_CARDS,
    } = await import('./puredb-taxonomy.js');

    let partnerCardIds: number[] = [];
    let matchedCharacterName: string | null = null;
    if (character) {
      const num = Number(character);
      const card = !isNaN(num)
        ? PURE_DB_CARDS.find((c) => c.id === num)
        : PURE_DB_CARDS.find((c) => c.name.toLowerCase().includes(character.toLowerCase()));
      if (card) {
        partnerCardIds = [card.id];
        matchedCharacterName = card.name;
      } else {
        const { findBestCharacterMatch, searchPureDbCardsFuzzy } = await import('./fuzzy-search.js');
        const bestChar = findBestCharacterMatch(character);
        if (bestChar?.item?.pureDbCards && bestChar.item.pureDbCards.length > 0) {
          partnerCardIds = [bestChar.item.pureDbCards[0].id];
          matchedCharacterName = bestChar.item.pureDbCards[0].name;
        } else {
          const fuzzyDb = searchPureDbCardsFuzzy(character, 1);
          if (fuzzyDb.length > 0 && fuzzyDb[0].score >= 40) {
            partnerCardIds = [fuzzyDb[0].card.id];
            matchedCharacterName = fuzzyDb[0].card.name;
          }
        }
      }
    }

    const blueFactors = [];
    if (blue && BLUE_FACTORS[blue]) {
      blueFactors.push({
        groupId: BLUE_FACTORS[blue].groupId,
        count: blueStars,
        searchType,
      });
    }

    const redFactors = [];
    if (red && RED_FACTORS[red]) {
      redFactors.push({
        groupId: RED_FACTORS[red].groupId,
        count: redStars,
        searchType,
      });
    }

    const greenFactors = [];
    if (green) {
      const num = Number(green);
      const item = !isNaN(num)
        ? PURE_DB_GREEN_FACTORS.find((f) => f.value === num)
        : PURE_DB_GREEN_FACTORS.find((f) => f.label.toLowerCase().includes(green.toLowerCase()));
      if (item) {
        greenFactors.push({
          groupId: item.value,
          count: 1,
          searchType,
        });
      }
    }

    const scenarioFactors = [];
    if (scenario && SCENARIO_FACTORS[scenario]) {
      scenarioFactors.push({
        groupId: SCENARIO_FACTORS[scenario].groupId,
        count: 0,
        searchType,
      });
    }

    const raceFactors = [];
    if (race) {
      const num = Number(race);
      const item = !isNaN(num)
        ? PURE_DB_RACE_FACTORS.find((f) => f.value === num)
        : PURE_DB_RACE_FACTORS.find((f) => f.label.toLowerCase().includes(race.toLowerCase()));
      if (item) {
        raceFactors.push({
          groupId: item.value,
          count: 0,
          searchType,
        });
      }
    }

    const commonSkillFactors = [];
    if (skill) {
      const num = Number(skill);
      const item = !isNaN(num)
        ? PURE_DB_COMMON_SKILL_FACTORS.find((f) => f.value === num)
        : PURE_DB_COMMON_SKILL_FACTORS.find((f) => f.label.toLowerCase().includes(skill.toLowerCase()));
      if (item) {
        commonSkillFactors.push({
          groupId: item.value,
          count: 0,
          searchType,
        });
      }
    }

    let supportCardId = 0;
    if (support) {
      const num = Number(support);
      const card = !isNaN(num)
        ? PURE_DB_SUPPORT_CARDS.find((s) => s.id === num)
        : PURE_DB_SUPPORT_CARDS.find((s) => s.name.toLowerCase().includes(support.toLowerCase()));
      if (card) {
        supportCardId = card.id;
      } else {
        const { findBestSupportCardMatch, searchPureDbSupportCardsFuzzy } = await import('./fuzzy-search.js');
        const bestCard = findBestSupportCardMatch(support);
        if (bestCard?.item?.pureDbSupportCards && bestCard.item.pureDbSupportCards.length > 0) {
          supportCardId = bestCard.item.pureDbSupportCards[0].id;
        } else {
          const fuzzyDb = searchPureDbSupportCardsFuzzy(support, 1);
          if (fuzzyDb.length > 0 && fuzzyDb[0].score >= 40) {
            supportCardId = fuzzyDb[0].card.id;
          }
        }
      }
    }

    const url = buildPureDbSearchUrl({
      gameServerCode: server,
      partnerCardIds,
      supportCardId,
      supportCardLimitBreak: 4,
      excludeCardIds: [],
      excludeCardSearchType: 0,
      blueFactors,
      redFactors,
      greenFactors,
      commonSkillFactors,
      raceFactors,
      scenarioFactors,
      otherFactors: [],
      whiteFactorCountConditions: [],
      winCount: 0,
      g1WinCount: 0,
      searchCount: 100,
      excludeFullFollowerUser: true,
      excludeArchivedChara: true,
    });

    return {
      success: true,
      searchUrl: url,
      server,
      matchedCharacter: matchedCharacterName,
      criteria: {
        partnerCardIds,
        blueFactors,
        redFactors,
        greenFactors,
        scenarioFactors,
        raceFactors,
        commonSkillFactors,
        supportCardId,
      },
    };
  },
};

export const allDomainTools = [
  umamusumeDataMiner,
  umamusumeSearch,
  umamusumeCompile,
  umamusumeListSources,
  umamusumePureDbSearch,
];

export * from './sources.js';
export * from './puredb-taxonomy.js';
export * from './fuzzy-search.js';
