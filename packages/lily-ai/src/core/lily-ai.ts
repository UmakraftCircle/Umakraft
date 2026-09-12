import { LilyAIRequest, LilyAIResponse } from './types.js';
import { createLilyAIContext } from './context.js';
import { LilyOrchestrator } from '../orchestrator/lily-orchestrator.js';
import { LilyLanguageService } from '../services/language/lily-language-service.js';
import { LilyMemoryService } from '../services/memory/lily-memory-service.js';
import { LilyToolService } from '../services/tools/lily-tool-service.js';
import { LilyKnowledgeService } from '../services/knowledge/lily-knowledge-service.js';
import { LilyChatService } from '../services/chat/lily-chat-service.js';

export class LilyAI {
  private orchestrator: LilyOrchestrator;

  constructor(orchestrator: LilyOrchestrator) {
    this.orchestrator = orchestrator;
  }

  /**
   * Main processing pipeline for LilyAI.
   */
  async process(request: LilyAIRequest): Promise<LilyAIResponse> {
    // 1. Build initial context (legacy fallback or session prep)
    const context = createLilyAIContext(request.userId);

    // 2. Delegate to the unified A7 Orchestrator
    return await this.orchestrator.execute(request);
  }

  async chat(request: LilyAIRequest): Promise<LilyAIResponse> {
    return this.process(request);
  }

  public getOrchestrator(): LilyOrchestrator {
    return this.orchestrator;
  }
}

export function createLilyAI(
  geminiGeneratorOrOptions?: ((sys: string, user: string) => Promise<string>) | {
    languageService?: LilyLanguageService;
    memoryService?: LilyMemoryService;
    toolService?: LilyToolService;
    knowledgeService?: LilyKnowledgeService;
  },
  optionsParam?: {
    languageService?: LilyLanguageService;
    memoryService?: LilyMemoryService;
    toolService?: LilyToolService;
    knowledgeService?: LilyKnowledgeService;
  }
): LilyAI {
  let generator: ((sys: string, user: string) => Promise<string>) | undefined;
  let options = optionsParam;

  if (typeof geminiGeneratorOrOptions === 'function') {
    generator = geminiGeneratorOrOptions;
  } else if (geminiGeneratorOrOptions && typeof geminiGeneratorOrOptions === 'object') {
    options = geminiGeneratorOrOptions;
  }

  const languageService = options?.languageService || new LilyLanguageService();
  const memoryService = options?.memoryService || new LilyMemoryService();
  const toolService = options?.toolService || new LilyToolService();
  const knowledgeService = options?.knowledgeService || new LilyKnowledgeService();
  const chatService = new LilyChatService(generator || (async (sys, user) => {
    // Check if prompt has formatting template
    const templateMarker = '[FORMATTING TEMPLATE]\nFormat as:\n"';
    if (sys.includes(templateMarker)) {
      const start = sys.lastIndexOf(templateMarker) + templateMarker.length;
      const end = sys.indexOf('"', start);
      if (start !== -1 && end !== -1) {
        return sys.substring(start, end);
      }
    }
    return 'I am Lily, ready to assist you!';
  }));

  const orchestrator = new LilyOrchestrator(
    languageService,
    memoryService,
    toolService,
    knowledgeService,
    chatService
  );

  return new LilyAI(orchestrator);
}

