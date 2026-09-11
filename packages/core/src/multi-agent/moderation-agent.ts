import { BaseAgent } from './base-agent.js';
import type { AgentInput, AgentOutput, IAgentOrchestrator } from './types.js';
import { moderationLogStore } from '@ai-agent-platform/integrations';

export const MODERATION_AGENT_SYSTEM_PROMPT = `You are the specialized Moderation & Content Safety Agent for the Umakraft Discord community.
Your role is to evaluate messages, enforce server safety standards, review potential policy violations, and provide structured moderation recommendations.

Policy Guidelines:
1. Detect and flag hate speech, harassment, severe toxicity, explicit NSFW content, and malicious exploits.
2. Evaluate severity: Low, Medium, High, or Critical.
3. Provide actionable moderation recommendations (e.g. Warning, Message Removal, Timeout, or No Action Needed).
4. Provide structured, objective rationales.`;

export class ModerationAgent extends BaseAgent {
  public readonly id = 'moderation-agent';
  public readonly name = 'Moderation Agent';
  public readonly description = 'Reviews content safety, enforces moderation policies, identifies violations, and logs audit records.';
  public readonly allowedTools: string[] = [];

  public async canHandle(input: AgentInput): Promise<number> {
    const text = input.message.toLowerCase();

    // High confidence triggers
    const strongPatterns = [
      /\b(moderate|moderation|mod review|check safety|policy violation|inappropriate|toxic|report user|ban|mute|kick|warn user)\b/i,
      /\b(is this allowed|is this safe|review this message)\b/i,
      /\b(moderation log|safety audit|audit log)\b/i,
    ];

    for (const pattern of strongPatterns) {
      if (pattern.test(text)) {
        return 0.95;
      }
    }

    return 0.05;
  }

  public async execute(input: AgentInput, orchestrator?: IAgentOrchestrator): Promise<AgentOutput> {
    const startTime = Date.now();
    this.logger.info(`[ModerationAgent] Processing moderation task for user ${input.userId}: "${input.message}"`);

    try {
      const prompt = `${MODERATION_AGENT_SYSTEM_PROMPT}\n\nUser Message to Evaluate:\n"${input.message}"\n\nContext:\n${input.context || 'None'}\n\nPlease output a structured moderation assessment.`;

      const assessment = await this.aiService.generate({
        prompt,
        maxTokens: 500,
      });

      // Log moderation evaluation to the audit store
      try {
        await moderationLogStore.append(
          input.userId,
          input.channelId || 'unknown',
          input.message
        );
      } catch (logErr: any) {
        this.logger.warn(`[ModerationAgent] Failed to write moderation log: ${logErr?.message}`);
      }

      const durationMs = Date.now() - startTime;

      return {
        agentId: this.id,
        agentName: this.name,
        answer: assessment,
        status: 'completed',
        toolsUsed: [],
        durationMs,
        metadata: {
          evaluatedAt: new Date().toISOString(),
          targetUserId: input.userId,
        },
      };
    } catch (err: any) {
      this.logger.error(`[ModerationAgent] Execution failed: ${err?.message ?? err}`);
      return {
        agentId: this.id,
        agentName: this.name,
        answer: 'Moderation review could not be completed at this time.',
        status: 'failed',
        toolsUsed: [],
        durationMs: Date.now() - startTime,
        error: err?.message ?? String(err),
      };
    }
  }
}
