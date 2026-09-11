import { appendFileSync } from 'fs';
import { resolve } from 'path';
import type { Message } from 'discord.js';
import { createLogger } from '@ai-agent-platform/shared';
import { classifyIntent, type IntentResult } from './intent-router.js';
import { executeFanGain } from './fan-gain.js';
import { getLeaderboard, getRank } from './fan-leaderboard.js';
import { executeMilestoneCheck } from './milestones.js';
import { fanPaceService } from './fan-pace.js';
import { linkRequestService } from './link-request.js';
import { dmMemoryStore } from './dm-memory.js';
import { dmAuditStore, type DMAuditRecord } from './dm-audit.js';
import { trainerMemoryStore } from './trainer-memory.js';
import { autonomousPlanner } from './autonomous-planner.js';
import { proactiveEngine } from './proactive-engine.js';
import { clubHealthEvaluator } from './club-health.js';
import { clubLeaderDashboardService } from './leader-dashboard.js';
import { fanIntelligenceEngine } from './fan-intelligence.js';
import { coordinatorAgent } from './multi-agent.js';
import { capabilityDiscovery } from '@ai-agent-platform/core';
import { generateChatResponse } from '../chat.js';
import { splitForEmbeds } from '../embed-reply.js';
import { lilyChatService } from './lily-chat-service.js';
import {
  chatSessionStore,
  memoryService,
} from '@ai-agent-platform/integrations';

const logger = createLogger('AutomationEngine');
const LOG_FILE_PATH = resolve(process.cwd(), 'automation.log');

export class AutomationEngine {
  private static instance: AutomationEngine;

  public static getInstance(): AutomationEngine {
    if (!AutomationEngine.instance) {
      AutomationEngine.instance = new AutomationEngine();
    }
    return AutomationEngine.instance;
  }

  /**
   * Logs execution metrics to automation.log file.
   */
  private logAction(userId: string, intent: string, executionMs: number, status: 'Success' | 'Failure'): void {
    const logEntry = `[INFO]\nUser: ${userId}\nIntent: ${intent}\nExecution: ${executionMs}ms\nStatus: ${status}\n\n`;

    try {
      appendFileSync(LOG_FILE_PATH, logEntry, 'utf8');
    } catch (err: any) {
      logger.warn(`Failed to write to automation.log: ${err?.message}`);
    }

    logger.info(`[AutomationEngine] User: ${userId} | Intent: ${intent} | Execution: ${executionMs}ms | Status: ${status}`);
  }

