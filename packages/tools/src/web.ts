import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';
import * as dns from 'dns/promises';

const logger = createLogger('WebTools');

// ── SSRF protection: DNS-level blocking ──

const PRIVATE_IPV4_RANGES = [
  { ip: 0x7F000000, mask: 0xFF000000 },  // 127.0.0.0/8
  { ip: 0x0A000000, mask: 0xFF000000 },  // 10.0.0.0/8
  { ip: 0xAC100000, mask: 0xFFF00000 },  // 172.16.0.0/12
  { ip: 0xC0A80000, mask: 0xFFFF0000 },  // 192.168.0.0/16
  { ip: 0xA9FE0000, mask: 0xFFFF0000 },  // 169.254.0.0/16
  // Cloud metadata endpoints
  0xA9FEA9FE,                             // 169.254.169.254/32
];

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isPrivateIP(ip: string): boolean {
  // IPv6 loopback / link-local / unique local
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
    return true;
  }

  // IPv4 mapped in IPv6
  const v4Match = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Match) return isPrivateIP(v4Match[1]);

  // Pure IPv4
  if (!ip.includes('.')) return false;
  const int = ipv4ToInt(ip);
  if (int === 0x00000000 || int === 0xFFFFFFFF) return true; // 0.0.0.0 or 255.255.255.255

  for (const range of PRIVATE_IPV4_RANGES) {
    if (typeof range === 'number') {
      if (int === range) return true;
    } else {
      if ((int & range.mask) === (range.ip & range.mask)) return true;
    }
  }

  return false;
}

async function resolveHostIP(hostname: string): Promise<string[]> {
  try {
    const result = await dns.resolve4(hostname);
    return result;
  } catch {
    try {
      const result = await dns.resolve6(hostname);
      return result;
    } catch {
      throw new Error(`DNS resolution failed for hostname: ${hostname}`);
    }
  }
}

async function validateUrlAtIPLevel(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: "${raw}"`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`Only HTTPS URLs are allowed. Got: ${url.protocol}`);
  }

  // Resolve DNS and block if any resolved IP is private
  const ips = await resolveHostIP(url.hostname);
  const privateIps = ips.filter(isPrivateIP);
  if (privateIps.length > 0) {
    throw new Error(
      `URL hostname "${url.hostname}" resolves to private/internal IP(s): ${privateIps.join(', ')}. Blocked.`
    );
  }

  logger.debug(`DNS validation OK: ${url.hostname} → ${ips.join(', ')}`);
  return url;
}

// ── Shared fetch helper (30s timeout) ──

async function safeFetch(url: string): Promise<Response> {
  return fetch(url, {
    redirect: 'manual',    // we validate every hop ourselves
    signal: AbortSignal.timeout(30_000),
  });
}

/**
 * Fetches text content from a public HTTPS URL.
 * DNS-resolves the hostname and blocks private/internal IPs at the IP level.
 * Uses manual redirect mode — validates every redirect hop before following.
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

    let currentUrl = (await validateUrlAtIPLevel(rawUrl)).href;

    try {
      // Follow redirects manually, validating each hop
      const MAX_REDIRECTS = 10;
      let response: Response;

      for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
        response = await safeFetch(currentUrl);

        // Check for redirect
        const status = response.status;
        if (status >= 300 && status < 400) {
          const location = response.headers.get('location');
          if (!location) throw new Error(`HTTP ${status} redirect without Location header`);

          // Resolve relative URLs
          const nextUrl = new URL(location, currentUrl).href;

          // Validate redirect target at DNS level before following
          await validateUrlAtIPLevel(nextUrl);

          logger.info(`Redirect ${hop + 1}: ${currentUrl} → ${nextUrl}`);
          currentUrl = nextUrl;
          continue;
        }

        // Non-redirect response — proceed
        break;
      }

      if (!response!) {
        throw new Error('Too many redirects');
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

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

      logger.info(`Fetched ${text.length} characters from ${currentUrl}`);
      return {
        success: true,
        url: currentUrl,
        contentType,
        text: truncated,
        length: text.length,
        truncated: text.length > maxLength
      };
    } catch (error: any) {
      logger.error(`Web fetch failed for ${currentUrl}: ${error.message}`);
      throw new Error(`Failed to fetch ${currentUrl}: ${error.message}`);
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
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

      const response = await safeFetch(url);

      if (!response.ok) {
        throw new Error(`DuckDuckGo API returned HTTP ${response.status}`);
      }

      const data = await response.json();

      const results: Array<{ title: string; url: string; snippet: string }> = [];

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
