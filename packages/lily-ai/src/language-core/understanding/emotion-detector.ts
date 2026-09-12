export class EmotionDetector {
  private emotionsMap: { words: string[]; emotion: string }[] = [
    { words: ['unclear', 'confused', 'dont understand', 'dont get', 'lost', 'what do you mean'], emotion: 'Confused' },
    { words: ['angry', 'mad', 'frustrated', 'annoyed', 'hate', 'stupid', 'sucks', 'losing every', 'keep losing', 'cant win'], emotion: 'Frustrated' },
    { words: ['worried', 'scared', 'afraid', 'nervous', 'concern', 'concerned', 'anxious', 'stuck', 'trouble'], emotion: 'Concerned' },
    { words: ['happy', 'excited', 'good', 'great', 'awesome', 'finally', 'poggers', 'won', 'victory', 'congrats', 'success'], emotion: 'Happy' },
    { words: ['thrilled', 'amazing', 'hype', 'incredible', 'hype', 'excited'], emotion: 'Excited' },
    { words: ['?', 'how', 'why', 'what', 'curious', 'wonder', 'explain'], emotion: 'Curious' },
    { words: ['urgent', 'emergency', 'asap', 'quick', 'fast', 'immediately', 'now'], emotion: 'Urgent' }
  ];

  /**
   * Detects emotion category from text inputs
   */
  public detect(text: string): string {
    const normalized = text.toLowerCase();
    
    for (const entry of this.emotionsMap) {
      if (entry.words.some(word => normalized.includes(word))) {
        return entry.emotion;
      }
    }

    return 'Neutral';
  }
}
