import { test } from 'node:test';
import assert from 'node:assert';
import { FederationService, TrustLevel, PrivacyEngine } from '../../packages/lily-ai/src/federation/index.js';
import { FederationAgent } from '../../packages/lily-ai/src/agents/index.js';

test('E5 — Cross-Server Intelligence & Federation', async (t) => {
  const service = new FederationService();

  await t.test('E5.1 Data Sanitization & Privacy Engine', () => {
    const rawPayload = {
      nodeId: 'node_jp_east',
      trainerId: 'trainer_99999',
      discordId: 'discord_444444',
      username: 'SpecialistTrez',
      privateMessages: ['This is personal'],
      metaTrends: { 'Front Runner': 60 }
    };

    const sanitized = service.getExchange().prepareOutbound();
    
    // Test direct privacy engine sanitize
    const privacyEngine = new PrivacyEngine();
    const result = privacyEngine.sanitize(rawPayload);

    assert.strictEqual(result.trainerId, undefined);
    assert.strictEqual(result.discordId, undefined);
    assert.strictEqual(result.username, undefined);
    assert.strictEqual(result.privateMessages, undefined);
    assert.strictEqual(result.metaTrends['Front Runner'], 60);
  });

  await t.test('E5.2 Trust Scoring', () => {
    const trustEngine = service.getTrustEngine();
    assert.strictEqual(trustEngine.getWeightMultiplier(TrustLevel.VERIFIED), 1.0);
    assert.strictEqual(trustEngine.getWeightMultiplier(TrustLevel.UNKNOWN), 0.25);
    assert.strictEqual(trustEngine.getTrustLevelFromScore(95), TrustLevel.VERIFIED);
  });

  await t.test('E5.3 Federation Aggregation & Meta Sharing', () => {
    const trends = service.getFederatedMetaTrends({ 'Front Runner': 58, 'Pace Chaser': 20 });
    // Aggregation of 3 nodes: umakraft_sea (58), jp_east (68), na_west (62) with trust weights
    const frontRunnerTrend = trends.find(t => t.strategy === 'Front Runner');
    assert.ok(frontRunnerTrend);
    assert.strictEqual(frontRunnerTrend.localUsage, 58);
    // Weighted math: (58 * 1.0 + 68 * 0.8 + 62 * 0.5) / (1.0 + 0.8 + 0.5) = (58 + 54.4 + 31) / 2.3 = 143.4 / 2.3 = 62
    assert.strictEqual(frontRunnerTrend.federatedUsage, 62);
  });

  await t.test('E5.4 Parent Demand Sharing', () => {
    const demand = service.getFederatedParentDemand('Long Distance End Closer', 182, 37);
    assert.strictEqual(demand.lineage, 'Long Distance End Closer');
    // Summed requests over nodes
    assert.strictEqual(demand.requests, 182 + 120 + 62); // 364
    assert.strictEqual(demand.supply, 37 + 25 + 12); // 74
    assert.strictEqual(demand.shortageRisk, 'HIGH'); // requests (364) > supply (74) * 4
  });

  await t.test('E5.5 Benchmark Generation', () => {
    const benchmarks = service.generateBenchmarks(93, 82);
    const complianceBenchmark = benchmarks.find(b => b.metric === 'fanCompliance');
    assert.ok(complianceBenchmark);
    assert.strictEqual(complianceBenchmark.localValue, 93);
    // Average: umakraft_sea (93), jp_east (89), na_west (87) -> sum 269 / 3 = 90
    assert.strictEqual(complianceBenchmark.federatedAverage, 90);
  });

  await t.test('E5.6 FederationAgent Integration', async () => {
    const agent = new FederationAgent();
    const canHandle = await agent.canHandle({ input: 'show cross-server benchmarks', shared: {} });
    assert.strictEqual(canHandle, true);

    const result = await agent.execute({ input: 'show cross-server benchmarks', shared: {} });
    assert.strictEqual(result.success, true);
    assert.ok(result.output.includes('fanCompliance'));
  });
});
