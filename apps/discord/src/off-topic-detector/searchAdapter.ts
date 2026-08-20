/**
 * searchAdapter.ts — adapts the real `umamusume_search` tool to the
 * `SearchEscalator` contract the detector expects for ambiguous escalation.
 *
 * `umamusumeSearch.handler` returns `{ success, excerpts: string[] }`, while the
 * detector's `SearchValidationResult` expects `{ success, excerpts?: { text? }[] }`.
 * This adapter bridges the two.
 */

import type { SearchEscalator } from './types.js';
import { umamusumeSearch } from '@ai-agent-platform/umamusume';

/**
 * Build the escalation callback used by classifyTopic for ambiguous inputs.
 */
export function buildSearchEscalator(): SearchEscalator {
  return async (query: string) => {
    let raw: unknown;
    try {
      raw = await umamusumeSearch.handler({ query });
    } catch (err) {
      return { success: false, excerpts: [] };
    }

    if (!raw || typeof raw !== 'object') {
      return { success: false, excerpts: [] };
    }

    const r = raw as { success?: boolean; excerpts?: unknown };
    if (r.success === false) return { success: false, excerpts: [] };

    const excerpts = r.excerpts;
    if (!Array.isArray(excerpts)) {
      return { success: true, excerpts: [] };
    }

    const normalized = excerpts.map((e) =>
      typeof e === 'string' ? { text: e } : (e as { text?: string }),
    );

    return { success: true, excerpts: normalized };
  };
}
