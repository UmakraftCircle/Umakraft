import { createLogger } from '@ai-agent-platform/shared';
import { agentToolRegistry } from './tool-registry.js';

const logger = createLogger('ToolPlanner');

export interface ToolPlan {
  goal: string;
  selectedTool: string; // e.g. 'WEB_SEARCH', 'FAN_SYSTEM', 'LEADERBOARD_SYSTEM', 'HANDBOOK_SEARCH', 'LINK_REQUEST_SYSTEM', 'NONE'
  confidence: number;
  reason: string;
}

export interface ToolExecutionResult<T = any> {
  success: boolean;
  source: string;
  data: T;
  error?: string;
}

export interface PlanOptions {
  userId: string;
  message: string;
  activeTopic?: string;
}

/**
 * Autonomous Tool Planner (Phase F2)
 * Decides whether internal knowledge is sufficient or if an external tool/system is required.
 */
export async function planToolUsage(options: PlanOptions): Promise<ToolPlan> {
  const { userId, message } = options;
  const trimmed = (message || '').trim();
  const lower = trimmed.toLowerCase();

  // 1. Live Information / Web Search Check (Low Confidence / Real-Time Required)
  if (
    /\b(latest|global\s+update|patch\s+notes?|maintenance|current\s+event|news|today'?s\s+update)\b/i.test(
      lower
    )
  ) {
    const plan: ToolPlan = {
      goal: `Retrieve live information or patch notes for: "${trimmed}"`,
      selectedTool: 'WEB_SEARCH',
      confidence: 0.98,
      reason: 'Current real-time information required; internal knowledge insufficient',
    };
    logTelemetry(userId, trimmed, plan);
    return plan;
  }

  // 2. Fan System Check
  if (/\b(fan\s+gain|my\s+fans?|fans?\s+today|fan\s+count)\b/i.test(lower)) {
    const plan: ToolPlan = {
      goal: 'Retrieve user fan gain and progression stats',
      selectedTool: 'FAN_SYSTEM',
      confidence: 0.98,
      reason: 'Fan tracking database query required',
    };
    logTelemetry(userId, trimmed, plan);
    return plan;
  }

  // 3. Leaderboard System Check
  if (/\b(leaderboard|top\s+trainers?|ranking|rankings)\b/i.test(lower)) {
    const plan: ToolPlan = {
      goal: 'Retrieve trainer and club leaderboards',
      selectedTool: 'LEADERBOARD_SYSTEM',
      confidence: 0.98,
      reason: 'Leaderboard database query required',
    };
    logTelemetry(userId, trimmed, plan);
    return plan;
  }

  // 4. Link Request System / Handbook Search Check
  if (/\b(link\s+my\s+account|link\s+account|connect\s+account)\b/i.test(lower)) {
    const plan: ToolPlan = {
      goal: 'Initiate account linking workflow',
      selectedTool: 'LINK_REQUEST_SYSTEM',
      confidence: 0.95,
      reason: 'Account authentication workflow requested',
    };
    logTelemetry(userId, trimmed, plan);
    return plan;
  }

  if (/\b(handbook|guide|training\s+guide|support\s+cards?)\b/i.test(lower)) {
    const plan: ToolPlan = {
      goal: 'Retrieve handbook mechanics or training guidelines',
      selectedTool: 'HANDBOOK_SEARCH',
      confidence: 0.90,
      reason: 'Handbook RAG lookup required for game mechanics',
    };
    logTelemetry(userId, trimmed, plan);
    return plan;
  }

  // 5. Internal Knowledge / Chat Engine (No Tool Needed)
  const plan: ToolPlan = {
    goal: 'Engage in character discussion or conversational chat',
    selectedTool: 'NONE',
    confidence: 0.95,
    reason: 'Internal persona knowledge and conversation history are sufficient',
  };
  logTelemetry(userId, trimmed, plan);
  return plan;
}

/**
 * Standardized Tool Execution Wrapper with Failure Recovery
 */
export async function executeToolPlan<T = any>(
  plan: ToolPlan,
  executorFn: () => Promise<T>
): Promise<ToolExecutionResult<T>> {
  const startTime = Date.now();
  try {
    const data = await executorFn();
    const executionTime = Date.now() - startTime;
    logger.info(`[Tool Execution Success] Tool: ${plan.selectedTool} | Duration: ${executionTime}ms`);
    return {
      success: true,
      source: plan.selectedTool,
      data,
    };
  } catch (err: any) {
    const executionTime = Date.now() - startTime;
    logger.error(`[Tool Execution Failure] Tool: ${plan.selectedTool} | Error: ${err?.message} | Duration: ${executionTime}ms`);
    return {
      success: false,
      source: plan.selectedTool,
      data: null as any,
      error: err?.message ?? 'Unknown tool execution error',
    };
  }
}

function logTelemetry(userId: string, message: string, plan: ToolPlan): void {
  logger.info(
    `[Tool Planner Telemetry]\n` +
      `  User Query: "${message}"\n` +
      `  User ID: ${userId}\n` +
      `  Selected Tool: ${plan.selectedTool}\n` +
      `  Goal: ${plan.goal}\n` +
      `  Confidence: ${plan.confidence}\n` +
      `  Reason: ${plan.reason}`
  );
}
