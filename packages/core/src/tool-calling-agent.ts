import { createLogger } from '@ai-agent-platform/shared';
import { AIService, buildSystemPrompt } from '@ai-agent-platform/ai';
import { ToolRegistry } from './tool-registry.js';
import { capabilityDiscovery } from './capability-discovery.js';
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

export interface ToolCall {
  slug: string;
  args: Record<string, unknown>;
}

export type ToolBudgetMap = Record<string, number>;

export type FinalizeReason =
  | 'total_budget'
  | 'per_tool_budget'
  | 'repeat_detected'
  | 'stop_short'
  | 'completed'
  | 'timeout';

export interface StructuredLogEntry {
  event: 'tool_call' | 'finalize' | 'limit_skipped' | 'repeat_detected';
  turn: number;
  toolSlug?: string;
  priorityLevel?: number;
  fallbackUsed?: boolean;
  success?: boolean;
  argsSnippet?: string;
  totalUsed: number;
  totalBudget: number;
  perToolRemaining?: number;
  reason?: FinalizeReason;
}

/**
 * Maps a tool slug to its authority priority level (1 = Highest / Club, 2 = Umamusume, 3 = Research, 4 = Conversation / Memory).
 */
export function getToolPriorityLevel(slug: string): number {
  if (
    [
      'get_trainer_stats',
      'get_user_profile',
      'search_trainers',
      'get_leaderboard',
      'get_fan_gain',
      'get_fan_leaderboard',
      'fan-tracker-fetch-stats',
      'fan-tracker-analyze-trends',
      'link_request',
    ].includes(slug)
  ) {
    return 1; // Priority 1: Club Authority
  }
  if (
    [
      'umamusume-puredb-search',
      'umamusume-data-miner',
      'umamusume-search',
      'umamusume-compile',
      'umamusume-list-sources',
    ].includes(slug)
  ) {
    return 2; // Priority 2: Umamusume Authority
  }
  if (['search_web', 'web_fetch', 'tavily'].includes(slug)) {
    return 3; // Priority 3: Research Authority
  }
  return 4; // Priority 4: Conversational / Memory / Knowledge RAG
}

export type UmamusumeIntentCategory =
  | 'character'
  | 'skill'
  | 'support_card'
  | 'track'
  | 'inheritance'
  | 'training'
  | 'scenario'
  | 'mechanics'
  | 'general';

export function getUmamusumeIntentCategory(slug: string, argsStr: string): UmamusumeIntentCategory {
  const lower = argsStr.toLowerCase();
  if (lower.includes('skill') || lower.includes('recovery') || lower.includes('acceleration') || lower.includes('gold skill')) {
    return 'skill';
  }
  if (lower.includes('support') || lower.includes('card') || lower.includes('ssr') || lower.includes('sr')) {
    return 'support_card';
  }
  if (lower.includes('track') || lower.includes('course') || lower.includes('tokyo') || lower.includes('nakayama') || lower.includes('hanshin')) {
    return 'track';
  }
  if (lower.includes('inherit') || lower.includes('parent') || lower.includes('factor')) {
    return 'inheritance';
  }
  if (lower.includes('scenario') || lower.includes('ura') || lower.includes('aoharu') || lower.includes('grand live') || lower.includes("l'arc") || lower.includes('uaf')) {
    return 'scenario';
  }
  if (lower.includes('train') || lower.includes('stat') || lower.includes('build') || lower.includes('deck')) {
    return 'training';
  }
  if (lower.includes('mechanic') || lower.includes('position') || lower.includes('pacing')) {
    return 'mechanics';
  }
  if (slug === 'umamusume-puredb-search' || slug === 'umamusume-data-miner') {
    return 'character';
  }
  return 'general';
}

export interface ToolCallingAgentOptions {
  maxToolCalls?: number;
  maxWebSearches?: number;
  toolTimeoutMs?: number;
  generateTimeoutMs?: number;
  overallTimeoutMs?: number;
  maxResultBytes?: number;
  inputTokenBudget?: number;
  outputTokenBudget?: number;
  systemPromptPrefix?: string;
  domainGuard?: boolean;
  toolSlugs?: string[];
  toolBudgets?: ToolBudgetMap;
  logger?: (entry: StructuredLogEntry) => void;
}

export const DEFAULT_AGENT_OPTIONS = {
  maxToolCalls: 10,
  maxWebSearches: 3,
  toolTimeoutMs: 10_000,
  generateTimeoutMs: 20_000,
  overallTimeoutMs: 90_000,
  maxResultBytes: 8 * 1024,
  inputTokenBudget: 7500,
  outputTokenBudget: 1500,
} as const;

