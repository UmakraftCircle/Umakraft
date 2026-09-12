export class ParagraphBuilder {
  private transitions = [
    'Additionally,',
    'Furthermore,',
    'Moreover,',
    'Consequently,',
    'Therefore,',
    'In addition,',
    'As a result,'
  ];

  /**
   * Combines multiple sentences into a coherent paragraph using natural language transitions
   */
  public buildParagraph(sentences: string[]): string {
    const cleanSentences = sentences
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => (/[.!?]$/.test(s) ? s : `${s}.`));

    if (cleanSentences.length === 0) return '';
    if (cleanSentences.length === 1) return cleanSentences[0];

    // Combine with intelligent transitions
    const structured: string[] = [cleanSentences[0]];

    for (let i = 1; i < cleanSentences.length; i++) {
      const sentence = cleanSentences[i];
      
      // Select a transition periodically or based on sentence indices to avoid monotony
      const transition = this.transitions[(i - 1) % this.transitions.length];
      
      // Don't add transition if sentence already starts with one or is very short
      const lowerSentence = sentence.toLowerCase();
      const hasExistingTransition = ['additionally', 'consequently', 'therefore', 'however', 'but', 'so', 'and'].some(t => 
        lowerSentence.startsWith(t)
      );

      if (hasExistingTransition) {
        structured.push(sentence);
      } else {
        // Lowercase the first letter of the subsequent sentence to fit after the transition
        const firstChar = sentence.charAt(0);
        const rest = sentence.slice(1);
        const lowerFirst = firstChar.toLowerCase();
        
        // Ensure we don't lowercase proper nouns/entities like Trainer, Oguri Cap, etc.
        const isProperNoun = /^[A-Z]/.test(firstChar) && (
          sentence.startsWith('Trainer') || 
          sentence.startsWith('Oguri') || 
          sentence.startsWith('Kitasan') || 
          sentence.startsWith('Arima')
        );

        if (isProperNoun) {
          structured.push(`${transition} ${sentence}`);
        } else {
          structured.push(`${transition} ${lowerFirst}${rest}`);
        }
      }
    }

    return structured.join(' ');
  }
}
