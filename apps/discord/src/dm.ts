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
import { routeMessage } from './domain-router.js';
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

  // 2. Centralized Domain Router Check (Phase D2)
  const routeDecision = await routeMessage({
    userId,
    message: content,
    recentHistory: dmMemoryStore.getHistory(userId),
  });

  logger.info(`[Domain Router Decision] Domain: ${routeDecision.domain} | Confidence: ${routeDecision.confidence} | Handler: ${routeDecision.handler} | Reason: ${routeDecision.reason}`);

  // Single Ownership Rule: Execute ONLY the winning handler
  if (routeDecision.domain === 'FAN_GAIN' || routeDecision.domain === 'FAN_LEADERBOARD') {
    try {
      const fanResolver = new FanLeaderboardResolver();
      const fanReply = await fanResolver.formatLeaderboardResponse(userId, content);
      await sendDirectMessageResponse(message, fanReply);
      return;
    } catch (fanErr: any) {
      logger.warn(`Fan query handling error for ${userId}: ${fanErr?.message}; falling back to chat`);
    }
  }

  if (routeDecision.domain === 'LINK_REQUEST') {
    const linkMsg = "Trainer, to link your account, please use the settings menu in the Umakraft web app or execute `/link` in your authorized server! 🐎";
    await sendDirectMessageResponse(message, linkMsg);
    return;
  }

  // 3. Update Conversation & Session Tracking for DM Context Continuity
  const existingSession = await chatSessionStore.getSession(userId).catch(() => null);
  const isNewSession = !existingSession;
  dmMemoryStore.addMessage(userId, 'user', content);

  // 4. Main Feature: Conversational Engine (or injected test generator)
  let response: string;
  try {
    if (options?.chatGenerator) {
      if (isNewSession) {
        await chatSessionStore.openSession(userId, sessionId);
      } else {
        await chatSessionStore.bumpTurn(userId);
      }
      response = await options.chatGenerator({
        userId,
        channelId: sessionId,
        message: content,
        subcommand: isNewSession ? 'speak' : 'reply',
      });
      await conversationMemoryStore.record(userId, sessionId, 'user', content).catch(() => {});
      await conversationMemoryStore.record(userId, sessionId, 'assistant', response).catch(() => {});
    } else if (options?.askGenerator) {
      if (isNewSession) {
        await chatSessionStore.openSession(userId, sessionId);
      } else {
        await chatSessionStore.bumpTurn(userId);
      }
      response = await options.askGenerator({
        userId,
        channelId: sessionId,
        question: content,
        domainGuard: false,
        bypassTopicCheck: true,
      });
      await conversationMemoryStore.record(userId, sessionId, 'user', content).catch(() => {});
      await conversationMemoryStore.record(userId, sessionId, 'assistant', response).catch(() => {});
    } else {
      // Route through existing conversational intelligence engine (which handles session open/bump & memory persistence)
      response = await generateChatResponse({
        userId,
        channelId: sessionId,
        message: content,
        subcommand: isNewSession ? 'speak' : 'reply',
      });
    }

    // Persist turn in DM memory store
    dmMemoryStore.addMessage(userId, 'assistant', response);

    await sendDirectMessageResponse(message, response);
    logger.info(`[DM Replied] Successfully responded to user ${userId}`);
  } catch (err: any) {
    logger.error(`Error processing DM for user ${userId}: ${err?.message ?? err}`);
    const fallbackMsg = "Sorry, I couldn't process your message right now.";
    await sendDirectMessageResponse(message, fallbackMsg);
  }
}


