import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';
import * as dns from 'dns/promises';
import * as https from 'https';
import { IncomingMessage } from 'http';

const logger = createLogger('WebTools');

// ── SSRF protection: DNS-level + IP-level blocking ──

const PRIVATE_IPV4_RANGES = [
  { ip: 0x7F000000, mask: 0xFF000000 },  // 127.0.0.0/8
  { ip: 0x0A000000, mask: 0xFF000000 },  // 10.0.0.0/8
  { ip: 0xAC100000, mask: 0xFFF00000 },  // 172.16.0.0/12
  { ip: 0xC0A80000, mask: 0xFFFF0000 },  // 192.168.0.0/16
  { ip: 0xA9FE0000, mask: 0xFFFF0000 },  // 169.254.0.0/16
  0xA9FEA9FE,                             // 169.254.169.254/32
];

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isPrivateIP(ip: string): boolean {
  // Normalize to lowercase for case-insensitive IPv6 matching
  const lower = ip.toLowerCase();

  // IPv6 loopback / link-local / unique local (case-insensitive)
  if (lower === '::1') return true;
  if (lower.startsWith('fe80:')) return true;  // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local

  // IPv4-mapped IPv6 — handle multiple representations
  // ::ffff:1.2.3.4, ::ffff:0:1.2.3.4, 0:0:0:0:0:ffff:1.2.3.4, etc.
  const v4MappedPatterns = [
    /^::ffff:(\d+\.\d+\.\d+\.\d+)$/,
    /^::ffff:\d+\.\d+\.\d+\.\d+$/,   // ::ffff:0:1.2.3.4 via normalization
    /^0:0:0:0:0:ffff:(\d+\.\d+\.\d+\.\d+)$/,
  ];

  for (const pattern of v4MappedPatterns) {
    const v4Match = lower.match(pattern);
    if (v4Match?.[1]) return isPrivateIP(v4Match[1]);
  }

  // General check: if the lower string contains an IPv4 pattern anywhere, check it
  const embeddedV4 = lower.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (embeddedV4 && lower.includes('ffff')) return isPrivateIP(embeddedV4[1]);

  // Pure IPv4
  if (!ip.includes('.')) return false;
  const int = ipv4ToInt(ip);
  if (int === 0x00000000 || int === 0xFFFFFFFF) return true;

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

// ── TOCTOU-safe HTTPS fetch (binds to validated IP) ──

interface FetchResult {
  status: number;
  headers: Record<string, string>;
  text(): Promise<string>;
  json(): Promise<any>;
}

/**
 * HTTPS GET to a specific IP, using the hostname for SNI / cert validation
 * and the Host header. This eliminates the TOCTOU DNS rebinding gap — we
 * resolve DNS exactly once and bind the TCP connection to that validated IP.
 */
function httpsGetToIP(
  hostname: string,
  pathAndQuery: string,
  ip: string,
  timeoutMs: number,
): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: ip,             // connect to the VALIDATED IP (no second DNS)
      port: 443,
      path: pathAndQuery,
      method: 'GET',
      servername: hostname,     // SNI + cert validation uses the real hostname
      headers: {
        'Host': hostname,
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate',
      },
      timeout: timeoutMs,
      rejectUnauthorized: true,
    }, (res: IncomingMessage) => {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.headers)) {
        if (v !== undefined) {
          headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
        }
      }

      // Collect body
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve({
          status: res.statusCode || 0,
          headers,
          text: async () => body,
          json: async () => JSON.parse(body),
        });
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`HTTPS request to ${hostname} timed out after ${timeoutMs}ms`));
    });
    req.end();
  });
}

async function validateUrlAtIPLevel(raw: string): Promise<{ url: URL; safeIP: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: "${raw}"`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`Only HTTPS URLs are allowed. Got: ${url.protocol}`);
  }

  // Resolve DNS ONCE and block if ANY resolved IP is private
  const ips = await resolveHostIP(url.hostname);
  const privateIps = ips.filter(isPrivateIP);
  if (privateIps.length > 0) {
    throw new Error(
      `URL hostname "${url.hostname}" resolves to private/internal IP(s): ${privateIps.join(', ')}. Blocked.`
    );
  }

  // Pick first public IP — the actual connection WILL go to this IP
  const safeIP = ips[0];
  logger.debug(`DNS validated: ${url.hostname} → ${safeIP}`);
  return { url, safeIP };
}

/**
 * Fetches text content from a public HTTPS URL.
 * Resolves DNS once per hop, validates IPs, and binds the TCP connection
 * to the validated IP — eliminating the TOCTOU DNS rebinding gap.
 * Uses manual redirect mode — each hop is validated before following.
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

    const { url: initialUrl, safeIP: initialIP } = await validateUrlAtIPLevel(rawUrl);
    let currentHostname = initialUrl.hostname;
    let currentPath = initialUrl.pathname + initialUrl.search;
    let currentIP = initialIP;

    try {
      const MAX_REDIRECTS = 10;
      let result: FetchResult;

      for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
        result = await httpsGetToIP(currentHostname, currentPath, currentIP, 30_000);

        // Check for redirect
        if (result.status >= 300 && result.status < 400) {
          const location = result.headers['location'];
          if (!location) throw new Error(`HTTP ${result.status} redirect without Location header`);

          // Resolve relative URL
          const nextUrl = new URL(location, `https://${currentHostname}${currentPath}`);

          // Validate redirect target at DNS + IP level BEFORE connecting
          if (nextUrl.protocol !== 'https:') {
            throw new Error(`Redirect to non-HTTPS URL blocked: ${nextUrl.protocol}`);
          }

          const { safeIP: nextIP } = await validateUrlAtIPLevel(nextUrl.href);
          logger.info(`Redirect ${hop + 1}: https://${currentHostname} → ${nextUrl.href}`);
          currentHostname = nextUrl.hostname;
          currentPath = nextUrl.pathname + nextUrl.search;
          currentIP = nextIP;
          continue;
        }

        // Non-redirect — done
        break;
      }

      if (!result!) throw new Error('Too many redirects');

      if (result.status < 200 || result.status >= 300) {
        throw new Error(`HTTP ${result.status}`);
      }

      const contentType = result.headers['content-type'] || '';
      let text: string;

      if (contentType.includes('application/json')) {
        const json = await result.json();
        text = JSON.stringify(json, null, 2);
      } else {
        text = await result.text();
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

      const maxLength = 50000;
      const currentUrl = `https://${currentHostname}${currentPath}`;
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
      logger.error(`Web fetch failed for https://${currentHostname}${currentPath}: ${error.message}`);
      throw new Error(`Failed to fetch https://${currentHostname}${currentPath}: ${error.message}`);
    }
  }
};

/**
 * Performs a search query against DuckDuckGo's instant answer API.
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
      // DuckDuckGo API — known safe host, uses fetch directly
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

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
