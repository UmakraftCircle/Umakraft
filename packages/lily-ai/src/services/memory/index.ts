import { MemoryContext } from './memory-context.js';

export interface IMemoryService {
  getContext(userId: string): Promise<MemoryContext>;
  updateContext(userId: string, context: Partial<MemoryContext>): Promise<void>;
}

export * from './memory-context.js';
export * from './user-memory.js';
export * from './conversation-memory.js';
export * from './session-memory.js';
export * from './memory-store.js';
export * from './lily-memory-service.js';
