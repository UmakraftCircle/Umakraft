import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createLogger } from '@ai-agent-platform/shared';
import { trainerLinkStore } from '@ai-agent-platform/integrations';
import { dmMemoryStore } from './dm-memory.js';
import { GlobalPersonalityLayer } from './global-personality.js';
import { lilyMemoryService } from './lily-memory-service.js';
import { lilyTaskService } from './lily-task-service.js';
import { executeFanGain } from './fan-gain.js';
import { getLeaderboard } from './fan-leaderboard.js';
import { executeMilestoneCheck } from './milestones.js';
import { fanPaceService } from './fan-pace.js';
import { aiProviderManager, AIProviderManager } from './ai-provider/index.js';
import {
  umamusumePureDbSearch,
  umamusumeDataMiner,
  umamusumeSearch,
  umamusumeCompile,
} from '@ai-agent-platform/umamusume';

const logger = createLogger('LilyChatService');

export interface LilyChatRequest {
  userId: string;
  username?: string;
  message: string;
  clubContext?: string;
  additionalSystemPrompt?: string;
}

export interface LilyChatResponse {
  content: string;
  activeKeyIndex: number;
  activeModel: string;
  retryCount: number;
  latencyMs: number;
  tokensUsed?: number;
  cached?: boolean;
  fallbackUsed?: boolean;
  fallbackProvider?: string;
  errorType?: string | null;
  toolsExecuted?: string[];
  toolContextUsed?: boolean;
}

export interface LilyChatMetrics {
  totalRequests: number;
  failedRequests: number;
  totalRetries: number;
  activeKeyIndex: number;
  activeModel: string;
  lastLatencyMs: number;
  queueLength: number;
  cacheHits: number;
  bypassedCasualCount: number;
}

/**
 * LilyChatService — Enterprise Groq-powered Umamusume Conversational Intelligence.
 *
 * Core Optimizations:
 * 1. Strictly ≤ 1 AI call per Discord message.
 * 2. Greeting Optimization (AI_CALL=false).
 * 3. Fan Systems & Telemetry Direct Execution (AI_CALL=false).
 * 4. Repository Context Injection ONLY on repository questions.
 * 5. Dynamic memory & trimmed conversation history (max 10 messages).
 * 6. 1-minute duplicate response caching (AI_CALL=false).
 * 7. AIProviderManager with GroqProvider, 1-6 keys round-robin, model fallback, no lockouts.
 */
export class LilyChatService {
  private static instance: LilyChatService;
  private providerManager: AIProviderManager;

  // 1-minute response cache for duplicate requests
  private responseCache: Map<string, { content: string; timestamp: number }> = new Map();
  private cacheTtlMs = 1 * 60 * 1000; // 1 minute

  // Per-trainer anti-flood rate limit (3 seconds)
  private trainerRateLimits: Map<string, number> = new Map();
  private trainerCooldownMs = 3000;

  // Repository Handbook memory cache
  private lilyHandbookCache = '';

  private metrics: LilyChatMetrics = {
    totalRequests: 0,
    failedRequests: 0,
    totalRetries: 0,
    activeKeyIndex: 1,
    activeModel: 'qwen/qwen3-32b',
    lastLatencyMs: 0,
    queueLength: 0,
    cacheHits: 0,
    bypassedCasualCount: 0,
  };

  private constructor() {
    this.providerManager = aiProviderManager;
    this.loadHandbook();
  }

  public static getInstance(): LilyChatService {
    if (!LilyChatService.instance) {
      LilyChatService.instance = new LilyChatService();
    }
    return LilyChatService.instance;
  }

  private loadHandbook(): void {
    try {
      const handbookPath = resolve(process.cwd(), 'LILY_HANDBOOK.md');
      if (existsSync(handbookPath)) {
        this.lilyHandbookCache = readFileSync(handbookPath, 'utf8');
        logger.info('[LilyChatService] Loaded LILY_HANDBOOK.md for repository intelligence.');
      }
    } catch (err: any) {
      logger.warn(`[LilyChatService] Failed to read LILY_HANDBOOK.md: ${err?.message}`);
    }
  }

  public getMetrics(): LilyChatMetrics {
    const providerMetrics = this.providerManager.getMetrics();
    return {
      ...this.metrics,
      queueLength: providerMetrics.queueLength,
      totalRequests: providerMetrics.totalRequests,
      failedRequests: providerMetrics.failedRequests,
      totalRetries: providerMetrics.totalRetries,
    };
  }

