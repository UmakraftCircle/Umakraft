import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FileAdapter,
  HealthAnalyzer,
  HealthCollector,
  createHealthEvent,
  collectCIHealth,
  collectDependencyHealth,
  collectDeploymentHealth,
  validateHealthEvent,
  validateHealthMetric,
} from '@ai-agent-platform/health';

describe('Health Domain', () => {
  it('validates events and rejects invalid levels', () => {
    assert.doesNotThrow(() => validateHealthEvent({
      service: 'api',
      level: 'info',
      message: 'started',
      createdAt: new Date().toISOString(),
    }));
    assert.throws(() => validateHealthEvent({ service: 'api', level: 'nope', message: 'bad' }));
  });

  it('validates metric ranges', () => {
    assert.doesNotThrow(() => validateHealthMetric({ service: 'api', errorRate: 0.2, cpuPercent: 50 }));
    assert.throws(() => validateHealthMetric({ service: 'api', errorRate: 2 }));
  });

  it('calculates a critical score for an unhealthy service', () => {
    const collector = new HealthCollector();
    collector.registerService({ name: 'api' });
    collector.ingest(createHealthEvent({ service: 'api', level: 'error', message: 'database unavailable' }));
    const score = new HealthAnalyzer(collector).score();
    assert.equal(score.status, 'critical');
    assert.ok(score.score < 80);
  });

  it('persists and restores a health snapshot atomically', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'umakraft-health-'));
    const filePath = join(directory, 'snapshot.json');
    const adapter = new FileAdapter(filePath);
    const collector = new HealthCollector();
    collector.heartbeat('api', '1.2.3');
    collector.ingest(createHealthEvent({ service: 'api', level: 'info', message: 'ready' }));
    await adapter.save(collector.exportState());

    const restored = await adapter.load();
    assert.equal(restored.services[0].name, 'api');
    assert.equal(restored.events[0].message, 'ready');
    assert.ok((await readFile(filePath, 'utf8')).startsWith('{'));
  });

  it('marks a service with an expired heartbeat as unknown', () => {
    const collector = new HealthCollector();
    collector.restore({
      services: [{ name: 'worker', version: '1', status: 'healthy', heartbeat: '2000-01-01T00:00:00.000Z' }],
      events: [],
      metrics: [],
    });
    assert.equal(collector.snapshot().services[0].status, 'unknown');
  });

  it('collects CI and Railway metadata without network access', () => {
    assert.equal(collectCIHealth({ CI: 'true', GITHUB_SHA: 'abc', GITHUB_REF_NAME: 'main', GITHUB_RUN_ID: '42' })[0].service, 'ci');
    assert.equal(collectDeploymentHealth({ RAILWAY_ENVIRONMENT: 'production', RAILWAY_DEPLOYMENT_ID: 'deploy-1' })[0].service, 'deployment');
  });

  it('checks workspace and lockfile presence from supplied metadata', () => {
    const results = collectDependencyHealth({ dependencies: {} }, {
      workspaceFileExists: false,
      lockfileExists: false,
      workspacePackageNames: ['@one/pkg', '@one/pkg'],
    });
    assert.ok(results.some((result) => result.message.includes('pnpm-workspace')));
    assert.ok(results.some((result) => result.message.includes('Duplicate')));
  });
});