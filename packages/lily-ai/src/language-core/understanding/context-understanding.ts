export interface ContextState {
  lastMentionedCharacter?: string;
  lastMentionedEvent?: string;
}

export class ContextUnderstanding {
  private pronouns = ['her', 'she', 'him', 'he', 'this character', 'it', 'them', 'they'];

  /**
   * Resolves current references in text using previous context state
   */
  public resolveContext(text: string, state: ContextState): { character?: string; event?: string; contextResolved: boolean; needsContext: boolean } {
    const normalized = text.toLowerCase();
    const hasPronouns = this.pronouns.some(p => {
      const regex = new RegExp(`\\b${p}\\b`, 'i');
      return regex.test(normalized);
    });

    const result = {
      character: undefined as string | undefined,
      event: undefined as string | undefined,
      contextResolved: false,
      needsContext: false
    };

    if (hasPronouns) {
      if (state.lastMentionedCharacter) {
        result.character = state.lastMentionedCharacter;
        result.contextResolved = true;
      } else {
        result.needsContext = true;
      }
      if (state.lastMentionedEvent) {
        result.event = state.lastMentionedEvent;
      }
    }

    return result;
  }
}
