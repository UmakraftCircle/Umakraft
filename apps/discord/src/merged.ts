import * as http from 'http';
import { createLogger, PLATFORM_NAME } from '@ai-agent-platform/shared';
import { handleRelay, setRelaySender } from '@ai-agent-platform/integrations';
import { startGatewayBot } from './gateway.js';

const logger = createLogger('Merged');
const PORT = Number(process.env['PORT'] || 3000);

function corsOrigin(): string {
  const env = process.env['CORS_ORIGIN'];
  if (env) return env;
  return process.env['NODE_ENV'] === 'production' ? '' : '*';
}

function json(res: http.ServerResponse, status: number, data: any): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin(),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

async function main(): Promise<void> {
  // 1. Boot the Discord gateway (this is the ONE gateway / token / session).
  const client = await startGatewayBot();

  // 2. Wire the relay reply sender to the live client (direct, in-process).
  setRelaySender(async (channelId: string, content: string) => {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} is not text-based or not found`);
    }
    const sent = await channel.send(content);
    return { message_id: sent.id };
  });
  logger.info('Relay reply sender wired to Discord client.');

  // 3. Start the HTTP server (health + relay) — Railway probes $PORT.
  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': corsOrigin(),
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end();
      return;
    }

    const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const path = parsed.pathname;
    const params: Record<string, string> = {};
    for (const [k, v] of parsed.searchParams) params[k] = v;

    // Health probe (unauthenticated) for Railway.
    if (path === '/health' && req.method === 'GET') {
      json(res, 200, { status: 'ok', platform: PLATFORM_NAME, uptime: process.uptime() });
      return;
    }

    // Relay routes (RELAY_TOKEN scoped).
    if (await handleRelay(req, res, path, params)) {
      return;
    }

    json(res, 404, { error: 'Not Found', path });
  });

  server.listen(PORT, () => {
    logger.info(`==================================================`);
    logger.info(`Umakraft merged process up`);
    logger.info(`  Discord gateway : ${client.user?.tag ?? 'connecting…'}`);
    logger.info(`  HTTP (health+relay) : http://localhost:${PORT}`);
    logger.info(`==================================================`);
  });

  const shutdown = () => {
    logger.info('Shutting down merged process...');
    client.destroy();
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error(`Merged process failed to start: ${err?.message ?? err}`);
  process.exit(1);
});
