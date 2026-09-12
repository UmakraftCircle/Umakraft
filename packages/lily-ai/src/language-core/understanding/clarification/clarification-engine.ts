import { ClarificationMemory, ClarificationState } from './clarification-memory.js';
import { ClarificationPolicy, ClarificationRequest } from './clarification-policy.js';

export class ClarificationEngine {
  private memory = new ClarificationMemory();
  private policy = new ClarificationPolicy();

  public getMemory(): ClarificationMemory {
    return this.memory;
  }

  public getPolicy(): ClarificationPolicy {
    return this.policy;
  }

  /**
   * Main entry point to evaluate clarification for a session.
   */
  public evaluate(params: {
    sessionId: string;
    text: string;
    confidence: number;
    ambiguity: boolean;
    context: any;
    goal?: string;
  }): { clarificationNeeded: boolean; clarification?: ClarificationRequest } {
    const sessionState = this.memory.get(params.sessionId);

    // If there is an active sessionState, we merge its gathered data with context
    const mergedContext = {
      ...params.context,
      ...(sessionState?.data || {})
    };

    const evaluation = this.policy.evaluate({
      text: params.text,
      confidence: params.confidence,
      ambiguity: params.ambiguity,
      context: mergedContext,
      goal: params.goal
    });

    if (evaluation.clarificationNeeded && evaluation.clarification) {
      const clar = evaluation.clarification;
      const remainingSteps: string[] = [];
      if (clar.type === 'guided' && clar.currentStep) {
        const allSteps = ['runningStyle', 'distance', 'surface'];
        const currentIdx = allSteps.indexOf(clar.currentStep);
        if (currentIdx !== -1) {
          remainingSteps.push(...allSteps.slice(currentIdx + 1));
        }
      }

      this.memory.set(params.sessionId, {
        sessionId: params.sessionId,
        type: clar.type,
        step: clar.currentStep,
        remainingSteps,
        data: mergedContext
      });
    } else {
      // Keep data if we finished guided parameters
      if (sessionState && sessionState.type === 'guided') {
        // Just clear the steps but keep gathered data in memory so the actual tool/query can use it
        this.memory.set(params.sessionId, {
          sessionId: params.sessionId,
          type: 'guided',
          data: mergedContext
        });
      } else {
        this.memory.delete(params.sessionId);
      }
    }

    return evaluation;
  }

  /**
   * Processes a user's response to an outstanding clarification question.
   */
  public handleResponse(sessionId: string, answer: string): void {
    const state = this.memory.get(sessionId);
    if (!state) {
      return;
    }

    if (state.type === 'guided' && state.step) {
      const step = state.step;
      const data = state.data || {};
      data[step] = answer;

      const remaining = state.remainingSteps || [];
      const nextStep = remaining[0];
      const nextRemaining = remaining.slice(1);

      if (nextStep) {
        this.memory.set(sessionId, {
          sessionId,
          type: 'guided',
          step: nextStep,
          remainingSteps: nextRemaining,
          data
        });
      } else {
        this.memory.set(sessionId, {
          sessionId,
          type: 'guided',
          data
        });
      }
    }
  }
}
export type { ClarificationState };
