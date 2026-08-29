# ToolCallingAgent Integration Reference Notes

## Architecture Overview

`ToolCallingAgent` encapsulates deterministic multi-step tool execution with the following core policies:

1. **Per-Tool Execution Budgets**: Hard caps on web search and domain tool usage.
2. **Loop & Repetition Detection**: Detects idempotent identical tool calls and exits early to prevent infinite reasoning cycles.
3. **Graceful Finalization**: Forces an LLM finalization pass when budget limits or step counts are reached.
4. **Trace Logging**: Returns comprehensive execution trace metadata including token usage, tools invoked, and intermediate tool responses.

```ts
import { ToolCallingAgent, ToolRegistry } from '@ai-agent-platform/core';

const agent = new ToolCallingAgent(aiService, registry);
const result = await agent.runWithTrace(userId, prompt, history, {
  maxToolCalls: 4,
  maxWebSearches: 2,
  systemPromptPrefix: "You are the Umamusume Assistant.",
});
```
