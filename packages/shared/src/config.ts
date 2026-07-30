export interface PlatformConfig {
  env: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  redisUrl?: string;
  databaseUrl?: string;
}

export const loadConfig = (): PlatformConfig => {
  return {
    env: process.env['NODE_ENV'] || 'development',
    openaiApiKey: process.env['OPENAI_API_KEY'],
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
    redisUrl: process.env['REDIS_URL'],
    databaseUrl: process.env['DATABASE_URL'],
  };
};
