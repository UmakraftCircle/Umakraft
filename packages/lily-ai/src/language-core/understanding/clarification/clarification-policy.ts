import { DirectClarificationEngine } from './direct-clarification.js';
import { GuidedClarificationEngine } from './guided-clarification.js';
import { TopMatchClarificationEngine } from './top-match-clarification.js';

export interface ClarificationRequest {
  type: 'direct' | 'guided' | 'top_match';
  reason: string;
  question: string;
  options?: string[];
  matches?: any[];
  currentStep?: string;
  query?: string;
}

export class ClarificationPolicy {
  private directEngine = new DirectClarificationEngine();
  private guidedEngine = new GuidedClarificationEngine();
  private topMatchEngine = new TopMatchClarificationEngine();

  public evaluate(params: {
    text: string;
    confidence: number;
    ambiguity: boolean;
    context: any;
    goal?: string;
  }): { clarificationNeeded: boolean; clarification?: ClarificationRequest } {
    const normalized = params.text.toLowerCase().trim();

    // 1. Check Missing Context first (e.g. "How do I build her?" with no referenced character)
    const needsContext = params.context?.needsContext === true;
    if (needsContext || (normalized.includes('build her') && !params.context?.character)) {
      return {
        clarificationNeeded: true,
        clarification: {
          type: 'guided',
          reason: 'missing_context',
          question: 'Which character would you like help building?',
          options: []
        }
      };
    }

    // 2. Check Entity Ambiguity / Top Match Clarification (e.g. "Build Rudolf.")
    const topMatch = this.topMatchEngine.resolve(params.text);
    if (topMatch) {
      return {
        clarificationNeeded: true,
        clarification: {
          type: 'top_match',
          reason: 'ambiguous_entity',
          question: 'I found multiple possible matches. Which one are you referring to?',
          options: topMatch.matches.map(m => m.name),
          matches: topMatch.matches,
          query: topMatch.query
        }
      };
    }

    // 3. Check Direct Clarification (e.g. "Need speed parent.")
    const directResult = this.directEngine.resolve(params.text);
    if (directResult) {
      return {
        clarificationNeeded: true,
        clarification: {
          type: 'direct',
          reason: 'ambiguous_term',
          question: directResult.question,
          options: directResult.options
        }
      };
    }

    // 4. Check Guided Clarification (e.g. "Find parent." -> missing style/distance/surface)
    const goal = params.goal || '';
    if (goal === 'Parent Search' || goal === 'ParentSearch' || normalized === 'find parent' || normalized === 'need parent' || normalized === 'search parent') {
      const activeGoal = goal === 'ParentSearch' ? 'ParentSearch' : 'Parent Search';
      const guidedResult = this.guidedEngine.getNextStep(activeGoal, params.context || {});
      if (guidedResult) {
        return {
          clarificationNeeded: true,
          clarification: {
            type: 'guided',
            reason: 'missing_parameters',
            question: guidedResult.question,
            options: guidedResult.options,
            currentStep: guidedResult.currentStep
          }
        };
      }
    }

    // 5. Default trigger thresholds (Confidence < 0.70 or Ambiguity = true)
    if (params.confidence < 0.70 || params.ambiguity) {
      // If we mention parent but failed other checks, ask guided style
      if (normalized.includes('parent')) {
        const guidedResult = this.guidedEngine.getNextStep('Parent Search', params.context || {});
        if (guidedResult) {
          return {
            clarificationNeeded: true,
            clarification: {
              type: 'guided',
              reason: 'missing_parameters',
              question: guidedResult.question,
              options: guidedResult.options,
              currentStep: guidedResult.currentStep
            }
          };
        }
      }

      return {
        clarificationNeeded: true,
        clarification: {
          type: 'direct',
          reason: 'low_confidence',
          question: 'Could you please rephrase or clarify what you need help with?',
          options: ['Build Help', 'Parent Search', 'Glossary Definition']
        }
      };
    }

    return {
      clarificationNeeded: false
    };
  }
}
