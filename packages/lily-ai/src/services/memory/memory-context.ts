export interface MemoryContext {
  recentMessages: string[];
  activeTopic?: string;
  lastIntent?: string;
  trainerId?: string;
  trainerName?: string;
  linkedDiscordId?: string;
  clubId?: string;
  clubName?: string;
  preferences?: Record<string, unknown>;
  workingMemory?: Record<string, any>;
  lastFanCheck?: string | number;
  lastFanGain?: number;
  lastMilestone?: string;
  pendingLinkRequest?: boolean;
}
