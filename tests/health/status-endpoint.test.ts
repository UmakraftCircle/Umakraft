import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import { HealthCollector, HealthAnalyzer, createHealthEvent } from '@ai-agent-platform/health';

describe('API Status Endpoint', () => {
  it('returns overall uptime and service status using health library', async () => {
    const collector = new HealthCollector();
    const analyzer = new HealthAnalyzer(collector);

    collector.registerService({ name: 'api', version: '1.0.0' });
    collector.registerService({ name: 'discord-bot', version: '1.0.0' });

    // Lightweight mock server simulating the apps/api/src/index.ts status endpoint logic
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname === '/status' || url.pathname === '/health/status') {
        const health = analyzer.context();
        const overallStatus =
          health.score.status === 'critical'
            ? 'degraded'
            : health.score.status === 'warning'
            ? 'degraded'
            : 'healthy';

        const payload = {
          status: overallStatus,
          uptime: process.uptime(),
          services: health.services,
          serviceStatus: Object.fromEntries(health.services.map((s) => [s.name, s.status])),
          healthScore: health.score,
          platform: 'AI Agent Platform',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          ...health,
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      for (const endpoint of ['/status', '/health/status']) {
        const response = await fetch(`${baseUrl}${endpoint}`);
        assert.equal(response.status, 200);

        const data = await response.json();
        assert.ok(typeof data.uptime === 'number' && data.uptime >= 0, 'uptime must be a non-negative number');
        assert.equal(data.status, 'healthy');
        assert.ok(Array.isArray(data.services), 'services must be an array');
        assert.equal(data.services.length, 2);
        assert.equal(data.serviceStatus.api, 'healthy');
        assert.equal(data.serviceStatus['discord-bot'], 'healthy');
        assert.ok(data.healthScore.score > 0);
      }

      // When an error event is ingested, service status changes
      collector.ingest(createHealthEvent({
        service: 'discord-bot',
        level: 'error',
        message: 'gateway connection dropped',
      }));

      const degradedResponse = await fetch(`${baseUrl}/status`);
      const degradedData = await degradedResponse.json();
      assert.equal(degradedData.serviceStatus['discord-bot'], 'unhealthy');
      assert.equal(degradedData.status, 'degraded');
    } finally {
      server.close();
    }
  });
});
