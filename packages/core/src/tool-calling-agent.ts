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
   * Soft cap on the combined token size (system + conversation context +
   * accumulated tool transcript) sent to the model, estimated chars/4. When the
   * request would exceed it, older context/transcript is trimmed first. Kept well
   * below the Groq 8000 TPM limit to leave headroom for output tokens.
   */
  inputTokenBudget?: number;
  /**
   * Max tokens budgeted for the MODEL OUTPUT. Mirrors the `max_tokens` sent to
   * the provider. Sized to leave headroom under the shared 8000 TPM limit.
   */
  outputTokenBudget?: number;
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
  /**
   * Optional explicit list of tool slugs to expose to the model this run. When
   * omitted, ALL registered tools are sent. Scoping to a small set keeps the
   * tool-schema token overhead low (important on Groq's free tier).
   */
  toolSlugs?: string[];
}

export const DEFAULT_AGENT_OPTIONS = {
  maxToolCalls: 5,
  maxWebSearches: 3,
  toolTimeoutMs: 10_000,
  generateTimeoutMs: 20_000,
  overallTimeoutMs: 90_000,
  maxResultBytes: 8 * 1024,
  // Groq TPM is 8000; budget ~4000 input tokens + ~1500 output tokens leaves
  // ample headroom for the provider's tool-schema serialization overhead.
  inputTokenBudget: 4000,
  outputTokenBudget: 1500,
} as const;

const WEB_SEARCH_SLUG = 'search_web';

/**
 * Rough token estimate (chars / 4). Good enough for budget gating and logging;
 * deliberately conservative so we stay safely under provider limits without a
 * tokenizer dependency.
 */
function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

/** Detect Groq 413 / TPM "request too large" errors from thrown provider errors. */
function isTokenLimitError(err: any): boolean {
  if (!err) return false;
  const msg = (err?.message ?? String(err)).toLowerCase();
  const status = err?.statusCode ?? err?.status;
  if (status === 413) return true;
  return (
    /request too large/.test(msg) ||
    /tokens per minute/.test(msg) ||
    /rate_limit_exceeded/.test(msg) ||
    (/413/.test(msg) && /(token|limit|too large)/.test(msg))
  );
}

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

/**
 * Compact an already-truncated tool result bytes-string into a tighter,
 * token-budgeted form. Preserves the leading (most relevant) content — tool
 * results are shaped with the decision-relevant fields first, so a head-keep is
 * safe. Used when a single large result would otherwise dominate the request.
 */
function compactToolResult(rendered: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (rendered.length <= maxChars) return rendered;
  const head = rendered.slice(0, Math.floor(maxChars * 0.7));
  const tail = rendered.slice(-Math.floor(maxChars * 0.3));
  return `${head}\n…[${estimateTokens(rendered) - maxTokens} tokens elided]…\n${tail}`;
}