  /**
   * Greeting Optimization: Returns localized Lily response without calling Groq (AI_CALL=false).
   */
  private tryHandleGreetingLocally(message: string): string | null {
    const clean = message.toLowerCase().trim().replace(/[!.,?~]/g, '');

    const greetings = ['hi', 'hello', 'hey', 'greetings', 'morning', 'good morning', 'good afternoon', 'good evening', 'yo'];
    if (greetings.includes(clean)) {
      return `Hello, Trainer! 🐎 Lily here, ready to assist your training! How are your runs going today?`;
    }

    const thanks = ['thanks', 'thank you', 'thx', 'appreciate it', 'arigato'];
    if (thanks.includes(clean)) {
      return `You're very welcome, Trainer! Seeing you succeed on the turf is my greatest joy! ✨`;
    }

    const farewells = ['bye', 'goodbye', 'good night', 'gn', 'see ya', 'see you later'];
    if (farewells.includes(clean)) {
      return `Rest well, Trainer! Don't forget to stretch and get plenty of rest before tomorrow's races. 🌙`;
    }

    return null;
  }

  /**
   * Fan Systems Optimization: Direct repository service execution without calling Groq (AI_CALL=false).
   */
  private async tryHandleFanSystemLocally(userId: string, message: string): Promise<string | null> {
    const lower = message.toLowerCase().trim();

    // Fan gain / Fan count
    if (
      lower === 'fan gain' ||
      lower === 'fans' ||
      lower === 'how many fans' ||
      lower === 'my fans' ||
      lower === 'fan count' ||
      lower === 'fan status'
    ) {
      const report = await executeFanGain(userId);
      return `Here is your current fan update, Trainer:\n\n${report}`;
    }

    // Leaderboard
    if (
      lower === 'leaderboard' ||
      lower === 'top 3' ||
      lower === 'top 5' ||
      lower === 'top 10' ||
      lower === 'ranking'
    ) {
      const report = await getLeaderboard('unified', 'daily', 5);
      return `Here is the current circle leaderboard, Trainer:\n\n${report}`;
    }

    // Deficit status
    if (
      lower === 'deficit' ||
      lower === 'am i in deficit' ||
      lower === 'deficit check' ||
      lower === 'deficit status'
    ) {
      const report = await fanPaceService.getDeficitLeaderboard();
      return `Here is the circle deficit telemetry, Trainer:\n\n${report}`;
    }

    // Surplus status
    if (
      lower === 'surplus' ||
      lower === 'surplus check' ||
      lower === 'surplus status'
    ) {
      const report = await fanPaceService.getSurplusLeaderboard();
      return `Here is the surplus telemetry, Trainer:\n\n${report}`;
    }

    // Milestone check
    if (
      lower === 'milestone' ||
      lower === 'milestones' ||
      lower === 'milestone check' ||
      lower === 'milestone status'
    ) {
      const report = await executeMilestoneCheck(userId);
      return `Here is your milestone progress, Trainer:\n\n${report}`;
    }

    // Trainer linking status
    if (
      lower === 'link status' ||
      lower === 'my link' ||
      lower === 'trainer link' ||
      lower === 'am i linked'
    ) {
      const link = await trainerLinkStore.getByDiscordUser(userId);
      if (link) {
        return `Trainer, you are linked to **${link.trainerName}** (ID: \`${link.trainerId}\`)! 🐎`;
      }
      return `Trainer, your Discord account is not linked to a game profile yet. You can use \`/link\` to get started!`;
    }

    return null;
  }

  /**
   * Evaluates whether message requires repository handbook context.
   */
  private isRepositoryQuestion(message: string): boolean {
    const lower = message.toLowerCase();
    const repoKeywords = [
      'handbook',
      'repository',
      'repo',
      'architecture',
      'source code',
      'codebase',
      'database schema',
      'how does deficit work',
      'how does pace work',
      'how does calculation work',
      'what commands',
      'lily handbook',
      'how does autonomous',
      'railway deployment',
    ];
    return repoKeywords.some((k) => lower.includes(k));
  }

