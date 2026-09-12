import { Fact } from '../comprehension/fact-detector.js';
import { Entity } from '../comprehension/reading-comprehension-engine.js';

export interface WritingContext {
  topic: string;
  facts: Fact[];
  entities: Entity[];
  audience: string;
  style: string;
  tone: string;
}

export class TemplateEngine {
  /**
   * Renders a response template based on style, tone, and context facts
   */
  public render(context: WritingContext): string {
    const { topic, facts, tone, style } = context;

    // Handle Fan Requirement topic as an example
    if (topic.toLowerCase().includes('fan')) {
      const currentFact = facts.find(f => f.attribute === 'Fans');
      const requiredFact = facts.find(f => f.attribute === 'Required Fans');
      
      if (currentFact && requiredFact) {
        const cur = currentFact.value;
        const req = requiredFact.value;
        const diff = req - cur;

        if (diff > 0) {
          const diffStr = this.formatNumber(diff);
          if (tone.toLowerCase() === 'friendly') {
            return `Trainer, you're getting close! You need ${diffStr} more fans to reach the monthly requirement.`;
          } else if (tone.toLowerCase() === 'coach') {
            return `Let's focus on increasing your fans. We are currently ${diffStr} short of the monthly requirement. Keep training!`;
          } else if (tone.toLowerCase() === 'professional') {
            return `The current fan progress is below the required threshold. An additional ${diffStr} fans are required to fulfill the target.`;
          }
          return `You need ${diffStr} more fans to reach the monthly requirement of ${this.formatNumber(req)} fans.`;
        } else {
          if (tone.toLowerCase() === 'friendly') {
            return `Trainer, you've done it! You have reached and exceeded your fan requirement.`;
          }
          return `The required fan threshold has been successfully met or exceeded.`;
        }
      }
    }

    // Default template fallback
    return `Regarding ${topic}: Current metrics indicate active status.`;
  }

  private formatNumber(num: number): string {
    if (num >= 1_000_000_000) {
      const val = num / 1_000_000_000;
      return `${val % 1 === 0 ? val : val.toFixed(1)} billion`;
    }
    if (num >= 1_000_000) {
      const val = num / 1_000_000;
      return `${val % 1 === 0 ? val : val.toFixed(1)} million`;
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(0) + 'k';
    }
    return num.toString();
  }
}
