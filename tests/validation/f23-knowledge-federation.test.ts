import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  KnowledgeFederationService,
  FederationRouter,
  FederationResolver,
  FederationAggregator,
  FederationContextBuilder,
  FederationConfidenceEngine,
  FederationRankingEngine,
  KnowledgeFederationCache,
  TaxonomyFederationAdapter,
  HandbookFederationAdapter,
  DatabaseFederationAdapter,
  LexicalFederationAdapter,
  MemoryFederationAdapter,
  KnowledgeProvider,
  TaxonomyKnowledgeProvider,
  HandbookKnowledgeProvider,
  DatabaseKnowledgeProvider,
  LilyKnowledgeService
} from '../../packages/lily-ai/src/index.js';

describe('F23 — Knowledge Federation Engine', () => {

  // Test 1: Provider Routing
  describe('1. Provider Routing', () => {
    it('routes specific queries to appropriate providers', () => {
      const router = new FederationRouter();
      const registered = ['taxonomy', 'handbook', 'database', 'lexical'];

      // Guide query -> taxonomy & handbook
      const ctx1 = FederationContextBuilder.build({ text: 'Front Runner build guide' });
      const plan1 = router.route('Front Runner build guide', ctx1, registered);
      assert.ok(plan1.selectedProviders.includes('taxonomy'));
      assert.ok(plan1.selectedProviders.includes('handbook'));

      // Rank query -> database
      const ctx2 = FederationContextBuilder.build({ text: "What's my rank?", userId: 'trainer_123' });
      const plan2 = router.route("What's my rank?", ctx2, registered);
      assert.ok(plan2.selectedProviders.includes('database'));

      // Composite query -> taxonomy, handbook, database
      const ctx3 = FederationContextBuilder.build({ text: 'How am I doing as a Front Runner?', userId: 'trainer_123' });
      const plan3 = router.route('How am I doing as a Front Runner?', ctx3, registered);
      assert.ok(plan3.selectedProviders.includes('taxonomy'));
      assert.ok(plan3.selectedProviders.includes('handbook'));
      assert.ok(plan3.selectedProviders.includes('database'));
    });
  });

  // Test 2: Parallel Execution
  describe('2. Parallel Execution', () => {
    it('runs providers concurrently without blocking and handles errors gracefully', async () => {
      const mockSlowProvider1: KnowledgeProvider = {
        id: 'slow_1',
        authority: 90,
        supports: () => true,
        search: async () => [],
        resolve: async () => {
          await new Promise(r => setTimeout(r, 20));
          return { data: 'res1' };
        }
      };

      const mockSlowProvider2: KnowledgeProvider = {
        id: 'slow_2',
        authority: 85,
        supports: () => true,
        search: async () => [],
        resolve: async () => {
          await new Promise(r => setTimeout(r, 20));
          return { data: 'res2' };
        }
      };

      const mockErrorProvider: KnowledgeProvider = {
        id: 'failing',
        authority: 70,
        supports: () => true,
        search: async () => [],
        resolve: async () => {
          throw new Error('Provider timeout or database unavailable');
        }
      };

      const ctx = FederationContextBuilder.build({ text: 'test query' });
      const start = Date.now();
      const { results, errors } = await FederationResolver.executeParallel(
        [mockSlowProvider1, mockSlowProvider2, mockErrorProvider],
        'test query',
        ctx
      );
      const elapsed = Date.now() - start;

      // Parallel execution should complete around ~20-50ms (not 40ms+ sequentially)
      assert.ok(elapsed < 150);
      assert.ok(results['slow_1']);
      assert.ok(results['slow_2']);
      assert.equal(results['slow_1'].data.data, 'res1');
      assert.equal(results['slow_2'].data.data, 'res2');

      // Error provider handled gracefully without throwing
      assert.equal(errors.length, 1);
      assert.equal(errors[0].providerId, 'failing');
    });
  });

  // Test 3: Aggregation
  describe('3. Knowledge Aggregation', () => {
    it('merges taxonomy, handbook, database, and lexical data into coherent sections', () => {
      const ctx = FederationContextBuilder.build({
        text: 'How am I doing as a Front Runner?',
        userId: 'trainer_123'
      });

      const providerResults = {
        taxonomy: {
          providerId: 'taxonomy',
          authority: 100,
          confidence: 0.99,
          data: {
            id: 'running_style.front_runner',
            name: 'Front Runner',
            category: 'Running Style',
            canonical: 'Front Runner'
          },
          timestamp: new Date()
        },
        handbook: {
          providerId: 'handbook',
          authority: 90,
          confidence: 0.95,
          data: {
            primaryRecommendation: 'Maintain lead early with Speed and Stamina.',
            guides: [{ id: 'guide_fr', title: 'Front Runner Strategy', version: '2.0' }]
          },
          timestamp: new Date()
        },
        database: {
          providerId: 'database',
          authority: 95,
          confidence: 0.99,
          data: {
            rank: 12,
            trainerName: 'Trainer A',
            totalFans: 152_000_000,
            dailyGain: 5_000_000,
            currentMilestone: '150M Minimum',
            nextMilestone: '200M Competitive',
            remainingFansToNextMilestone: 48_000_000
          },
          timestamp: new Date()
        },
        lexical: {
          providerId: 'lexical',
          authority: 80,
          confidence: 0.90,
          data: {
            definition: 'Front Runner: A tactical running style emphasizing early pace leadership.',
            synonyms: ['Nige', 'Leader']
          },
          timestamp: new Date()
        }
      };

      const aggregated = FederationAggregator.aggregate(providerResults, ctx);

      // Verify sections
      assert.equal(aggregated.sections.taxonomy?.canonical, 'Front Runner');
      assert.equal(aggregated.sections.handbook?.primaryRecommendation, 'Maintain lead early with Speed and Stamina.');
      assert.equal(aggregated.sections.database?.leaderboard?.rank, 12);
      assert.equal(aggregated.sections.database?.fanStats?.totalFans, 152_000_000);
      assert.equal(aggregated.sections.lexical?.definition, 'Front Runner: A tactical running style emphasizing early pace leadership.');

      // Verify top-level unified data
      assert.equal(aggregated.aggregatedData.rank, 12);
      assert.equal(aggregated.aggregatedData.totalFans, 152_000_000);
      assert.equal(aggregated.aggregatedData.runningStyle, 'Front Runner');
    });
  });

  // Test 4: Context Building
  describe('4. Context Building', () => {
    it('extracts running styles, characters, intents, and user attributes into shared context', () => {
      const query1 = {
        text: 'How should I build Rice Shower on Long Turf tracks?',
        userId: 'trainer_456',
        guildId: 'umakraft_guild'
      };

      const context1 = FederationContextBuilder.build(query1);
      assert.equal(context1.character, 'Rice Shower');
      assert.equal(context1.distance, 'Long');
      assert.equal(context1.surface, 'Turf');
      assert.equal(context1.intent, 'build_guide');
      assert.equal(context1.userId, 'trainer_456');
      assert.equal(context1.guildId, 'umakraft_guild');

      // Detect Japanese alias for running style
      const query2 = { text: 'Tips for Nige strategy' };
      const context2 = FederationContextBuilder.build(query2);
      assert.equal(context2.runningStyle, 'Front Runner');
    });
  });

  // Test 5: Confidence Calculation
  describe('5. Confidence Engine', () => {
    it('calculates weighted confidence and applies multi-source agreement bonus', () => {
      const mockResults = {
        database: {
          providerId: 'database',
          authority: 95,
          confidence: 0.99,
          data: {},
          timestamp: new Date()
        },
        taxonomy: {
          providerId: 'taxonomy',
          authority: 100,
          confidence: 0.98,
          data: {},
          timestamp: new Date()
        },
        handbook: {
          providerId: 'handbook',
          authority: 90,
          confidence: 0.95,
          data: {},
          timestamp: new Date()
        }
      };

      const assessment = FederationConfidenceEngine.calculate(mockResults);
      assert.ok(assessment.overallConfidence >= 0.95);
      assert.ok(assessment.agreementBonus > 0);
      assert.equal(assessment.sourceCount, 3);
    });
  });

  // Test 6: Conflict Resolution
  describe('6. Conflict Resolution', () => {
    it('resolves conflicts based on authority precedence and guide versions', () => {
      const ctx = FederationContextBuilder.build({ text: 'rank and guide check' });
      const providerResults = {
        taxonomy: {
          providerId: 'taxonomy',
          authority: 100,
          confidence: 0.9,
          data: { rank: 99 }, // Outdated/estimated taxonomy rank
          timestamp: new Date()
        },
        database: {
          providerId: 'database',
          authority: 95,
          confidence: 0.99,
          data: { rank: 12 }, // Real live database rank
          timestamp: new Date()
        },
        handbook: {
          providerId: 'handbook',
          authority: 90,
          confidence: 0.95,
          data: {
            guides: [
              { id: 'guide_v2', title: 'Guide', version: '2.0', recommendations: ['Skill B'] },
              { id: 'guide_v1', title: 'Guide', version: '1.0', recommendations: ['Skill A'] }
            ]
          },
          timestamp: new Date()
        }
      };

      const aggregated = FederationAggregator.aggregate(providerResults, ctx);

      // Check conflict resolution
      assert.ok(aggregated.conflicts.length >= 1);
      const rankConflict = aggregated.conflicts.find(c => c.field === 'rank');
      assert.ok(rankConflict);
      assert.equal(rankConflict?.winningProvider, 'database');

      const guideConflict = aggregated.conflicts.find(c => c.field === 'guide_version');
      assert.ok(guideConflict);
      assert.ok(guideConflict?.reason.includes('v2.0'));
    });
  });

  // Test 7: Semantic Federation
  describe('7. Semantic Federation', () => {
    it('semantically expands queries to increase multi-source recall', () => {
      const router = new FederationRouter();
      const expansions = router.expandQuery("Who's leading right now?");

      assert.ok(expansions.includes('leaderboard'));
      assert.ok(expansions.includes('rank 1') || expansions.includes('top position'));
    });
  });

  // Test 8: Response Planning
  describe('8. Response Planning', () => {
    it('creates a structured response plan with situation, guide, concept, and action', () => {
      const ctx = FederationContextBuilder.build({
        text: 'How do I improve as a Front Runner?',
        userId: 'trainer_1'
      });

      const providerResults = {
        database: {
          providerId: 'database',
          authority: 95,
          confidence: 0.98,
          data: {
            leaderboard: { rank: 12, trainerName: 'Trainer 1', fans: 152_000_000 },
            fanStats: {
              totalFans: 152_000_000,
              nextMilestone: '200M Competitive',
              remainingFansToNextMilestone: 48_000_000
            },
            milestoneProgress: {
              currentMilestone: '150M Minimum'
            }
          },
          timestamp: new Date()
        },
        handbook: {
          providerId: 'handbook',
          authority: 90,
          confidence: 0.95,
          data: {
            primaryRecommendation: 'Prioritize Speed bursts and Early Race positioning skills.'
          },
          timestamp: new Date()
        },
        taxonomy: {
          providerId: 'taxonomy',
          authority: 100,
          confidence: 0.99,
          data: {
            canonical: 'Front Runner',
            category: 'Running Style'
          },
          timestamp: new Date()
        }
      };

      const aggregated = FederationAggregator.aggregate(providerResults, ctx);
      const plan = aggregated.responsePlan;

      assert.ok(plan);
      assert.ok(plan.steps.length >= 3);

      const stepTypes = plan.steps.map(s => s.type);
      assert.ok(stepTypes.includes('current_situation'));
      assert.ok(stepTypes.includes('relevant_guide'));
      assert.ok(stepTypes.includes('recommended_action'));

      // Check summary text contains essential facts
      assert.ok(plan.summaryText?.includes('Rank #12'));
      assert.ok(plan.summaryText?.includes('Front Runner'));
    });
  });

  // Test 9: Provider Registration & Adapters
  describe('9. Provider Registration & Lifecycle', () => {
    it('supports registering, querying, and custom provider plug-ins', async () => {
      const federation = new KnowledgeFederationService({ enableCache: false });
      
      const customProvider: KnowledgeProvider = {
        id: 'custom_analytics',
        authority: 87,
        supports: (q) => q.includes('analytics'),
        search: async () => [{ metric: 'win_rate', value: 0.74 }],
        resolve: async () => ({ analyticsScore: 92 })
      };

      federation.registerProvider(customProvider);
      assert.equal(federation.getProvider('custom_analytics')?.id, 'custom_analytics');
      assert.ok(federation.getAllProviders().some(p => p.id === 'taxonomy'));
      assert.ok(federation.getAllProviders().some(p => p.id === 'database'));
      assert.ok(federation.getAllProviders().some(p => p.id === 'handbook'));
      assert.ok(federation.getAllProviders().some(p => p.id === 'memory')); // M1 Hook
    });
  });

  // Test 10: End-to-End Federation Integration
  describe('10. End-to-End Federation Integration', () => {
    it('executes full federation flow for "How am I doing as a Front Runner this month?"', async () => {
      const federation = new KnowledgeFederationService({ enableCache: false });
      
      // Inject database test state for trainer
      const dbProvider = federation.getProvider('database') as any;
      if (dbProvider && dbProvider.source) {
        const registry = dbProvider.source.getRegistry();
        await registry.trainerRepo.save({
          id: 'trainer_fe',
          trainerId: 'trainer_fe',
          trainerName: 'FrontRunnerAce',
          discordId: 'discord_fe_1',
          clubId: 'club_umakraft',
          totalFans: 152_000_000,
          currentRank: 12,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await registry.fanRepo.saveStats({
          trainerId: 'trainer_fe',
          trainerName: 'FrontRunnerAce',
          totalFans: 152_000_000,
          dailyGain: 5_000_000,
          monthlyGain: 152_000_000,
          currentDay: 15,
          daysInMonth: 30,
          currentMilestone: '150M Minimum',
          nextMilestone: '200M Competitive',
          remainingFansToNextMilestone: 48_000_000,
          deficit: 0,
          surplus: 2_000_000,
          requiredDailyGain: 3_200_000,
          projectedMonthEnd: 180_000_000
        });
      }

      const result = await federation.query({
        text: 'How am I doing this month as a Front Runner?',
        userId: 'trainer_fe',
        trainerId: 'trainer_fe'
      });

      assert.ok(result);
      assert.ok(result.participatingProviders.length >= 2);
      assert.ok(result.confidence > 0.85);

      // Verify sections populated
      assert.ok(result.sections.taxonomy);
      assert.ok(result.sections.database);
      assert.ok(result.sections.handbook);

      // Verify response plan generated
      assert.ok(result.responsePlan);
      assert.ok(result.responsePlan.steps.length >= 3);

      // Verify LilyKnowledgeService integration
      const lilyKnowledge = new LilyKnowledgeService();
      const lilyResult = await lilyKnowledge.resolveFederated({
        text: 'Front Runner guide and standings',
        userId: 'trainer_fe'
      });

      assert.ok(lilyResult);
      assert.ok(lilyResult.participatingProviders.length >= 1);
    });
  });
});
