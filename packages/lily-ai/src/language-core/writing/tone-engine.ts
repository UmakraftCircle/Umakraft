export class ToneEngine {
  /**
   * Adapts the text to a specified tone, incorporating Lily's personality
   * (Helpful, Reliable, Respectful, Trainer-focused)
   */
  public applyTone(text: string, tone: string): string {
    const cleanTone = tone.trim().toLowerCase();
    let prefix = '';
    let suffix = '';

    // Lily Personality - respectful and trainer-focused overrides / defaults
    const isTrainerFocused = text.toLowerCase().includes('trainer');

    switch (cleanTone) {
      case 'friendly':
        prefix = isTrainerFocused ? "Hi Trainer! " : "Hello! ";
        suffix = " You're doing amazing!";
        break;

      case 'encouraging':
        prefix = "Let's do this together! ";
        suffix = " I'm cheering you on, you've got this!";
        break;

      case 'coach':
        prefix = "Focus up, Trainer! ";
        suffix = " Let's concentrate on the training goals and get that victory.";
        break;

      case 'professional':
        prefix = "Attention, Trainer: ";
        suffix = " This completes the current assessment.";
        break;

      case 'officer':
        prefix = "[URGENT DIRECTIVE] ";
        suffix = " Please execute immediately.";
        break;

      case 'system':
        prefix = "[SYS_LOG] ";
        suffix = " [STATUS_OK]";
        break;

      case 'formal':
        prefix = "Respected Trainer, ";
        suffix = " I remain at your service to assist in your endeavors.";
        break;

      default:
        // Default respectful, trainer-focused Lily personality
        prefix = "Trainer, ";
        suffix = " I hope this helps you achieve your goals.";
        break;
    }

    // Make sure we don't double up prefixes if already in text
    const textHasPrefix = text.toLowerCase().startsWith(prefix.toLowerCase().trim());
    const finalPrefix = textHasPrefix ? '' : prefix;

    return `${finalPrefix}${text}${suffix}`;
  }
}