  /**
   * Executes Umamusume domain tools if the query requires live game knowledge.
   */
  public async executeUmamusumeToolIfApplicable(message: string): Promise<{
    intent: string;
    toolSlug: string;
    context: string;
  } | null> {
    const clean = message.trim();
    const lower = clean.toLowerCase();

    // 1. Pure-DB Parent Search & Factor queries
    const puredbKeywords = [
      'puredb',
      'pure-db',
      'parent search',
      'rental search',
      'factor search',
      'blue factor',
      'red factor',
      'parent factor',
    ];
    if (
      puredbKeywords.some((k) => lower.includes(k)) ||
      (lower.includes('parent') && (lower.includes('search') || lower.includes('find') || lower.includes('rental')))
    ) {
      try {
        let character: string | undefined;
        const charNames = [
          'special week', 'silence suzuka', 'tokai teio', 'maruzensky', 'oguri cap', 'gold ship',
          'vodka', 'daiwa scarlet', 'taiki shuttle', 'grass wonder', 'el condor pasa', 'mejiro mcqueen',
          'symboli rudolf', 'rice shower', 'super creek', 'haru urara', 'kitasan black', 'satono diamond',
          'curren chan', 'smart falcon', 'narita taishin', 'air groove', 'mayano top gun', 'manhattan cafe',
          'tamamo cross', 'fine motion', 'twin turbo',
        ];
        for (const name of charNames) {
          if (lower.includes(name)) {
            character = name;
            break;
          }
        }

        let blueFactor: string | undefined;
        if (lower.includes('speed')) blueFactor = 'speed';
        else if (lower.includes('stamina')) blueFactor = 'stamina';
        else if (lower.includes('power')) blueFactor = 'power';
        else if (lower.includes('guts')) blueFactor = 'guts';
        else if (lower.includes('wisdom') || lower.includes('wit')) blueFactor = 'wisdom';

        let redFactor: string | undefined;
        if (lower.includes('turf')) redFactor = 'turf';
        else if (lower.includes('dirt')) redFactor = 'dirt';
        else if (lower.includes('short')) redFactor = 'short';
        else if (lower.includes('mile')) redFactor = 'mile';
        else if (lower.includes('middle')) redFactor = 'middle';
        else if (lower.includes('long')) redFactor = 'long';

        const result: any = await umamusumePureDbSearch.handler({
          character,
          blueFactor,
          redFactor,
          blueStars: 3,
        });

        if (result && result.success) {
          return {
            intent: 'UmamusumePureDbSearch',
            toolSlug: 'umamusume-puredb-search',
            context: [
              `### [Umamusume Verified Authority Data — Pure-DB Tool Output]`,
              `Tool: umamusume-puredb-search`,
              `Search Link: ${result.searchUrl}`,
              `Matched Character: ${result.matchedCharacter || character || 'Any'}`,
              `Criteria Applied: ${JSON.stringify(result.criteria)}`,
              `Instructions for Lily: Provide this exact link to the Trainer with an encouraging explanation of the search criteria applied!`,
            ].join('\n'),
          };
        }
      } catch (err: any) {
        logger.warn(`Pure-DB tool execution error: ${err?.message}`);
      }
    }

    // 2. Skill lookups & explanations
    if (
      lower.includes('skill') ||
      lower.includes('what does ') ||
      lower.includes('arc maestro') ||
      lower.includes('maestro') ||
      lower.includes('concentration') ||
      lower.includes('non-stop girl') ||
      lower.includes('gold recovery') ||
      lower.includes('corner recovery')
    ) {
      try {
        const searchResult: any = await umamusumeSearch.handler({
          query: clean,
          category: 'skill',
          contextLines: 2,
        });

        if (searchResult && searchResult.success && searchResult.excerpts?.length > 0) {
          return {
            intent: 'UmamusumeSkillLookup',
            toolSlug: 'umamusume-search',
            context: [
              `### [Umamusume Verified Authority Data — Skill Database Search]`,
              `Tool: umamusume-search (category: skill, source: ${searchResult.sourceLabel || searchResult.sourceKey})`,
              `Verified Excerpts:`,
              ...searchResult.excerpts.slice(0, 5).map((e: string) => `• ${e}`),
              `Instructions for Lily: Synthesize this skill data warmly as Lily, the Trainer's coach. Explain the skill activation and effect accurately.`,
            ].join('\n'),
          };
        }

        const minerResult: any = await umamusumeDataMiner.handler({
          query: clean,
          category: 'skill',
          maxLength: 4000,
        });
        if (minerResult && minerResult.success && minerResult.text) {
          return {
            intent: 'UmamusumeSkillLookup',
            toolSlug: 'umamusume-data-miner',
            context: [
              `### [Umamusume Verified Authority Data — Skill Data Miner]`,
              `Tool: umamusume-data-miner (source: ${minerResult.sourceLabel || minerResult.sourceKey})`,
              `Retrieved Data: ${minerResult.text.slice(0, 1500)}`,
              `Instructions for Lily: Synthesize this skill info accurately and encouragingly.`,
            ].join('\n'),
          };
        }
      } catch (err: any) {
        logger.warn(`Skill tool execution error: ${err?.message}`);
      }
    }

    // 3. Support Card lookups
    if (
      lower.includes('support card') ||
      lower.includes('ssr') ||
      lower.includes('sr card') ||
      lower.includes('kitasan black card') ||
      lower.includes('fine motion card') ||
      lower.includes('super creek card') ||
      lower.includes('deck')
    ) {
      try {
        const searchResult: any = await umamusumeSearch.handler({
          query: clean,
          category: 'support-card',
          contextLines: 2,
        });

        if (searchResult && searchResult.success && searchResult.excerpts?.length > 0) {
          return {
            intent: 'UmamusumeCardLookup',
            toolSlug: 'umamusume-search',
            context: [
              `### [Umamusume Verified Authority Data — Support Card Search]`,
              `Tool: umamusume-search (source: ${searchResult.sourceLabel || searchResult.sourceKey})`,
              `Verified Excerpts:`,
              ...searchResult.excerpts.slice(0, 5).map((e: string) => `• ${e}`),
              `Instructions for Lily: Explain the card's strengths, training bonuses, and event skills to the Trainer.`,
            ].join('\n'),
          };
        }
      } catch (err: any) {
        logger.warn(`Support card tool execution error: ${err?.message}`);
      }
    }

    // 4. Character lookups & Build advice
    const charNames = [
      'special week', 'silence suzuka', 'tokai teio', 'maruzensky', 'oguri cap', 'gold ship',
      'vodka', 'daiwa scarlet', 'taiki shuttle', 'grass wonder', 'el condor pasa', 'mejiro mcqueen',
      'symboli rudolf', 'rice shower', 'super creek', 'haru urara', 'kitasan black', 'satono diamond',
      'twin turbo', 'tamamo cross', 'fine motion',
    ];
    const matchedName = charNames.find((name) => lower.includes(name));
    if (
      matchedName ||
      lower.includes('character') ||
      lower.includes('who is') ||
      lower.includes('how to build') ||
      lower.includes('build advice') ||
      lower.includes('how to train')
    ) {
      try {
        const queryTarget = matchedName || clean;
        const puredbCheck: any = await umamusumePureDbSearch.handler({
          character: queryTarget,
        });

        const searchResult: any = await umamusumeSearch.handler({
          query: queryTarget,
          category: 'character',
          contextLines: 2,
        });

        const lines: string[] = [
          `### [Umamusume Verified Authority Data — Character Database]`,
          `Target: ${puredbCheck?.matchedCharacter || queryTarget}`,
        ];
        if (puredbCheck?.searchUrl) {
          lines.push(`Pure-DB URL: ${puredbCheck.searchUrl}`);
        }
        if (searchResult && searchResult.success && searchResult.excerpts?.length > 0) {
          lines.push(`Database Excerpts:`);
          lines.push(...searchResult.excerpts.slice(0, 5).map((e: string) => `• ${e}`));
        }
        lines.push(`Instructions for Lily: Coach the Trainer on this character's aptitudes, training focus, and ideal strategy.`);

        return {
          intent: 'UmamusumeCharacterCoaching',
          toolSlug: 'umamusume-puredb-search',
          context: lines.join('\n'),
        };
      } catch (err: any) {
        logger.warn(`Character coaching tool execution error: ${err?.message}`);
      }
    }

    // 5. Track, Scenario, Mechanics lookups
    if (
      lower.includes('track') ||
      lower.includes('racecourse') ||
      lower.includes('scenario') ||
      lower.includes("l'arc") ||
      lower.includes('uaf') ||
      lower.includes('climax') ||
      lower.includes('mechanic') ||
      lower.includes('acceleration') ||
      lower.includes('inheritance')
    ) {
      try {
        let cat = 'general';
        if (lower.includes('track') || lower.includes('racecourse')) cat = 'track';
        else if (lower.includes('scenario') || lower.includes("l'arc") || lower.includes('uaf')) cat = 'scenario';
        else if (lower.includes('mechanic') || lower.includes('acceleration')) cat = 'game-mechanic';

        const searchResult: any = await umamusumeSearch.handler({
          query: clean,
          category: cat,
          contextLines: 2,
        });

        if (searchResult && searchResult.success && searchResult.excerpts?.length > 0) {
          return {
            intent: 'UmamusumeMechanicsLookup',
            toolSlug: 'umamusume-search',
            context: [
              `### [Umamusume Verified Authority Data — Game Knowledge Search]`,
              `Tool: umamusume-search (category: ${cat}, source: ${searchResult.sourceLabel || searchResult.sourceKey})`,
              `Verified Excerpts:`,
              ...searchResult.excerpts.slice(0, 5).map((e: string) => `• ${e}`),
              `Instructions for Lily: Provide a clear, tactical breakdown for the Trainer.`,
            ].join('\n'),
          };
        }
      } catch (err: any) {
        logger.warn(`Mechanics search tool execution error: ${err?.message}`);
      }
    }

    return null;
  }

