import { createLogger } from '@ai-agent-platform/shared';
import { toolRegistry } from '@ai-agent-platform/core';
import { allTools } from '@ai-agent-platform/tools';
import { allIntegrations } from '@ai-agent-platform/integrations';
import { allDomainTools as fanTrackerTools } from '@ai-agent-platform/fan-tracker';
import { allDomainTools as prMonitorTools } from '@ai-agent-platform/pr-monitor';

export const logger = createLogger('Discord-Bot');

export function registerAllTools(): void {
  for (const tool of [...allTools]) {
    toolRegistry.register(tool);
  }
  for (const integration of allIntegrations) {
    toolRegistry.register(integration);
  }
  for (const domainTool of [...fanTrackerTools, ...prMonitorTools]) {
    toolRegistry.register(domainTool);
  }

  logger.info(`Registered ${toolRegistry.getDeclarativeSchemas().length} tools in Discord bot.`);
}
