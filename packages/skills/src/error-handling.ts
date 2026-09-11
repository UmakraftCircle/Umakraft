import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('SkillTools:error-handling');

const CATEGORIES: Record<string, { title: string; guidance: string[] }> = {
  transient: {
    title: 'Transient / retryable',
    guidance: [
      'Back off with jitter between retries (exponential).',
      'Cap retries; do not retry forever.',
      'Idempotency: retries must be safe to repeat.',
    ],
  },
  validation: {
    title: 'Validation / input error',
    guidance: [
      'Fail fast with a clear, actionable message.',
      'Do not retry — input is invalid.',
      'Surface the specific field/constraint that failed.',
    ],
  },
  authentication: {
    title: 'Authentication / authorization',
    guidance: [
      'Never log credentials or tokens.',
      'Distinguish 401 (unauthenticated) from 403 (forbidden).',
      'Refresh/expire tokens securely.',
    ],
  },
  timeout: {
    title: 'Timeout',
    guidance: [
      'Honor user/agent timeouts; degrade gracefully.',
      'Return partial results where safe.',
      'Log duration for diagnosis.',
    ],
  },
};

export const errorHandlingPatternsTool: ToolDefinition = {
  slug: 'error-handling-patterns',
  name: 'Error Handling Patterns',
  description:
    'Return categorized error-handling guidance (transient/retryable, validation, auth, timeout) with concrete actions (backoff, fail-fast, idempotency, token hygiene) to correctly classify and respond to a failure.',
  parameters: {
    category: {
      type: 'string',
      description: 'Error category to get guidance for',
      required: false,
      enum: Object.keys(CATEGORIES),
    },
  },
  handler: async (args) => {
    const category = (args['category'] as string) ?? null;
    logger.info(`error-handling-patterns category=${category ?? 'all'}`);

    const out = category
      ? { [category]: CATEGORIES[category as string] }
      : CATEGORIES;

    return {
      success: true,
      categories: out,
      generalRules: [
        'Classify before reacting (is it transient, validation, auth, or timeout?).',
        'Log enough context to diagnose without leaking secrets.',
        'Never swallow errors silently.',
      ],
    };
  },
};
