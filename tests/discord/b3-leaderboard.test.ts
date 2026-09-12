import { describe, test } from 'node:test';
import assert from 'node:assert';

import {
  createLilyAI,
  LilyLanguageService,
  LilyMemoryService,
  LilyKnowledgeService,
  LilyToolService,
  ToolRegistry,
  LeaderboardTool,
  MemberRankTool,
  ClubStatsTool,
  LeaderboardCalculator,
  LeaderboardFormatter,
  defaultLeaderboardDataProvider,
  DefaultLeaderboardDataProvider,
  CLUB_DATA_SOURCE_RULE,
  FORBIDDEN_CLUB_DATA_SOURCES
} from '../../packages/lily-ai/src/index.js';

describe('B3 — Leaderboard Integration', () => {
  describe('1. Language Intents', () => {
    const languageService = new LilyLanguageService();

    test('Detects "show leaderboard" as leaderboard intent', async () => {
      const analysis = await languageService.analyze('show leaderboard');
      assert.strictEqual(analysis.intent, 'leaderboard');
    });

    test('Detects "what rank am i?" as member_rank intent', async () => {
      const analysis = await languageService.analyze('what rank am i?');
      assert.strictEqual(analysis.intent, 'member_rank');
    });

    test('Detects "what\'s my rank" as member_rank intent', async () => {
      const analysis = await languageService.analyze("what's my rank");
      assert.strictEqual(analysis.intent, 'member_rank');
    });

    test('Detects "who are the top 10?" as top_members intent', async () => {
      const analysis = await languageService.analyze('who are the top 10?');
      assert.strictEqual(analysis.intent, 'top_members');
    });

    test('Detects "who are the top 5?" as top_members intent', async () => {
      const analysis = await languageService.analyze('who are the top 5?');
      assert.strictEqual(analysis.intent, 'top_members');
    });

    test('Detects "how is the club doing?" as club_stats intent', async () => {
      const analysis = await languageService.analyze('how is the club doing?');
      assert.strictEqual(analysis.intent, 'club_stats');
    });

    test('Detects "club stats" as club_stats intent', async () => {
      const analysis = await languageService.analyze('club stats');
      assert.strictEqual(analysis.intent, 'club_stats');
    });
  });

  describe('2. Knowledge Rules Enforcement', () => {
    const knowledgeService = new LilyKnowledgeService();
    const languageService = new LilyLanguageService();

    test('Leaderboard query classifies to domain: club_data and source: database', async () => {
      const analysis = await languageService.analyze('show leaderboard');
      const knowledge = knowledgeService.analyze(analysis);

      assert.strictEqual(knowledge.domain, 'club_data');
      assert.strictEqual(knowledge.source, 'database');
    });

    test('Personal rank query classifies to domain: club_data and source: database', async () => {
      const analysis = await languageService.analyze('what rank am i?');
      const knowledge = knowledgeService.analyze(analysis);

      assert.strictEqual(knowledge.domain, 'club_data');
      assert.strictEqual(knowledge.source, 'database');
    });

    test('Club stats query classifies to domain: club_data and source: database', async () => {
      const analysis = await languageService.analyze('how is the club doing?');
      const knowledge = knowledgeService.analyze(analysis);

      assert.strictEqual(knowledge.domain, 'club_data');
      assert.strictEqual(knowledge.source, 'database');
    });

    test('Strict rule enforcement: database allowed, handbook/taxonomy/web_search strictly forbidden', () => {
      assert.strictEqual(CLUB_DATA_SOURCE_RULE.allowedSource, 'database');
      assert.strictEqual(knowledgeService.isSourceAllowedForClub('database'), true);

      for (const forbidden of FORBIDDEN_CLUB_DATA_SOURCES) {
        assert.strictEqual(
          knowledgeService.isSourceAllowedForClub(forbidden),
          false,
          `Source ${forbidden} must be forbidden for club_data`
        );
      }
    });
  });

  describe('3. Tool Selection & Registry', () => {
    const registry = new ToolRegistry();
    const toolService = new LilyToolService(registry);
    const languageService = new LilyLanguageService();

    test('LeaderboardTool, MemberRankTool, and ClubStatsTool are registered', () => {
      const leaderboardTool = registry.getTool('LeaderboardTool');
      const memberRankTool = registry.getTool('MemberRankTool');
      const clubStatsTool = registry.getTool('ClubStatsTool');

      assert.ok(leaderboardTool instanceof LeaderboardTool);
      assert.ok(memberRankTool instanceof MemberRankTool);
      assert.ok(clubStatsTool instanceof ClubStatsTool);
    });

    test('Selects LeaderboardTool for "show leaderboard"', async () => {
      const analysis = await languageService.analyze('show leaderboard');
      const selection = toolService.selectTool(analysis);

      assert.strictEqual(selection.tool, 'LeaderboardTool');
    });

    test('Selects MemberRankTool for "what rank am i?"', async () => {
      const analysis = await languageService.analyze('what rank am i?');
      const selection = toolService.selectTool(analysis);

      assert.strictEqual(selection.tool, 'MemberRankTool');
    });

    test('Selects LeaderboardTool for "who are the top 10?"', async () => {
      const analysis = await languageService.analyze('who are the top 10?');
      const selection = toolService.selectTool(analysis);

      assert.strictEqual(selection.tool, 'LeaderboardTool');
    });

    test('Selects ClubStatsTool for "how is the club doing?"', async () => {
      const analysis = await languageService.analyze('how is the club doing?');
      const selection = toolService.selectTool(analysis);

      assert.strictEqual(selection.tool, 'ClubStatsTool');
    });
  });

  describe('4. Leaderboard Calculation & Fan Integration', () => {
    const provider = new DefaultLeaderboardDataProvider();
    const members = provider.getMembers();

    test('Calculates personal rank and distance to next position', () => {
      // Rank #7 is CafeLover (184.2M) and Rank #6 is TachyonLab (190M)
      const rank7 = LeaderboardCalculator.calculateMemberRank(members, '789012');
      assert.ok(rank7);
      assert.strictEqual(rank7.rank, 7);
      assert.strictEqual(rank7.trainerName, 'CafeLover');
      assert.strictEqual(rank7.fans, 184_200_000);
      assert.strictEqual(rank7.totalMembers, 30);
      assert.strictEqual(rank7.nextRankDistance, 5_800_000); // 190M - 184.2M = 5.8M
    });

    test('Calculates #1 position rank with 0 nextRankDistance', () => {
      const rank1 = LeaderboardCalculator.calculateMemberRank(members, '123456');
      assert.ok(rank1);
      assert.strictEqual(rank1.rank, 1);
      assert.strictEqual(rank1.trainerName, 'RiceEnjoyer');
      assert.strictEqual(rank1.fans, 412_000_000);
      assert.strictEqual(rank1.nextRankDistance, 0);
    });

    test('Integrates B1 fan calculations into leaderboard entries', () => {
      const lb = LeaderboardCalculator.calculateLeaderboard(members, 5);
      assert.strictEqual(lb.entries.length, 5);
      assert.strictEqual(lb.entries[0].rank, 1);
      assert.strictEqual(lb.entries[0].trainerName, 'RiceEnjoyer');
      assert.strictEqual(lb.entries[0].fans, 412_000_000);
      assert.ok(lb.entries[0].milestoneStatus);
      assert.strictEqual(lb.entries[0].deficitStatus, 'on_pace');
    });

    test('Calculates aggregated club statistics', () => {
      const stats = provider.getClubStats();
      assert.strictEqual(stats.memberCount, 30);
      assert.strictEqual(stats.totalFans, 7_800_000_000);
      assert.strictEqual(stats.averageFans, 260_000_000);
      assert.strictEqual(stats.clubStatus, 'Super Competitive');
    });
  });

  describe('5. Formatting Consistency', () => {
    test('Formats fan numbers cleanly (7.8B, 412M, 184.2M, 5.8M)', () => {
      assert.strictEqual(LeaderboardFormatter.formatFans(7_800_000_000), '7.8B');
      assert.strictEqual(LeaderboardFormatter.formatFans(412_000_000), '412M');
      assert.strictEqual(LeaderboardFormatter.formatFans(184_200_000), '184.2M');
      assert.strictEqual(LeaderboardFormatter.formatFans(5_800_000), '5.8M');
      assert.strictEqual(LeaderboardFormatter.formatFans(260_000_000), '260M');
    });

    test('Formats personal rank output exactly matching prompt', () => {
      const formatted = LeaderboardFormatter.formatMemberRank({
        rank: 7,
        totalMembers: 30,
        fans: 184_200_000,
        nextRankDistance: 5_800_000
      });

      assert.strictEqual(
        formatted,
        "Trainer, you're currently ranked #7 out of 30 members.\n\nCurrent Fans: 184.2M\n\nYou're 5.8M away from the next position."
      );
    });

    test('Formats leaderboard output matching prompt', () => {
      const formatted = LeaderboardFormatter.formatLeaderboard({
        entries: [
          { rank: 1, trainerName: 'RiceEnjoyer', fans: 412_000_000 },
          { rank: 2, trainerName: 'SuzukaMain', fans: 398_000_000 },
          { rank: 3, trainerName: 'TeioFan', fans: 366_000_000 },
          { rank: 4, trainerName: 'OguriEnjoyer', fans: 342_000_000 },
          { rank: 5, trainerName: 'GoldShipChaos', fans: 315_000_000 }
        ]
      });

      assert.strictEqual(
        formatted,
        "Current Club Leaderboard\n\n#1 RiceEnjoyer — 412M\n#2 SuzukaMain — 398M\n#3 TeioFan — 366M\n#4 OguriEnjoyer — 342M\n#5 GoldShipChaos — 315M"
      );
    });

    test('Formats club stats output matching prompt', () => {
      const formatted = LeaderboardFormatter.formatClubStats({
        memberCount: 30,
        totalFans: 7_800_000_000,
        averageFans: 260_000_000,
        clubStatus: 'Super Competitive'
      });

      assert.strictEqual(
        formatted,
        "Club Overview\n\nMembers: 30\nTotal Fans: 7.8B\nAverage Fans: 260M\n\nCurrent Club Status:\nSuper Competitive"
      );
    });
  });

  describe('6. End-to-End LilyAI Chat & Multi-turn Interactions', () => {
    let languageService: LilyLanguageService;
    let memoryService: LilyMemoryService;
    let knowledgeService: LilyKnowledgeService;
    let toolService: LilyToolService;

    test('Top members request: "show leaderboard" displays Top 5 members', async () => {
      languageService = new LilyLanguageService();
      memoryService = new LilyMemoryService();
      knowledgeService = new LilyKnowledgeService();
      toolService = new LilyToolService();

      const lily = createLilyAI(undefined, {
        languageService,
        memoryService,
        knowledgeService,
        toolService
      });

      const res = await lily.chat({
        userId: 'discord-user-1',
        message: 'show leaderboard'
      });

      assert.strictEqual(res.success, true);
      assert.ok(res.response.includes('Current Club Leaderboard'));
      assert.ok(res.response.includes('#1 RiceEnjoyer — 412M'));
      assert.ok(res.response.includes('#2 SuzukaMain — 398M'));
      assert.ok(res.response.includes('#3 TeioFan — 366M'));
      assert.ok(res.response.includes('#4 OguriEnjoyer — 342M'));
      assert.ok(res.response.includes('#5 GoldShipChaos — 315M'));
    });

    test('Top members request: "who are the top 10?" displays Top 10 members', async () => {
      const lily = createLilyAI(undefined, {
        languageService,
        memoryService,
        knowledgeService,
        toolService
      });

      const res = await lily.chat({
        userId: 'discord-user-1',
        message: 'who are the top 10?'
      });

      assert.strictEqual(res.success, true);
      assert.ok(res.response.includes('Current Club Leaderboard'));
      assert.ok(res.response.includes('#1 RiceEnjoyer — 412M'));
      assert.ok(res.response.includes('#10 VodkaRacer — 170M'));
    });

    test('Club stats request: "how is the club doing?" displays Club Overview', async () => {
      const lily = createLilyAI(undefined, {
        languageService,
        memoryService,
        knowledgeService,
        toolService
      });

      const res = await lily.chat({
        userId: 'discord-user-1',
        message: 'how is the club doing?'
      });

      assert.strictEqual(res.success, true);
      assert.ok(res.response.includes('Club Overview'));
      assert.ok(res.response.includes('Members: 30'));
      assert.ok(res.response.includes('Total Fans: 7.8B'));
      assert.ok(res.response.includes('Average Fans: 260M'));
      assert.ok(res.response.includes('Current Club Status:'));
      assert.ok(res.response.includes('Super Competitive'));
    });

    test('Reuses B2 memory: user tells trainer ID once, then asks "what rank am i?" without repeating ID', async () => {
      const lily = createLilyAI(undefined, {
        languageService,
        memoryService,
        knowledgeService,
        toolService
      });

      const userId = 'multi-turn-trainer-user';

      // Turn 1: User provides trainer ID
      const turn1 = await lily.chat({
        userId,
        message: 'my trainer id is 123456'
      });
      assert.strictEqual(turn1.success, true);

      // Verify memory persisted trainerId from B2
      const mem = await memoryService.getContext(userId);
      assert.strictEqual(mem.trainerId, '123456');

      // Turn 2: User asks "what rank am i?"
      // Lily already knows trainer 123456 from B2 memory!
      const turn2 = await lily.chat({
        userId,
        message: 'what rank am i?'
      });

      assert.strictEqual(turn2.success, true);
      assert.ok(turn2.response.includes("Trainer, you're currently ranked #1 out of 30 members."));
      assert.ok(turn2.response.includes('Current Fans: 412M'));
      assert.ok(turn2.response.includes('You are holding the top position in the club!'));
    });

    test('Personal rank for linked user: user-cafe asks "what rank am i?" and receives #7 rank', async () => {
      const lily = createLilyAI(undefined, {
        languageService,
        memoryService,
        knowledgeService,
        toolService
      });

      const res = await lily.chat({
        userId: 'user-cafe',
        message: 'what rank am i?'
      });

      assert.strictEqual(res.success, true);
      assert.ok(res.response.includes("Trainer, you're currently ranked #7 out of 30 members."));
      assert.ok(res.response.includes('Current Fans: 184.2M'));
      assert.ok(res.response.includes("You're 5.8M away from the next position."));
    });

    test('Missing trainer context: unlinked user asks "what rank am i?" and gets clear link prompt', async () => {
      const lily = createLilyAI(undefined, {
        languageService,
        memoryService,
        knowledgeService,
        toolService
      });

      const res = await lily.chat({
        userId: 'unlinked-stranger-999',
        message: 'what rank am i?'
      });

      assert.strictEqual(res.success, true);
      assert.ok(res.response.includes("Trainer, I couldn't find a linked trainer profile."));
      assert.ok(res.response.includes('You can start a link request anytime.'));
    });
  });
});
