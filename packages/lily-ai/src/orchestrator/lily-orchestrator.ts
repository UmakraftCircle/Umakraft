import { LilyAIRequest, LilyAIResponse } from '../core/types.js';
import { LilyExecutionContext } from './execution-context.js';
import { LilyPipeline } from './pipeline.js';
import { ILanguageService } from '../services/language/index.js';
import { IMemoryService } from '../services/memory/index.js';
import { IToolService } from '../services/tools/index.js';
import { IKnowledgeService } from '../services/knowledge/index.js';
import { IChatService } from '../services/chat/index.js';

export class LilyOrchestrator {
  private pipeline = new LilyPipeline();

  constructor(
    private languageService: ILanguageService,
    private memoryService: IMemoryService,
    private toolService: IToolService,
    private knowledgeService: IKnowledgeService,
    private chatService: IChatService
  ) {
    this.setupPipeline();
  }

  private setupPipeline() {
    // 1. Language Analysis
    this.pipeline.addStage(async (context) => {
      context.language = this.languageService.analyze(context.request.message);
    });

    // 2. Memory
    this.pipeline.addStage(async (context) => {
      context.memory = await this.memoryService.getContext(context.request.userId);
    });

    // 3. Tool Selection
    this.pipeline.addStage(async (context) => {
      if (context.language) {
        const selection = this.toolService.selectTool(context.language);
        context.selectedTool = selection.tool ?? undefined;

        // Contextual override: if we are in a link flow and providing info, keep using LinkRequestTool
        const isTrainerRelated = context.language.intent === 'unknown' || 
                                 context.language.intent === 'trainer_search' || 
                                 context.language.intent === 'trainer_profile' ||
                                 context.language.intent === 'trainer_lookup';
        
        if (context.memory?.activeTopic === 'link' && isTrainerRelated) {
          context.selectedTool = 'LinkRequestTool';
        }
      }
    });

    // 4. Knowledge
    this.pipeline.addStage(async (context) => {
      if (
        context.language &&
        (context.language.intent === 'knowledge_query' ||
         context.language.intent === 'leaderboard' ||
         context.language.intent === 'member_rank' ||
         context.language.intent === 'top_members' ||
         context.language.intent === 'club_stats' ||
         context.language.intent === 'link_request' ||
         context.language.intent === 'link_status' ||
         context.language.intent === 'link_help' ||
         context.language.intent === 'fan_requirements' ||
         context.language.intent === 'activity_rules' ||
         context.language.intent === 'linking' ||
         context.language.intent === 'membership' ||
         context.language.intent === 'club_procedures' ||
         context.language.intent === 'faq')
      ) {
        context.knowledge = this.knowledgeService.analyze(context.language);
      }
    });

    // 4.5. Handbook Tool Selection
    this.pipeline.addStage(async (context) => {
      if (context.knowledge?.source === 'handbook') {
        context.selectedTool = 'HandbookLookupTool';
      }
    });

    // 5. Tool Execution
    this.pipeline.addStage(async (context) => {
      if (context.selectedTool && !context.toolResult) {
        // Pre-Execution: Capture immediate trainer info if in link flow
        if (context.memory && context.memory.activeTopic === 'link') {
          const msg = context.request.message;
          const nameMatch = msg.match(/(?:my trainer name is|i am|name is|name:) ([\w\s]{2,20})/i);
          if (nameMatch && nameMatch[1]) {
            context.memory.trainerName = nameMatch[1].trim();
          }
          const explicitTrainerId =
            context.language?.trainerId ||
            context.language?.entities?.find(e => e.type === 'trainer_id')?.value;
          if (explicitTrainerId) {
            context.memory.trainerId = explicitTrainerId;
          }
        }

        if (this.toolService.executeTool) {
          const explicitTrainerId =
            context.language?.trainerId ||
            context.language?.entities?.find(e => e.type === 'trainer_id')?.value;
          
          // Fallback to userId ONLY if not in a link flow (where we need a fresh Umamusume ID)
          const trainerId = explicitTrainerId || context.memory?.trainerId || (context.memory?.activeTopic !== 'link' ? context.request.userId : undefined);
          
          context.toolResult = await this.toolService.executeTool(context.selectedTool, {
            trainerId,
            userId: context.request.userId,
            username: context.request.username,
            language: context.language,
            memory: context.memory
          });
        }
      }
    });

    // 6. Chat Response Generation
    this.pipeline.addStage(async (context) => {
      if (context.language && context.memory) {
        context.response = await this.chatService.generateResponse({
          request: context.request,
          language: context.language,
          memory: context.memory,
          knowledge: context.knowledge,
          toolResult: context.toolResult,
          selectedTool: context.selectedTool
        });
      }
    });

    // 7. Memory Update
    this.pipeline.addStage(async (context) => {
      if (context.language) {
        const memoryUpdate: any = {
          lastIntent: context.language.intent,
          recentMessages: [context.request.message]
        };

        const explicitTrainerId =
          context.language?.trainerId ||
          context.language?.entities?.find(e => e.type === 'trainer_id')?.value;
        const msg = context.language.normalizedMessage;

        // Remember explicit user-stated identity
        if (
          explicitTrainerId &&
          (msg.includes('my trainer') || msg.includes('trainer id is') || msg.includes('trainer id:') || msg.includes('my id is') || context.memory?.activeTopic === 'link')
        ) {
          memoryUpdate.trainerId = explicitTrainerId;
        }

        // Capture trainer name if we're in a link flow
        if (context.memory?.activeTopic === 'link' && !context.language?.intent.startsWith('fan_')) {
          const rawMsg = context.request.message;
          const nameMatch = rawMsg.match(/(?:my trainer name is|i am|name is|name:) ([\w\s]{2,20})/i);
          if (nameMatch && nameMatch[1]) {
            memoryUpdate.trainerName = nameMatch[1].trim();
          }
        }

        if (
          context.language.intent === 'link_request' ||
          context.language.intent === 'link_status' ||
          context.language.intent === 'link_help' ||
          context.selectedTool === 'LinkRequestTool' ||
          context.selectedTool === 'LinkStatusTool' ||
          (context.selectedTool && context.selectedTool.includes('Link'))
        ) {
          memoryUpdate.activeTopic = 'link';
        } else if (
          context.language.intent.startsWith('fan_') ||
          (context.selectedTool && context.selectedTool.startsWith('Fan'))
        ) {
          memoryUpdate.activeTopic = 'fan';
          memoryUpdate.lastFanCheck = Date.now();
        } else if (
          context.language.intent.startsWith('trainer_') ||
          (context.selectedTool && context.selectedTool.startsWith('Trainer'))
        ) {
          // Only switch to trainer topic if we aren't in a link flow
          if (context.memory.activeTopic !== 'link') {
            memoryUpdate.activeTopic = 'trainer';
          }
        } else if (
          context.language.intent === 'leaderboard' ||
          context.language.intent === 'member_rank' ||
          context.language.intent === 'top_members' ||
          context.language.intent === 'club_stats' ||
          (context.selectedTool && (context.selectedTool.includes('Leaderboard') || context.selectedTool.includes('Rank') || context.selectedTool.includes('ClubStats')))
        ) {
          memoryUpdate.activeTopic = 'club';
        } else if (context.language.intent === 'parent_search') {
          memoryUpdate.activeTopic = 'parent_search';
        }

        if (context.toolResult?.success && context.toolResult.data) {
          const data = context.toolResult.data;
          if (data.gainedToday !== undefined) {
            memoryUpdate.lastFanGain = data.gainedToday;
          }
          if (data.currentMilestone !== undefined) {
            memoryUpdate.lastMilestone = data.currentMilestone;
          }
          if (data.rank !== undefined) {
            memoryUpdate.clubRank = data.rank;
          }

          // Remember resolved trainer identity for user's own profile / link queries
          if (
            context.language.intent === 'trainer_profile' ||
            context.language.intent === 'trainer_link_status'
          ) {
            if (data.trainerId && data.trainerId !== 'Unknown') {
              memoryUpdate.trainerId = data.trainerId;
            }
            if (data.trainerName && data.trainerName !== 'Unknown') {
              memoryUpdate.trainerName = data.trainerName;
            }
            if (data.clubName) {
              memoryUpdate.clubName = data.clubName;
            }
            if (data.clubId) {
              memoryUpdate.clubId = data.clubId;
            }
            if (data.linkedDiscordId) {
              memoryUpdate.linkedDiscordId = data.linkedDiscordId;
            } else if (data.linked) {
              memoryUpdate.linkedDiscordId = context.request.userId;
            }
          }

          if (context.language.intent === 'link_request' && data.success) {
            memoryUpdate.pendingLinkRequest = true;
          }
        }

        await this.memoryService.updateContext(context.request.userId, memoryUpdate);
      }
    });
  }

  public async execute(request: LilyAIRequest): Promise<LilyAIResponse> {
    const context: LilyExecutionContext = { request };
    
    const result = await this.pipeline.execute(context);

    return {
      success: result.success,
      response: result.response,
      error: result.error
    };
  }

  public getLanguageService(): ILanguageService {
    return this.languageService;
  }

  public getMemoryService(): IMemoryService {
    return this.memoryService;
  }

  public getKnowledgeService(): IKnowledgeService {
    return this.knowledgeService;
  }
}
