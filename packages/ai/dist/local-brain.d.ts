export interface LocalBrainConfig {
    /** Directory to store the GGUF model file. Default: /data/models */
    modelDir: string;
    /** Context window size in tokens. Default: 4096 */
    contextSize?: number;
    /** Sampling temperature. Default: 0.7 */
    temperature?: number;
    /** Max output tokens. Default: 512 */
    maxTokens?: number;
    /**
     * Idle timeout in ms before unloading the model from RAM.
     * Default: 180000 (3 minutes). Set to 0 to disable auto-sleep.
     */
    idleTimeoutMs?: number;
}
export declare class LocalBrain {
    #private;
    private model;
    private config;
    private ready;
    private initPromise;
    private idleTimer;
    private lastWakeMemRss;
    constructor(config: LocalBrainConfig);
    init(): Promise<void>;
    /**
     * Unload the model from RAM. The GGUF stays cached on disk.
     * Next prompt() call will auto-wake via init().
     */
    unload(): Promise<void>;
    prompt(userMessage: string, systemMessage?: string): Promise<string>;
    /**
     * Prompt the model with cached data injected into the context.
     *
     * @param taskDescription  What the model should do
     * @param cachedData       Key-value pairs of cached data to include
     * @param outputFormat     "text" = free text, "json" = JSON only, "decision" = yes/no/skip
     */
    promptWithCache(taskDescription: string, cachedData: Record<string, any>, outputFormat?: 'text' | 'json' | 'decision'): Promise<string>;
    /**
     * Use cached fan/leaderboard data to generate a Discord message.
     * Returns null if the model decides nothing is worth reporting.
     */
    generateCachedMessage(scenario: string, cachedData: Record<string, any>): Promise<string | null>;
    /**
     * Force stay awake — clears the idle timer and keeps the model
     * loaded until the next prompt() resets the timer naturally.
     * Call this before a burst of prompts to avoid sleep mid-batch.
     */
    stayAwake(): void;
    isReady(): boolean;
    getMemoryEstimate(): {
        modelFile: string;
        contextTokens: number;
    };
}
/**
 * Get or create the singleton LocalBrain instance.
 * Uses LOCAL_MODEL_DIR env var or defaults to /data/models (Railway volume).
 */
export declare function getLocalBrain(config?: Partial<LocalBrainConfig>): LocalBrain;
//# sourceMappingURL=local-brain.d.ts.map