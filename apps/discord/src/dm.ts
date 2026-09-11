import type { Message } from 'discord.js';
import { createLogger } from '@ai-agent-platform/shared';
import type { AIService } from '@ai-agent-platform/ai';
import { FanLeaderboardResolver } from '@ai-agent-platform/core';
import {
  chatSessionStore,
  memoryService,
  conversationMemoryStore,
} from '@ai-agent-platform/integrations';
import { generateChatResponse } from './chat.js';
import { generateAskResponse } from './ask.js';
import { classifyIntent, type RouteDecision } from './router.js';
import { safetyGuard } from './guard.js';
import { splitForEmbeds } from './embed-reply.js';
import { lilyChatService, type LilyChatResponse } from './automation/lily-chat-service.js';
import { dmMemoryStore } from './automation/dm-memory.js';

const logger = createLogger('Discord-DM');

/**
 * Checks whether a Discord message is a Direct Message (DM).
 * In Discord.js v14, DM channels have no guild and return true for isDMBased().
 */
export function isDirectMessage(message: Message): boolean {
  if (message.guild || message.guildId) {
    return false;
  }
  return typeof message.channel?.isDMBased === 'function' ? message.channel.isDMBased() : true;
}

export interface HandleDirectMessageOptions {
  routerService?: AIService;
  askGenerator?: (options: {
    userId: string;
    channelId: string;
    question: string;
    domainGuard?: boolean;
    bypassTopicCheck?: boolean;
  }) => Promise<string>;
  chatGenerator?: (options: {
    userId: string;
    channelId: string;
    message: string;
    subcommand?: 'speak' | 'reply' | 'auto';
  }) => Promise<string>;
  useLegacyChat?: boolean;
}

/**
 * Sends a message to the direct message channel, chunking if necessary.
 */
async function sendDirectMessageResponse(message: Message, text: string): Promise<void> {
  const chunks = splitForEmbeds(text, 1950);
  const parts = chunks.length > 0 ? chunks : [text];

  for (const part of parts) {
    const channel = message.channel as any;
    if (channel && typeof channel.send === 'function') {
      await channel.send(part);
    } else if (typeof message.reply === 'function') {
      await message.reply(part);
    }
  }
}

/**
 * Dedicated handler for incoming Direct Messages.
 * Orchestrates LilyChatService intelligence as the main DM feature,
 * typing indicator, fan queries, safety guards, and conversation continuity.
 */
export async function handleDirectMessage(
  message: Message,
  options?: HandleDirectMessageOptions
): Promise<void> {
  // Guard 1: Ignore messages from bots or webhooks
  if (message.author?.bot) {
    return;
  }

  // Guard 2: Verify message is indeed a DM
  if (!isDirectMessage(message)) {
    return;
  }

  const userId = message.author?.id || 'unknown';
  const username = message.author?.username || 'Trainer';
  const content = (message.content || '').trim();
  const sessionId = `discord-dm:${userId}`;

  logger.info(`[DM Received] User ID: ${userId} (${username}) | Content: "${content}"`);

  // Trigger typing indicator
  const channel = message.channel as any;
  if (channel && typeof channel.sendTyping === 'function') {
    try {
      await channel.sendTyping();
    } catch (typingErr: any) {
      logger.debug(`sendTyping failed: ${typingErr?.message}`);
    }
  }

  // 1. Safety Guard Check
  const blocked = safetyGuard(content);
  if (blocked) {
    const safetyMsg = "I can't help with that. Let's keep our conversations friendly and safe! 🐎";
    await sendDirectMessageResponse(message, safetyMsg);
    return;
  }

  // 2. Fan & Leaderboard Direct Intent Check (Domain Resolver)
  try {
    const fanResolver = new FanLeaderboardResolver();
    const fanIntent = fanResolver.detectIntent(content);
    if (fanIntent === 'fan_gain' || fanIntent === 'leaderboard') {
      const fanReply = await fanResolver.formatLeaderboardResponse(userId, content);
      await sendDirectMessageResponse(message, fanReply);
      return;
    }
  } catch (fanErr: any) {
    logger.warn(`Fan query handling error for ${userId}: ${fanErr?.message}; continuing to AI routing`);
  }

  // 3. Update Conversation & Session Tracking for DM Context Continuity
  try {
    const session = await chatSessionStore.getSession(userId);
    if (!session) {
      await chatSessionStore.openSession(userId, sessionId);
    } else {
      await chatSessionStore.bumpTurn(userId);
    }
    dmMemoryStore.addMessage(userId, 'user', content);
  } catch (sessErr: any) {
    logger.warn(`Session/memory update skipped for user ${userId}: ${sessErr?.message}`);
  }

  // 4. Main Feature: LilyChatService Conversational Engine (or injected test generator)
  let response: string;
  try {
    if (options?.chatGenerator || options?.useLegacyChat) {
      // Injected generator / legacy chat option (for custom tests & overrides)
      const chatFn = options?.chatGenerator ?? generateChatResponse;
      const session = await chatSessionStore.getSession(userId);
      response = await chatFn({
        userId,
        channelId: sessionId,
        message: content,
        subcommand: session ? 'reply' : 'speak',
      });
    } else if (options?.askGenerator) {
      // Injected ask generator
      response = await options.askGenerator({
        userId,
        channelId: sessionId,
        question: content,
        domainGuard: false,
        bypassTopicCheck: true,
      });
    } else {
      // Main Feature: Enterprise LilyChatService Conversational Intelligence
      const lilyResult: LilyChatResponse = await lilyChatService.generateResponse({
        userId,
        username,
        message: content,
      });
      response = lilyResult.content;
      logger.info(
        `[LilyChatService DM] Model=${lilyResult.activeModel} Key=${lilyResult.activeKeyIndex} Latency=${lilyResult.latencyMs}ms Cached=${Boolean(lilyResult.cached)}`
      );
    }

    // Persist turn across memory stores
    dmMemoryStore.addMessage(userId, 'assistant', response);
    await memoryService.saveUserMessage(userId, content, sessionId).catch(() => {});
    await memoryService.saveAssistantMessage(userId, response, sessionId).catch(() => {});

    await sendDirectMessageResponse(message, response);
    logger.info(`[DM Replied] Successfully responded to user ${userId} via LilyChatService`);
  } catch (err: any) {
    logger.error(`Error processing DM for user ${userId}: ${err?.message ?? err}`);
    const fallbackMsg = "Sorry, I couldn't process your message right now.";
    await sendDirectMessageResponse(message, fallbackMsg);
  }
}