  /**
   * Main interaction pipeline.
   * Guarantees at most 1 AI request per message.
   */
  public async generateResponse(req: LilyChatRequest): Promise<LilyChatResponse> {
    const now = Date.now();
    const cleanMessage = req.message.trim();

    // 1. Per-trainer rate limiting (3s)
    const lastReqTime = this.trainerRateLimits.get(req.userId) || 0;
    if (now - lastReqTime < this.trainerCooldownMs) {
      logger.info(`[LilyChatService] Intent=RateLimited AI_CALL=false`);
      return {
        content: `Please slow down a little bit, Trainer! Let's take a quick breath before our next chat. 🐎`,
        activeKeyIndex: this.metrics.activeKeyIndex,
        activeModel: this.metrics.activeModel,
        retryCount: 0,
        latencyMs: 0,
      };
    }
    this.trainerRateLimits.set(req.userId, now);

    // 2. Duplicate Request Protection (1-minute cache)
    const cacheKey = `${req.userId}:${cleanMessage.toLowerCase()}`;
    const cachedEntry = this.responseCache.get(cacheKey);
    if (cachedEntry && now - cachedEntry.timestamp < this.cacheTtlMs) {
      logger.info(`[LilyChatService] Intent=CachedQuery AI_CALL=false`);
      this.metrics.cacheHits++;
      return {
        content: cachedEntry.content,
        activeKeyIndex: this.metrics.activeKeyIndex,
        activeModel: this.metrics.activeModel,
        retryCount: 0,
        latencyMs: 1,
        cached: true,
      };
    }

    // 3. Greeting Optimization (AI_CALL=false)
    const greetingReply = this.tryHandleGreetingLocally(cleanMessage);
    if (greetingReply) {
      logger.info(`[LilyChatService] Intent=Greeting AI_CALL=false`);
      this.metrics.bypassedCasualCount++;
      return {
        content: greetingReply,
        activeKeyIndex: this.metrics.activeKeyIndex,
        activeModel: this.metrics.activeModel,
        retryCount: 0,
        latencyMs: 1,
        cached: true,
      };
    }

    // 4. Fan Systems Optimization (AI_CALL=false)
    const fanSystemReply = await this.tryHandleFanSystemLocally(req.userId, cleanMessage);
    if (fanSystemReply) {
      logger.info(`[LilyChatService] Intent=FanSystem AI_CALL=false`);
      return {
        content: fanSystemReply,
        activeKeyIndex: this.metrics.activeKeyIndex,
        activeModel: this.metrics.activeModel,
        retryCount: 0,
        latencyMs: 2,
        cached: true,
      };
    }

    // 5. Build AI Request Context
    let intentLabel = 'GeneralConversation';
    let repoContext = '';
    let umamusumeContext = '';
    const toolsExecuted: string[] = [];

    // Check if asking repository question (Preserves read-only LILY_HANDBOOK.md intelligence)
    if (this.isRepositoryQuestion(cleanMessage)) {
      intentLabel = 'RepositoryQuestion';
      if (this.lilyHandbookCache) {
        // Trim handbook to relevant portion (first 3000 chars) to prevent token bloat
        repoContext = `### [Repository Intelligence — LILY_HANDBOOK.md]\n${this.lilyHandbookCache.slice(0, 3000)}\n`;
      }
    }

    // Check Umamusume Domain & Tool-Calling Intent (Executes Umamusume tools locally; 0 extra LLM calls!)
    const umaToolResult = await this.executeUmamusumeToolIfApplicable(cleanMessage);
    if (umaToolResult) {
      intentLabel = umaToolResult.intent;
      umamusumeContext = `\n${umaToolResult.context}\n`;
      toolsExecuted.push(umaToolResult.toolSlug);
    }

    // Check Task Intelligence Intent (Goal analysis & multi-step projection)
    let taskAnalysisContext = '';
    const lowerMsg = cleanMessage.toLowerCase();
    if (lowerMsg.includes('300m') || lowerMsg.includes('300 million')) {
      intentLabel = 'GoalAnalysis';
      try {
        const analysis = await lilyTaskService.analyzeGoalProjection(req.userId, 300_000_000);
        taskAnalysisContext = `### [Task Intelligence Analysis (300M)]\nSummary: ${analysis.summary}\nRecommendation: ${analysis.recommendation}\n`;
      } catch {}
    } else if (lowerMsg.includes('200m') || lowerMsg.includes('200 million')) {
      intentLabel = 'GoalAnalysis';
      try {
        const analysis = await lilyTaskService.analyzeGoalProjection(req.userId, 200_000_000);
        taskAnalysisContext = `### [Task Intelligence Analysis (200M)]\nSummary: ${analysis.summary}\nRecommendation: ${analysis.recommendation}\n`;
      } catch {}
    } else if (lowerMsg.includes('recover') && lowerMsg.includes('deficit')) {
      intentLabel = 'DeficitRecovery';
      try {
        const analysis = await lilyTaskService.analyzeDeficitRecovery(req.userId);
        taskAnalysisContext = `### [Task Intelligence Analysis (Deficit Recovery)]\nSummary: ${analysis.summary}\nRecommendation: ${analysis.recommendation}\n`;
      } catch {}
    }

    // Logging AI Call Intent
    logger.info(`[LilyChatService] Intent=${intentLabel} ToolsExecuted=[${toolsExecuted.join(', ')}] AI_CALL=true`);

    // System prompt assembling
    const personality = GlobalPersonalityLayer.getInstance().getSystemPromptInjection();
    const memoryPackage = lilyMemoryService.compileMemoryContext(req.userId, cleanMessage);

    const systemPromptParts = [
      personality,
      '',
      memoryPackage.formattedInjection,
      taskAnalysisContext ? `\n${taskAnalysisContext}` : '',
      repoContext ? `\n${repoContext}` : '',
      umamusumeContext ? `\n${umamusumeContext}` : '',
      req.clubContext ? `\n### Club Live Context:\n${req.clubContext}` : '',
      req.additionalSystemPrompt || '',
    ].filter(Boolean);

    // Optimized conversation history: trimmed to at most 10 messages (max 400 chars each)
    const rawHistory = dmMemoryStore.getHistory(req.userId, 10);
    const trimmedHistory = rawHistory.slice(-10).map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content.length > 400 ? `${m.content.slice(0, 397)}...` : m.content,
    }));

    const messages = [
      { role: 'system' as const, content: systemPromptParts.join('\n') },
      ...trimmedHistory,
      { role: 'user' as const, content: cleanMessage },
    ];

    // 6. Execute AI Call (Single AI Request per message)
    const startTime = Date.now();
    const result = await this.providerManager.generateChat(messages, {
      temperature: 0.7,
      maxTokens: 800,
      intent: intentLabel,
      messageLength: cleanMessage.length,
    });

    const latencyMs = Date.now() - startTime;
    this.metrics.activeKeyIndex = result.keyIndex;
    this.metrics.activeModel = result.model;
    this.metrics.lastLatencyMs = latencyMs;

    // Cache successful response (1 minute TTL)
    if (!result.emergencyModeActive && result.content) {
      this.responseCache.set(cacheKey, { content: result.content, timestamp: Date.now() });
    }

    return {
      content: result.content,
      activeKeyIndex: result.keyIndex,
      activeModel: result.model,
      retryCount: result.retryCount,
      latencyMs,
      fallbackUsed: result.fallbackUsed,
      fallbackProvider: result.fallbackProvider,
      errorType: result.errorType,
      toolsExecuted: toolsExecuted.length > 0 ? toolsExecuted : undefined,
      toolContextUsed: Boolean(umaToolResult),
    };
  }
}

export const lilyChatService = LilyChatService.getInstance();
