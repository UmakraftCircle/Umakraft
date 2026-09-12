import { test } from 'node:test';
import assert from 'node:assert';
import { VisionService } from '../../packages/lily-ai/src/vision/index.js';

test('E1 — Vision Intelligence', async (t) => {
  const visionService = new VisionService();

  await t.test('E1.1 Training Screen Analysis', async () => {
    const result = await visionService.analyzeTrainingScreenshot('path/to/screenshot.jpg');
    assert.strictEqual(result.energy, 52);
    assert.strictEqual(result.stats.speed, 612);
  });
});