function buildSystemPromptMsg(
  maxWebSearches: number,
  domainGuard: boolean,
  systemPromptPrefix?: string,
): string {
  // Note: tool *descriptions* are carried by the native `tools` schema sent
  // separately to the provider, so they are NOT duplicated here. This avoids
  // doubling tool-definition tokens in every request.
  const prefix = systemPromptPrefix ? `${systemPromptPrefix}\n\n` : '';
  return (
    prefix +
    `${buildSystemPrompt(domainGuard)}

TOOLS
- Use the provided tools to gather real data instead of guessing. You may call a tool,
  then use its result to produce a final answer.
- You may use at most ${maxWebSearches} web searches (search_web) in this conversation.
- Stop as soon as the question is answered; do not enter an open-ended search loop.`.trim()
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
    const inputTokenBudget = options.inputTokenBudget ?? DEFAULT_AGENT_OPTIONS.inputTokenBudget;
    const outputTokenBudget = options.outputTokenBudget ?? DEFAULT_AGENT_OPTIONS.outputTokenBudget;
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
        inputTokenBudget,
        outputTokenBudget,
        domainGuard,
        systemPromptPrefix: options.systemPromptPrefix,
        toolSlugs: options.toolSlugs,
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
    inputTokenBudget: number;
    outputTokenBudget: number;
    domainGuard: boolean;
    systemPromptPrefix?: string;
    toolSlugs?: string[];
  }): Promise<AgentRunTrace> {
    const toolSchemas = this.registry.getDeclarativeSchemas(p.toolSlugs);

    const system = buildSystemPromptMsg(p.maxWebSearches, p.domainGuard, p.systemPromptPrefix);
    const systemTokens = estimateTokens(system);
    // Reserve budget for the system prompt + native tool schemas; what remains is
    // available for conversation context and the tool transcript.
    const schemaTokens = toolSchemas.reduce((sum, t) => sum + estimateTokens(`${t.slug} ${t.description ?? ''}`) + 40, 0);
    const runtimeBudget = Math.max(0, p.inputTokenBudget - systemTokens - schemaTokens);

    let context = p.context
      ? `Context from earlier conversation:\n${p.context}\n\n`
      : '';
    let toolCallCount = 0;
    let webSearchCount = 0;
    // Accumulates tool results across the loop. Trimmed oldest-first so later,
    // more recent results are preserved.
    let transcript = '';

    const trimContext = () => {
      const ctxBudget = Math.floor(runtimeBudget * 0.4);
      if (context && estimateTokens(context) > ctxBudget) {
        const before = estimateTokens(context);
        // Keep the most recent tail of the conversation context.
        context = context.slice(-ctxBudget * 4);
        const after = estimateTokens(context);
        logger.info(
          `[token-budget] trimmed conversation context by ${before - after} est. tokens (${before}→${after}); context-budget=${ctxBudget}`,
        );
      }
    };

    const trimTranscript = () => {
      const trBudget = Math.floor(runtimeBudget * 0.5);
      if (transcript && estimateTokens(transcript) > trBudget) {
        const before = estimateTokens(transcript);
        // Drop the OLDEST tool results; keep the newest, most relevant ones.
        while (transcript && estimateTokens(transcript) > trBudget) {
          const nl = transcript.indexOf('\n');
          transcript = nl >= 0 ? transcript.slice(nl + 1) : '';
        }
        const after = estimateTokens(transcript);
        logger.info(
          `[token-budget] trimmed tool transcript by ${before - after} est. tokens (${before}→${after}); transcript-budget=${trBudget}`,
        );
      }
    };

    const buildPrompt = () => `${transcript}${context}User ${p.userId} says: ${p.userMessage}`;

    const generate = async (systemMsg: string, prompt: string, retryTrimmed: boolean) => {
      try {
        return await withTimeout(
          this.aiService.generateStructuredOutput({
            system: systemMsg,
            prompt,
            schema: DecisionSchema,
            tools: toolSchemas as any,
            maxTokens: p.outputTokenBudget,
          }),
          p.generateTimeoutMs,
          'model generation',
        );
      } catch (err: any) {
        if (isTokenLimitError(err) && retryTrimmed) {
          // 413 / TPM: the request was too large. Retry ONCE with aggressively
          // trimmed context+transcript. Safe — no tool has executed for this step,
          // so no duplicate tool execution occurs.
          logger.warn(
            `[token-budget] request too large (${err?.message ?? err}); retrying with reduced context`,
          );
          trimContext();
          trimTranscript();
          const retryPrompt = buildPrompt();
          return await withTimeout(
            this.aiService.generateStructuredOutput({
              system: systemMsg,
              prompt: retryPrompt,
              schema: DecisionSchema,
              tools: toolSchemas as any,
              maxTokens: p.outputTokenBudget,
            }),
            p.generateTimeoutMs,
            'model generation (retry)',
          );
        }
        // Not token-related (config/tool-use/rate) — surface it.
        logger.error(`Model generation failed: ${err?.message ?? err}`);
        throw err;
      }
    };

    for (let i = 0; i <= p.maxToolCalls; i++) {
      trimContext();
      trimTranscript();
      const prompt = buildPrompt();

      const estInput = systemTokens + schemaTokens + estimateTokens(prompt);
      logger.info(
        `[token-budget] estimated input=${estInput} tokens (budget=${p.inputTokenBudget}; system=${systemTokens}; tools=${schemaTokens}; body=${estimateTokens(prompt)})`,
      );
      if (estInput > p.inputTokenBudget) {
        logger.warn(
          `[token-budget] request over budget (${estInput} > ${p.inputTokenBudget}); trimming context/transcript`,
        );
        trimContext();
        trimTranscript();
      }

      let parsed: { success: boolean; data?: Decision; error?: any } | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        let raw: any;
        try {
          raw = await generate(system, prompt, attempt === 0);
        } catch (err: any) {
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
        const truncated = truncate(JSON.stringify(result), p.maxResultBytes);
        const rendered = compactToolResult(truncated, Math.floor(runtimeBudget * 0.4));
        transcript += `\nTool ${decision.action} returned: ${rendered}\n`;
        continue;
      }

      return { answer: 'I could not determine a response. Please rephrase.', usedWebSearch: webSearchCount > 0 };
    }

    return { answer: 'I reached the maximum number of steps without a final answer.', usedWebSearch: webSearchCount > 0 };
  }
}
