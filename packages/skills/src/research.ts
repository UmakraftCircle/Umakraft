import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('SkillTools:research');

export const deepResearchTool: ToolDefinition = {
  slug: 'deep-research',
  name: 'Deep Research',
  description:
    'Orchestrate multi-phase research: break a complex question into 3-7 sub-questions, search the web, cross-reference sources, and synthesize a structured, evidence-graded report with cited findings, open questions, and next steps.',
  parameters: {
    topic: { type: 'string', description: 'The research topic or question', required: true },
    depth: {
      type: 'string',
      description: 'Research depth: quick, standard, deep, or exhaustive',
      required: false,
      enum: ['quick', 'standard', 'deep', 'exhaustive'],
    },
    subQuestions: {
      type: 'array',
      description: 'Optional explicit list of sub-questions (overrides auto-decomposition)',
      required: false,
    },
  },
  handler: async (args) => {
    const topic = String(args['topic']);
    const depth = (args['depth'] as string) || 'standard';
    logger.info(`deep-research topic="${topic}" depth=${depth}`);

    const subQuestions: string[] =
      (args['subQuestions'] as string[]) ??
      decompose(topic);

    return {
      success: true,
      topic,
      depth,
      subQuestions,
      grading: ['high', 'medium', 'low'],
      methodology: {
        steps: [
          'search existing knowledge (memory + workspace)',
          'web research (2-3 keyword variations per sub-question)',
          'codebase/workspace analysis where relevant',
          'cross-reference across sources',
          'synthesize with per-finding evidence grades',
        ],
      },
    };
  },
};

function decompose(topic: string): string[] {
  return [
    `What are the key definitions and current state of "${topic}"?`,
    `What are the main actors/companies/technologies involved?`,
    `What measurable outcomes or data exist?`,
    `What are the open questions or contradictions?`,
  ];
}

export const questionReviewTool: ToolDefinition = {
  slug: 'question-review',
  name: 'Question Review',
  description:
    'Run a structured review of a target against explicit review questions, answering each with a direct answer, cited evidence, a confidence level, and follow-up recommendations. Unanswerable parts are marked unresolved.',
  parameters: {
    target: { type: 'string', description: 'Review target location (file, folder, or doc set)', required: true },
    questions: {
      type: 'array',
      description: 'The explicit list of review questions to answer',
      required: true,
    },
  },
  handler: async (args) => {
    const target = String(args['target']);
    const questions = (args['questions'] as string[]) ?? [];
    logger.info(`question-review target="${target}" questions=${questions.length}`);

    return {
      success: true,
      target,
      questions,
      answerTemplate: {
        directAnswer: '<answer>',
        evidence: '<cited excerpt>',
        confidence: 'high | medium | low',
        unresolved: false,
        followUp: '<scoped recommendation>',
      },
      qualityChecks: [
        'every question answered or marked unresolved',
        'evidence cited from the artifact (not asserted from memory)',
        'confidence provided per answer',
        'follow-up actions are concrete and scoped',
      ],
    };
  },
};
