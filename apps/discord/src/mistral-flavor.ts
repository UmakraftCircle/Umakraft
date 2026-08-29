/**
 * Mistral and Umamusume persona flavor styling helpers for Discord message formatting.
 */

export interface FlavorOptions {
  trainerName?: string;
  enthusiasm?: 'low' | 'medium' | 'high';
}

export function formatMistralFlavor(content: string, _options: FlavorOptions = {}): string {
  return content.trim();
}

export function applyTrainerGreeting(content: string, trainerName?: string): string {
  if (!trainerName) return content;
  if (!content.toLowerCase().includes('trainer')) {
    return `Trainer ${trainerName}, ${content}`;
  }
  return content;
}
