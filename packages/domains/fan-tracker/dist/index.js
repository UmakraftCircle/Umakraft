import { createLogger } from '@ai-agent-platform/shared';
import { fanTrackerAPI } from './infrastructure.js';
const logger = createLogger('FanTrackerDomain');
export const fanTrackerFetchStats = {
    slug: 'fan-tracker-fetch-stats',
    name: 'Fan Tracker: Fetch Stats',
    description: 'Gathers and updates total fan count, support cards, and current points of an Umamusume Trainer ID.',
    parameters: {
        trainerId: {
            type: 'string',
            description: 'The alpha-numeric ID of the registered game trainer',
            required: true
        }
    },
    handler: async (args) => {
        const trainerId = args['trainerId'];
        logger.info(`Fetching fan tracker metrics from API for trainer: ${trainerId}`);
        const stats = await fanTrackerAPI.fetchTrainerStats(trainerId);
        return stats;
    }
};
export const fanTrackerAnalyzeTrends = {
    slug: 'fan-tracker-analyze-trends',
    name: 'Fan Tracker: Analyze Trends',
    description: 'Calculates active fan dynamics, growth trajectories, and recommends optimization targets.',
    parameters: {
        trainerId: {
            type: 'string',
            description: 'Trainer ID to analyze',
            required: false
        },
        metrics: {
            type: 'array',
            description: 'The list of metric names to feed into the analytical algorithm',
            required: false
        },
        period: {
            type: 'string',
            description: 'Analysis period: daily, weekly, monthly (default: weekly)',
            required: false
        }
    },
    handler: async (args) => {
        const metrics = args['metrics'] || [];
        const trainerId = args['trainerId'] || 'trainer-99';
        const period = args['period'] || 'weekly';
        logger.info(`Running trend analysis for trainer ${trainerId} [${period}], metrics:`, metrics);
        const analysis = await fanTrackerAPI.analyzeTrends(trainerId, period);
        return { ...analysis, metricsRequested: metrics };
    }
};
export const allDomainTools = [fanTrackerFetchStats, fanTrackerAnalyzeTrends];
export * from './infrastructure.js';
//# sourceMappingURL=index.js.map