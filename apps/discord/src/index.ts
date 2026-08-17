import { PLATFORM_NAME } from '@ai-agent-platform/shared';
import { registerAllTools, logger } from './bootstrap.js';
import { startGatewayBot } from './gateway.js';
import { startSimulator } from './simulator.js';

async function startBot() {
  const token = process.env['DISCORD_BOT_TOKEN'];
  const clientId = process.env['DISCORD_CLIENT_ID'];
  const umaKey = process.env['UMAMOE_API_KEY'];
  const circleIds = (process.env['UMAMOE_CIRCLE_IDS'] || process.env['UMAMOE_CIRCLE_ID'] || '974470619,325938032').split(',').map(s => s.trim());

  logger.info('='.repeat(50));
  logger.info(`Starting ${PLATFORM_NAME} Discord Service...`);
  logger.info('='.repeat(50));
  logger.info(`uma.moe API: ${umaKey ? '✅ key configured' : '⚠️ no key — may hit rate limits'}`);
  logger.info(`Circle IDs: ${circleIds.join(', ')}`);

  registerAllTools();

  if (token && clientId) {
    await startGatewayBot();
  } else {
    if (token && !clientId) {
      logger.warn('DISCORD_BOT_TOKEN is set but DISCORD_CLIENT_ID is missing.');
      logger.warn('Both are required for Gateway mode. Falling back to simulator.');
    }
    startSimulator();
  }
}

startBot();
