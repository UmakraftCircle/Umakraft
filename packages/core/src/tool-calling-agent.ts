import { createLogger } from '@ai-agent-platform/shared';
import { AIService } from '@ai-agent-platform/ai';
import { ToolRegistry } from './tool-registry.js';
import { z } from 'zod';

const logger = createLogger('ToolCallingAgent');

/** Structured output the model returns on each reasoning step. */
const DecisionSchema = z.object({
  tool: z.string().optional(),
  args: z.record(z.any()).optional(),
  answer: z.string().optional(),
});

type Decision = z.infer<typeof DecisionSchema>;

export interface ToolCallingAgentOptions {
  maxToolCalls?: number;
  toolTimeoutMs?: number;
  /** Per-model-generation timeout (the LLM call itself). */
  generateTimeoutMs?: number;
  /** Hard wall-clock cap on the whole run(). */
  overallTimeoutMs?: number;
}

export const DEFAULT_AGENT_OPTIONS = {
  maxToolCalls: 5,
  toolTimeoutMs: 10_000,
  generateTimeoutMs: 20_000,
  overallTimeoutMs: 90_000,
} as const;

/** Wrap a promise with a timeout that rejects (and clears the timer) on expiry. */
function withTimeout<T>(p: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); })
     .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

/**
 * Feature 2: a controlled, model-driven tool-calling loop.
 *
 * Each iteration the model decides (via structured output) whether to invoke
 * a read-only allow-listed tool or to produce a final answer. Tools are
 * executed strictly through the existing ToolRegistry, which performs
 * argument validation and secret redaction, so the model can never run
 * arbitrary code/sql/shell/network.
 *
 * Timeouts are enforced at three levels:
 *  - per tool call (toolTimeoutMs)
 *  - per model generation (generateTimeoutMs)
 *  - whole run (overallTimeoutMs)
 */
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
    const maxToolCalls = options.maxToolCalls ?? DEFAULT_AGENT_OPTIONS.maxToolCalls;
    const toolTimeoutMs = options.toolTimeoutMs ?? DEFAULT_AGENT_OPTIONS.toolTimeoutMs;
    const generateTimeoutMs = options.generateTimeoutMs ?? DEFAULT_AGENT_OPTIONS.generateTimeoutMs;
    const overallTimeoutMs = options.overallTimeoutMs ?? DEFAULT_AGENT_OPTIONS.overallTimeoutMs;

    return withTimeout(this._run({ userId, userMessage, context, maxToolCalls, toolTimeoutMs, generateTimeoutMs }), overallTimeoutMs, 'agent run');
  }

  private async _run(p: {
    userId: string;
    userMessage: string;
    context?: string;
    maxToolCalls: number;
    toolTimeoutMs: number;
    generateTimeoutMs: number;
  }): Promise<string> {
    const toolSchemas = this.registry.getDeclarativeSchemas();
    const toolList = toolSchemas
      .map((t) => `- ${t.slug}: ${t.description}`)
      .join('\n');

    const system = `
You are a helpful assistant for the Umakraft Discord server, an Uma Musume fan community.
You can answer conversationally and, when needed, call read-only tools to fetch real data.

Available tools (read-only):
${toolList}

Whenever you produce data, prefer calling a tool FIRST rather than guessing.
When you call a tool, respond ONLY with JSON: {"tool": "<slug>", "args": {...}}.
When you have enough information, respond with JSON: {"answer": "<final text>"}.
Do not indicate tool calls in your final answer.
`.trim();

    let transcript = context ? `Context from earlier conversation:\n${context}\n\n` : '';
    let toolCallCount = 0;

    for (let i = 0; i <= p.maxToolCalls; i++) {
      const prompt = `${transcript}User ${p.userId} says: ${p.userMessage}`;
      const raw = await withTimeout(
        this.aiService.generateStructuredOutput({ system, prompt, schema: DecisionSchema }),
        p.generateTimeoutMs,
        'model generation',
      );
      const parsed = DecisionSchema.safeParse(raw);

      if (!parsed.success) {
        logger.error(`Model returned invalid decision: ${parsed.error.message}`);
        return 'Sorry, I had trouble deciding what to do. Please try again.';
      }

      const decision: Decision = parsed.data;

      // Final answer
      if (decision.answer && !decision.tool) {
        return decision.answer;
      }

      // Tool call
      if (decision.tool) {
        if (toolCallCount >= p.maxToolCalls) {
          logger.warn(`Tool-call limit (${p.maxToolCalls}) reached; stopping.`);
          return 'I reached my tool-call limit. Here is what I gathered so far.';
        }

        let result;
        try {
          result = await withTimeout(
            this.registry.execute(decision.tool, decision.args ?? {}),
            p.toolTimeoutMs,
            'tool execution',
          );
        } catch (err: any) {
          result = { success: false, error: err?.message ?? String(err) };
        }

        toolCallCount++;
        transcript += `\nTool ${decision.tool} returned: ${JSON.stringify(result)}\n`;
        continue;
      }

      // Neither answer nor tool -> treat as no-op answer
      return 'I could not determine a response. Please rephrase.';
    }

    return 'I reached the maximum number of steps without a final answer.';
  }
}
