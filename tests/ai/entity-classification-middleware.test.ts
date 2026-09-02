import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyUmamusumeEntity,
  validateBeforeSearch,
  createEntityClassificationMiddleware,
} from '../../packages/ai/src/index.js';

test('EntityClassificationMiddleware: Character classification (Special Week)', () => {
  const result = classifyUmamusumeEntity('Who is Special Week?');

  assert.equal(result.isTargetingKnownEntity, true);
  assert.equal(result.primaryType, 'character');
  assert.equal(result.canonicalEntity, 'Special Week');
  assert.ok(result.characterDetails);
  assert.equal(result.characterDetails?.japaneseName, 'スペシャルウィーク');
  assert.equal(result.characterDetails?.growthRates?.Stamina, '+20%');
  assert.ok(result.formatGuidance.includes('CHARACTER FORMAT GUIDANCE'));
  assert.ok(result.cleanSearchQuery.includes('Special Week umamusume'));
});

test('EntityClassificationMiddleware: Character classification (Oguri Cap)', () => {
  const result = classifyUmamusumeEntity('How to build Oguri Cap for Arima Kinen?');

  assert.equal(result.isTargetingKnownEntity, true);
  assert.equal(result.primaryType, 'character');
  assert.equal(result.canonicalEntity, 'Oguri Cap');
  assert.ok(result.characterDetails);
});

test('EntityClassificationMiddleware: Skill classification (Straightaway Spurt)', () => {
  const result = classifyUmamusumeEntity('What is Straightaway Spurt and when does it activate?');

  assert.equal(result.isTargetingKnownEntity, true);
  assert.equal(result.primaryType, 'skill');
  assert.equal(result.canonicalEntity, 'Straightaway Spurt');
  assert.ok(result.skillDetails);
  assert.equal(result.skillDetails?.classType, 'acceleration');
  assert.equal(result.skillDetails?.recommendedStrategy, 'End Closer (追込 / Oikomi)');
  assert.ok(result.skillDetails?.nativeBearers?.includes('Gold Ship'));
  assert.ok(result.formatGuidance.includes('SKILL FORMAT GUIDANCE'));
});

test('EntityClassificationMiddleware: Skill classification (Circle of Maestro)', () => {
  const result = classifyUmamusumeEntity('When does Circle of Maestro trigger?');

  assert.equal(result.isTargetingKnownEntity, true);
  assert.equal(result.primaryType, 'skill');
  assert.ok(result.canonicalEntity?.includes('Circle of Maestro'));
  assert.equal(result.skillDetails?.classType, 'recovery');
});

test('EntityClassificationMiddleware: GameTora enriched entities and URLs', () => {
  const charResult = classifyUmamusumeEntity('Tell me about Silence Suzuka growth rates');
  assert.equal(charResult.canonicalEntity, 'Silence Suzuka');
  assert.equal(charResult.primaryType, 'character');
  assert.equal(charResult.gametoraUrl, 'https://gametora.com/umamusume/characters/silence-suzuka');
  assert.ok(charResult.recommendedSources.some(s => s.includes('gametora.com')));

  const cardResult = classifyUmamusumeEntity('How good is SSR Kitasan Black?');
  assert.equal(cardResult.primaryType, 'support-card');
  assert.ok(cardResult.canonicalEntity?.includes('SSR Kitasan Black'));
  assert.equal(cardResult.supportCardDetails?.cardType, 'Speed');
  assert.ok(cardResult.formatGuidance.includes('SUPPORT CARD FORMAT GUIDANCE'));

  const skillResult = classifyUmamusumeEntity('Who should inherit Angling and Scheming?');
  assert.equal(skillResult.primaryType, 'skill');
  assert.equal(skillResult.canonicalEntity, 'Angling and Scheming');
  assert.equal(skillResult.skillDetails?.classType, 'acceleration');
});

test('EntityClassificationMiddleware: Track classification (Arima Kinen)', () => {
  const result = classifyUmamusumeEntity('What is the distance and turn profile of Arima Kinen?');

  assert.equal(result.isTargetingKnownEntity, true);
  assert.equal(result.primaryType, 'track');
  assert.equal(result.canonicalEntity, 'Arima Kinen');
  assert.ok(result.trackDetails);
  assert.equal(result.trackDetails?.distanceMeters, 2500);
  assert.equal(result.trackDetails?.surface, 'turf');
  assert.ok(result.formatGuidance.includes('TRACK FORMAT GUIDANCE'));
});

test('EntityClassificationMiddleware: validateBeforeSearch rejects off-topic queries in strict mode', () => {
  const offTopicQuery = 'How do I cook a pepperoni pizza in the oven?';
  const validation = validateBeforeSearch(offTopicQuery, { strictUmamusumeOnly: true });

  assert.equal(validation.valid, false);
  assert.ok(validation.reason?.includes('not target a recognized Umamusume'));
  assert.ok(validation.redirectSuggestion?.includes('Please rephrase'));
});

test('EntityClassificationMiddleware: validateBeforeSearch accepts known entity query', () => {
  const validation = validateBeforeSearch('Who has Straightaway Spurt skill?', { strictUmamusumeOnly: true });

  assert.equal(validation.valid, true);
  assert.equal(validation.classification.primaryType, 'skill');
  assert.ok(validation.formattedGuidelines.includes('SKILL FORMAT GUIDANCE'));
});

test('EntityClassificationMiddleware: createEntityClassificationMiddleware wraps search execution', async () => {
  const middleware = createEntityClassificationMiddleware({ strictUmamusumeOnly: true });

  let passedQuery = '';
  let passedType = '';

  const mockSearchTool = async (query: string, classification: any) => {
    passedQuery = query;
    passedType = classification.primaryType;
    return { results: [`Data found for ${query}`] };
  };

  const result = await middleware('Straightaway Spurt activation condition', mockSearchTool);

  assert.equal(passedQuery, 'Straightaway Spurt umamusume');
  assert.equal(passedType, 'skill');
  assert.deepEqual(result, { results: ['Data found for Straightaway Spurt umamusume'] });

  // Rejection test for off-topic query in middleware
  await assert.rejects(
    async () => {
      await middleware('What is the stock price of Apple?', mockSearchTool);
    },
    /not target a recognized Umamusume/
  );
});
