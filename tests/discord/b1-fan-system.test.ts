import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  createLilyAI,
  FAN_MILESTONES,
  FanCalculator,
  FanFormatter,
  FanGainTool,
  FanDeficitTool,
  FanSurplusTool,
  FanProjectionTool,
  FanMilestoneTool,
  defaultFanDataProvider,
  LilyLanguageService,
  LilyToolService,
  LilyMemoryService,
  LilyOrchestrator,
  LilyChatService
} from '../../packages/lily-ai/src/index.js';

describe('B1 — Fan System Integration', () => {

  describe('1. Centralized Milestones', () => {
    test('Milestone constants are centralized and isolated from prompt strings', () => {
      assert.strictEqual(FAN_MILESTONES.length, 3);
      assert.strictEqual(FAN_MILESTONES[0].fans, 150_000_000);
      assert.strictEqual(FAN_MILESTONES[0].title, 'Minimum');
      assert.strictEqual(FAN_MILESTONES[1].fans, 200_000_000);
      assert.strictEqual(FAN_MILESTONES[1].title, 'Competitive');
      assert.strictEqual(FAN_MILESTONES[2].fans, 300_000_000);
      assert.strictEqual(FAN_MILESTONES[2].title, 'Super Competitive');
    });
  });

  describe('2. Fan Calculations (No Duplication / No Calc in Prompts)', () => {
    test('Calculates Fan Gain accurately', () => {
      const data = {
        trainerId: 'trainer-1',
        dailyGain: 5_200_000,
        totalFans: 167_400_000
      };
      const result = FanCalculator.calculateGain(data);
      assert.strictEqual(result.gainedToday, 5_200_000);
      assert.strictEqual(result.totalFans, 167_400_000);
    });

    test('Calculates Fan Deficit when behind pace', () => {
      const data = {
        trainerId: 'trainer-2',
        dailyGain: 1_000_000,
        totalFans: 20_000_000, // day 10 of 30 days -> expected 50M -> deficit 30M
        currentDay: 10,
        daysInMonth: 30
      };
      const result = FanCalculator.calculateDeficit(data);
      assert.strictEqual(result.deficit, 30_000_000);
      assert.strictEqual(result.currentAverage, 2_000_000);
      assert.strictEqual(result.requiredDailyGain, Math.round(130_000_000 / 20)); // 6.5M
    });

    test('Calculates Fan Surplus when ahead of pace', () => {
      const data = {
        trainerId: 'trainer-3',
        dailyGain: 8_000_000,
        totalFans: 80_000_000, // day 10 of 30 -> expected 50M -> surplus 30M
        currentDay: 10,
        daysInMonth: 30
      };
      const result = FanCalculator.calculateSurplus(data);
      assert.strictEqual(result.surplus, 30_000_000);
      assert.strictEqual(result.projectedMonthEnd, 240_000_000);
    });

    test('Calculates Month-End Projection and milestone match', () => {
      const data = {
        trainerId: 'trainer-4',
        dailyGain: 7_000_000,
        totalFans: 70_000_000, // day 10 of 30 -> projected 210M -> Competitive
        currentDay: 10,
        daysInMonth: 30
      };
      const result = FanCalculator.calculateProjection(data);
      assert.strictEqual(result.projectedFans, 210_000_000);
      assert.strictEqual(result.projectedMilestone, 'Competitive');
    });

    test('Calculates Milestone progress and remaining distance', () => {
      const data = {
        trainerId: 'trainer-5',
        dailyGain: 5_000_000,
        totalFans: 200_000_000 // Reached Competitive (200M), next is Super Competitive (300M)
      };
      const result = FanCalculator.calculateMilestones(data);
      assert.strictEqual(result.currentMilestone, 'Competitive');
      assert.strictEqual(result.nextMilestone, 'Super Competitive');
      assert.strictEqual(result.remainingFans, 100_000_000);
    });
  });

  describe('3. Language Intent Detection', () => {
    const languageService = new LilyLanguageService();

    test('Detects fan_gain intent', () => {
      const analysis = languageService.analyze('How much fan did I gain today?');
      assert.strictEqual(analysis.intent, 'fan_gain');
      assert.ok(analysis.confidence >= 0.9);
    });

    test('Detects fan_deficit intent', () => {
      const analysis = languageService.analyze('Am I behind?');
      assert.strictEqual(analysis.intent, 'fan_deficit');
      assert.ok(analysis.confidence >= 0.9);
    });

    test('Detects fan_surplus intent', () => {
      const analysis = languageService.analyze('Am I ahead on fans?');
      assert.strictEqual(analysis.intent, 'fan_surplus');
      assert.ok(analysis.confidence >= 0.9);
    });

    test('Detects fan_projection intent', () => {
      const analysis = languageService.analyze('Will I reach 150m?');
      assert.strictEqual(analysis.intent, 'fan_projection');
      assert.ok(analysis.confidence >= 0.9);
    });

    test('Detects fan_milestone intent', () => {
      const analysis = languageService.analyze('What milestone did I reach?');
      assert.strictEqual(analysis.intent, 'fan_milestone');
      assert.ok(analysis.confidence >= 0.9);
    });
  });

  describe('4. Tool Registry & Tool Selection', () => {
    const toolService = new LilyToolService();

    test('Selects FanGainTool for fan_gain intent', () => {
      const selection = toolService.selectTool({
        intent: 'fan_gain',
        confidence: 0.95,
        taxonomyMatches: [],
        entities: [],
        normalizedMessage: 'fan gain'
      });
      assert.strictEqual(selection.tool, 'FanGainTool');
    });

    test('Selects FanDeficitTool for fan_deficit intent', () => {
      const selection = toolService.selectTool({
        intent: 'fan_deficit',
        confidence: 0.95,
        taxonomyMatches: [],
        entities: [],
        normalizedMessage: 'am i behind'
      });
      assert.strictEqual(selection.tool, 'FanDeficitTool');
    });

    test('Selects FanSurplusTool for fan_surplus intent', () => {
      const selection = toolService.selectTool({
        intent: 'fan_surplus',
        confidence: 0.95,
        taxonomyMatches: [],
        entities: [],
        normalizedMessage: 'fan surplus'
      });
      assert.strictEqual(selection.tool, 'FanSurplusTool');
    });

    test('Selects FanProjectionTool for fan_projection intent', () => {
      const selection = toolService.selectTool({
        intent: 'fan_projection',
        confidence: 0.95,
        taxonomyMatches: [],
        entities: [],
        normalizedMessage: 'will i reach 150m'
      });
      assert.strictEqual(selection.tool, 'FanProjectionTool');
    });

    test('Selects FanMilestoneTool for fan_milestone intent', () => {
      const selection = toolService.selectTool({
        intent: 'fan_milestone',
        confidence: 0.95,
        taxonomyMatches: [],
        entities: [],
        normalizedMessage: 'milestone'
      });
      assert.strictEqual(selection.tool, 'FanMilestoneTool');
    });
  });

  describe('5. Tool Execution', () => {
    test('FanGainTool executes and returns FanGainResult', async () => {
      defaultFanDataProvider.setTrainerFanData({
        trainerId: 'user-gain',
        dailyGain: 5_200_000,
        totalFans: 167_400_000
      });

      const tool = new FanGainTool(defaultFanDataProvider);
      const res = await tool.execute({ trainerId: 'user-gain' });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.gainedToday, 5_200_000);
      assert.strictEqual(res.data.totalFans, 167_400_000);
    });

    test('FanDeficitTool executes and returns FanDeficitResult', async () => {
      defaultFanDataProvider.setTrainerFanData({
        trainerId: 'user-def',
        dailyGain: 2_000_000,
        totalFans: 41_600_000, // day 10 of 30: expected 50M -> deficit 8.4M
        currentDay: 10,
        daysInMonth: 30
      });

      const tool = new FanDeficitTool(defaultFanDataProvider);
      const res = await tool.execute({ trainerId: 'user-def' });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.deficit, 8_400_000);
      assert.strictEqual(res.data.requiredDailyGain, 5_420_000);
    });

    test('FanSurplusTool executes and returns FanSurplusResult', async () => {
      defaultFanDataProvider.setTrainerFanData({
        trainerId: 'user-surp',
        dailyGain: 6_000_000,
        totalFans: 65_000_000,
        currentDay: 10,
        daysInMonth: 30
      });

      const tool = new FanSurplusTool(defaultFanDataProvider);
      const res = await tool.execute({ trainerId: 'user-surp' });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.surplus, 15_000_000);
      assert.strictEqual(res.data.projectedMonthEnd, 195_000_000);
    });

    test('FanProjectionTool executes and returns FanProjectionResult', async () => {
      defaultFanDataProvider.setTrainerFanData({
        trainerId: 'user-proj',
        dailyGain: 7_000_000,
        totalFans: 70_000_000,
        currentDay: 10,
        daysInMonth: 30
      });

      const tool = new FanProjectionTool(defaultFanDataProvider);
      const res = await tool.execute({ trainerId: 'user-proj' });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.projectedFans, 210_000_000);
      assert.strictEqual(res.data.projectedMilestone, 'Competitive');
    });

    test('FanMilestoneTool executes and returns FanMilestoneResult', async () => {
      defaultFanDataProvider.setTrainerFanData({
        trainerId: 'user-mile',
        dailyGain: 5_000_000,
        totalFans: 200_000_000
      });

      const tool = new FanMilestoneTool(defaultFanDataProvider);
      const res = await tool.execute({ trainerId: 'user-mile' });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.currentMilestone, 'Competitive');
      assert.strictEqual(res.data.nextMilestone, 'Super Competitive');
      assert.strictEqual(res.data.remainingFans, 100_000_000);
    });
  });

  describe('6. Chat Formatting Templates', () => {
    test('Formats fan gain template', () => {
      const formatted = FanFormatter.formatGain({
        gainedToday: 5_200_000,
        totalFans: 167_400_000
      });
      assert.ok(formatted.includes('5.2M fans today'));
      assert.ok(formatted.includes('167.4M fans'));
    });

    test('Formats fan deficit template', () => {
      const formatted = FanFormatter.formatDeficit({
        deficit: 8_400_000,
        requiredDailyGain: 5_400_000,
        currentAverage: 4_160_000
      });
      assert.ok(formatted.includes('8.4M fans behind'));
      assert.ok(formatted.includes('5.4M fans per day'));
    });

    test('Formats fan milestone template', () => {
      const formatted = FanFormatter.formatMilestone({
        currentMilestone: 'Competitive',
        nextMilestone: 'Super Competitive',
        remainingFans: 100_000_000
      });
      assert.ok(formatted.includes('Competitive milestone'));
      assert.ok(formatted.includes('Super Competitive'));
      assert.ok(formatted.includes('100M fans'));
    });
  });

  describe('7. End-to-End Orchestrator & Memory Integration', () => {
    test('Orchestrates fan gain request, formats response, and updates memory', async () => {
      defaultFanDataProvider.setTrainerFanData({
        trainerId: 'trainer-e2e',
        dailyGain: 5_200_000,
        totalFans: 167_400_000
      });

      const memoryService = new LilyMemoryService();
      // Pre-seed memory with trainerId
      await memoryService.updateContext('user-e2e', { trainerId: 'trainer-e2e' });

      const lilyAI = createLilyAI(undefined, { memoryService });

      const response = await lilyAI.process({
        userId: 'user-e2e',
        message: 'How much fan did I gain today?'
      });

      assert.strictEqual(response.success, true);
      assert.ok(response.response.includes('5.2M fans today'));
      assert.ok(response.response.includes('167.4M fans'));

      // Check Memory integration
      const memory = await memoryService.getContext('user-e2e');
      assert.strictEqual(memory.activeTopic, 'fan');
      assert.strictEqual(memory.lastFanGain, 5_200_000);
      assert.ok(memory.lastFanCheck !== undefined);
    });

    test('Orchestrates fan deficit request and formats deficit response', async () => {
      defaultFanDataProvider.setTrainerFanData({
        trainerId: 'trainer-deficit-e2e',
        dailyGain: 1_000_000,
        totalFans: 41_600_000,
        currentDay: 10,
        daysInMonth: 30
      });

      const memoryService = new LilyMemoryService();
      await memoryService.updateContext('user-def-e2e', { trainerId: 'trainer-deficit-e2e' });

      const lilyAI = createLilyAI(undefined, { memoryService });

      const response = await lilyAI.process({
        userId: 'user-def-e2e',
        message: 'Am I behind?'
      });

      assert.strictEqual(response.success, true);
      assert.ok(response.response.includes('8.4M fans behind'));
      assert.ok(response.response.includes('5.4M fans per day'));
    });

    test('Orchestrates fan milestone request and updates lastMilestone in memory', async () => {
      defaultFanDataProvider.setTrainerFanData({
        trainerId: 'trainer-mile-e2e',
        dailyGain: 3_000_000,
        totalFans: 200_000_000
      });

      const memoryService = new LilyMemoryService();
      await memoryService.updateContext('user-mile-e2e', { trainerId: 'trainer-mile-e2e' });

      const lilyAI = createLilyAI(undefined, { memoryService });

      const response = await lilyAI.process({
        userId: 'user-mile-e2e',
        message: 'What milestone did I reach?'
      });

      assert.strictEqual(response.success, true);
      assert.ok(response.response.includes('Competitive milestone'));

      const memory = await memoryService.getContext('user-mile-e2e');
      assert.strictEqual(memory.lastMilestone, 'Competitive');
    });
  });
});
