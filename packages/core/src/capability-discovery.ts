import { createLogger } from '@ai-agent-platform/shared';
import { ToolRegistry, ToolCapability } from './tool-registry.js';

const logger = createLogger('ToolCapabilityDiscovery');

export interface DynamicCapabilityMap {
  category: string;
  tools: ToolCapability[];
}

export interface ToolSelfAuditReport {
  registeredToolCount: number;
  activeCategories: string[];
  unusedTools: string[];
  rarelyUsedTools: string[];
  capabilityAreasCovered: string[];
}

export class ToolCapabilityDiscovery {
  private static instance: ToolCapabilityDiscovery;
  private usageTracker: Map<string, number> = new Map();

  public static getInstance(): ToolCapabilityDiscovery {
    if (!ToolCapabilityDiscovery.instance) {
      ToolCapabilityDiscovery.instance = new ToolCapabilityDiscovery();
    }
    return ToolCapabilityDiscovery.instance;
  }

  /**
   * Tracks execution count for a tool to detect unused / rarely used tools.
   */
  public trackUsage(slug: string): void {
    const current = this.usageTracker.get(slug) || 0;
    this.usageTracker.set(slug, current + 1);
  }

  /**
   * Dynamically groups all registered tools by capability category.
   */
  public getCapabilityMap(): DynamicCapabilityMap[] {
    const registry = ToolRegistry.getInstance();
    const capabilities = registry.getCapabilities();

    const categoryMap = new Map<string, ToolCapability[]>();
    for (const cap of capabilities) {
      const cat = cap.category || 'General';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat)!.push(cap);
    }

    const map: DynamicCapabilityMap[] = [];
    for (const [category, tools] of categoryMap.entries()) {
      map.push({ category, tools });
    }
    return map;
  }

  /**
   * Generates a dynamic capability summary for injection into LLM system prompts.
   * This ensures newly registered tools are automatically visible to the AI without hardcoding!
   */
  public generateCapabilityPromptSummary(): string {
    const capMap = this.getCapabilityMap();
    if (capMap.length === 0) {
      return 'No dynamic capabilities currently registered.';
    }

    const lines: string[] = ['## Dynamically Discovered Capabilities & Tools:'];
    for (const group of capMap) {
      lines.push(`\n### Category: ${group.category}`);
      for (const tool of group.tools) {
        const auth = tool.authority ? ` | Authority: ${tool.authority.toUpperCase()} (${tool.authorityScore || 10}/10)` : '';
        const whenUse = tool.whenToUse ? ` | Use when: ${tool.whenToUse}` : '';
        lines.push(`- **\`${tool.id}\`**: ${tool.description}${auth}${whenUse}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Self-Audit report detecting unused or rarely used tools in the ecosystem.
   */
  public performSelfAudit(): ToolSelfAuditReport {
    const registry = ToolRegistry.getInstance();
    const capabilities = registry.getCapabilities();

    const unusedTools: string[] = [];
    const rarelyUsedTools: string[] = [];
    const categoriesSet = new Set<string>();

    for (const cap of capabilities) {
      categoriesSet.add(cap.category || 'General');
      const count = this.usageTracker.get(cap.id) || 0;
      if (count === 0) {
        unusedTools.push(cap.id);
      } else if (count < 2) {
        rarelyUsedTools.push(`${cap.id} (${count} use)`);
      }
    }

    logger.info(
      `[Self-Audit] Total Tools: ${capabilities.length} | Unused: ${unusedTools.length} | Rarely Used: ${rarelyUsedTools.length}`,
    );

    return {
      registeredToolCount: capabilities.length,
      activeCategories: Array.from(categoriesSet),
      unusedTools,
      rarelyUsedTools,
      capabilityAreasCovered: Array.from(categoriesSet),
    };
  }
}

export const capabilityDiscovery = ToolCapabilityDiscovery.getInstance();
