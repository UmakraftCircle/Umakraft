import { createLogger } from '@ai-agent-platform/shared';
import { workflowEngine, WorkflowType } from './workflow-engine.js';

const logger = createLogger('IntentTranslator');

export type SupportedTaskType =
  | 'GOAL_TRACKING'
  | 'PACE_MONITORING'
  | 'DEFICIT_ALERT'
  | 'SURPLUS_ALERT'
  | 'RANKING_ALERT'
  | 'MILESTONE_ALERT'
  | 'CLUB_MILESTONE_ALERT'
  | 'LINK_REQUEST'
  | 'REMINDER';

export interface ExtractedTaskIntent {
  taskType: SupportedTaskType;
  workflowType: WorkflowType;
  parameters: {
    targetValue?: number;
    rank?: number;
    clubTarget?: number;
  };
  confidence: number;
}

export interface IntentTranslationResult {
  intents: ExtractedTaskIntent[];
  isAmbiguous: boolean;
  clarificationMessage?: string;
  responseMessage: string;
}

export class IntentTranslator {
  private static instance: IntentTranslator;

  public static getInstance(): IntentTranslator {
    if (!IntentTranslator.instance) {
      IntentTranslator.instance = new IntentTranslator();
    }
    return IntentTranslator.instance;
  }

  /**
  * Parses natural language messages into structured agent intents and creates corresponding workflows.
  */
  public parseAndExecute(trainerId: string, message: string): IntentTranslationResult {
    const lower = (message || '').toLowerCase();
    const intents: ExtractedTaskIntent[] = [];

    // Check for ambiguity (e.g. "Watch my progress" or "Help me")
    if (/^(watch\s+my\s+progress|monitor\s+me|help\s+me)$/i.test(lower.trim())) {
      return {
        intents: [],
        isAmbiguous: true,
        clarificationMessage: 'Trainer, would you like me to monitor your fan goal, ranking, or overall pace?',
        responseMessage: 'Trainer, would you like me to monitor your fan goal, ranking, or overall pace?',
      };
    }

    // 1. Goal Tracking Parsing ("Track my 150M goal", "reach 150m this month")
    const goalMatch = lower.match(/(?:track\s+my\s+|reach\s+|goal\s+of\s+)?(\d+(?:\.\d+)?)\s*(m|million|b|billion)?\s*(?:fans?|goal)?/i);
    if (/\b(goal|reach|track\s+my)\b/i.test(lower)) {
      let targetValue = 150_000_000; // default
      if (goalMatch && goalMatch[1]) {
        const num = parseFloat(goalMatch[1]);
        const unit = (goalMatch[2] || '').toLowerCase();
        if (unit.startsWith('b')) {
          targetValue = num * 1_000_000_000;
        } else if (unit.startsWith('m')) {
          targetValue = num * 1_000_000;
        } else {
          targetValue = num; // assume raw if no unit
        }
      }

      intents.push({
        taskType: 'GOAL_TRACKING',
        workflowType: 'FAN_GOAL_TRACKING',
        parameters: { targetValue },
        confidence: 0.95,
      });
    }

    // 2. Ranking Alert Parsing ("reach top 5", "enter the top 10")
    const rankMatch = lower.match(/top\s+(\d+)/i);
    if (rankMatch || /\b(ranking|rank)\b/i.test(lower)) {
      const rank = rankMatch ? parseInt(rankMatch[1], 10) : 10;
      intents.push({
        taskType: 'RANKING_ALERT',
        workflowType: 'MILESTONE_TRACKING',
        parameters: { rank },
        confidence: 0.92,
      });
    }

    // 3. Club Milestone Alert Parsing ("club reaches 5b", "club 5 billion")
    const clubMatch = lower.match(/club\s+(?:reaches|hits)?\s*(\d+(?:\.\d+)?)\s*(b|billion|m|million)?/i);
    if (clubMatch || /\b(club\s+reaches|club\s+fans)\b/i.test(lower)) {
      let clubTarget = 5_000_000_000;
      if (clubMatch && clubMatch[1]) {
        const num = parseFloat(clubMatch[1]);
        const unit = (clubMatch[2] || '').toLowerCase();
        if (unit.startsWith('b')) clubTarget = num * 1_000_000_000;
        else if (unit.startsWith('m')) clubTarget = num * 1_000_000;
      }
      intents.push({
        taskType: 'CLUB_MILESTONE_ALERT',
        workflowType: 'MILESTONE_TRACKING',
        parameters: { clubTarget },
        confidence: 0.95,
      });
    }

    // 4. Pace Monitoring Parsing ("behind pace", "keep an eye on my fan progress")
    if (/\b(pace|behind|progress)\b/i.test(lower) && intents.length === 0) {
      intents.push({
        taskType: 'PACE_MONITORING',
        workflowType: 'DEFICIT_RECOVERY',
        parameters: {},
        confidence: 0.90,
      });
    }

    if (intents.length === 0) {
      return {
        intents: [],
        isAmbiguous: true,
        clarificationMessage: 'Trainer, I am not sure which task or goal you would like me to track. Could you specify your target?',
        responseMessage: 'Trainer, I am not sure which task or goal you would like me to track. Could you specify your target?',
      };
    }

    // Execute workflow creation for extracted intents
    const createdWorkflows: string[] = [];
    for (const intent of intents) {
      const goalDesc = intent.parameters.targetValue
        ? `Reach ${(intent.parameters.targetValue / 1e6).toFixed(0)}M fans`
        : intent.parameters.rank
        ? `Enter Top ${intent.parameters.rank}`
        : intent.parameters.clubTarget
        ? `Club reaches ${(intent.parameters.clubTarget / 1e9).toFixed(1)}B fans`
        : 'Fan progress monitoring';

      const targetVal = intent.parameters.targetValue || intent.parameters.clubTarget || 150_000_000;

      const wf = workflowEngine.createWorkflow({
        ownerId: trainerId,
        ownerType: 'TRAINER',
        type: intent.workflowType,
        goal: goalDesc,
        targetValue: targetVal,
        initialValue: targetVal * 0.8, // mock initial
      });
      createdWorkflows.push(wf.workflowId);
    }

    let responseMessage = `Of course, Trainer. I've activated ${intents.length} monitoring workflow(s) and will notify you when milestones or pace changes occur.`;
    if (intents.length === 1 && intents[0].taskType === 'GOAL_TRACKING') {
      const val = (intents[0].parameters.targetValue ?? 150_000_000) / 1e6;
      responseMessage = `Of course, Trainer. I've activated a fan goal tracking workflow for ${val}M and will notify you if you're ahead of pace, behind pace, or reach the milestone.`;
    }

    logger.info(`[Intent Translator] Created ${createdWorkflows.length} workflows for trainer ${trainerId}.`);

    return {
      intents,
      isAmbiguous: false,
      responseMessage,
    };
  }
}

export const intentTranslator = IntentTranslator.getInstance();
