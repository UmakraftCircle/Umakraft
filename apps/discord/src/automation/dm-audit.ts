import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('DMAuditStore');

export interface DMAuditRecord {
  id: string;
  timestamp: number;
  userId: string;
  userMessage: string;
  intent: string;
  intentConfidence: number;
  toolsConsidered: string[];
  selectedTools: string[];
  executionMs: number;
  resultsCount: number;
  verificationStatus: 'Verified' | 'Reasoned' | 'Unverified';
  confidence: 'High' | 'Medium' | 'Low';
  fallbackUsed: boolean;
  webSearchUsed: boolean;
  potentialHallucination: boolean;
  webSearchWatchdogAlert: boolean;
  reason: string;
  finalResponse: string;
  // Phase 12 Relationship & Trust Telemetry
  personalizationApplied?: boolean;
  goalReferenced?: boolean;
  memoryUsed?: boolean;
  achievementDetected?: boolean;
  trustLevelEvent?: string;
  // Phase 17 AI Provider Telemetry
  aiProvider?: string;
  aiModel?: string;
  aiLatencyMs?: number;
  aiFallbackUsed?: boolean;
  aiFallbackProvider?: string;
  aiErrorType?: string | null;
}

export interface DMAuditStats {
  totalAudits: number;
  toolUsageCounts: Record<string, number>;
  fallbackCount: number;
  fallbackRatePercentage: number;
  webSearchCount: number;
  webSearchWatchdogAlerts: number;
  potentialHallucinationCount: number;
  personalizationEventsCount: number;
  achievementsDetectedCount: number;
  verificationDistribution: {
    Verified: number;
    Reasoned: number;
    Unverified: number;
  };
}

export class DMAuditStore {
  private static instance: DMAuditStore;
  private auditLogs: DMAuditRecord[] = [];
  private readonly maxLogs = 500;

  public static getInstance(): DMAuditStore {
    if (!DMAuditStore.instance) {
      DMAuditStore.instance = new DMAuditStore();
    }
    return DMAuditStore.instance;
  }

  /**
   * Appends an audit record to the store and performs real-time self-diagnostics.
   */
  public recordAudit(record: DMAuditRecord): void {
    this.auditLogs.unshift(record);
    if (this.auditLogs.length > this.maxLogs) {
      this.auditLogs.pop();
    }

    // Diagnostics & Watchdog Logging
    if (record.webSearchWatchdogAlert) {
      logger.warn(
        `[WATCHDOG ALERT] Web search used for domain query! User: ${record.userId} | Intent: ${record.intent} | Message: "${record.userMessage}"`,
      );
    }

    if (record.potentialHallucination) {
      logger.warn(
        `[HALLUCINATION DETECTOR] Potential hallucination! User: ${record.userId} | Intent: ${record.intent} | No authoritative tool verified response.`,
      );
    }

    logger.info(
      `[telemetry] DM Audit Logged | ID: ${record.id} | Intent: ${record.intent} (${Math.round(
        record.intentConfidence * 100,
      )}%) | Tools: [${record.selectedTools.join(', ')}] | Status: ${record.verificationStatus} | Exec: ${
        record.executionMs
      }ms`,
    );
  }

  /**
   * Retrieves the most recent audit record for a given user.
   */
  public getLastAudit(userId: string): DMAuditRecord | null {
    return this.auditLogs.find((log) => log.userId === userId) ?? null;
  }

  /**
   * Formats the last audit record for admin `!debug why` query.
   */
  public formatDebugWhy(userId: string): string {
    const record = this.getLastAudit(userId);
    if (!record) {
      return `🔍 **DM Decision Diagnostics**\nNo recent audit records found for user ID \`${userId}\`.`;
    }

    const dateStr = new Date(record.timestamp).toISOString();
    return [
      `🔍 **DM Decision Audit Trail** (\`${record.id}\`)`,
      `• **Timestamp:** ${dateStr}`,
      `• **User Message:** "${record.userMessage}"`,
      `• **Intent Detected:** \`${record.intent}\` (${Math.round(record.intentConfidence * 100)}% confidence)`,
      `• **Considered Tools:** ${record.toolsConsidered.length > 0 ? record.toolsConsidered.map((t) => `\`${t}\``).join(', ') : 'None'}`,
      `• **Selected Tool(s):** ${record.selectedTools.length > 0 ? record.selectedTools.map((t) => `\`${t}\``).join(', ') : 'None (Direct Response)'}`,
      `• **Reason:** ${record.reason}`,
      `• **Execution Time:** ${record.executionMs}ms | **Results Count:** ${record.resultsCount}`,
      `• **Verification Status:** \`${record.verificationStatus}\` | **Confidence:** \`${record.confidence}\``,
      `• **Fallback Triggered:** \`${record.fallbackUsed}\` | **Web Search Used:** \`${record.webSearchUsed}\``,
      `• **Watchdog Alert:** ${record.webSearchWatchdogAlert ? '⚠️ ALERT (Web search used for domain topic)' : '✅ Normal'}`,
      `• **Hallucination Flag:** ${record.potentialHallucination ? '⚠️ POTENTIAL HALLUCINATION (Unverified factual claim)' : '✅ Clean'}`,
    ].join('\n');
  }

  /**
   * Returns aggregated usage telemetry and self-diagnostic analytics.
   */
  public getStats(): DMAuditStats {
    const totalAudits = this.auditLogs.length;
    const toolUsageCounts: Record<string, number> = {};
    let fallbackCount = 0;
    let webSearchCount = 0;
    let webSearchWatchdogAlerts = 0;
    let potentialHallucinationCount = 0;
    let personalizationEventsCount = 0;
    let achievementsDetectedCount = 0;
    const verificationDistribution = { Verified: 0, Reasoned: 0, Unverified: 0 };

    for (const log of this.auditLogs) {
      for (const tool of log.selectedTools) {
        toolUsageCounts[tool] = (toolUsageCounts[tool] || 0) + 1;
      }
      if (log.fallbackUsed) fallbackCount++;
      if (log.webSearchUsed) webSearchCount++;
      if (log.webSearchWatchdogAlert) webSearchWatchdogAlerts++;
      if (log.potentialHallucination) potentialHallucinationCount++;
      if (log.personalizationApplied || log.goalReferenced || log.memoryUsed) personalizationEventsCount++;
      if (log.achievementDetected) achievementsDetectedCount++;
      verificationDistribution[log.verificationStatus]++;
    }

    const fallbackRatePercentage = totalAudits > 0 ? Math.round((fallbackCount / totalAudits) * 100) : 0;

    return {
      totalAudits,
      toolUsageCounts,
      fallbackCount,
      fallbackRatePercentage,
      webSearchCount,
      webSearchWatchdogAlerts,
      potentialHallucinationCount,
      personalizationEventsCount,
      achievementsDetectedCount,
      verificationDistribution,
    };
  }
}

export const dmAuditStore = DMAuditStore.getInstance();
