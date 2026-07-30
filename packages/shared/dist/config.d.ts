export interface PlatformConfig {
    env: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    redisUrl?: string;
    databaseUrl?: string;
}
export declare const loadConfig: () => PlatformConfig;
//# sourceMappingURL=config.d.ts.map