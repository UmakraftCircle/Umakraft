import { ClarificationRequest } from '../understanding/clarification/clarification-policy.js';

export class ClarificationStrategy {
  public mapStrategy(request?: ClarificationRequest): {
    clarificationType?: string;
    formattedQuestion?: string;
  } {
    if (!request) {
      return {};
    }

    let clarificationType = '';
    switch (request.type) {
      case 'direct':
        clarificationType = 'Direct';
        break;
      case 'guided':
        clarificationType = 'Guided';
        break;
      case 'top_match':
        clarificationType = 'TopMatch';
        break;
    }

    return {
      clarificationType,
      formattedQuestion: request.question
    };
  }
}
