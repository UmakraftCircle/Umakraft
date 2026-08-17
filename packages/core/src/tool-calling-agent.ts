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
}

/**
 * Feature 2: a controlled, model-driven tool-calling loop.
 *
 * Each iteration the model decides (via structured output) whether to invoke
 * a read-only allow-listed tool or to produce a final answer. Tools are
 * executed strictly through the existing ToolRegistry, which performs
 * argument validation and secret redaction, so the model can never run
 * arbitrary code/sql/shell/network.
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
    const maxToolCalls = options.maxToolCalls ?? 5;
    const toolTimeoutMs = options.toolTimeoutMs ?? 10_000;

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

    for (let i = 0; i <= maxToolCalls; i++) {
      const prompt = `${transcript}User ${userId} says: ${userMessage}`;

      const raw = await this.aiService.generateStructuredOutput({ system, prompt, schema: DecisionSchema });
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
        if (toolCallCount >= maxToolCalls) {
          logger.warn(`Tool-call limit (${maxToolCalls}) reached; stopping.`);
          return 'I reached my tool-call limit. Here is what I gathered so far.';
        }

        const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
          new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('tool timeout')), ms);
            p.then((v) => { clearTimeout(timer); resolve(v); }).catch((e) => { clearTimeout(timer); reject(e); });
          });

        let result;
        try {
          result = await withTimeout(
            this.registry.execute(decision.tool, decision.args ?? {}),
            toolTimeoutMs,
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
