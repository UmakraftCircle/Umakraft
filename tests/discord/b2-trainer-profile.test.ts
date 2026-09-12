import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  createLilyAI,
  LilyLanguageService,
  LilyToolService,
  LilyMemoryService,
  LilyKnowledgeService,
  ToolRegistry,
  FanGainTool,
  TrainerProfileTool,
  TrainerLinkStatusTool,
  TrainerLookupTool,
  TrainerFormatter,
  DefaultTrainerDataProvider,
  TRAINER_DATA_SOURCE_RULE,
  FORBIDDEN_TRAINER_DATA_SOURCES
} from '../../packages/lily-ai/src/index.js';

describe('B2 — Trainer Profile Integration', () => {
  let dataProvider: DefaultTrainerDataProvider;
  let languageService: LilyLanguageService;
  let toolService: LilyToolService;
  let memoryService: LilyMemoryService;
  let knowledgeService: LilyKnowledgeService;

  beforeEach(() => {
    dataProvider = new DefaultTrainerDataProvider();
    languageService = new LilyLanguageService();
    memoryService = new LilyMemoryService();
    knowledgeService = new LilyKnowledgeService();

    // Register custom dataProvider tools to the registry
    const tools = [
      new TrainerProfileTool(dataProvider),
      new TrainerLinkStatusTool(dataProvider),
      new TrainerLookupTool(dataProvider),
      new FanGainTool()
    ];
    toolService = new LilyToolService(new ToolRegistry(tools));
  });

  describe('1. Language Intent Detection', () => {
    test('Detects trainer_profile intent for "show my profile"', () => {
      const analysis = languageService.analyze('show my profile');
      assert.strictEqual(analysis.intent, 'trainer_profile');
      assert.ok(analysis.confidence >= 0.9);
    });

    test('Detects trainer_profile intent for "my profile"', () => {
      const analysis = languageService.analyze('my profile');
      assert.strictEqual(analysis.intent, 'trainer_profile');
    });

    test('Detects trainer_link_status intent for "am i linked?"', () => {
      const analysis = languageService.analyze('am i linked?');
      assert.strictEqual(analysis.intent, 'trainer_link_status');
      assert.ok(analysis.confidence >= 0.9);
    });

    test('Detects trainer_link_status intent for "check link status"', () => {
      const analysis = languageService.analyze('check link status');
      assert.strictEqual(analysis.intent, 'trainer_link_status');
    });

    test('Detects trainer_lookup intent for "show trainer 123456"', () => {
      const analysis = languageService.analyze('show trainer 123456');
      assert.strictEqual(analysis.intent, 'trainer_lookup');
      assert.strictEqual(analysis.trainerId, '123456');
    });

    test('Detects trainer_lookup intent for "who is trainer 987654321"', () => {
      const analysis = languageService.analyze('who is trainer 987654321');
      assert.strictEqual(analysis.intent, 'trainer_lookup');
      assert.strictEqual(analysis.trainerId, '987654321');
    });

    test('Extracts trainer ID from "my trainer id is 123456"', () => {
      const analysis = languageService.analyze('my trainer id is 123456');
      assert.strictEqual(analysis.intent, 'trainer_profile');
      assert.strictEqual(analysis.trainerId, '123456');
    });
  });

  describe('2. Knowledge Rules Enforcement', () => {
    test('Classifies trainer requests under trainer_data domain', () => {
      const analysis = languageService.analyze('show my profile');
      const knowledgeAnalysis = knowledgeService.analyze(analysis);
      assert.strictEqual(knowledgeAnalysis.domain, 'trainer_data');
      assert.strictEqual(knowledgeAnalysis.source, 'database');
    });

    test('Strict rule: Trainer data source allows ONLY database', () => {
      assert.strictEqual(TRAINER_DATA_SOURCE_RULE.allowedSource, 'database');
      assert.strictEqual(knowledgeService.isSourceAllowedForTrainer('database'), true);
    });

    test('Strict rule: Trainer data is NEVER sourced from handbook, taxonomy, or web search', () => {
      for (const forbidden of FORBIDDEN_TRAINER_DATA_SOURCES) {
        assert.strictEqual(
          knowledgeService.isSourceAllowedForTrainer(forbidden),
          false,
          `Source '${forbidden}' must be strictly forbidden for trainer data`
        );
      }
    });
  });

  describe('3. Tool Execution & Formatting', () => {
    test('TrainerProfileTool returns profile for linked trainer', async () => {
      const tool = new TrainerProfileTool(dataProvider);
      const result = await tool.execute({
        trainerId: '123456',
        userId: 'user-rice'
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.trainerName, 'RiceEnjoyer');
      assert.strictEqual(result.data.trainerId, '123456');
      assert.strictEqual(result.data.linked, true);
      assert.strictEqual(result.data.clubName, 'Umakraft');

      const formatted = TrainerFormatter.formatProfile(result.data);
      assert.ok(formatted.includes('Trainer Profile'));
      assert.ok(formatted.includes('Name: RiceEnjoyer'));
      assert.ok(formatted.includes('Trainer ID: 123456'));
      assert.ok(formatted.includes('Status: Linked'));
      assert.ok(formatted.includes('Club: Umakraft'));
    });

    test('TrainerProfileTool returns unlinked notice for unknown trainer', async () => {
      const tool = new TrainerProfileTool(dataProvider);
      const result = await tool.execute({
        userId: 'unlinked-discord-user-999'
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.linked, false);
      assert.strictEqual(result.data.unlinkedNotice, true);

      const formatted = TrainerFormatter.formatProfile(result.data);
      assert.ok(formatted.includes("Trainer, I couldn't find a linked trainer profile."));
      assert.ok(formatted.includes('You can start a link request anytime.'));
    });

    test('TrainerLinkStatusTool returns linked status', async () => {
      const tool = new TrainerLinkStatusTool(dataProvider);
      const result = await tool.execute({
        userId: 'user-rice'
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.linked, true);
      assert.strictEqual(result.data.trainerId, '123456');

      const formatted = TrainerFormatter.formatLinkStatus(result.data);
      assert.ok(formatted.includes('Trainer, your account is currently linked.'));
      assert.ok(formatted.includes('Trainer ID: 123456'));
    });

    test('TrainerLinkStatusTool returns unlinked status', async () => {
      const tool = new TrainerLinkStatusTool(dataProvider);
      const result = await tool.execute({
        userId: 'unknown-discord-user'
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.linked, false);

      const formatted = TrainerFormatter.formatLinkStatus(result.data);
      assert.ok(formatted.includes("Trainer, I couldn't find a linked trainer profile."));
      assert.ok(formatted.includes('You can start a link request anytime.'));
    });

    test('TrainerLookupTool finds registered trainer', async () => {
      const tool = new TrainerLookupTool(dataProvider);
      const result = await tool.execute({
        language: {
          intent: 'trainer_lookup',
          confidence: 1,
          taxonomyMatches: [],
          entities: [{ value: '123456', type: 'trainer_id' }],
          normalizedMessage: 'show trainer 123456',
          trainerId: '123456'
        }
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.trainerName, 'RiceEnjoyer');
      assert.strictEqual(result.data.trainerId, '123456');

      const formatted = TrainerFormatter.formatLookup(result.data, '123456');
      assert.ok(formatted.includes('Name: RiceEnjoyer'));
      assert.ok(formatted.includes('Trainer ID: 123456'));
    });

    test('TrainerLookupTool formats not found message for unregistered trainer', async () => {
      const tool = new TrainerLookupTool(dataProvider);
      const result = await tool.execute({
        language: {
          intent: 'trainer_lookup',
          confidence: 1,
          taxonomyMatches: [],
          entities: [{ value: '999999', type: 'trainer_id' }],
          normalizedMessage: 'show trainer 999999',
          trainerId: '999999'
        }
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.notFound, true);

      const formatted = TrainerFormatter.formatLookup(result.data, '999999');
      assert.strictEqual(
        formatted,
        "Trainer, I couldn't find trainer 999999 in the database."
      );
    });
  });

  describe('4. Memory Continuity & Multi-turn Context ("Lily Already Knows")', () => {
    test('Remembers trainer identity across conversation turns without asking "Which trainer?"', async () => {
      const lily = createLilyAI(undefined, {
        languageService,
        memoryService,
        knowledgeService,
        toolService
      });

      const userId = 'discord-user-teio';

      // Turn 1: User introduces their trainer ID
      const turn1 = await lily.chat({
        userId,
        message: 'my trainer id is 123456'
      });

      assert.strictEqual(turn1.success, true);

      // Assert memory was updated with trainer context
      const memAfterTurn1 = await memoryService.getContext(userId);
      assert.strictEqual(memAfterTurn1.trainerId, '123456');
      assert.strictEqual(memAfterTurn1.trainerName, 'RiceEnjoyer');
      assert.strictEqual(memAfterTurn1.clubName, 'Umakraft');

      // Turn 2: User asks for profile without specifying trainer ID
      const turn2 = await lily.chat({
        userId,
        message: 'show my profile'
      });

      assert.strictEqual(turn2.success, true);
      assert.ok(turn2.response.includes('Trainer Profile'));
      assert.ok(turn2.response.includes('Name: RiceEnjoyer'));
      assert.ok(turn2.response.includes('Trainer ID: 123456'));

      // Turn 3: User asks for fan gain today - Lily already knows trainer 123456!
      const turn3 = await lily.chat({
        userId,
        message: 'how much fan did i gain today?'
      });

      assert.strictEqual(turn3.success, true);
      // Lily responds directly with fan gain stats for 123456, not asking "Which trainer?"
      assert.ok(turn3.response.includes('Trainer, you gained'));
      assert.ok(!turn3.response.includes('Which trainer?'));
    });

    test('Unlinked user asking for link status gets clear prompt to link', async () => {
      const lily = createLilyAI(undefined, {
        languageService,
        memoryService,
        knowledgeService,
        toolService
      });

      const unlinkedUser = 'discord-user-newbie';
      const response = await lily.chat({
        userId: unlinkedUser,
        message: 'am i linked?'
      });

      assert.strictEqual(response.success, true);
      assert.ok(response.response.includes("Trainer, I couldn't find a linked trainer profile."));
      assert.ok(response.response.includes('You can start a link request anytime.'));
    });

    test('Linked user asking "am i linked?" receives confirmation and trainer ID', async () => {
      const lily = createLilyAI(undefined, {
        languageService,
        memoryService,
        knowledgeService,
        toolService
      });

      const linkedUser = 'user-rice';
      const response = await lily.chat({
        userId: linkedUser,
        message: 'am i linked?'
      });

      assert.strictEqual(response.success, true);
      assert.ok(response.response.includes('Trainer, your account is currently linked.'));
      assert.ok(response.response.includes('Trainer ID: 123456'));
    });
  });
});
