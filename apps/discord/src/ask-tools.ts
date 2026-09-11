import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';
import { fanTrackerAPI } from '@ai-agent-platform/fan-tracker';
import { trainerLinkStore, searchWebTool } from '@ai-agent-platform/integrations';
import { umamusumePureDbSearch } from '@ai-agent-platform/umamusume';
import { FanLeaderboardResolver } from '@ai-agent-platform/core';

const logger = createLogger('AskTools');
const fanResolver = new FanLeaderboardResolver();

const getFanGainTool: ToolDefinition = {
  slug: 'get_fan_gain',
  name: 'Get Fan Gain',
  description: 'Get fan gain summary and rank position for a user across ecosystems (umakraft, umakraft2, unified) and periods (daily, weekly, monthly, all).',
  parameters: {
    discordUserId: { type: 'string', description: 'Discord user ID or "current"', required: false },
    scope: { type: 'string', description: 'umakraft, umakraft2, or unified (default unified)', required: false, enum: ['umakraft', 'umakraft2', 'unified'] },
    period: { type: 'string', description: 'daily, weekly, monthly, or all (default daily)', required: false, enum: ['daily', 'weekly', 'monthly', 'all'] },
  },
  handler: async (args) => {
    const userId = (args['discordUserId'] as string) || 'current';
    const scope = (args['scope'] as any) || 'unified';
    const period = (args['period'] as any) || 'daily';
    await fanResolver.init();
    const { rank, fanGain } = await fanResolver.getUserRank(userId, scope, period);
    return {
      scope,
      period,
      userId,
      fanGain,
      rank,
      summary: `📈 Fan Gain Summary\n\nScope: ${scope}\nPeriod: ${period}\n\nFan Gain:\n${fanGain.toLocaleString()}\n\nCurrent Rank:\n#${rank}\n\nYou are currently ranked #${rank} on today's ${scope} Fan Gain leaderboard.`
    };
  },
};

const getFanLeaderboardTool: ToolDefinition = {
  slug: 'get_fan_leaderboard',
  name: 'Get Fan Leaderboard',
  description: 'Get fan gain leaderboard with user rank prioritized first for umakraft, umakraft2, or unified ecosystems.',
  parameters: {
    discordUserId: { type: 'string', description: 'Discord user ID', required: false },
    query: { type: 'string', description: 'User message query or ecosystem scope', required: false },
  },
  handler: async (args) => {
    const userId = (args['discordUserId'] as string) || 'current';
    const query = (args['query'] as string) || 'leaderboard';
    await fanResolver.init();
    const formatted = await fanResolver.formatLeaderboardResponse(userId, query);
    return { formattedResponse: formatted };
  },
};

const getTrainerStatsTool: ToolDefinition = {
  slug: 'get_trainer_stats',
  name: 'Get Trainer Stats',
  description: 'Get fan count, ranks and tier for a single Uma Musume trainer by numeric trainer id.',
  parameters: {
    trainerId: { type: 'string', description: 'The numeric trainer id (e.g. "123456")', required: true },
  },
  handler: async (args) => {
    const trainerId = String(args['trainerId']);
    logger.info(`get_trainer_stats for ${trainerId}`);
    return fanTrackerAPI.fetchTrainerStats(trainerId);
  },
};

const searchTrainersTool: ToolDefinition = {
  slug: 'search_trainers',
  name: 'Search Trainers',
  description: 'Fuzzy search trainers by name or id and return lightweight matches (name, id, total fans).',
  parameters: {
    query: { type: 'string', description: 'Name or id substring to search', required: true },
  },
  handler: async (args) => {
    const query = String(args['query']).toLowerCase().trim();
    logger.info(`search_trainers for "${query}"`);
    const members = await fanTrackerAPI.fetchAllMembers();
    return members
      .filter((m) => m.trainerName.toLowerCase().includes(query) || m.trainerId.includes(query))
      .slice(0, 10)
      .map((m) => ({ trainerId: m.trainerId, trainerName: m.trainerName, totalFans: m.totalFans }));
  },
};

const getLeaderboardTool: ToolDefinition = {
  slug: 'get_leaderboard',
  name: 'Get Leaderboard',
  description: 'Get ranked trainers by fan gain for a period (daily, weekly, monthly).',
  parameters: {
    period: { type: 'string', description: 'daily, weekly or monthly', required: false, enum: ['daily', 'weekly', 'monthly'] },
    top: { type: 'number', description: 'Number of top trainers (default 10)', required: false },
  },
  handler: async (args) => {
    const period = (args['period'] as string) || 'monthly';
    const top = Number(args['top']) || 10;
    logger.info(`get_leaderboard period=${period} top=${top}`);
    const members = await fanTrackerAPI.fetchAllMembers();
    const sortFn = (a: any, b: any) => {
      if (period === 'daily') return b.dailyGain - a.dailyGain;
      if (period === 'weekly') return (b.gain7d ?? b.weeklyGain) - (a.gain7d ?? a.weeklyGain);
      return b.monthlyFans - a.monthlyFans;
    };
    return [...members].sort(sortFn).slice(0, Math.min(top, members.length)).map((m) => ({
      trainerId: m.trainerId,
      trainerName: m.trainerName,
      dailyGain: m.dailyGain,
      weeklyGain: m.gain7d ?? m.weeklyGain,
      monthlyFans: m.monthlyFans,
      totalFans: m.totalFans,
      clubRankTier: m.clubRankTier,
    }));
  },
};

const getUserProfileTool: ToolDefinition = {
  slug: 'get_user_profile',
  name: 'Get User Profile',
  description: 'Resolve a Discord user id to their linked Uma Musume trainer profile.',
  parameters: {
    discordUserId: { type: 'string', description: 'The Discord user id', required: true },
  },
  handler: async (args) => {
    const discordUserId = String(args['discordUserId']);
    const link = await trainerLinkStore.getByDiscordUser(discordUserId);
    if (!link) return { linked: false, discordUserId };
    const stats = await fanTrackerAPI.fetchTrainerStats(link.trainerId);
    return { linked: true, discordUserId, trainerId: link.trainerId, trainerName: link.trainerName, stats };
  },
};

export const askTools: ToolDefinition[] = [
  getFanGainTool,
  getFanLeaderboardTool,
  getTrainerStatsTool,
  searchTrainersTool,
  getLeaderboardTool,
  getUserProfileTool,
  searchWebTool,
  umamusumePureDbSearch,
];
