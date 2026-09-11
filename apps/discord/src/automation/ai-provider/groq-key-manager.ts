import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('GroqKeyManager');

export interface GroqKeyState {
  keyIndex: number;
  key: string;
  maskedKey: string;
  healthy: boolean;
  failCount: number;
  successCount: number;
  cooldownUntil: number | null;
  lastUsedAt: number | null;
  lastError: string | null;
}

/**
 * GroqKeyManager — High-performance multi-key manager for Groq.
 * Supports 1 to 6 keys with round-robin rotation and instant failover.
 * (Cooldown system completely removed per optimization directives).
 */
export class GroqKeyManager {
  private keyStates: GroqKeyState[] = [];
  private roundRobinPointer = 0;

  constructor() {
    this.loadKeys();
  }

  public loadKeys(): void {
    const rawEnv = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '';
    const parsed = rawEnv
      .split(/[\n,;]+/)
      .map((k) => k.replace(/^["'`\s]+|["'`\s]+$/g, '').trim())
      .filter((k) => k.length > 0 && !k.startsWith('#'));

    // Enforce 1–6 keys max
    const validKeys = parsed.slice(0, 6);

    this.keyStates = validKeys.map((key, index) => ({
      keyIndex: index + 1, // 1-indexed (Key 1 to Key 6)
      key,
      maskedKey: key.length > 8 ? `${key.substring(0, 6)}...${key.substring(key.length - 4)}` : '***',
      healthy: true,
      failCount: 0,
      successCount: 0,
      cooldownUntil: null, // cooldowns removed
      lastUsedAt: null,
      lastError: null,
    }));

    if (this.keyStates.length === 0) {
      logger.warn('[LilyChatService] No valid keys found in GROQ_API_KEYS or GROQ_API_KEY. Emergency mode will activate if AI is requested.');
    } else {
      const maskedList = this.keyStates.map((k) => `Key ${k.keyIndex}: ${k.maskedKey}`).join(', ');
      logger.info(`[LilyChatService] Loaded ${this.keyStates.length} Groq API keys (${maskedList}).`);
    }
  }

  public getKeyCount(): number {
    if (this.keyStates.length === 0) {
      this.loadKeys();
    }
    return this.keyStates.length;
  }

  /**
   * Round Robin selection across available keys.
   */
  public getNextKey(): GroqKeyState | null {
    if (this.keyStates.length === 0) {
      this.loadKeys();
    }
    if (this.keyStates.length === 0) return null;

    const selected = this.keyStates[this.roundRobinPointer];
    this.roundRobinPointer = (this.roundRobinPointer + 1) % this.keyStates.length;
    return selected;
  }

  /**
   * Selects an alternative key for failover excluding a failed key.
   */
  public getFailoverKey(excludeKeyIndex: number): GroqKeyState | null {
    if (this.keyStates.length <= 1) return null;

    for (const state of this.keyStates) {
      if (state.keyIndex !== excludeKeyIndex) {
        return state;
      }
    }
    return null;
  }

  /**
   * Records successful response for the key.
   */
  public recordSuccess(keyIndex: number): void {
    const state = this.keyStates.find((k) => k.keyIndex === keyIndex);
    if (state) {
      state.successCount++;
      state.lastUsedAt = Date.now();
      state.healthy = true;
      state.lastError = null;
    }
  }

  /**
   * Records failure for the key without locking it out or applying cooldowns.
   */
  public recordFailure(keyIndex: number, errorMsg: string): void {
    const state = this.keyStates.find((k) => k.keyIndex === keyIndex);
    if (state) {
      state.failCount++;
      state.lastUsedAt = Date.now();
      state.lastError = errorMsg;
      logger.warn(`[GroqKeyManager] Key ${keyIndex} (${state.maskedKey}) encountered failure: ${errorMsg}`);
    }
  }

  public getAllKeyStates(): GroqKeyState[] {
    return this.keyStates.map((s) => ({ ...s }));
  }
}
