import { test } from 'node:test';
import assert from 'node:assert';
import {
  DatabaseKnowledgeProvider,
  DatabaseRegistry,
  DatabaseQueryEngine,
  DatabaseResolver,
  DatabaseCache,
  DatabaseRankingEngine,
  DatabaseValidator,
  DatabaseAuthorizationService,
  DefaultTrainerRepository,
  DefaultLeaderboardRepository,
  DefaultFanRepository,
  DefaultClubRepository,
  DefaultLinkRepository,
  DefaultMilestoneRepository
} from '../../packages/lily-ai/src/knowledge/database/index.js';
import { KnowledgeEngine } from '../../packages/lily-ai/src/knowledge/knowledge-engine.js';
import { LilyKnowledgeService } from '../../packages/lily-ai/src/knowledge/lily-knowledge-service.js';

test('F22 — Database Knowledge Provider', async (t) => {
  const provider = new DatabaseKnowledgeProvider();

  await t.test('1. Trainer Lookup & Repository', async () => {
    // 1. Lookup by ID
    const trainerById = await provider.getTrainer('123456');
    assert.ok(trainerById);
    assert.strictEqual(trainerById?.trainerName, 'RiceEnjoyer');
    assert.strictEqual(trainerById?.clubName, 'Umakraft');

    // 2. Lookup by Name
    const trainerByName = await provider.getTrainer('CafeLover');
    assert.ok(trainerByName);
    assert.strictEqual(trainerByName?.trainerId, '789012');

    // 3. Lookup by Discord User ID
    const trainerByDiscord = await provider.getTrainer('user-rice');
    assert.ok(trainerByDiscord);
    assert.strictEqual(trainerByDiscord?.trainerId, '123456');
  });

  await t.test('2. Fan Gain Retrieval & Calculations', async () => {
    const fanModule = provider.getFanModule();

    // 1. RiceEnjoyer stats
    const stats = await fanModule.getFanStatistics('123456');
    assert.ok(stats);
    assert.ok(stats?.totalFans > 400_000_000);
    assert.strictEqual(stats?.currentMilestone, 'Super Competitive');

    // 2. Methods check
    const daily = await fanModule.getDailyFanGain('123456');
    const monthly = await fanModule.getMonthlyFanGain('123456');
    assert.ok(daily > 0);
    assert.ok(monthly > 0);

    // 3. Remaining fans calculation
    const remaining = await fanModule.getRemainingFans('123456', 500_000_000);
    assert.ok(remaining > 0);
  });

  await t.test('3. Leaderboard Retrieval & Rankings', async () => {
    const lbModule = provider.getLeaderboardModule();

    // 1. Leaderboard entries
    const entries = await lbModule.getLeaderboard(10);
    assert.strictEqual(entries.length, 10);
    assert.strictEqual(entries[0].rank, 1);
    assert.strictEqual(entries[0].trainerName, 'RiceEnjoyer');

    // 2. Individual trainer rank
    const rankResult = await lbModule.getTrainerRank('CafeLover');
    assert.ok(rankResult);
    assert.strictEqual(rankResult?.trainerId, '789012');
    assert.ok(rankResult?.rank > 1);

    // 3. Nearby competitors
    const nearby = await lbModule.getNearbyCompetitors('CafeLover');
    assert.ok(nearby);
    assert.strictEqual(nearby?.current.trainerName, 'CafeLover');
    assert.ok(nearby?.above);
    assert.ok(nearby?.below);
  });

  await t.test('4. Milestone Progress & Eligibility', async () => {
    const milestoneModule = provider.getMilestoneModule();

    // 1. All milestones
    const milestones = await milestoneModule.getMilestones();
    assert.strictEqual(milestones.length, 3);
    assert.strictEqual(milestones[0].requiredFans, 150_000_000);
    assert.strictEqual(milestones[1].requiredFans, 200_000_000);
    assert.strictEqual(milestones[2].requiredFans, 300_000_000);

    // 2. Eligibility checks
    const check150 = await milestoneModule.checkEligibility(160_000_000, 150_000_000);
    assert.strictEqual(check150.eligible, true);
    assert.strictEqual(check150.deficit, 0);

    const check200 = await milestoneModule.checkEligibility(160_000_000, 200_000_000);
    assert.strictEqual(check200.eligible, false);
    assert.strictEqual(check200.deficit, 40_000_000);

    // 3. Progress tracking
    const progress = await milestoneModule.getProgress('123456');
    assert.strictEqual(progress.isEligible150M, true);
    assert.strictEqual(progress.isEligible200M, true);
    assert.strictEqual(progress.isEligible300M, true);
    assert.strictEqual(progress.currentMilestone?.title, 'Super Competitive');
  });

  await t.test('5. Link Requests Workflow', async () => {
    const linkModule = provider.getLinkModule();

    // 1. Create a link request
    const newReq = await linkModule.createRequest('discord_user_test_99', '555666', 'TestRunner');
    assert.ok(newReq.requestId);
    assert.strictEqual(newReq.status, 'pending');

    // 2. Lookup pending requests
    const pending = await linkModule.getPendingRequests();
    assert.ok(pending.some(r => r.requestId === newReq.requestId));

    // 3. Approve request
    const approved = await linkModule.approveRequest(newReq.requestId, 'officer_admin_1');
    assert.ok(approved);
    assert.strictEqual(approved?.status, 'approved');
  });

  await t.test('6. Authorization Layer & Access Control', async () => {
    const auth = provider.getAuth();

    // 1. Public data is accessible by public user
    assert.strictEqual(auth.canAccess('leaderboard', 'read', { roles: ['public'] }), true);
    assert.strictEqual(auth.canAccess('club', 'read', { roles: ['public'] }), true);
    assert.strictEqual(auth.canAccess('milestone', 'read', { roles: ['public'] }), true);

    // 2. Personal trainer data is accessible by owner or officer
    assert.strictEqual(auth.canAccess('trainer', 'read', { userId: '123456', roles: ['member'] }, '123456'), true);
    assert.strictEqual(auth.canAccess('trainer', 'read', { roles: ['officer'] }, '123456'), true);
    assert.strictEqual(auth.canAccess('trainer', 'read', { roles: ['admin'], isAdmin: true }, '123456'), true);

    // 3. Restricted bot configuration requires admin
    assert.strictEqual(auth.canAccess('bot_configuration', 'read', { roles: ['public'] }), false);
    assert.strictEqual(auth.canAccess('bot_configuration', 'read', { roles: ['member'] }), false);
    assert.strictEqual(auth.canAccess('bot_configuration', 'read', { roles: ['admin'], isAdmin: true }), true);
  });

  await t.test('7. Live Data Cache Behavior', async () => {
    const cache = provider.getCache();
    cache.clear();
    assert.strictEqual(cache.size(), 0);

    // 1. First query caches result
    const res1 = await provider.resolve('leaderboard');
    assert.ok(res1.length > 0);
    assert.ok(cache.size() > 0);

    // 2. Cache retrieval
    const cached = cache.get('nl::leaderboard', 'public');
    assert.ok(cached);
    assert.strictEqual(cached?.[0].entityType, 'leaderboard');

    // 3. Invalidation
    cache.invalidate('nl::leaderboard');
    assert.strictEqual(cache.get('nl::leaderboard', 'public'), null);
  });

  await t.test('8. Entity Resolution (User Language -> DB Entities)', async () => {
    // 1. "Top 10 trainers" -> leaderboard
    const topTrainers = await provider.resolve('Top 10 trainers');
    assert.ok(topTrainers.length > 0);
    assert.strictEqual(topTrainers[0].entityType, 'leaderboard');

    // 2. "RiceEnjoyer fans" -> fan_gain
    const riceFans = await provider.resolve('RiceEnjoyer fans');
    assert.ok(riceFans.length > 0);
    assert.strictEqual(riceFans[0].entityType, 'fan_gain');

    // 3. "Umakraft club overview" -> club
    const clubData = await provider.resolve('Umakraft club stats');
    assert.ok(clubData.length > 0);
    assert.strictEqual(clubData[0].entityType, 'club');
  });

  await t.test('9. Intent Mapping & Natural Language Composite Inference', async () => {
    // 1. "How am I doing this month?" -> Composite inference (fan stats + rank + milestone progress)
    const compositeRes = await provider.resolve('How am I doing this month?', {
      trainerId: '123456',
      userId: '123456'
    });

    assert.ok(compositeRes.length > 0);
    assert.strictEqual(compositeRes[0].entityType, 'composite_status');

    const payload = compositeRes[0].payload as any;
    assert.ok(payload.fanStatistics);
    assert.strictEqual(payload.rank, 1);
    assert.ok(payload.milestoneProgress);
    assert.strictEqual(payload.milestoneProgress.currentMilestone.title, 'Super Competitive');

    // 2. "Am I eligible for 200M?" -> milestone eligibility
    const eligibleRes = await provider.resolve('Am I eligible for 200M?', {
      trainerId: '123456'
    });
    assert.ok(eligibleRes.length > 0);
    assert.strictEqual(eligibleRes[0].entityType, 'milestone');
  });

  await t.test('10. Knowledge Engine & LilyKnowledgeService Integration (Authority 95)', async () => {
    const knowledgeEngine = new KnowledgeEngine();
    const sources = knowledgeEngine.getRegistry().getAll();

    // Check presence and priority hierarchy:
    // Taxonomy (100) > Database Provider (95) > Handbook (90) > Static Database (85) > Lexical (80)
    const dbProviderSource = sources.find(s => s.id === 'database_provider' && s.priority === 95);
    const handbookSource = sources.find(s => s.id === 'handbook');
    const staticDbSource = sources.find(s => s.id === 'database' && s.priority === 85);
    const taxonomySource = sources.find(s => s.id === 'taxonomy');
    const lexicalSource = sources.find(s => s.id === 'lexical_intelligence');

    assert.ok(dbProviderSource);
    assert.ok(staticDbSource);
    assert.strictEqual(taxonomySource?.priority, 100);
    assert.strictEqual(dbProviderSource?.priority, 95);
    assert.strictEqual(handbookSource?.priority, 90);
    assert.strictEqual(lexicalSource?.priority, 80);

    // Test query execution through KnowledgeEngine
    const results = await knowledgeEngine.query({
      term: 'leaderboard'
    });

    assert.ok(results.length > 0);
    const dbResult = results.find(r => r.source === 'database' && r.authority === 95);
    assert.ok(dbResult);
    assert.strictEqual(dbResult?.authority, 95);

    // Test query execution through LilyKnowledgeService
    const knowledgeService = new LilyKnowledgeService(knowledgeEngine);
    const serviceResults = await knowledgeService.resolve('RiceEnjoyer fans');
    assert.ok(serviceResults.length > 0);
    assert.ok(serviceResults.some(r => r.authority === 95));
  });
});
