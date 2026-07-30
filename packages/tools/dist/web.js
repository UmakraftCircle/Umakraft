import { createLogger } from '@ai-agent-platform/shared';
const logger = createLogger('WebTools');
/**
 * Fetches text content from a public web URL.
 */
export const webFetch = {
    slug: 'web-fetch',
    name: 'Web Fetch',
    description: 'Downloads and returns the plain text content of a public web page.',
    parameters: {
        url: {
            type: 'string',
            description: 'Full HTTPS URL to fetch',
            required: true
        }
    },
    handler: async (args) => {
        const url = args['url'];
        logger.info(`Fetching web page: ${url}`);
        try {
            const response = await fetch(url, { redirect: 'follow' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const contentType = response.headers.get('content-type') || '';
            let text;
            if (contentType.includes('application/json')) {
                const json = await response.json();
                text = JSON.stringify(json, null, 2);
            }
            else {
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
            logger.info(`Fetched ${text.length} characters from ${url}`);
            return {
                success: true,
                url,
                contentType,
                text: truncated,
                length: text.length,
                truncated: text.length > maxLength
            };
        }
        catch (error) {
            logger.error(`Web fetch failed for ${url}: ${error.message}`);
            throw new Error(`Failed to fetch ${url}: ${error.message}`);
        }
    }
};
/**
 * Performs a search query against a configurable search engine API.
 * Uses DuckDuckGo's instant answer API by default (no API key needed).
 */
export const webSearch = {
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
            description: 'Maximum number of results to return (default 5)',
            required: false
        }
    },
    handler: async (args) => {
        const query = args['query'];
        const maxResults = args['maxResults'] || 5;
        logger.info(`Performing web search for: "${query}"`);
        try {
            // Use DuckDuckGo Instant Answer API (no auth required, public)
            const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
            const response = await fetch(url);
            const data = await response.json();
            const results = [];
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
        }
        catch (error) {
            logger.error(`Web search failed: ${error.message}`);
            throw new Error(`Web search failed for "${query}": ${error.message}`);
        }
    }
};
export const webTools = [webFetch, webSearch];
//# sourceMappingURL=web.js.map