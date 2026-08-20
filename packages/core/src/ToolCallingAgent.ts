/**
 * ToolCallingAgent — deterministic tool-execution control loop.
 *
 * Design philosophy (agent-control problem, NOT model problem):
 *   - The LLM stays a planner/explainer. Tool *execution* is deterministic.
 *   - The tool-call ceiling should almost never be reached in normal chat;
 *     raising maxToolCalls only hides a symptom. Instead we enforce per-tool
 *     budgets, detect repeated calls, force finalization, and stop early.
 *
 * This module is a self-contained reference. Adapt the provider `complete`
 * signature + message/tool types to your real SDK (Groq/OpenAI), and wire it
 * into apps/discord/src/{chat,ask}.ts so command files stay thin.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single tool exposed to the model. */
export interface ToolSpec<TArgs = Record<string, unknown>> {
  slug: string;
  name: string;
  description?: string;
  handler: (args: TArgs) => Promise<string> | string;
}

/** A tool call emitted by the model in a given round. */
export interface ToolCall {
  slug: string;
  args: Record<string, unknown>;
}

/** Per-tool call budget. Missing slugs fall back to `defaultBudget`. */
export type ToolBudgetMap = { [slug: string]: number };

export interface ToolCallingAgentConfig {
  /** Hard cap on total tool-call rounds (safety net, rarely reached). */
  maxToolCalls: number;
  /** Per-tool budgets. `search_web` is the usual suspect to cap at 1. */
  toolBudgets: ToolBudgetMap;
  /** Budget used for tools not listed in `toolBudgets`. */
  defaultBudget: number;
  /** Force finalization when this many total calls remain. */
  stopShortBy: number;
  /** Inject a short "answer now" system nudge alongside tool_choice enforcement. */
  finalizeSystemMessage: string;
}

export interface ToolCallingAgentDeps {
  tools: ToolSpec[];
  config: ToolCallingAgentConfig;
  /**
   * Calls the model. `toolChoice` maps to the provider's tool-choice knob:
   * `"auto"` lets the model call tools; `"none"` forbids it (hard finalize).
   */
  complete: (opts: {
    messages: ChatMessage[];
    toolChoice: "auto" | "none";
  }) => Promise<{ message: ChatMessage }>;
  logger?: (entry: StructuredLogEntry) => void;
}

export type ChatMessage =
  | { role: "system" | "assistant" | "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls: ToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export interface StructuredLogEntry {
  event: "tool_call" | "finalize" | "limit_skipped";
  turn: number;
  toolSlug?: string;
  argsSnippet?: string;
  totalUsed: number;
  totalBudget: number;
  perToolRemaining?: number;
  reason?: FinalizeReason;
}

export type FinalizeReason =
  | "total_budget"
  | "per_tool_budget"
  | "repeat_detected"
  | "stop_short";

export interface RunResult {
  content: string;
  finalizeReason: FinalizeReason | null;
  totalToolCalls: number;
  log: StructuredLogEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Canonical fingerprint of a tool call: normalize the tool slug + every string
 * argument value (trim, collapse whitespace, lowercase), then stringify
 * deterministically. Cache-safe and human-readable for logging.
 *
 *   search_web("Weather Cebu") -> 'search_web:{"q":"weather cebu"}'
 */
export function fingerprintCall(call: ToolCall): string {
  const normalizedArgs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(call.args)) {
    normalizedArgs[key] =
      typeof value === "string"
        ? value.trim().replace(/\s+/g, " ").toLowerCase()
        : value;
  }
  // Sort keys so arg order never changes the fingerprint.
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(normalizedArgs).sort()) {
    sorted[key] = normalizedArgs[key];
  }
  return `${call.slug}:${JSON.stringify(sorted)}`;
}

