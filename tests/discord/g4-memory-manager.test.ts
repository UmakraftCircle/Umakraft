import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { memoryManagerService, MemoryType } from '../../apps/discord/src/memory-manager.js';

describe('G4 — Memory Manager Service Tests', () => {
  beforeEach(() => {
    memoryManagerService.clear();
  });

  it('1. Classifies and extracts favorite Umamusume into PREFERENCE memory', () => {
    const trainerId = 'trainer-100';
    const extracted = memoryManagerService.classifyAndExtract(trainerId, "My favorite Umamusume is Rice Shower");

    assert.equal(extracted.length, 1);
    assert.equal(extracted[0].key, 'favoriteUma');
    assert.equal(extracted[0].value, 'Rice Shower');
    assert.equal(extracted[0].type, MemoryType.PREFERENCE);
    assert.equal(extracted[0].confidence, 0.95);

    const storedValue = memoryManagerService.getTrainerMemory(trainerId, 'favoriteUma');
    assert.equal(storedValue, 'Rice Shower');
  });

  it('2. Classifies and extracts trainer ID into PROFILE memory', () => {
    const trainerId = 'trainer-200';
    const extracted = memoryManagerService.classifyAndExtract(trainerId, "My trainer ID is 987654321");

    assert.equal(extracted.length, 1);
    assert.equal(extracted[0].key, 'trainerId');
    assert.equal(extracted[0].value, '987654321');
    assert.equal(extracted[0].type, MemoryType.PROFILE);

    const allMemories = memoryManagerService.getAllTrainerMemories(trainerId);
    assert.equal(allMemories.trainerId, '987654321');
  });

  it('3. Ignores random small talk/non-stable messages', () => {
    const trainerId = 'trainer-300';
    const extracted = memoryManagerService.classifyAndExtract(trainerId, "The weather is nice today and I love running.");

    assert.equal(extracted.length, 0);
  });

  it('4. Tracks and manages session recent entities', () => {
    const trainerId = 'trainer-400';
    memoryManagerService.classifyAndExtract(trainerId, "Tell me about Oguri Cap training");

    const session = memoryManagerService.getSessionMemory(trainerId);
    assert.ok(session);
    assert.ok(session.recentEntities.includes('Oguri Cap'));
  });

  it('5. Manages shared club memory independently', () => {
    memoryManagerService.setClubMemory('monthlyRequirement', '150 million fans');
    const req = memoryManagerService.getClubMemory('monthlyRequirement');
    assert.equal(req, '150 million fans');
  });
});
