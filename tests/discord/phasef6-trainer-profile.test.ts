import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { trainerProfileEngine } from '../../apps/discord/src/trainer-profile.js';

describe('Phase F6 — Trainer Relationship & Personalization Engine Tests', () => {
  beforeEach(() => {
    trainerProfileEngine.clearAll();
  });

  it('1. Detects COMPETITIVE archetype when query mentions leaderboard, rank, or gap', () => {
    const trainerId = 'trainer-comp-1';
    trainerProfileEngine.recordInteraction(trainerId, 'Show me the leaderboard ranking and gap to top players');
    const profile = trainerProfileEngine.getOrCreateProfile(trainerId);

    assert.equal(profile.interactionStyle, 'COMPETITIVE');
    assert.ok(profile.favoriteTopics.includes('leaderboards'));
  });

  it('2. Detects COLLECTOR archetype when query mentions character lore or favorite umamusume', () => {
    const trainerId = 'trainer-coll-1';
    trainerProfileEngine.recordInteraction(trainerId, 'Tell me about Smart Falcon support card lore');
    const profile = trainerProfileEngine.getOrCreateProfile(trainerId);

    assert.equal(profile.interactionStyle, 'COLLECTOR');
    assert.ok(profile.favoriteCharacters.includes('Smart Falcon'));
  });

  it('3. Detects ANALYST archetype when query mentions pace calculations or statistics', () => {
    const trainerId = 'trainer-analyst-1';
    trainerProfileEngine.recordInteraction(trainerId, 'Calculate my daily fan gain projection and pacing formula');
    const profile = trainerProfileEngine.getOrCreateProfile(trainerId);

    assert.equal(profile.interactionStyle, 'ANALYST');
    assert.equal(profile.preferredResponseLength, 'detailed');
  });

  it('4. Personalizes responses based on detected archetype (Competitive vs Casual)', () => {
    const compId = 'trainer-comp-2';
    trainerProfileEngine.recordInteraction(compId, 'Check my rank and leaderboard');
    const compResponse = trainerProfileEngine.personalizeResponse(compId, 'You are ranked 5th.', 'rank');
    assert.ok(compResponse.includes('closing the gap fast'));

    const casualId = 'trainer-casual-2';
    trainerProfileEngine.recordInteraction(casualId, 'Hello assistant');
    const casualResponse = trainerProfileEngine.personalizeResponse(casualId, 'You are ranked 5th.', 'rank');
    assert.ok(casualResponse.includes('Nice work!'));
  });
});
