import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('MultiToolPlanner');

export interface ExecutionStep {
  stepId: string;
  toolName: string;
  description: string;
  dependsOn?: string[];
}

export interface MultiToolPlan {
  goal: string;
  steps: ExecutionStep[];
  maxSteps: number;
  maxToolCalls: number;
}

export interface StepExecutionResult {
  stepId: string;
  toolName: string;
  success: boolean;
  data: any;
  error?: string;
}

export interface ExecutionGraphResult {
  goal: string;
  success: boolean;
  workingMemory: Record<string, any>;
  stepResults: StepExecutionResult[];
  summary: string;
}

/**
 * Multi-Tool Reasoning & Task Execution Engine (Phase F3)
 * Plans and executes sequences of dependent tools with shared working memory and safety controls.
 */
export class MultiToolPlanner {
  private maxSteps: number;
  private maxToolCalls: number;

  constructor(maxSteps = 5, maxToolCalls = 10) {
    this.maxSteps = maxSteps;
    this.maxToolCalls = maxToolCalls;
  }

  /**
   * Creates a structured multi-step execution plan based on user intent.
   */
  public createPlan(message: string): MultiToolPlan {
    const lower = (message || '').toLowerCase();

    // 1. Fan Pace Analysis Plan ("Am I on pace for 150M fans...")
    if (/\b(pace|track|goal|150m|200m|fans?)\b/i.test(lower) && /\b(am\s+i|on\s+track|reach)\b/i.test(lower)) {
      return {
        goal: 'Check fan pace and calculate required progress',
        steps: [
          { stepId: 'step_1', toolName: 'FAN_SYSTEM', description: 'Retrieve current fan total and daily gain' },
          { stepId: 'step_2', toolName: 'CALCULATION_ENGINE', description: 'Calculate required daily pace to reach target', dependsOn: ['step_1'] },
          { stepId: 'step_3', toolName: 'CHAT_ENGINE', description: 'Generate personalized advice and encouragement', dependsOn: ['step_2'] },
        ],
        maxSteps: this.maxSteps,
        maxToolCalls: this.maxToolCalls,
      };
    }

    // 2. Leaderboard Comparison Plan ("How far am I from rank 1?")
    if (/\b(rank|leaderboard|top|far\s+am\s+i|behind)\b/i.test(lower)) {
      return {
        goal: 'Compare user rank against top leaderboard trainers',
        steps: [
          { stepId: 'step_1', toolName: 'FAN_SYSTEM', description: 'Retrieve user fan rank and total' },
          { stepId: 'step_2', toolName: 'LEADERBOARD_SYSTEM', description: 'Retrieve top rank leaderboard data' },
          { stepId: 'step_3', toolName: 'CALCULATION_ENGINE', description: 'Compute fan difference to rank 1', dependsOn: ['step_1', 'step_2'] },
          { stepId: 'step_4', toolName: 'CHAT_ENGINE', description: 'Summarize standing and gap', dependsOn: ['step_3'] },
        ],
        maxSteps: this.maxSteps,
        maxToolCalls: this.maxToolCalls,
      };
    }

    // 3. Linking Assistance Plan ("How do I get linked?")
    if (/\b(link|linking|account|connect)\b/i.test(lower)) {
      return {
        goal: 'Provide account linking instructions and leadership contact info',
        steps: [
          { stepId: 'step_1', toolName: 'HANDBOOK_SEARCH', description: 'Retrieve account linking procedure from handbook' },
          { stepId: 'step_2', toolName: 'CLUB_DATA', description: 'Retrieve club leadership contact info' },
          { stepId: 'step_3', toolName: 'CHAT_ENGINE', description: 'Build personalized linking instructions', dependsOn: ['step_1', 'step_2'] },
        ],
        maxSteps: this.maxSteps,
        maxToolCalls: this.maxToolCalls,
      };
    }

    // 4. Default single-step plan
    return {
      goal: 'General conversational response',
      steps: [
        { stepId: 'step_1', toolName: 'CHAT_ENGINE', description: 'Generate standard conversational response' },
      ],
      maxSteps: this.maxSteps,
      maxToolCalls: this.maxToolCalls,
    };
  }

