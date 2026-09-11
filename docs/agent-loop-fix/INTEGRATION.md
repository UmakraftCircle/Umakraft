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
const chatConfig = {
  maxToolCalls: 4,
  toolBudgets: { search_web: 1 },
  defaultBudget: 1,
  stopShortBy: 1,
  finalizeSystemMessage: "Answer now using what you know. Do not search again.",
};

// ask.ts — domain tools, search capped at 2
const askConfig = {
  maxToolCalls: 4,
  toolBudgets: { search_web: 2, other_tool_slug: 1 },
  defaultBudget: 1,
  stopShortBy: 1,
  finalizeSystemMessage: "Answer now from the data you gathered. Do not call more tools.",
};
```

---

## Provider adapter (Groq/OpenAI-style SDK)

The module is provider-agnostic — you supply a `complete` function. Map
`toolChoice` to your SDK's knob:

| `toolChoice` | Provider mapping                        |
| ------------ | --------------------------------------- |
| `"none"`     | `tool_choice: "none"` (hard constraint) |
| `"auto"`     | `tool_choice: "auto"` (model decides)   |

```ts
const agent = new ToolCallingAgent({
  tools,
  config: chatConfig,
  complete: async ({ messages, toolChoice }) => {
    const res = await yourProvider.chat({
      messages,
      tool_choice: toolChoice,
      tools: tools.map((t) => ({ type: "function", function: { name: t.name } })),
    });
    return { message: normalizeProviderMessage(res) };
  },
  logger: (entry) => console.warn("[ToolCallingAgent]", JSON.stringify(entry)),
});

const result = await agent.run(systemPrompt, userInput);
// result.content -> final answer
// result.finalizeReason -> repeat_detected | per_tool_budget | total_budget | stop_short | null
// result.log -> full structured trace
```

---

## Example structured log output

Replace:

```
[WARN] [ToolCallingAgent] Tool-call limit (4) reached; stopping.
```

With:

```jsonc
{
  "event": "tool_call",
  "turn": 2,
  "toolSlug": "search_web",
  "argsSnippet": "{\"q\":\"weather cebu\"}",
  "totalUsed": 2,
  "totalBudget": 4,
  "perToolRemaining": -1,
  "reason": "repeat_detected"
}
```

Every entry answers: what was called, when, how much budget was left per-tool
and total, and why the loop stopped.

---

## Fix → implementation map

| # | Fix                            | Where in module                                                       |
| - | ------------------------------ | --------------------------------------------------------------------- |
| 1 | Per-tool budgets               | `budgetFor()` + `perToolUsed` check before execution                  |
| 2 | Forced finalization            | `toolChoice: "none"` + `finalizeSystemMessage`                        |
| 3 | Repeated-loop detection        | `fingerprintCall()` + `seenFingerprints` Set                          |
| 4 | Per-message cache              | `resultCache` keyed by fingerprint                                    |
| 5 | Early stop (1 remaining)       | `stopShortBy` sets `forceFinalize`                                    |
| 6 | Planner/executor separation    | `chat.ts`/`ask.ts` thin, agent owns policy                            |
| 7 | Structured observability       | `StructuredLogEntry` + `logger` callback                              |
| 8 | Model-agnostic control logic   | no model-specific behavior; swap via `complete` adapter               |
