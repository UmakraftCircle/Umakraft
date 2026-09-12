export class ResponsePrioritizer {
  public prioritize(params: {
    text: string;
    goal?: string;
    glossaryTerms?: string[];
  }): string[] {
    const priorities: string[] = [];

    if (
      params.text.toLowerCase().includes('lose') ||
      params.text.toLowerCase().includes('losing')
    ) {
      priorities.push('Critical: Fix Stat deficits (Stamina / Speed)');
    } else {
      priorities.push('Critical: User intent resolution');
    }

    if (params.goal === 'Parent Search' || params.goal === 'ParentSearch') {
      priorities.push('Important: Running style and distance compatibility');
    } else if (params.glossaryTerms && params.glossaryTerms.length > 0) {
      priorities.push(`Important: Glossary term [${params.glossaryTerms[0]}] definition`);
    } else {
      priorities.push('Important: Core building rules');
    }

    priorities.push('Helpful: Recommended support card combinations');
    priorities.push('Additional: Historical race metadata');

    return priorities;
  }
}
