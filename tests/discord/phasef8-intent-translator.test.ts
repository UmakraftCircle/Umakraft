import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { intentTranslator } from '../../apps/discord/src/intent-translator.js';
import { workflowEngine } from '../../apps/discord/src/workflow-engine.js';

describe('Phase F8 — Natural Language Task Creation & Agent Command Understanding Tests', () => {
  beforeEach(() => {
    workflowEngine.clearAll();
  });

  it('1. Extracts GOAL_TRACKING intent from "Track my 150M goal."', () => {
    const result = intentTranslator.parseAndExecute('trainer-1', 'Track my 150M goal.');
    assert.equal(result.isAmbiguous, false);
    assert.equal(result.intents.length, 1);
    assert.equal(result.intents[0].taskType, 'GOAL_TRACKING');
    assert.equal(result.intents[0].parameters.targetValue, 150_000_000);
  });

  it('2. Extracts RANKING_ALERT intent from "Tell me when I reach top 5."', () => {
    const result = intentTranslator.parseAndExecute('trainer-2', 'Tell me when I reach top 5.');
    assert.equal(result.isAmbiguous, false);
    assert.equal(result.intents.length, 1);
    assert.equal(result.intents[0].taskType, 'RANKING_ALERT');
    assert.equal(result.intents[0].parameters.rank, 5);
  });

  it('3. Extracts CLUB_MILESTONE_ALERT intent from "Notify me when the club reaches 5B."', () => {
    const result = intentTranslator.parseAndExecute('trainer-3', 'Notify me when the club reaches 5B.');
    assert.equal(result.isAmbiguous, false);
    assert.equal(result.intents.length, 1);
    assert.equal(result.intents[0].taskType, 'CLUB_MILESTONE_ALERT');
    assert.equal(result.intents[0].parameters.clubTarget, 5_000_000_000);
  });

  it('4. Parses multi-intent messages ("Track my 200M goal and tell me when I enter top 10.")', () => {
    const result = intentTranslator.parseAndExecute('trainer-4', 'Track my 200M goal and tell me when I enter top 10.');
    assert.equal(result.isAmbiguous, false);
    assert.equal(result.intents.length, 2);
    assert.equal(result.intents[0].parameters.targetValue, 200_000_000);
    assert.equal(result.intents[1].parameters.rank, 10);
  });

  it('5. Handles ambiguous messages ("Watch my progress") by requesting clarification', () => {
    const result = intentTranslator.parseAndExecute('trainer-5', 'Watch my progress');
    assert.equal(result.isAmbiguous, true);
    assert.equal(result.intents.length, 0);
    assert.ok(result.clarificationMessage?.includes('monitor your fan goal'));
  });
});
