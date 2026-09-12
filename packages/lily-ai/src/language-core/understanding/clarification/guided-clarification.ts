export interface GuidedClarification {
  type: 'guided';
  currentStep: string;
  question: string;
  options: string[];
}

export class GuidedClarificationEngine {
  private requirements: Record<string, string[]> = {
    'Parent Search': ['runningStyle', 'distance', 'surface'],
    'ParentSearch': ['runningStyle', 'distance', 'surface']
  };

  private stepMetadata: Record<string, { question: string; options: string[] }> = {
    runningStyle: {
      question: 'Which running style are you looking for?',
      options: ['Front Runner', 'Pace Chaser', 'Late Surger', 'End Closer']
    },
    distance: {
      question: 'What distance category?',
      options: ['Sprint', 'Mile', 'Medium', 'Long']
    },
    surface: {
      question: 'What surface?',
      options: ['Turf', 'Dirt']
    }
  };

  public getNextStep(
    goal: string,
    existingData: Record<string, any> = {}
  ): GuidedClarification | null {
    const fields = this.requirements[goal];
    if (!fields) {
      return null;
    }

    for (const field of fields) {
      if (!existingData[field]) {
        const metadata = this.stepMetadata[field];
        if (metadata) {
          return {
            type: 'guided',
            currentStep: field,
            question: metadata.question,
            options: metadata.options
          };
        }
      }
    }

    return null;
  }
}
