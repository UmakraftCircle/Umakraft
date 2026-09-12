import { UserMemory } from './user-memory.js';
import { ConversationMemory } from './conversation-memory.js';
import { SessionMemory } from './session-memory.js';

/**
 * A simple in-memory central store for A5.
 * Strictly ephemeral for now; no databases, no embeddings.
 */
export class MemoryStore {
  public user = new UserMemory();
  public conversation = new ConversationMemory();
  public session = new SessionMemory();
}
