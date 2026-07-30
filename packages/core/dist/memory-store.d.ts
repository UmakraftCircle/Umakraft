import type { FailureObservation, AdaptationRule } from './learning.js';
/**
 * Persistent Memory Store backed by SQLite.
 *
 * Survives process restarts — the Learning Engine's observations and
 * adaptation rules persist across deployments so lessons are never lost.
 */
export declare class MemoryStore {
    private static instance;
    static getInstance(): MemoryStore;
    private constructor();
    /**
     * Persist a failure observation to durable storage.
     */
    saveObservation(obs: FailureObservation): Promise<void>;
    /**
     * Load all failure observations from disk.
     */
    loadObservations(): Promise<FailureObservation[]>;
    /**
     * Get failure stats per tool — useful for targeted debugging.
     */
    getToolFailureStats(): Promise<Array<{
        toolSlug: string;
        count: number;
        lastSeen: string;
    }>>;
    /**
     * Persist an adaptation rule (upsert — increment occurrences if exists).
     */
    saveRule(rule: AdaptationRule): Promise<void>;
    /**
     * Load all adaptation rules from disk, sorted by occurrence frequency.
     */
    loadRules(): Promise<AdaptationRule[]>;
    /**
     * Load the complete system memory: observations + rules.
     * Called once during LearningEngine initialization.
     */
    loadAll(): Promise<{
        observations: FailureObservation[];
        rules: AdaptationRule[];
    }>;
    /**
     * Purge all learning data (useful for resetting during development).
     */
    reset(): Promise<void>;
}
//# sourceMappingURL=memory-store.d.ts.map