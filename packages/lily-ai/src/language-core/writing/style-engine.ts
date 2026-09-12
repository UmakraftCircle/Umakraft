export class StyleEngine {
  /**
   * Applies structural style constraints to the given text body
   */
  public applyStyle(text: string, style: string): string {
    const cleanStyle = style.trim().toLowerCase();

    switch (cleanStyle) {
      case 'conversation':
        return text; // Normal dialogue

      case 'explanation':
        return `Explanation:\n${text}`;

      case 'guide':
        // Converts plain text lists to numbered lists if appropriate
        if (text.includes('\n')) {
          return text.split('\n')
            .map((line, idx) => `${idx + 1}. ${line.replace(/^[\s•\-\d\.\s]*/, '')}`)
            .join('\n');
        }
        return `Guide Steps:\n1. ${text}`;

      case 'summary':
        return `Summary:\n• ${text}`;

      case 'report':
        return `=== PERFORMANCE REPORT ===\n${text}\n==========================`;

      case 'announcement':
        return `📢 ANNOUNCEMENT 📢\n\n${text}`;

      case 'notification':
        return `🔔 Notification: ${text}`;

      case 'warning':
        return `⚠️ WARNING: ${text}`;

      case 'checklist':
        if (text.includes('\n')) {
          return text.split('\n')
            .map(line => `[ ] ${line.replace(/^[\s•\-\d\.\s]*/, '')}`)
            .join('\n');
        }
        return `[ ] ${text}`;

      default:
        return text;
    }
  }
}