const WEB_SEARCH_SLUG = 'search_web';

/**
 * Canonical fingerprint of a tool call: normalizes the slug and all string arguments
 * (trimmed, lowercase, collapsed spaces), then sorts keys deterministically.
 */
export function fingerprintCall(call: ToolCall): string {
  const normalizedArgs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(call.args || {})) {
    normalizedArgs[key] =
      typeof value === 'string'
        ? value.trim().replace(/\s+/g, ' ').toLowerCase()
        : value;
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(normalizedArgs).sort()) {
    sorted[key] = normalizedArgs[key];
  }
  return `${call.slug}:${JSON.stringify(sorted)}`;
}

function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

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
  totalToolCalls?: number;
  finalizeReason?: FinalizeReason;
  logs?: StructuredLogEntry[];
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
        toolBudgets: options.toolBudgets,
        loggerCallback: options.logger,
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
    toolBudgets?: ToolBudgetMap;
    loggerCallback?: (entry: StructuredLogEntry) => void;
  }): Promise<AgentRunTrace> {
    const toolSchemas = this.registry.getDeclarativeSchemas(p.toolSlugs);

    const system = buildSystemPromptMsg(p.maxWebSearches, p.domainGuard, p.systemPromptPrefix);
    const systemTokens = estimateTokens(system);
    const schemaTokens = toolSchemas.reduce((sum, t) => sum + estimateTokens(`${t.slug} ${t.description ?? ''}`) + 40, 0);
    const runtimeBudget = Math.max(0, p.inputTokenBudget - systemTokens - schemaTokens);

    let context = p.context
      ? `Context from earlier conversation:\n${p.context}\n\n`
      : '';
    let toolCallCount = 0;
    let webSearchCount = 0;
    let transcript = '';
    const executedSlugs: string[] = [];
    let successfulCalls = 0;

    const seenFingerprints = new Set<string>();
    const resultCache = new Map<string, string>();
    const perToolUsed: Record<string, number> = {};
    const logEntries: StructuredLogEntry[] = [];

    const emitLog = (entry: StructuredLogEntry) => {
      logEntries.push(entry);
      if (p.loggerCallback) {
        try { p.loggerCallback(entry); } catch {}
      }
    };

    const trimContext = () => {
      const ctxBudget = Math.floor(runtimeBudget * 0.4);
      if (context && estimateTokens(context) > ctxBudget) {
        const before = estimateTokens(context);
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
        return {
          answer: 'Sorry, I had trouble deciding what to do. Please try again.',
          usedWebSearch: webSearchCount > 0,
          totalToolCalls: toolCallCount,
          logs: logEntries,
        };
      }

      const decision: Decision = parsed.data!;
      // Final answer
      if (decision.answer && !decision.action) {
        if (executedSlugs.length > 0) {
          const successRate = Math.round((successfulCalls / executedSlugs.length) * 100);
          logger.info(
            `[telemetry] Multi-Tool Workflow | ExecutedTools: [${executedSlugs.join(', ')}] | TotalExecuted: ${executedSlugs.length} | SuccessRate: ${successRate}%`,
          );
        }
        emitLog({
          event: 'finalize',
          turn: toolCallCount,
          totalUsed: toolCallCount,
          totalBudget: p.maxToolCalls,
          reason: 'completed',
        });
        return {
          answer: decision.answer,
          usedWebSearch: webSearchCount > 0,
          totalToolCalls: toolCallCount,
          finalizeReason: 'completed',
          logs: logEntries,
        };
      }

      // Tool call
      if (decision.action) {
        const slug = decision.action;
        const callArgs = decision.parameters ?? {};
        const callObj: ToolCall = { slug, args: callArgs };
        const fingerprint = fingerprintCall(callObj);

        // Check global tool call limit
        if (toolCallCount >= p.maxToolCalls) {
          logger.warn(`Tool-call limit (${p.maxToolCalls}) reached; stopping.`);
          emitLog({
            event: 'finalize',
            turn: toolCallCount,
            toolSlug: slug,
            totalUsed: toolCallCount,
            totalBudget: p.maxToolCalls,
            reason: 'total_budget',
          });
          return {
            answer: 'I reached my tool-call limit. Here is what I gathered so far.',
            usedWebSearch: webSearchCount > 0,
            totalToolCalls: toolCallCount,
            finalizeReason: 'total_budget',
            logs: logEntries,
          };
        }

        // Check per-tool budgets
        const perToolBudget = p.toolBudgets?.[slug] ?? (slug === WEB_SEARCH_SLUG ? p.maxWebSearches : Infinity);
        const usedThisTool = perToolUsed[slug] ?? 0;
        if (usedThisTool >= perToolBudget) {
          logger.warn(`Per-tool budget for [${slug}] (${perToolBudget}) reached; forcing finalization.`);
          emitLog({
            event: 'finalize',
            turn: toolCallCount,
            toolSlug: slug,
            totalUsed: toolCallCount,
            totalBudget: p.maxToolCalls,
            perToolRemaining: 0,
            reason: 'per_tool_budget',
          });
          return {
            answer: `I reached the limit for tool "${slug}". Here is what I gathered so far.`,
            usedWebSearch: webSearchCount > 0,
            totalToolCalls: toolCallCount,
            finalizeReason: 'per_tool_budget',
            logs: logEntries,
          };
        }

        // Check repeat call detection
        let rendered: string;
        if (seenFingerprints.has(fingerprint)) {
          logger.warn(`[repeat_detected] Identical tool call repeated: ${fingerprint}`);
          emitLog({
            event: 'repeat_detected',
            turn: toolCallCount,
            toolSlug: slug,
            argsSnippet: fingerprint,
            totalUsed: toolCallCount,
            totalBudget: p.maxToolCalls,
            reason: 'repeat_detected',
          });
          rendered = resultCache.get(fingerprint) ?? 'Cached result: previously executed with identical parameters.';
          transcript += `\n[Notice: Repeated query suppressed. Using previous result for ${slug}]\n`;
        } else {
          let result;
          try {
            result = await withTimeout(
              this.registry.execute(slug, callArgs),
              p.toolTimeoutMs,
              'tool execution',
            );
          } catch (err: any) {
            result = { success: false, error: err?.message ?? String(err) };
          }

          if (slug === WEB_SEARCH_SLUG) webSearchCount++;
          toolCallCount++;
          perToolUsed[slug] = usedThisTool + 1;

          const truncated = truncate(JSON.stringify(result), p.maxResultBytes);
          rendered = compactToolResult(truncated, Math.floor(runtimeBudget * 0.4));
          resultCache.set(fingerprint, rendered);
          seenFingerprints.add(fingerprint);

          const priorityLevel = getToolPriorityLevel(slug);
          const isSuccess = typeof result === 'object' && result !== null ? (result as any).success !== false : !rendered.startsWith('Error');
          const fallbackUsed = priorityLevel >= 3;

          executedSlugs.push(slug);
          capabilityDiscovery.trackUsage(slug);
          if (isSuccess) successfulCalls++;

          logger.info(
            `[telemetry] Tool Decision | Tool: ${slug} | Priority: ${priorityLevel} | FallbackUsed: ${fallbackUsed} | Success: ${isSuccess}`,
          );

          if (priorityLevel === 2) {
            const category = getUmamusumeIntentCategory(slug, fingerprint);
            const count = Array.isArray((result as any)?.results) ? (result as any).results.length : (isSuccess ? 1 : 0);
            logger.info(
              `[telemetry] Umamusume Routing | Category: ${category} | Tool: ${slug} | ResultCount: ${count} | Fallback: ${fallbackUsed}`,
            );
          }

          const confidenceLevel = isSuccess ? (priorityLevel <= 2 ? 'Verified' : 'Reasoned') : 'Unverified';
          const claimType = priorityLevel === 1 ? 'Club Fact' : priorityLevel === 2 ? 'Umamusume Fact' : priorityLevel === 3 ? 'Research Fact' : 'Conversational';

          logger.info(
            `[telemetry] Authority Verification | ClaimType: ${claimType} | SourceTool: ${slug} | VerificationStatus: ${isSuccess ? 'verified' : 'failed'} | ConfidenceLevel: ${confidenceLevel}`,
          );

          emitLog({
            event: 'tool_call',
            turn: toolCallCount,
            toolSlug: slug,
            priorityLevel,
            fallbackUsed,
            success: isSuccess,
            argsSnippet: fingerprint,
            totalUsed: toolCallCount,
            totalBudget: p.maxToolCalls,
            perToolRemaining: perToolBudget - perToolUsed[slug],
          });
        }

        transcript += `\nTool ${slug} returned: ${rendered}\n`;
        continue;
      }

      return {
        answer: 'I could not determine a response. Please rephrase.',
        usedWebSearch: webSearchCount > 0,
        totalToolCalls: toolCallCount,
        logs: logEntries,
      };
    }

    return {
      answer: 'I reached the maximum number of steps without a final answer.',
      usedWebSearch: webSearchCount > 0,
      totalToolCalls: toolCallCount,
      finalizeReason: 'total_budget',
      logs: logEntries,
    };
  }
}