const DEFAULT_CONFIG: ToolCallingAgentConfig = {
  maxToolCalls: 4,
  toolBudgets: {},
  defaultBudget: 1,
  stopShortBy: 1,
  finalizeSystemMessage:
    "You must now answer using only what you already have. Do not call more tools.",
};

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class ToolCallingAgent {
  private readonly tools: ToolSpec[];
  private readonly cfg: ToolCallingAgentConfig;
  private readonly complete: ToolCallingAgentDeps["complete"];
  private readonly logger: ToolCallingAgentDeps["logger"];

  constructor(deps: ToolCallingAgentDeps) {
    this.tools = deps.tools;
    this.cfg = { ...DEFAULT_CONFIG, ...deps.config };
    this.complete = deps.complete;
    this.logger = deps.logger;
  }

  private bySlug = (slug: string): ToolSpec | undefined =>
    this.tools.find((t) => t.slug === slug);

  private budgetFor = (slug: string): number =>
    slug in this.cfg.toolBudgets ? this.cfg.toolBudgets[slug] : this.cfg.defaultBudget;

  /**
   * Entry point shared by chat.ts and ask.ts. Those files only configure the
   * tool set + the system prompt; every control policy lives here.
   */
  async run(systemPrompt: string, userInput: string): Promise<RunResult> {
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userInput },
    ];

    const totalBudget = this.cfg.maxToolCalls;
    const perToolUsed: Record<string, number> = {};
    const seenFingerprints = new Set<string>();
    // Fix 4 (cache): keyed by fingerprint so a repeated call returns instantly.
    const resultCache = new Map<string, string>();

    let totalUsed = 0;
    let finalizeReason: FinalizeReason | null = null;
    const log: StructuredLogEntry[] = [];

    while (totalUsed < totalBudget) {
      // Fix 5 (early stop): with `stopShortBy` calls left, don't let the model
      // spend its final round on yet another tool call — force an answer.
      const remaining = totalBudget - totalUsed;
      const forceFinalize = remaining <= this.cfg.stopShortBy;

      const resp = await this.complete({
        messages,
        toolChoice: forceFinalize ? "none" : "auto",
      });

      // Append any prior "answer now" nudge when we're forcing finalization.
      if (forceFinalize) {
        messages.push({
          role: "system",
          content: this.cfg.finalizeSystemMessage,
        });
      }

      const msg = resp.message;

      // No tool calls -> the model produced a final answer.
      if (msg.role === "assistant" && !("toolCalls" in msg)) {
        if (forceFinalize) {
          finalizeReason = "stop_short";
        }
        this.emitLog(log, "finalize", totalUsed, totalBudget, finalizeReason);
        return { content: msg.content, finalizeReason, totalToolCalls: totalUsed, log };
      }

      const calls: ToolCall[] =
        msg.role === "assistant" && "toolCalls" in msg ? msg.toolCalls ?? [] : [];

      if (calls.length === 0) {
        // model returned nothing actionable; finalize defensively
        finalizeReason = "total_budget";
        return { content: "", finalizeReason, totalToolCalls: totalUsed, log };
      }

      messages.push(msg);

      for (const call of calls) {
        // Fix 1 (per-tool budget) + Fix 3 (repeat detection) BEFORE execution.
        const tool = this.bySlug(call.slug);
        const used = perToolUsed[call.slug] ?? 0;
        const budget = this.budgetFor(call.slug);
        const fingerprint = fingerprintCall(call);

        let result: string;

        if (seenFingerprints.has(fingerprint)) {
          // Fix 3: the model re-issued a semantically identical call.
          finalizeReason = "repeat_detected";
          result = resultCache.get(fingerprint) ?? "";
          if (this.logger) {
            this.logger({
              event: "tool_call",
              turn: totalUsed,
              toolSlug: call.slug,
              argsSnippet: snippet(call),
              totalUsed,
              totalBudget,
              perToolRemaining: budget - used,
              reason: finalizeReason,
            });
          }
          log.push({
            event: "tool_call",
            turn: totalUsed,
            toolSlug: call.slug,
            argsSnippet: snippet(call),
            totalUsed,
            totalBudget,
            perToolRemaining: budget - used,
            reason: finalizeReason,
          });
          // Force an answer immediately with the cached result.
          return this.finalize(messages, result, finalizeReason, totalUsed, log);
        }

        if (used >= budget) {
          finalizeReason = "per_tool_budget";
          return this.finalize(
            messages,
            "",
            finalizeReason,
            totalUsed,
            log,
          );
        }

        // Execute (Fix 4 cache write after a successful run).
        let executed: string;
        try {
          executed = await tool!.handler(call.args);
        } catch (err) {
          executed = `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
        resultCache.set(fingerprint, executed);
        seenFingerprints.add(fingerprint);
        perToolUsed[call.slug] = used + 1;
        totalUsed += 1;
        result = executed;

        this.emitLog(
          log,
          "tool_call",
          totalUsed,
          totalBudget,
          null,
          call.slug,
          call,
          budget - (used + 1),
        );

        messages.push({
          role: "tool",
          toolCallId: this.toolCallId(call),
          content: result,
        });
      }

      // Fix 2: if we just exhausted the total budget through calls, finalize
      // on the next loop iteration via `forceFinalize` (or the while guard).
      if (totalUsed >= totalBudget) {
        finalizeReason = totalUsed === totalBudget ? "total_budget" : finalizeReason;
      }
    }

    // Fell out of the loop: total budget reached.
    finalizeReason = "total_budget";
    const final = await this.complete({ messages, toolChoice: "none" });
    return {
      content: final.message.content ?? "",
      finalizeReason,
      totalToolCalls: totalUsed,
      log,
    };
  }

  private async finalize(
    messages: ChatMessage[],
    cachedContent: string,
    reason: FinalizeReason,
    totalUsed: number,
    log: StructuredLogEntry[],
  ): Promise<RunResult> {
    // If we already have a cached result from a repeated call, return it
    // directly — zero extra tokens. Otherwise run one final "answer now" turn.
    if (cachedContent) {
      return { content: cachedContent, finalizeReason: reason, totalToolCalls: totalUsed, log };
    }
    messages.push({ role: "system", content: this.cfg.finalizeSystemMessage });
    const final = await this.complete({ messages, toolChoice: "none" });
    this.emitLog(log, "finalize", totalUsed, this.cfg.maxToolCalls, reason);
    return {
      content: final.message.content ?? "",
      finalizeReason: reason,
      totalToolCalls: totalUsed,
      log,
    };
  }

  private toolCallId(call: ToolCall): string {
    return fingerprintCall(call);
  }

  private emitLog(
    log: StructuredLogEntry[],
    event: "tool_call" | "finalize" | "limit_skipped",
    totalUsed: number,
    totalBudget: number,
    reason: FinalizeReason | null,
    toolSlug?: string,
    call?: ToolCall,
    perToolRemaining?: number,
  ) {
    const entry: StructuredLogEntry = {
      event,
      turn: totalUsed,
      toolSlug,
      argsSnippet: call ? snippet(call) : undefined,
      totalUsed,
      totalBudget,
      perToolRemaining,
      reason: reason ?? undefined,
    };
    log.push(entry);
    this.logger?.(entry);
  }
}

function snippet(call: ToolCall, maxLen = 80): string {
  const s = JSON.stringify(call.args);
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}