import { createLogger } from '@ai-agent-platform/shared';
import { AIService, buildSystemPrompt } from '@ai-agent-platform/ai';
import { ToolRegistry } from './tool-registry.js';
import { z } from 'zod';

const logger = createLogger('ToolCallingAgent');

/**
 * Structured output the model returns on each reasoning step. With native
 * tool-calling, the provider returns `{ action, parameters }` (translated from
 * Groq/OpenAI `tool_calls`) or `{ answer }`. The field names also avoid the
 * native tool-call signature (`name`/`arguments`) to prevent gateway interception.
 */
const DecisionSchema = z.object({
  action: z.string().optional(),
  parameters: z.record(z.any()).optional(),
  answer: z.string().optional(),
});

type Decision = z.infer<typeof DecisionSchema>;

export interface ToolCallingAgentOptions {
  maxToolCalls?: number;
  maxWebSearches?: number;
  toolTimeoutMs?: number;
  generateTimeoutMs?: number;
  overallTimeoutMs?: number;
  maxResultBytes?: number;
  /**
   * Optional text prepended to the canonical agent system prompt. Used by
   * command-specific voices (e.g. `/chat`'s Trainer persona) to layer a persona
   * on top of the shared core without replacing it.
   */
  systemPromptPrefix?: string;
  /**
   * When true, the Uma Musume domain block (including the [[OFFTOPIC]] off-topic
   * gate) is appended to the system prompt, restricting the conversation to the
   * Uma Musume / Umakraft domain. Used by `/ask`.
   *
   * When false (default), only the shared safety/identity core is used, so the
   * agent is a general-conversation assistant. Used by `/chat` and `/agent`.
   */
  domainGuard?: boolean;
}

export const DEFAULT_AGENT_OPTIONS = {
  maxToolCalls: 5,
  maxWebSearches: 3,
  toolTimeoutMs: 10_000,
  generateTimeoutMs: 20_000,
  overallTimeoutMs: 90_000,
  maxResultBytes: 64 * 1024,
} as const;

const WEB_SEARCH_SLUG = 'search_web';

function withTimeout<T>(p: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); })
     .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

function byteLen(s: string): number {
  return Buffer.byteLength(s, 'utf8');
}

function truncate(s: string, maxBytes: number): string {
  if (maxBytes <= 0 || byteLen(s) <= maxBytes) return s;
  let out = s.slice(0, maxBytes);
  while (byteLen(out) > maxBytes) out = out.slice(0, out.length - 1);
  return out + '…[truncated]';
}

function buildSystemPromptMsg(
  toolList: string,
  maxWebSearches: number,
  domainGuard: boolean,
  systemPromptPrefix?: string,
): string {
  const prefix = systemPromptPrefix ? `${systemPromptPrefix}\n\n` : '';
  return (
    prefix +
    `${buildSystemPrompt(domainGuard)}

TOOLS
- Use the provided tools to gather real data instead of guessing. You may call a tool,
  then use its result to produce a final answer.
- You may use at most ${maxWebSearches} web searches (search_web) in this conversation.
- Stop as soon as the question is answered; do not enter an open-ended search loop.

Available tools:
${toolList}
`.trim()
  );
}

export interface AgentRunTrace {
  answer: string;
  usedWebSearch: boolean;
}

export class ToolCallingAgent {
  constructor(
    private aiService: AIService,
    private registry: ToolRegistry = ToolRegistry.getInstance(),
  ) {}

  async run(
    userId: string,
    userMessage: string,
    context?: string,
    options: ToolCallingAgentOptions = {},
  ): Promise<string> {
    const trace = await this.runWithTrace(userId, userMessage, context, options);
    return trace.answer;
  }

  async runWithTrace(
    userId: string,
    userMessage: string,
    context?: string,
    options: ToolCallingAgentOptions = {},
  ): Promise<AgentRunTrace> {
    const maxToolCalls = options.maxToolCalls ?? DEFAULT_AGENT_OPTIONS.maxToolCalls;
    const maxWebSearches = options.maxWebSearches ?? DEFAULT_AGENT_OPTIONS.maxWebSearches;
    const toolTimeoutMs = options.toolTimeoutMs ?? DEFAULT_AGENT_OPTIONS.toolTimeoutMs;
    const generateTimeoutMs = options.generateTimeoutMs ?? DEFAULT_AGENT_OPTIONS.generateTimeoutMs;
    const overallTimeoutMs = options.overallTimeoutMs ?? DEFAULT_AGENT_OPTIONS.overallTimeoutMs;
    const maxResultBytes = options.maxResultBytes ?? DEFAULT_AGENT_OPTIONS.maxResultBytes;
    const domainGuard = options.domainGuard ?? false;

    return withTimeout(
      this._run({
        userId,
        userMessage,
        context,
        maxToolCalls,
        maxWebSearches,
        toolTimeoutMs,
        generateTimeoutMs,
        maxResultBytes,
        domainGuard,
        systemPromptPrefix: options.systemPromptPrefix,
      }),
      overallTimeoutMs,
      'agent run',
    );
  }

