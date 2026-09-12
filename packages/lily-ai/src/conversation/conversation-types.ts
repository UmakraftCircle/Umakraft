export enum DialogueState {
  IDLE = 'IDLE',
  CLARIFYING = 'CLARIFYING',
  COACHING = 'COACHING',
  PARENT_SEARCH = 'PARENT_SEARCH',
  TRAINING_HELP = 'TRAINING_HELP',
  EVENT_HELP = 'EVENT_HELP'
}

export enum CoachingStyle {
  CASUAL = 'CASUAL',
  BALANCED = 'BALANCED',
  COMPETITIVE = 'COMPETITIVE',
  ELITE = 'ELITE'
}

export interface VoiceTranscript {
  text: string;
  confidence: number;
}

export interface ConversationContext {
  activeCharacter?: string;
  activeRace?: string;
  lastIntent?: string;
  style: CoachingStyle;
  state: DialogueState;
}
