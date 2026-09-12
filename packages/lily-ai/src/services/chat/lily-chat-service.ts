import { IChatService } from './index.js';
import { LilyChatContext } from './chat-context.js';
import { ResponsePlanner } from './response-planner.js';
import { PromptBuilder } from './prompt-builder.js';
import { GeminiGenerateContentMethod } from './gemini-adapter.js'; // Note: Injected dependency for LLM

export class LilyChatService implements IChatService {
  private planner = new ResponsePlanner();
  private builder = new PromptBuilder();
  private llmGenerate: GeminiGenerateContentMethod;

  constructor(llmGenerate: GeminiGenerateContentMethod) {
    this.llmGenerate = llmGenerate;
  }

  public async generateResponse(context: LilyChatContext): Promise<string> {
    // 1. Determine strategy (Tool format, Knowledge explain, or Chat)
    const mode = this.planner.determineMode(context);

    // 2. Build the strict context payload (Voice, not Brain)
    const promptPayload = this.builder.build(context);

    // 3. Delegate to LLM (Gemini) exclusively for natural language generation
    const response = await this.llmGenerate(promptPayload.systemPrompt, promptPayload.userPrompt);
    
    return response;
  }
}
