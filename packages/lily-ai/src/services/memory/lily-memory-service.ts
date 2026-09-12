import { IMemoryService } from './index.js';
import { MemoryContext } from './memory-context.js';
import { MemoryStore } from './memory-store.js';

export class LilyMemoryService implements IMemoryService {
  private store = new MemoryStore();

  public async getContext(userId: string): Promise<MemoryContext> {
    const user = this.store.user.getProfile(userId);
    const conv = this.store.conversation.getState(userId);
    const sess = this.store.session.getSession(userId);

    return {
      recentMessages: conv.recentMessages,
      lastIntent: conv.lastIntent,
      activeTopic: sess.activeTopic,
      trainerId: user.trainerId,
      trainerName: user.trainerName,
      linkedDiscordId: user.linkedDiscordId,
      clubId: user.clubId,
      clubName: user.clubName,
      preferences: user.preferences,
      workingMemory: sess.workingMemory,
      lastFanCheck: user.lastFanCheck,
      lastFanGain: user.lastFanGain,
      lastMilestone: user.lastMilestone
    };
  }

  public async updateContext(userId: string, context: Partial<MemoryContext>): Promise<void> {
    // 1. Route User updates
    if (
      context.trainerId !== undefined || 
      context.trainerName !== undefined || 
      context.linkedDiscordId !== undefined ||
      context.clubId !== undefined ||
      context.clubName !== undefined ||
      context.preferences !== undefined ||
      context.lastFanCheck !== undefined ||
      context.lastFanGain !== undefined ||
      context.lastMilestone !== undefined
    ) {
      this.store.user.updateProfile(userId, {
        ...(context.trainerId !== undefined && { trainerId: context.trainerId }),
        ...(context.trainerName !== undefined && { trainerName: context.trainerName }),
        ...(context.linkedDiscordId !== undefined && { linkedDiscordId: context.linkedDiscordId }),
        ...(context.clubId !== undefined && { clubId: context.clubId }),
        ...(context.clubName !== undefined && { clubName: context.clubName }),
        ...(context.preferences !== undefined && { preferences: context.preferences }),
        ...(context.lastFanCheck !== undefined && { lastFanCheck: context.lastFanCheck }),
        ...(context.lastFanGain !== undefined && { lastFanGain: context.lastFanGain }),
        ...(context.lastMilestone !== undefined && { lastMilestone: context.lastMilestone })
      });
    }

    // 2. Route Conversation updates
    if (context.recentMessages !== undefined || context.lastIntent !== undefined) {
      this.store.conversation.updateState(userId, {
        ...(context.recentMessages !== undefined && { recentMessages: context.recentMessages }),
        ...(context.lastIntent !== undefined && { lastIntent: context.lastIntent })
      });
    }

    // 3. Route Session & Working Memory updates
    if (context.activeTopic !== undefined || context.workingMemory !== undefined) {
      this.store.session.updateSession(userId, {
        ...(context.activeTopic !== undefined && { activeTopic: context.activeTopic }),
        ...(context.workingMemory !== undefined && { workingMemory: context.workingMemory }),
        ...(context.pendingLinkRequest !== undefined && { pendingLinkRequest: context.pendingLinkRequest })
      });
    }
  }

  public async clearWorkingMemory(userId: string): Promise<void> {
    this.store.session.clearWorkingMemory(userId);
  }
}
