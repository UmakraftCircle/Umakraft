import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';
import * as dns from 'dns/promises';

const logger = createLogger('WebTools');

// ── SSRF protection ──

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  'metadata.google.internal', // GCP
  '169.254.169.254',          // AWS / cloud metadata
]);

const BLOCKED_CIDRS = [
  { prefix: '127.', mask: 8 },
  { prefix: '10.', mask: 8 },
  { prefix: '172.16.', mask: 12 },
  { prefix: '192.168.', mask: 16 },
  { prefix: '169.254.', mask: 16 },
  { prefix: 'fc00:', mask: 7 },   // unique local
  { prefix: 'fe80:', mask: 10 },  // link-local IPv6
];

function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(lower)) return true;

  for (const block of BLOCKED_CIDRS) {
    if (lower.startsWith(block.prefix)) return true;
  }

  return false;
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

  if (isPrivateHost(url.hostname)) {
    throw new Error(`URL hostname is blocked (private/internal): ${url.hostname}`);
  }

  return url;
}

// ── DNS rebinding protection ──

async function validateUrlWithDns(raw: string): Promise<URL> {
  const url = validateUrl(raw);
  try {
    const addresses = await dns.resolve4(url.hostname).catch(() => [] as string[]);
    for (const addr of addresses) {
      if (isPrivateIPv4(addr)) {
        throw new Error(`DNS resolution of ${url.hostname} returned private IP: ${addr}`);
      }
    }
    const ipv6 = await dns.resolve6(url.hostname).catch(() => [] as string[]);
    for (const addr of ipv6) {
      if (isPrivateIPv6(addr)) {
        throw new Error(`DNS resolution of ${url.hostname} returned private IPv6: ${addr}`);
      }
    }
  } catch (err: any) {
    if (err.message.includes('ENOTFOUND') || err.message.includes('ENODATA')) {
      // DNS resolution failed — host doesn't exist, let fetch handle it
    } else if (err.message.includes('private IP') || err.message.includes('private IPv6')) {
      throw err;
    }
    logger.warn(`DNS resolution warning for ${url.hostname}: ${err.message}`);
  }
  return url;
}

function isPrivateIPv4(addr: string): boolean {
  const octets = addr.split('.').map(Number);
  if (octets.length !== 4) return false;
  if (octets[0] === 10) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 127) return true;
  if (octets[0] === 169 && octets[1] === 254) return true;
  if (octets[0] === 0) return true;
  return false;
}

function isPrivateIPv6(addr: string): boolean {
  const lower = addr.toLowerCase();
  if (lower === '::1') return true;
  if (lower.startsWith('fe80:')) return true;
  return false;
}

/**
 * Fetches text content from a public HTTPS URL.
 * Blocks loopback, RFC1918, link-local, and cloud metadata endpoints.
 * Validates redirect targets to prevent SSRF bypass via redirect chains.
 */
export const webFetch: ToolDefinition = {
  slug: 'web-fetch',
  name: 'Web Fetch',
  description: 'Downloads and returns the plain text content of a public HTTPS web page.',
  parameters: {
    url: {
      type: 'string',
      description: 'Full HTTPS URL to fetch',
      required: true
    }
  },
  handler: async (args) => {
    const rawUrl = args['url'];
    logger.info(`Fetching web page: ${rawUrl}`);

    const url = await validateUrlWithDns(rawUrl);

    try {
      // Validate every redirect hop (scheme + hostname + DNS) BEFORE following,
      // preventing SSRF via a redirect chain to a private/internal address.
      let current = url;
      let response: Response | null = null;

      for (let hop = 0; hop < 5; hop++) {
        response = await fetch(current.href, {
          redirect: 'manual',
          signal: AbortSignal.timeout(30_000),
        });

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (!location) throw new Error(`Redirect (${response.status}) without Location header`);
          const next = await validateUrlWithDns(new URL(location, current).href);
          logger.info(`Following redirect to: ${next.href}`);
          current = next;
          continue;
        }

        break;
      }

      if (!response) throw new Error('No response received');
      if (response.status >= 300 && response.status < 400) {
        throw new Error('Too many redirects (max 5)');
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const finalUrl = current;
      const contentType = response.headers.get('content-type') || '';
      let text: string;

      if (contentType.includes('application/json')) {
        const json = await response.json();
        text = JSON.stringify(json, null, 2);
      } else {
        text = await response.text();
        // Strip HTML tags for plain text extraction
        if (contentType.includes('text/html')) {
          text = text
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
        }
      }

      // Truncate very large responses
      const maxLength = 50000;
      const truncated = text.length > maxLength ? text.slice(0, maxLength) + '\n\n[... truncated ...]' : text;

      logger.info(`Fetched ${text.length} characters from ${finalUrl.href}`);
      return {
        success: true,
        url: finalUrl.href,
        contentType,
        text: truncated,
        length: text.length,
        truncated: text.length > maxLength
      };
    } catch (error: any) {
      logger.error(`Web fetch failed for ${url.href}: ${error.message}`);
      throw new Error(`Failed to fetch ${url.href}: ${error.message}`);
    }
  }
};

/**
 * Performs a search query against a configurable search engine API.
 * Uses DuckDuckGo's instant answer API by default (no API key needed).
 */
export const webSearch: ToolDefinition = {
  slug: 'web-search',
  name: 'Web Search',
  description: 'Performs a web search query and returns top results.',
  parameters: {
    query: {
      type: 'string',
      description: 'Search query string',
      required: true
    },
    maxResults: {
      type: 'number',
      description: 'Maximum number of results to return (default 5, max 20)',
      required: false
    }
  },
  handler: async (args) => {
    const query = args['query'];
    const rawMax = args['maxResults'] || 5;
    const maxResults = Math.max(1, Math.min(20, Number.isFinite(rawMax) ? rawMax : 5));

    logger.info(`Performing web search for: "${query}" (max ${maxResults})`);

    try {
      // Use DuckDuckGo Instant Answer API (no auth required, public)
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo API returned HTTP ${response.status}`);
      }

      const data = await response.json();

      const results: Array<{ title: string; url: string; snippet: string }> = [];

      // Parse RelatedTopics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, maxResults)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 80),
              url: topic.FirstURL,
              snippet: topic.Text.slice(0, 200)
            });
          }
        }
      }

      // Include Abstract if available
      if (data.AbstractText && data.AbstractURL) {
        results.unshift({
          title: data.Heading || query,
          url: data.AbstractURL,
          snippet: data.AbstractText.slice(0, 300)
        });
      }

      logger.info(`Search for "${query}" returned ${results.length} results.`);
      return {
        success: true,
        query,
        resultCount: results.length,
        results: results.slice(0, maxResults)
      };
    } catch (error: any) {
      logger.error(`Web search failed: ${error.message}`);
      throw new Error(`Web search failed for "${query}": ${error.message}`);
    }
  }
};

export const webTools = [webFetch, webSearch];