  private async _run(p: {
    userId: string;
    userMessage: string;
    context?: string;
    maxToolCalls: number;
    maxWebSearches: number;
    toolTimeoutMs: number;
    generateTimeoutMs: number;
    maxResultBytes: number;
    domainGuard: boolean;
    systemPromptPrefix?: string;
  }): Promise<AgentRunTrace> {
    const toolSchemas = this.registry.getDeclarativeSchemas();
    const toolList = toolSchemas
      .map((t) => `- ${t.slug}: ${t.description}`)
      .join('\n');

    const system = buildSystemPromptMsg(toolList, p.maxWebSearches, p.domainGuard, p.systemPromptPrefix);

    let transcript = p.context ? `Context from earlier conversation:\n${p.context}\n\n` : '';
    let toolCallCount = 0;
    let webSearchCount = 0;

    for (let i = 0; i <= p.maxToolCalls; i++) {
      const prompt = `${transcript}User ${p.userId} says: ${p.userMessage}`;

      let parsed: { success: boolean; data?: Decision; error?: any } | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        let raw: any;
        try {
          raw = await withTimeout(
            this.aiService.generateStructuredOutput({ system, prompt, schema: DecisionSchema, tools: toolSchemas as any }),
            p.generateTimeoutMs,
            'model generation',
          );
        } catch (err: any) {
          // A config error (tool_use_failed 400, etc.) is NOT retryable — surface it.
          logger.error(`Model generation failed: ${err?.message ?? err}`);
          throw err;
        }
        const result = DecisionSchema.safeParse(raw);
        if (result.success) {
          parsed = result;
          break;
        }
        if (attempt === 0) {
          logger.warn('Model produced non-conforming decision; retrying once.');
        } else {
          parsed = result;
        }
      }

      if (!parsed || !parsed.success) {
        logger.error(`Model returned invalid decision: ${parsed?.error?.message ?? 'unknown'}`);
        return { answer: 'Sorry, I had trouble deciding what to do. Please try again.', usedWebSearch: webSearchCount > 0 };
      }

      const decision: Decision = parsed.data!;

      // Final answer
      if (decision.answer && !decision.action) {
        return { answer: decision.answer, usedWebSearch: webSearchCount > 0 };
      }

      // Tool call
      if (decision.action) {
        if (toolCallCount >= p.maxToolCalls) {
          logger.warn(`Tool-call limit (${p.maxToolCalls}) reached; stopping.`);
          return { answer: 'I reached my tool-call limit. Here is what I gathered so far.', usedWebSearch: webSearchCount > 0 };
        }
        if (decision.action === WEB_SEARCH_SLUG && webSearchCount >= p.maxWebSearches) {
          logger.warn(`Web-search limit (${p.maxWebSearches}) reached; stopping.`);
          return { answer: 'I reached my web-search limit. Here is what I gathered so far.', usedWebSearch: webSearchCount > 0 };
        }

        let result;
        try {
          result = await withTimeout(
            this.registry.execute(decision.action, decision.parameters ?? {}),
            p.toolTimeoutMs,
            'tool execution',
          );
        } catch (err: any) {
          result = { success: false, error: err?.message ?? String(err) };
        }

        if (decision.action === WEB_SEARCH_SLUG) webSearchCount++;
        toolCallCount++;
        const rendered = truncate(JSON.stringify(result), p.maxResultBytes);
        transcript += `\nTool ${decision.action} returned: ${rendered}\n`;
        continue;
      }

      return { answer: 'I could not determine a response. Please rephrase.', usedWebSearch: webSearchCount > 0 };
    }

    return { answer: 'I reached the maximum number of steps without a final answer.', usedWebSearch: webSearchCount > 0 };
  }
}
