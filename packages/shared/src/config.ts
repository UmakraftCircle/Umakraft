import { createLogger } from './logger.js';

const logger = createLogger('Config');

export interface PlatformConfig {
  env: 'development' | 'production' | 'test';
  openaiApiKey?: string;
  anthropicApiKey?: string;
  redisUrl?: string;
  databaseUrl?: string;
}

export const loadConfig = (): PlatformConfig => {
  const env = process.env['NODE_ENV'] || 'development';

  // Core API keys — warn if missing in production
  const missing: string[] = [];
  if (!process.env['OPENAI_API_KEY'] && !process.env['ANTHROPIC_API_KEY']) {
    missing.push('OPENAI_API_KEY or ANTHROPIC_API_KEY');
  }
  if (missing.length > 0 && env !== 'test') {
    logger.warn(`Missing env vars (some features disabled): ${missing.join(', ')}`);
  }

  return {
    env,
    openaiApiKey: process.env['OPENAI_API_KEY'],
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
    redisUrl: process.env['REDIS_URL'],
    databaseUrl: process.env['DATABASE_URL'],
  };
};
