import { createLogger } from '@ai-agent-platform/shared';
import { resolve } from 'path';
import { existsSync, mkdirSync, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { freemem } from 'os';
const logger = createLogger('LocalBrain');
// ── Model source ──────────────────────────────────────────
// Qwen 2.5 0.5B Instruct — Q3_K_M quantization (~339 MB)
// Downloaded once at first startup, cached in LOCAL_MODEL_DIR
const MODEL_URL = 'https://huggingface.co/bartowski/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/Qwen2.5-0.5B-Instruct-Q3_K_M.gguf';
const MODEL_FILENAME = 'qwen2.5-0.5b-instruct-q3_k_m.gguf';
// ── Prompt templates ──────────────────────────────────────
const DEFAULT_SYSTEM = 'You are a helpful assistant running inside UmaKraft, a Discord bot for tracking Umamusume fan statistics. ' +
    'Keep responses short and direct. When given cached data, use it to answer. ' +
    'When told to generate a message, output exactly the message with no extra text.';
// ── LocalBrain ────────────────────────────────────────────
export class LocalBrain {
    model = null;
    config;
    ready = false;
    initPromise = null;
    idleTimer = null;
    lastWakeMemRss = 0;
    constructor(config) {
        this.config = {
            contextSize: 4096,
            temperature: 0.7,
            maxTokens: 512,
            idleTimeoutMs: 180000, // 3 minutes
            ...config,
        };
    }
    // ── Init (lazy, idempotent) ─────────────────────────────
    async init() {
        if (this.ready)
            return;
        if (this.initPromise)
            return this.initPromise;
        this.initPromise = this.#doInit();
        return this.initPromise;
    }
    async #doInit() {
        const modelPath = resolve(this.config.modelDir, MODEL_FILENAME);
        // ── Memory check before loading ──
        const freeMem = freemem();
        const freeMemMB = Math.round(freeMem / 1024 / 1024);
        const rssBefore = process.memoryUsage().rss;
        const rssBeforeMB = Math.round(rssBefore / 1024 / 1024);
        logger.info(`LocalBrain waking up... free system memory: ${freeMemMB} MB, bot RSS: ${rssBeforeMB} MB`);
        if (freeMem < 500 * 1024 * 1024) {
            logger.warn(`⚠️  MEMORY SPIKE RISK: only ${freeMemMB} MB free. ` +
                `Model needs ~400 MB. Expect swap.`);
        }
        // Download model if not cached
        if (!existsSync(modelPath)) {
            logger.info(`Model not found at ${modelPath}, downloading ${MODEL_FILENAME}...`);
            mkdirSync(this.config.modelDir, { recursive: true });
            await this.#downloadModel(modelPath);
        }
        else {
            logger.info(`Model found at ${modelPath}`);
        }
        // Load model via llama.cpp
        logger.info('Loading Qwen 2.5 0.5B (Q3_K_M) into memory...');
        const { getLlama } = await import('node-llama-cpp');
        const llama = await getLlama({ gpu: false });
        this.model = await llama.loadModel({ modelPath });
        this.ready = true;
        this.lastWakeMemRss = process.memoryUsage().rss;
        const usedMB = Math.round((this.lastWakeMemRss - rssBefore) / 1024 / 1024);
        logger.info(`LocalBrain awake — model loaded (+${usedMB} MB RSS, ` +
            `${this.config.contextSize} ctx tokens, idle timeout: ${this.config.idleTimeoutMs / 1000}s)`);
    }
    // ── Unload (sleep) ─────────────────────────────────────
    /**
     * Unload the model from RAM. The GGUF stays cached on disk.
     * Next prompt() call will auto-wake via init().
     */
    async unload() {
        if (!this.ready || !this.model)
            return;
        this.#clearIdleTimer();
        const rssBefore = process.memoryUsage().rss;
        const rssBeforeMB = Math.round(rssBefore / 1024 / 1024);
        logger.info('LocalBrain going to sleep...');
        this.model = null;
        this.ready = false;
        this.initPromise = null;
        // Hint V8 to collect — the model object graph is large
        if (typeof globalThis.gc === 'function') {
            globalThis.gc();
        }
        // Let event loop flush before measuring RSS (GC is async)
        await new Promise(r => setTimeout(r, 100));
        const rssAfter = process.memoryUsage().rss;
        const freedMB = Math.round((rssBefore - rssAfter) / 1024 / 1024);
        const rssAfterMB = Math.round(rssAfter / 1024 / 1024);
        logger.info(`LocalBrain asleep — freed ~${freedMB} MB, bot RSS: ${rssAfterMB} MB`);
    }
    // ── Idle timer management ─────────────────────────────
    /** Start (or restart) the idle sleep countdown. */
    #resetIdleTimer() {
        this.#clearIdleTimer();
        if (this.config.idleTimeoutMs > 0 && this.ready) {
            this.idleTimer = setTimeout(() => {
                const idleSec = Math.round(this.config.idleTimeoutMs / 1000);
                logger.info(`LocalBrain idle for ${idleSec}s — going to sleep`);
                void this.unload().catch(e => logger.error(`Idle unload failed: ${e.message}`));
            }, this.config.idleTimeoutMs);
            this.idleTimer.unref?.();
        }
    }
    #clearIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }
    async prompt(userMessage, systemMessage) {
        await this.init();
        // Cancel the sleep timer while we're working
        this.#clearIdleTimer();
        // Create a fresh context per call — stateless single-turn prompts.
        // At 0.5B with 4096 ctx, context creation is ~50ms and uses ~30MB.
        // This avoids sequence pool exhaustion and keeps prompts isolated.
        const { LlamaChatSession } = await import('node-llama-cpp');
        const ctx = await this.model.createContext({
            contextSize: this.config.contextSize,
        });
        try {
            const session = new LlamaChatSession({
                contextSequence: ctx.getSequence(),
                systemPrompt: systemMessage || DEFAULT_SYSTEM,
            });
            const reply = await session.prompt(userMessage, {
                temperature: this.config.temperature,
                maxTokens: this.config.maxTokens,
            });
            return reply.trim();
        }
        finally {
            // Free context memory after each call
            await ctx.dispose();
            // Start the idle sleep countdown
            this.#resetIdleTimer();
        }
    }
    // ── Structured prompt with cached data ──────────────────
    /**
     * Prompt the model with cached data injected into the context.
     *
     * @param taskDescription  What the model should do
     * @param cachedData       Key-value pairs of cached data to include
     * @param outputFormat     "text" = free text, "json" = JSON only, "decision" = yes/no/skip
     */
    async promptWithCache(taskDescription, cachedData, outputFormat = 'text') {
        // Build the data block
        const dataBlocks = Object.entries(cachedData)
            .map(([key, value]) => `[${key}]\n${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`)
            .join('\n\n');
        const system = DEFAULT_SYSTEM;
        let formatHint = '';
        switch (outputFormat) {
            case 'json':
                formatHint = '\nRespond with ONLY valid JSON. No markdown, no explanation.';
                break;
            case 'decision':
                formatHint = '\nRespond with exactly ONE word: "yes", "no", or "skip".';
                break;
        }
        const prompt = `TASK: ${taskDescription}${formatHint}\n\nCACHED DATA:\n${dataBlocks}\n\nYour response:`;
        return this.prompt(prompt, system);
    }
    // ── Generate a Discord-ready message from cache ─────────
    /**
     * Use cached fan/leaderboard data to generate a Discord message.
     * Returns null if the model decides nothing is worth reporting.
     */
    async generateCachedMessage(scenario, cachedData) {
        const response = await this.promptWithCache(`Based on the cached data, ${scenario}. ` +
            'If there is nothing notable to report, respond with exactly "SKIP". ' +
            'Otherwise, write the Discord message directly (no formatting instructions needed).', cachedData, 'text');
        if (response.toUpperCase().startsWith('SKIP'))
            return null;
        return response;
    }
    /**
     * Force stay awake — clears the idle timer and keeps the model
     * loaded until the next prompt() resets the timer naturally.
     * Call this before a burst of prompts to avoid sleep mid-batch.
     */
    stayAwake() {
        this.#clearIdleTimer();
        logger.info('LocalBrain stay-awake — idle timer cancelled');
    }
    isReady() {
        return this.ready;
    }
    getMemoryEstimate() {
        return {
            modelFile: '~339 MB',
            contextTokens: this.config.contextSize,
        };
    }
    // ── Download helper ─────────────────────────────────────
    async #downloadModel(destPath) {
        logger.info(`Downloading from HuggingFace: ${MODEL_URL}`);
        const response = await fetch(MODEL_URL, { redirect: 'follow' });
        if (!response.ok) {
            throw new Error(`Model download failed: HTTP ${response.status}`);
        }
        const contentLength = response.headers.get('content-length');
        const totalMB = contentLength ? `${(parseInt(contentLength) / 1024 / 1024).toFixed(0)} MB` : 'unknown size';
        logger.info(`Downloading ${totalMB} to ${destPath}...`);
        const fileStream = createWriteStream(destPath);
        if (!response.body) {
            throw new Error('No response body for model download');
        }
        // Node.js fetch returns a web ReadableStream — pipe it
        const nodeStream = Readable.fromWeb(response.body);
        await pipeline(nodeStream, fileStream);
        logger.info('Model download complete.');
    }
}
// ── Singleton factory ─────────────────────────────────────
let brainInstance = null;
/**
 * Get or create the singleton LocalBrain instance.
 * Uses LOCAL_MODEL_DIR env var or defaults to /data/models (Railway volume).
 */
export function getLocalBrain(config) {
    if (!brainInstance) {
        const modelDir = process.env['LOCAL_MODEL_DIR'] || '/data/models';
        const idleTimeoutEnv = process.env['LOCAL_BRAIN_IDLE_TIMEOUT'];
        const idleTimeoutMs = idleTimeoutEnv ? parseInt(idleTimeoutEnv, 10) : undefined;
        brainInstance = new LocalBrain({ modelDir, idleTimeoutMs, ...config });
        logger.info(`LocalBrain instance created — model dir: ${modelDir}`);
    }
    return brainInstance;
}
//# sourceMappingURL=local-brain.js.map