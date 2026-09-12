import { LilyChatContext } from './chat-context.js';
import { LILY_PERSONALITY } from './personality.js';
import { TrainerFormatter } from '../../tools/trainer/index.js';
import { LeaderboardFormatter } from '../../tools/leaderboard/index.js';
import { LinkFormatter } from '../../tools/link/index.js';

export interface PromptPayload {
  systemPrompt: string;
  userPrompt: string;
}

export class PromptBuilder {
  public build(context: LilyChatContext): PromptPayload {
    let systemPrompt = LILY_PERSONALITY;
    let userPrompt = `User Message: "${context.request.message}"\n\n`;

    // Inject active context boundaries
    systemPrompt += `\n[CONTEXT]\n`;
    systemPrompt += `Detected Intent: ${context.language.intent}\n`;
    
    if (context.memory.trainerId) {
      systemPrompt += `Trainer ID: ${context.memory.trainerId}\n`;
    }

    if (context.toolResult) {
      systemPrompt += `\n[TOOL RESULT]\n`;
      if (context.toolResult.success) {
        systemPrompt += `Tool Execution Succeeded.\nData: ${JSON.stringify(context.toolResult.data)}\n`;
        
        // Add fan response formatting guidelines if fan data is present
        const data = context.toolResult.data;
        if (data.gainedToday !== undefined && data.totalFans !== undefined) {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"Trainer, you gained ${(data.gainedToday / 1_000_000).toFixed(1)}M fans today.\nYour total is now ${(data.totalFans / 1_000_000).toFixed(1)}M fans."\n`;
        } else if (data.deficit !== undefined && data.requiredDailyGain !== undefined) {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"Trainer, you're currently ${(data.deficit / 1_000_000).toFixed(1)}M fans behind the minimum pace.\nTo recover, you'll need about ${(data.requiredDailyGain / 1_000_000).toFixed(1)}M fans per day."\n`;
        } else if (data.surplus !== undefined && data.projectedMonthEnd !== undefined) {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"Trainer, you are currently ${(data.surplus / 1_000_000).toFixed(1)}M fans ahead of pace!\nProjected month-end total: ${(data.projectedMonthEnd / 1_000_000).toFixed(1)}M fans."\n`;
        } else if (data.projectedFans !== undefined) {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"Trainer, based on your current pace, you are projected to reach ${(data.projectedFans / 1_000_000).toFixed(1)}M fans by month-end (Milestone: ${data.projectedMilestone})."\n`;
        } else if (data.currentMilestone !== undefined) {
          const nextTarget = data.nextMilestone ? `Next target:\n${data.nextMilestone}.\nRemaining: ${(data.remainingFans / 1_000_000).toFixed(1)}M fans.` : 'You have reached the maximum milestone!';
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"Congratulations!\nYou've reached the ${data.currentMilestone} milestone.\n\n${nextTarget}"\n`;
        } else if (context.language.intent === 'link_request' || (context.selectedTool === 'LinkRequestTool' && context.language.intent !== 'link_status')) {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"${LinkFormatter.formatRequest(data)}"\n`;
        } else if (context.language.intent === 'link_status' || context.selectedTool === 'LinkStatusTool') {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"${LinkFormatter.formatStatus(data)}"\n`;
        } else if (context.language.intent === 'link_help') {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"To link your Discord account to your Umamusume trainer account, I'll need your **Trainer Name** and **Trainer ID**.\n\nOnce you provide these, I'll submit a request to our club leaders for approval. You can check your status anytime by asking \\"Is my link request approved?\\""\n`;
        } else if (context.language.intent === 'trainer_link_status') {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"${TrainerFormatter.formatLinkStatus(data)}"\n`;
        } else if (context.language.intent === 'trainer_lookup') {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"${TrainerFormatter.formatLookup(data, context.language.trainerId)}"\n`;
        } else if (context.language.intent === 'trainer_profile' || context.language.intent === 'trainer_search') {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"${TrainerFormatter.formatProfile(data)}"\n`;
        } else if (context.language.intent === 'member_rank') {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"${LeaderboardFormatter.formatMemberRank(data)}"\n`;
        } else if (
          context.language.intent === 'top_members' ||
          context.language.intent === 'leaderboard' ||
          context.language.intent === 'fan_leaderboard'
        ) {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"${LeaderboardFormatter.formatLeaderboard(data)}"\n`;
        } else if (context.language.intent === 'club_stats') {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"${LeaderboardFormatter.formatClubStats(data)}"\n`;
        } else if (data.rank !== undefined && data.totalMembers !== undefined) {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"${LeaderboardFormatter.formatMemberRank(data)}"\n`;
        } else if (data.entries !== undefined) {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"${LeaderboardFormatter.formatLeaderboard(data)}"\n`;
        } else if (data.memberCount !== undefined && data.totalFans !== undefined) {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"${LeaderboardFormatter.formatClubStats(data)}"\n`;
        } else if (data.trainerId !== undefined && data.trainerName !== undefined && data.linked !== undefined) {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"${TrainerFormatter.formatProfile(data)}"\n`;
        } else if (data.unlinkedNotice) {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"Trainer, I couldn't find a linked trainer profile.\n\nYou can start a link request anytime."\n`;
        } else if (data.linked !== undefined) {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"${TrainerFormatter.formatLinkStatus(data)}"\n`;
        } else if (data.source === 'handbook' && data.results) {
          systemPrompt += `\n[FORMATTING TEMPLATE]\nFormat as:\n"According to the Umakraft Handbook:\n\n[Section Title]\n[Content]"\n`;
          if (data.results.length > 0) {
            systemPrompt += `\n[HANDBOOK DATA]\n`;
            for (const res of data.results) {
              systemPrompt += `Section: ${res.section}\nTitle: ${res.title}\nContent: ${res.content}\n\n`;
            }
          }
        }

        userPrompt += `(Use the tool data and formatting template above to answer the user's request.)`;
      } else {
        systemPrompt += `Tool Execution Failed: ${context.toolResult.error}\n`;
        userPrompt += `(Explain that the system encountered an error fulfilling this request.)`;
      }
    } else if (context.knowledge) {
      systemPrompt += `\n[KNOWLEDGE RESULT]\n`;
      systemPrompt += `Source: ${context.knowledge.source}\nDomain: ${context.knowledge.domain}\n`;
      // Note: In A7/actual runtime, actual retrieved text from uma.guide would be injected here.
      // For now, we inform the prompt of the source classification.
      userPrompt += `(Explain the mechanics/lore based on the knowledge context.)`;
    } else {
      userPrompt += `(Respond naturally to this conversation.)`;
    }

    return {
      systemPrompt,
      userPrompt
    };
  }
}
