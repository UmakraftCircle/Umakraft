# ToolCallingAgent — Integration Notes

Reference for wiring the deterministic control loop into your Discord bot.
`ToolCallingAgent` owns execution policy; `chat.ts` / `ask.ts` stay thin and
only configure tools + prompts.

---

## File responsibilities

| File                   | Responsibility                                                        |
| ---------------------- | --------------------------------------------------------------------- |
| `chat.ts`              | Provide `search_web` only + system prompt + chat-specific budgets     |
| `ask.ts`               | Run `classifyTopic` (pre-LLM), provide domain tools + ask budgets     |
| `ToolCallingAgent.ts`  | Budgets, cache, repeat detection, finalization, logging               |

---

## Recommended config

```ts
// chat.ts — single tool, hard-capped at 1
const chatConfig: ToolCallingAgentConfig = {
  maxToolCalls: 4,
  toolBudgets: { search_web: 1 },
  defaultBudget: 1,
  stopShortBy: 1,
  finalizeSystemMessage:
    "You must answer now using only what you already know. Do not search again.",
};

// ask.ts — domain tools, search capped at 2
const askConfig: ToolCallingAgentConfig = {
  maxToolCalls: 4,
  toolBudgets: { search_web: 2, other_tool_slug: 1 },
  defaultBudget: 1,
  stopShortBy: 1,
  finalizeSystemMessage:
    "Answer now from the data you already gathered. Do not call more tools.",
};
```

---

## Complete provider adapter (Groq/OpenAI-style SDK)

The module is provider-agnostic — you supply a `complete` function. Map
`toolChoice` to your SDK's knob:

| `toolChoice` | Provider mapping                        |
| ------------ | --------------------------------------- |
| `"none"`     | `tool_choice: "none"` (hard constraint) |
| `"auto"`     | `tool_choice: "auto"` (model decides)   |

```ts
import { ToolCallingAgent, ToolSpec } from "./ToolCallingAgent";

const tools: ToolSpec[] = [
  {
    slug: "search_web",
    name: "search_web",
    description: "Search the web for information.",
    handler: async (args) => {
      // call your existing searchWebTool here
      return JSON.stringify(await searchWebTool.handler(args));
    },
  },
];

const agent = new ToolCallingAgent({
  tools,
  config: chatConfig,
  complete: async ({ messages, toolChoice }) => {
    // Translate to your actual provider call (Groq/OpenAI).
    const res = await yourProvider.chat({
      messages,
      tool_choice: toolChoice, // "none" | "auto"
      tools: tools.map((t) => ({ type: "function", function: { name: t.name } })),
    });
    // Normalize the response into { message: ChatMessage }.
    return { message: normalizeProviderMessage(res) };
  },
  logger: (entry) => {
    // Fix 7: structured logs instead of the opaque warning.
    console.warn("[ToolCallingAgent]", JSON.stringify(entry));
  },
});

const result = await agent.run(systemPrompt, userInput);
// result.content -> final answer
// result.finalizeReason -> "repeat_detected" | "per_tool_budget" | "total_budget" | "stop_short" | null
// result.log -> full structured trace
```

---

## Example structured log output

Replace this:

```
[WARN] [ToolCallingAgent] Tool-call limit (4) reached; stopping.
```

With this:

```jsonc
{
  "event": "tool_call",
  "turn": 2,
  "toolSlug": "search_web",
  "argsSnippet": "{\"q\":\"weather Cebu\"}",
  "totalUsed": 2,
  "totalBudget": 4,
  "perToolRemaining": -1, // <- immediately signals budget exceeded
  "reason": "repeat_detected"
}
```

Every entry answers: **what** was called, **when**, **how much budget** was left
per-tool and total, and **why** the loop stopped. No more reverse-engineering
from a bare "limit reached" string.

---

## Fix → implementation map (for code review)

| # | Fix                                  | Where in module                                                           |
| - | ------------------------------------ | ------------------------------------------------------------------------- |
| 1 | Per-tool budgets                     | `budgetFor()` + `perToolUsed` check before execution                       |
| 2 | Forced finalization                  | `toolChoice: "none"` + `finalizeSystemMessage` in `finalize()` / early stop |
| 3 | Repeated-loop detection              | `fingerprintCall()` + `seenFingerprints` Set                               |
| 4 | Per-message cache                    | `resultCache` keyed by fingerprint                                         |
| 5 | Early stop (1 remaining)             | `stopShortBy` check setting `forceFinalize` in the loop                    |
| 6 | Planner/executor separation          | architecture: `chat.ts`/`ask.ts` thin, `ToolCallingAgent` owns policy      |
| 7 | Structured observability             | `StructuredLogEntry` + `logger` callback                                   |
| 8 | Model-agnostic control logic         | no model-specific behavior; swap via `complete` adapter                    |