  /**
   * Executes the execution graph with shared working memory and step validation.
   */
  public async executePlan(
    plan: MultiToolPlan,
    toolExecutors: Record<string, (memory: Record<string, any>) => Promise<any>>
  ): Promise<ExecutionGraphResult> {
    logger.info(`[F3 Execution] Starting plan: "${plan.goal}" with ${plan.steps.length} steps.`);
    const workingMemory: Record<string, any> = {};
    const stepResults: StepExecutionResult[] = [];
    let toolCallCount = 0;

    for (const step of plan.steps) {
      if (stepResults.length >= plan.maxSteps || toolCallCount >= plan.maxToolCalls) {
        logger.warn(`[F3 Safety Limit] Reached max steps or tool calls limit. Aborting further execution.`);
        break;
      }

      // Safety check: prohibit destructive or unauthorized actions
      if (['ADMIN_DELETE', 'UNSAFE_EXEC', 'AUTO_LINK_OVERRIDE'].includes(step.toolName)) {
        logger.error(`[F3 Safety Block] Prohibited action requested: ${step.toolName}`);
        stepResults.push({
          stepId: step.stepId,
          toolName: step.toolName,
          success: false,
          data: null,
          error: 'Action prohibited by safety boundaries',
        });
        break;
      }

      toolCallCount++;
      const executor = toolExecutors[step.toolName];

      try {
        let stepData: any = {};
        if (executor) {
          stepData = await executor(workingMemory);
        } else {
          // Default mock/simulation execution for built-in system tools
          stepData = this.simulateToolExecution(step.toolName, workingMemory);
        }

        // Result Validation
        if (stepData === undefined || stepData === null) {
          throw new Error(`Tool ${step.toolName} returned invalid or empty data.`);
        }

        workingMemory[step.stepId] = stepData;
        stepResults.push({
          stepId: step.stepId,
          toolName: step.toolName,
          success: true,
          data: stepData,
        });
        logger.info(`[F3 Step Success] Step ${step.stepId} (${step.toolName}) completed successfully.`);
      } catch (err: any) {
        logger.error(`[F3 Step Failure] Step ${step.stepId} (${step.toolName}) failed: ${err?.message}`);
        stepResults.push({
          stepId: step.stepId,
          toolName: step.toolName,
          success: false,
          data: null,
          error: err?.message ?? 'Execution error',
        });
        // Abort graph on critical step failure
        break;
      }
    }

    const allSuccessful = stepResults.every((r) => r.success);
    const summary = allSuccessful
      ? `Successfully executed ${stepResults.length} steps for goal: "${plan.goal}".`
      : `Plan execution encountered errors on one or more steps.`;

    return {
      goal: plan.goal,
      success: allSuccessful,
      workingMemory,
      stepResults,
      summary,
    };
  }

  private simulateToolExecution(toolName: string, memory: Record<string, any>): any {
    switch (toolName) {
      case 'FAN_SYSTEM':
        return { fanTotal: 128000000, dailyGain: 3200000, rank: 5 };
      case 'CALCULATION_ENGINE':
        return { target: 150000000, remainingFans: 22000000, requiredDailyPace: 3142857, onTrack: true };
      case 'LEADERBOARD_SYSTEM':
        return { topTrainer: 'TrainerApex', topFans: 195000000, fanGap: 67000000 };
      case 'HANDBOOK_SEARCH':
        return { procedure: 'Visit the Umakraft settings menu or execute /link in an authorized server.' };
      case 'CLUB_DATA':
        return { leader: 'ClubPresident_Kaichou', contact: 'Discord DM @Kaichou' };
      case 'CHAT_ENGINE':
        return { advice: "Trainer, you're doing great! Keep pushing those dirt races." };
      default:
        return { status: 'ok' };
    }
  }
}

export const multiToolPlanner = new MultiToolPlanner();
