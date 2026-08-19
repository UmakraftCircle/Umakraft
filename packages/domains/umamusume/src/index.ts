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
    // caller handles JSON; here just return raw text
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
 * Fetches an approved source URL with redirect-target validation.
 * Returns trimmed text plus source metadata.
 */
async function fetchApprovedSource(urlStr: string, maxLength = 30000): Promise<any> {
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
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

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
    url: current.href,
    contentType,
    length: text.length,
    truncated,
    text: truncated ? text.slice(0, maxLength) + '\n\n[... truncated ...]' : text,
  };
}

// ── Tool definitions ──

/**
 * Primary tool: route a request to an approved source and retrieve relevant text.
 * Embeds the skill's "classify → direct source → targeted search → verify → compile"
 * retrieval flow at the tool level, so the agent never drifts into unrestricted scraping.
 */
export const umamusumeDataMiner: ToolDefinition = {
  slug: 'umamusume-data-miner',
  name: 'Umamusume Data Miner',
  description:
    'Retrieves Umamusume: Pretty Derby information strictly from approved sources ' +
    '(uma.guide primary, gametora secondary, fandom for lore, reddit for community). ' +
    'Classifies the request, routes it to the highest-priority approved source, fetches it, ' +
    'and returns trimmed text plus source metadata. Never scrapes unrelated websites.',
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

    const keys = CATEGORY_SOURCE_MAP[category] ?? CATEGORY_SOURCE_MAP.general;
    const sources = keys.map(getSource).filter((s): s is NonNullable<typeof s> => Boolean(s));

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
          finalUrl: fetched.url,
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

export const allDomainTools = [umamusumeDataMiner, umamusumeListSources];

export * from './sources.js';