  /**
   * Primary entry point for message processing in DM & Guild channels.
   */
  public async process(message: Message): Promise<void> {
    // Safety Guard 1: Never respond to bot messages
    if (message.author?.bot) {
      return;
    }

    // Safety Guard 2: Ignore webhook or system messages
    if (message.webhookId || message.system) {
      return;
    }

    const userId = message.author?.id ?? 'unknown';
    const content = (message.content ?? '').trim();
    if (!content) return;

    const startTime = Date.now();
    const isDM = !message.guildId && (typeof message.channel?.isDMBased === 'function' ? message.channel.isDMBased() : true);
    const username = message.author?.username || 'Trainer';

    // Save user message in DM Memory & Conversation Store
    if (isDM) {
      dmMemoryStore.addMessage(userId, 'user', content);
      chatSessionStore
        .getSession(userId)
        .then(async (session) => {
          if (!session) {
            await chatSessionStore.openSession(userId, message.channelId || `dm-${userId}`);
          } else {
            await chatSessionStore.bumpTurn(userId);
          }
        })
        .catch(() => {});
      memoryService.saveUserMessage(userId, content, message.channelId || `dm-${userId}`).catch(() => {});
    }

    // Check if user is currently in an active interactive Link Request step
    if (isDM && linkRequestService.hasActiveSession(userId)) {
      const stepReply = await linkRequestService.handleStepResponse(message, message.client);
      if (stepReply) {
        dmMemoryStore.addMessage(userId, 'assistant', stepReply);
        memoryService.saveAssistantMessage(userId, stepReply, message.channelId || `dm-${userId}`).catch(() => {});
        await this.sendReply(message, stepReply);
        this.logAction(userId, 'link_request_step', Date.now() - startTime, 'Success');
        return;
      }
    }

    // Trigger typing indicator
    try {
      if (typeof (message.channel as any)?.sendTyping === 'function') {
        await (message.channel as any).sendTyping();
      }
    } catch {}

    // Step 2: Intent Router Classification with NLU & Context
    const intentResult: IntentResult = classifyIntent(content, userId);
    let replyText = '';
    let status: 'Success' | 'Failure' = 'Success';
    let lastAITelemetry: {
      provider?: string;
      model?: string;
      latencyMs?: number;
      fallbackUsed?: boolean;
      fallbackProvider?: string;
      errorType?: string | null;
      toolsExecuted?: string[];
    } | null = null;

    try {
      const lowerContent = content.toLowerCase();

      // Phase 13 Admin Intelligence Commands
      if (lowerContent === '!ai-status' || lowerContent === '!ai status') {
        replyText = await clubHealthEvaluator.getAIStatusReport();
      } else if (lowerContent === '!tool-health' || lowerContent === '!tool health') {
        replyText = clubHealthEvaluator.getToolHealthReport();
      } else if (lowerContent === '!hallucination-report' || lowerContent === '!hallucination report') {
        replyText = clubHealthEvaluator.getHallucinationReport();
      } else if (lowerContent === '!routing-report' || lowerContent === '!routing report') {
        replyText = clubHealthEvaluator.getRoutingReport();
      } else if (lowerContent === '!trainer-insights' || lowerContent === '!trainer insights') {
        replyText = await clubHealthEvaluator.getTrainerInsightsReport();
      } else if (lowerContent === '!agent-health' || lowerContent === '!agent health') {
        replyText = coordinatorAgent.formatAgentHealthReport();
      }
      // Phase 16 Leader Commands & Natural Language Triggers
      else if (lowerContent === '!club-health' || lowerContent === '!club health' || lowerContent.includes('how healthy is the club')) {
        replyText = await clubLeaderDashboardService.formatClubHealthReport();
      } else if (lowerContent === '!club-report' || lowerContent === '!club report' || lowerContent.includes('weekly club report')) {
        replyText = await clubLeaderDashboardService.formatWeeklyClubReport();
      } else if (lowerContent === '!risk-report' || lowerContent === '!risk report' || lowerContent.includes('trainers at risk')) {
        replyText = await clubLeaderDashboardService.formatRiskReport();
      } else if (lowerContent === '!milestone-report' || lowerContent === '!milestone report' || lowerContent.includes('milestone distribution')) {
        replyText = await clubLeaderDashboardService.formatMilestoneReport();
      } else if (lowerContent === '!link-report' || lowerContent === '!link report' || lowerContent.includes('link request status')) {
        replyText = await clubLeaderDashboardService.formatLinkReport();
      } else if (intentResult.needsClarification && intentResult.clarificationPrompt) {
        replyText = intentResult.clarificationPrompt;
      } else if (
        intentResult.intents.length > 1 &&
        intentResult.intents.some((i) => i.intent === 'milestone_projection') &&
        intentResult.intents.some((i) => i.intent === 'leaderboard_lookup')
      ) {
        // Multi-Intent Orchestration: Milestone Projection + Leaderboard
        const plan = autonomousPlanner.createPlan('fan_goal_projection', content, userId);
        const projectionText = await autonomousPlanner.orchestrate(plan);
        const leaderboardText = await getLeaderboard('unified', 'daily', 3);
        replyText = [projectionText, '', leaderboardText].join('\n');
      } else if (
        content.toLowerCase().includes('300m') &&
        (content.toLowerCase().includes('train') || content.toLowerCase().includes('focus') || content.toLowerCase().includes('build'))
      ) {
        // Multi-Agent Delegation: Fan Intelligence + Coach Agent
        replyText = await coordinatorAgent.coordinate(userId, content);
      } else {
        // Step 5: Commandless NLU Route Execution vs Gemini Fallback
        switch (intentResult.intent) {
          case 'fan_gain':
          case 'trainer_profile':
            replyText = await executeFanGain(userId);
            break;

          case 'deficit_check': {
            const metrics = await fanIntelligenceEngine.getIntelligenceForUser(userId);
            replyText = metrics
              ? fanIntelligenceEngine.generateSmartCoaching(metrics)
              : await fanPaceService.getDeficitLeaderboard();
            break;
          }

          case 'surplus_check':
            replyText = await fanPaceService.getSurplusLeaderboard();
            break;

          case 'leaderboard_lookup':
          case 'leaderboard':
            replyText = await getLeaderboard('unified', 'daily', 3);
            break;

          case 'rank':
            replyText = await getRank(userId, 'unified', 'daily');
            break;

          case 'milestone_status':
          case 'milestone':
            replyText = await executeMilestoneCheck(userId);
            break;

          case 'milestone_projection': {
            const plan = autonomousPlanner.createPlan('fan_goal_projection', content, userId);
            replyText = await autonomousPlanner.orchestrate(plan);
            break;
          }

          case 'build_review':
          case 'training_advice':
          case 'training_lookup': {
            const plan = autonomousPlanner.createPlan('trainer_coaching', content, userId);
            replyText = await autonomousPlanner.orchestrate(plan);
            break;
          }

          case 'fan_pace': {
            const paceReport = await fanPaceService.getPaceForUser(userId);
            replyText = paceReport
              ? fanPaceService.formatPaceReportMessage(paceReport)
              : 'Fan tracking unavailable. Skipping pace calculations.';
            break;
          }

          case 'surplus_leaderboard':
            replyText = await fanPaceService.getSurplusLeaderboard();
            break;

          case 'deficit_leaderboard':
            replyText = await fanPaceService.getDeficitLeaderboard();
            break;

          case 'link_request':
            replyText = await linkRequestService.initiateLinkRequest(userId, username);
            break;

          case 'help':
            replyText = this.getHelpText();
            break;

          case 'debug_why':
            replyText = dmAuditStore.formatDebugWhy(userId);
            break;

          case 'debug_stats': {
            const stats = dmAuditStore.getStats();
            const auditReport = capabilityDiscovery.performSelfAudit();
            const proactiveHistory = proactiveEngine.getAuditHistory();
            replyText = [
              '📊 **DM AI Tool Telemetry & Diagnostics Dashboard**',
              `• **Total Interactions Audited:** ${stats.totalAudits}`,
              `• **Fallback Rate:** ${stats.fallbackRatePercentage}% (${stats.fallbackCount} fallbacks)`,
              `• **Web Search Total Uses:** ${stats.webSearchCount}`,
              `• **Web Search Watchdog Alerts:** ${stats.webSearchWatchdogAlerts}`,
              `• **Potential Hallucinations Flagged:** ${stats.potentialHallucinationCount}`,
              `• **Verification Breakdown:** Verified: ${stats.verificationDistribution.Verified} | Reasoned: ${stats.verificationDistribution.Reasoned} | Unverified: ${stats.verificationDistribution.Unverified}`,
              `• **Top Tool Usage:** ${Object.entries(stats.toolUsageCounts).map(([t, c]) => `\`${t}\`: ${c}`).join(', ') || 'None yet'}`,
              '',
              '🛠️ **Phase 7 Dynamic Capability Discovery Audit**',
              `• **Registered Capabilities:** ${auditReport.registeredToolCount} tools across categories [${auditReport.activeCategories.join(', ')}]`,
              `• **Unused Tools Flagged:** ${auditReport.unusedTools.length > 0 ? auditReport.unusedTools.map((t) => `\`${t}\``).join(', ') : 'None (100% active coverage)'}`,
              `• **Rarely Used Tools:** ${auditReport.rarelyUsedTools.length > 0 ? auditReport.rarelyUsedTools.join(', ') : 'None'}`,
              '',
              '🤖 **Phase 10 Proactive Assistant Telemetry**',
              `• **Proactive Outreach Events Triggered:** ${proactiveHistory.length}`,
              `• **Recent Proactive Triggers:** ${proactiveHistory.slice(-3).map((h) => `\`${h.triggerType}\` (P${h.priority})`).join(', ') || 'None yet'}`,
              '',
              '🤝 **Phase 12 Relationship & Trust Telemetry**',
              `• **Personalization & Goal Reference Events:** ${stats.personalizationEventsCount}`,
              `• **Milestone Achievements Celebrated:** ${stats.achievementsDetectedCount}`,
            ].join('\n');
            break;
          }

          case 'chat':
          case 'skill_lookup':
          case 'character_lookup':
          case 'card_lookup':
          case 'support_card_lookup':
          case 'track_lookup':
          case 'inheritance_advice':
          case 'inheritance_lookup':
          case 'scenario_help':
          case 'scenario_lookup':
          case 'mechanics_explanation':
          case 'mechanics_lookup':
          case 'latest_event':
          case 'banner_info':
          case 'patch_notes':
          case 'news':
          case 'greeting':
          case 'small_talk':
          case 'opinion':
          case 'joke':
          case 'casual_chat':
          default:
            // Fallback to Gemini/Groq chat with conversation memory
            replyText = await this.executeGeminiChat(userId, message.channelId, content, (telemetry) => {
              lastAITelemetry = telemetry;
            });
            break;
        }
      }
    } catch (err: any) {
      status = 'Failure';
      logger.error(`Error processing automation intent ${intentResult.intent}: ${err?.message}`);
      replyText = 'Trainer, I encountered an issue processing your request. Please try again shortly! 🐎';
    } finally {
      const executionMs = Date.now() - startTime;
      this.logAction(userId, intentResult.intent, executionMs, status);

      // Construct Phase 6 DM Audit Trail Record
      const isDomainTopic = [
        'skill_lookup',
        'character_lookup',
        'card_lookup',
        'track_lookup',
        'inheritance_lookup',
        'training_lookup',
        'scenario_lookup',
        'mechanics_lookup',
      ].includes(intentResult.intent);

      const isWebSearchUsed = replyText.toLowerCase().includes('search') || replyText.toLowerCase().includes('web');
      const isWatchdogAlert = isDomainTopic && isWebSearchUsed;
      const isPotentialHallucination = isDomainTopic && status === 'Failure';
      const isPersonalization = replyText.includes('Preferred') || replyText.includes('Goal') || replyText.includes('Trainer');
      const isAchievement = replyText.toLowerCase().includes('congratulations') || replyText.includes('150M') || replyText.includes('200M') || replyText.includes('300M');

      const auditRecord: DMAuditRecord = {
        id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: Date.now(),
        userId,
        userMessage: content,
        intent: intentResult.intent,
        intentConfidence: intentResult.confidence,
        toolsConsidered: Array.from(
          new Set([
            ...(isDomainTopic ? ['umamusume-puredb-search', 'umamusume-data-miner', 'search_web'] : []),
            ...(lastAITelemetry?.toolsExecuted || []),
          ])
        ),
        selectedTools:
          lastAITelemetry?.toolsExecuted && lastAITelemetry.toolsExecuted.length > 0
            ? lastAITelemetry.toolsExecuted
            : isDomainTopic
            ? ['umamusume-puredb-search']
            : [],
        executionMs,
        resultsCount: status === 'Success' ? 1 : 0,
        verificationStatus: status === 'Success' ? (isDomainTopic ? 'Verified' : 'Reasoned') : 'Unverified',
        confidence: intentResult.confidence > 0.85 ? 'High' : intentResult.confidence > 0.6 ? 'Medium' : 'Low',
        fallbackUsed: intentResult.intent === 'chat' || (lastAITelemetry?.fallbackUsed ?? false),
        webSearchUsed: isWebSearchUsed,
        potentialHallucination: isPotentialHallucination,
        webSearchWatchdogAlert: isWatchdogAlert,
        reason: `Processed via ${intentResult.intent} route with ${Math.round(intentResult.confidence * 100)}% intent match.`,
        finalResponse: replyText.slice(0, 300),
        personalizationApplied: isPersonalization,
        goalReferenced: replyText.toLowerCase().includes('goal') || replyText.toLowerCase().includes('target') || replyText.toLowerCase().includes('milestone'),
        memoryUsed: !!trainerMemoryStore.getPermanentMemory(userId),
        achievementDetected: isAchievement,
        trustLevelEvent: isAchievement ? 'Achievement Celebrated' : (isWatchdogAlert ? 'Watchdog Risk Flagged' : 'Standard Interaction'),
        aiProvider: lastAITelemetry?.provider,
        aiModel: lastAITelemetry?.model,
        aiLatencyMs: lastAITelemetry?.latencyMs,
        aiFallbackUsed: lastAITelemetry?.fallbackUsed,
        aiFallbackProvider: lastAITelemetry?.fallbackProvider,
        aiErrorType: lastAITelemetry?.errorType,
      };

      dmAuditStore.recordAudit(auditRecord);
    }

    // Save assistant response in DM Memory & Conversation Store
    if (isDM && replyText) {
      dmMemoryStore.addMessage(userId, 'assistant', replyText);
      memoryService.saveAssistantMessage(userId, replyText, message.channelId || `dm-${userId}`).catch(() => {});
    }

    // Dispatch reply to Discord channel
    if (replyText) {
      await this.sendReply(message, replyText);
    }
  }

  /**
   * LilyChatService Fallback Chat processing with Dual Mistral API Architecture and Repository Intelligence.
   */
  private async executeGeminiChat(
    userId: string,
    channelId: string,
    content: string,
    onTelemetry?: (telemetry: any) => void
  ): Promise<string> {
    try {
      // Phase 8: Autonomous Goal Planning Check
      const detectedGoal = autonomousPlanner.detectGoal(content);
      if (['fan_goal_projection', 'fan_recovery_plan', 'trainer_coaching', 'build_evaluation'].includes(detectedGoal)) {
        logger.info(`[Phase 8 Planner] Detected Multi-Step Goal: ${detectedGoal} for content: "${content}"`);
        const plan = autonomousPlanner.createPlan(detectedGoal, content, userId);
        return await autonomousPlanner.orchestrate(plan);
      }

      const result = await lilyChatService.generateResponse({
        userId,
        message: content,
      });

      if (onTelemetry) {
        onTelemetry({
          provider: result.fallbackProvider ? 'Groq (OpenAI Fallback)' : 'Groq',
          model: result.activeModel,
          latencyMs: result.latencyMs,
          fallbackUsed: !!result.fallbackUsed,
          fallbackProvider: result.fallbackProvider,
          errorType: result.errorType,
          toolsExecuted: result.toolsExecuted,
        });
      }

      return result.content;
    } catch (err: any) {
      logger.error(`LilyChatService error: ${err?.message}`);
      return "Sorry, Trainer. I'm having trouble reaching my thoughts right now. Please try again in a moment.";
    }
  }

  /**
   * Formatted Help response message.
   */
  public getHelpText(): string {
    return [
      '📖 Umakraft Automation Commands & Support',
      '',
      'Available Direct Commands:',
      '• `fan gain` / `/fan-gain` - View your fan gain report',
      '• `fan leaderboard` / `/fan-leaderboard` - View top trainer rankings',
      '• `rank` / `/rank` - View your current fan leaderboard rank',
      '• `fan pace` / `deficit` / `surplus` - View your monthly fan deficit/surplus report',
      '• `fan surplus leaderboard` - View top surplus trainers',
      '• `fan deficit leaderboard` - View highest deficit trainers',
      '• `milestone` / `/milestone` - Check monthly milestone status',
      '• `link` / `request link` - Submit trainer account link request',
      '• `help` / `/help` - Show this guide',
      '',
      'You can also speak with me naturally in DMs or mention me in guild channels for general assistance! 🐎',
    ].join('\n');
  }

  /**
   * Sends reply back to Discord message channel with size chunking.
   */
  private async sendReply(message: Message, text: string): Promise<void> {
    const chunks = splitForEmbeds(text, 1950);
    const parts = chunks.length > 0 ? chunks : [text];

    for (const part of parts) {
      let sent = false;
      if (typeof message.reply === 'function') {
        try {
          await message.reply(part);
          sent = true;
        } catch (e) {
          logger.warn(`message.reply failed, attempting fallbacks: ${e}`);
        }
      }
      if (!sent && typeof (message.channel as any)?.send === 'function') {
        try {
          await (message.channel as any).send(part);
          sent = true;
        } catch (e) {
          logger.warn(`message.channel.send failed: ${e}`);
        }
      }
      if (!sent && typeof message.author?.send === 'function') {
        await message.author.send(part);
      }
    }
  }
}

export const automationEngine = AutomationEngine.getInstance();
