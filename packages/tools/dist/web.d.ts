import { ToolDefinition } from '@ai-agent-platform/shared';
/**
 * Fetches text content from a public HTTPS URL.
 * Blocks loopback, RFC1918, link-local, and cloud metadata endpoints.
 * Validates redirect targets to prevent SSRF bypass via redirect chains.
 */
export declare const webFetch: ToolDefinition;
/**
 * Performs a search query against a configurable search engine API.
 * Uses DuckDuckGo's instant answer API by default (no API key needed).
 */
export declare const webSearch: ToolDefinition;
export declare const webTools: ToolDefinition[];
//# sourceMappingURL=web.d.ts.map