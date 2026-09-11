import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('SkillTools:guidance');

/**
 * Guidance skills. These return a skill's methodology as structured guidance
 * the calling agent applies. They are pure/advisory: no side effects, no
 * invented statistics — content mirrors the corresponding Zaro skill docs.
 */

export const skillComplyTool: ToolDefinition = {
  slug: 'skill-comply-zaro',
  name: 'Skill Compliance Check',
  description:
    'Return the compliance-check methodology for verifying a skill (or artifact) follows its own stated steps and quality rules, producing a structured pass/fail report.',
  parameters: {
    skill: { type: 'string', description: 'Name of the skill/artifact to check', required: true },
  },
  handler: async (args) => {
    logger.info(`skill-comply-zaro skill=${args['skill']}`);
    return {
      success: true,
      skill: String(args['skill']),
      method: [
        'Enumerate the required behavioral steps from the skill spec.',
        'Verify each step is present and actionable.',
        'Record per-step compliance (met / unmet / n-a).',
        'Report a summary with any gaps flagged by severity.',
      ],
    };
  },
};

export const agentEvalTool: ToolDefinition = {
  slug: 'agent-eval',
  name: 'Agent Evaluation',
  description: 'Return a structured rubric for evaluating an agent run (task success, tool use, correctness, efficiency) with severity-graded findings.',
  parameters: {
    scenario: { type: 'string', description: 'Description of the run to evaluate', required: false },
  },
  handler: async () => {
    logger.info('agent-eval');
    return {
      success: true,
      rubric: [
        'Goal completion: did the agent satisfy the stated goal?',
        'Tool use: were the right tools invoked with correct arguments?',
        'Correctness: are outputs traceable to real data (no hallucination)?',
        'Efficiency: minimal steps, no redundant work?',
      ],
      severityScale: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'],
    };
  },
};

export const benchmarkTool: ToolDefinition = {
  slug: 'benchmark',
  name: 'Benchmark',
  description: 'Return a methodology for setting up a reproducible benchmark (task set, metrics, baselines) for evaluating agent or model performance.',
  parameters: {
    task: { type: 'string', description: 'Task domain to benchmark', required: false },
  },
  handler: async () => {
    logger.info('benchmark');
    return {
      success: true,
      method: [
        'Define a fixed, representative task set.',
        'Choose objective metrics (accuracy, latency, cost, success rate).',
        'Establish a baseline before measuring change.',
        'Report variance and run count for statistical validity.',
      ],
    };
  },
};

export const agenticEngineeringTool: ToolDefinition = {
  slug: 'agentic-engineering',
  name: 'Agentic Engineering',
  description: 'Return agentic-engineering principles for building reliable multi-step agents (planning, tool contracts, safety, observability).',
  parameters: {
    topic: { type: 'string', description: 'Specific area of agent engineering', required: false },
  },
  handler: async () => {
    logger.info('agentic-engineering');
    return {
      success: true,
      principles: [
        'Clear tool contracts with typed, validated inputs/outputs.',
        'Explicit planning separate from action execution.',
        'Safety gates and scope enforcement at boundaries.',
        'Observability: log reasoning, tool calls, and outcomes.',
      ],
    };
  },
};

export const contextEngineeringTool: ToolDefinition = {
  slug: 'context-engineering',
  name: 'Context Engineering',
  description: 'Return context-engineering guidance for composing effective prompts and managing context window across long tasks.',
  parameters: {
    goal: { type: 'string', description: 'What is being built or solved', required: false },
  },
  handler: async () => {
    logger.info('context-engineering');
    return {
      success: true,
      guidance: [
        'Keep the most decision-relevant information closest to the task.',
        'Separate stable instructions from volatile data.',
        'Compress aggressively while preserving sources/citations.',
      ],
    };
  },
};

export const contextManagerTool: ToolDefinition = {
  slug: 'context-manager',
  name: 'Context Manager',
  description: 'Return guidance for managing conversation/task context: retention, summarization, and eviction strategies.',
  parameters: {
    mode: { type: 'string', description: 'retention policy focus', required: false },
  },
  handler: async () => {
    logger.info('context-manager');
    return {
      success: true,
      strategies: [
        'Rolling window of recent turns with a cap (e.g. 20).',
        'Summarize older turns into a stable memory block.',
        'Evict by relevance, not just age.',
      ],
    };
  },
};

export const compressionStrategyTool: ToolDefinition = {
  slug: 'compression-strategy',
  name: 'Compression Strategy',
  description: 'Return strategies for compressing long-form content while preserving meaning and traceability.',
  parameters: {
    content: { type: 'string', description: 'Optional content to compress', required: false },
  },
  handler: async () => {
    logger.info('compression-strategy');
    return {
      success: true,
      strategies: [
        'Extract claims + their sources; drop prose.',
        'Prefer bullet/structured over paragraph.',
        'Flag truncation explicitly; never drop source pointers.',
      ],
    };
  },
};

export const iterativeRetrievalTool: ToolDefinition = {
  slug: 'iterative-retrieval',
  name: 'Iterative Retrieval',
  description: 'Return an iterative retrieval pattern for progressively refining searches/queries based on prior results.',
  parameters: {
    query: { type: 'string', description: 'Initial query or topic', required: false },
  },
  handler: async () => {
    logger.info('iterative-retrieval');
    return {
      success: true,
      pattern: [
        'State an initial query hypothesis.',
        'Retrieve a batch, inspect, and identify gaps.',
        'Reformulate the query to close gaps.',
        'Repeat until diminishing returns, then synthesize.',
      ],
    };
  },
};

export const aiPromptTool: ToolDefinition = {
  slug: 'ai-prompt',
  name: 'AI Prompt',
  description: 'Return prompting best practices for composing clear, effective AI prompts (role, task, constraints, output format, examples).',
  parameters: {
    task: { type: 'string', description: 'The task to prompt for', required: false },
  },
  handler: async () => {
    logger.info('ai-prompt');
    return {
      success: true,
      bestPractices: [
        'State the task and success criteria up front.',
        'Provide constraints and desired output format.',
        'Include few-shot examples when ambiguity is high.',
        'Prefer explicit instructions over implicit context.',
      ],
    };
  },
};

export const continuousLearningInstinctsTool: ToolDefinition = {
  slug: 'continuous-learning-instincts',
  name: 'Continuous Learning Instincts',
  description: 'Return the continuous-learning loop methodology: observe, extract confidence-scored instincts, evolve/retain selectively over time.',
  parameters: {
    source: { type: 'string', description: 'Signal source for instincts', required: false },
  },
  handler: async () => {
    logger.info('continuous-learning-instincts');
    return {
      success: true,
      loop: [
        'Observe recurring signals from interactions/tasks.',
        'Extract candidate instincts with a confidence score.',
        'Promote/retain above threshold; discard below.',
        'Evolve instincts on new evidence.',
      ],
    };
  },
};
