import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('WorkflowEngine');

export type WorkflowType =
  | 'FAN_GOAL_TRACKING'
  | 'LINK_REQUEST_TRACKING'
  | 'MILESTONE_TRACKING'
  | 'DEFICIT_RECOVERY'
  | 'SURPLUS_MONITORING';

export type WorkflowState = 'CREATED' | 'ACTIVE' | 'AT_RISK' | 'COMPLETED';

export type WorkflowOwner = 'TRAINER' | 'CLUB' | 'GLOBAL';

export interface WorkflowRecord {
  workflowId: string;
  ownerId: string;
  ownerType: WorkflowOwner;
  type: WorkflowType;
  goal: string;
  targetValue: number;
  currentValue: number;
  state: WorkflowState;
  lastCheckTimestamp: number;
  nextCheckTimestamp: number;
  history: Array<{ timestamp: number; message: string; state: WorkflowState }>;
}

export class WorkflowEngine {
  private static instance: WorkflowEngine;
  private workflows: Map<string, WorkflowRecord> = new Map();

  public static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  /**
  * Register or create a new autonomous workflow.
  */
  public createWorkflow(options: {
    ownerId: string;
    ownerType: WorkflowOwner;
    type: WorkflowType;
    goal: string;
    targetValue: number;
    initialValue: number;
  }): WorkflowRecord {
    const { ownerId, ownerType, type, goal, targetValue, initialValue } = options;
    const workflowId = `wf_${ownerId}_${Date.now()}`;
    const now = Date.now();

    const record: WorkflowRecord = {
      workflowId,
      ownerId,
      ownerType,
      type,
      goal,
      targetValue,
      currentValue: initialValue,
      state: 'ACTIVE',
      lastCheckTimestamp: now,
      nextCheckTimestamp: now + 24 * 60 * 60 * 1000, // 24 hours
      history: [
        {
          timestamp: now,
          message: `Workflow created for goal: "${goal}" with target ${targetValue.toLocaleString()}.`,
          state: 'ACTIVE',
        },
      ],
    };

    this.workflows.set(workflowId, record);
    logger.info(`[Workflow Created] ID: ${workflowId} | Type: ${type} | Goal: "${goal}" | Target: ${targetValue}`);
    return record;
  }

  /**
  * Retrieve a workflow by ID.
  */
  public getWorkflow(workflowId: string): WorkflowRecord | undefined {
    return this.workflows.get(workflowId);
  }

  /**
  * Retrieve all workflows for an owner (Trainer or Club).
  */
  public getWorkflowsForOwner(ownerId: string): WorkflowRecord[] {
    const results: WorkflowRecord[] = [];
    for (const wf of this.workflows.values()) {
      if (wf.ownerId === ownerId) {
        results.push(wf);
      }
    }
    return results;
  }

  /**
  * Evaluates active workflows, updates states (ACTIVE -> AT_RISK -> COMPLETED),
  * and returns notification messages when significant state transitions occur.
  */
  public evaluateWorkflow(workflowId: string, updatedCurrentValue: number): { workflow: WorkflowRecord; notification?: string } {
    const wf = this.workflows.get(workflowId);
    if (!wf || wf.state === 'COMPLETED') {
      throw new Error(`Workflow ${workflowId} not found or already completed.`);
    }

    const previousState = wf.state;
    wf.currentValue = updatedCurrentValue;
    wf.lastCheckTimestamp = Date.now();

    // Check completion
    if (wf.currentValue >= wf.targetValue) {
      wf.state = 'COMPLETED';
      const notification = `Congratulations, Trainer! You've reached your target of ${wf.targetValue.toLocaleString()} fans and achieved your monthly goal! 🎉`;
      wf.history.push({ timestamp: Date.now(), message: notification, state: 'COMPLETED' });
      logger.info(`[Workflow Completed] ID: ${workflowId} | Goal achieved.`);
      return { workflow: wf, notification };
    }

    // Evaluate Deficit / At-Risk status (e.g. if behind required pacing)
    // For demonstration, let's assume threshold evaluation or deficit pacing:
    // If progress ratio is below expected timeline ratio, mark AT_RISK.
    let notification: string | undefined;
    if (wf.type === 'FAN_GOAL_TRACKING') {
      // Simple mock heuristic: if currentValue is significantly below expected pacing
      const expectedPacing = wf.targetValue * 0.5; // halfway expectation
      if (wf.currentValue < expectedPacing && wf.state === 'ACTIVE') {
        wf.state = 'AT_RISK';
        notification = `Trainer, I'm notifying you because your current fan total (${wf.currentValue.toLocaleString()}) is behind the required pace to reach ${wf.targetValue.toLocaleString()} by month-end. Increasing your daily gain over the next week will help keep the objective within reach. 🐎`;
        wf.history.push({ timestamp: Date.now(), message: notification, state: 'AT_RISK' });
      } else if (wf.currentValue >= expectedPacing && wf.state === 'AT_RISK') {
        wf.state = 'ACTIVE';
        notification = `Trainer, great news! You've recovered your pacing and your goal is back on track.`;
        wf.history.push({ timestamp: Date.now(), message: notification, state: 'ACTIVE' });
      }
    }

    return { workflow: wf, notification };
  }

  /**
  * Clears all workflows (primarily for test cleanup).
  */
  public clearAll(): void {
    this.workflows.clear();
  }
}

export const workflowEngine = WorkflowEngine.getInstance();
